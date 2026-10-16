import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let res = 0
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return res === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: please sign in first' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { claimTicket, sessionId: directSessionId } = body

    let targetSessionId = directSessionId

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const enc = new TextEncoder()

    if (claimTicket) {
      const parts = claimTicket.split('.')
      if (parts.length !== 2) {
        return new Response(JSON.stringify({ error: 'Malformed claim ticket' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const [claimB64, sig] = parts
      const serverTicketKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(supabaseServiceKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const expectedSigBuf = await crypto.subtle.sign('HMAC', serverTicketKey, enc.encode(claimB64))
      const expectedSigHex = Array.from(new Uint8Array(expectedSigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32)

      if (!timingSafeEqual(sig, expectedSigHex)) {
        return new Response(JSON.stringify({ error: 'Invalid claim ticket signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const payload = JSON.parse(atob(claimB64))
      const now = Math.floor(Date.now() / 1000)

      if (payload.exp < now) {
        return new Response(JSON.stringify({ error: 'Claim ticket expired. Please scan the QR code again.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (payload.sub !== user.id) {
        return new Response(JSON.stringify({ error: 'Claim ticket belongs to a different user' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      targetSessionId = payload.sid
    }

    if (!targetSessionId) {
      return new Response(JSON.stringify({ error: 'Missing session ID or ticket' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check session
    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select('id, name, status, expires_at, school_name')
      .eq('id', targetSessionId)
      .single()

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (session.status === 'ended') {
      return new Response(JSON.stringify({ error: 'Session has ended' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'Session has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch user profile
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('id, full_name, track_no, level, school_id, faculty_id, department_id, registered, schools(name), faculties(name), departments(name)')
      .eq('id', user.id)
      .single()

    if (profErr || !profile || !profile.registered) {
      return new Response(JSON.stringify({ error: 'User profile is not registered. Please complete registration first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const schoolName = (profile.schools as any)?.name || session.school_name || ''
    const facultyName = (profile.faculties as any)?.name || ''
    const departmentName = (profile.departments as any)?.name || ''

    // Insert attendance snapshot
    const { data: attendanceRecord, error: insertErr } = await adminClient
      .from('attendance')
      .insert({
        session_id: session.id,
        student_id: user.id,
        full_name: profile.full_name || 'Anonymous',
        track_no: profile.track_no || 'N/A',
        level: profile.level || '',
        school_name: schoolName,
        faculty_name: facultyName,
        department_name: departmentName,
        entry_type: 'qr',
      })
      .select()
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: 'Attendance has already been marked for this session', code: 'ALREADY_MARKED' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw insertErr
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Attendance recorded successfully',
        attendance: attendanceRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
