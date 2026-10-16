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
    const {
      claimTicket,
      sessionId: directSessionId,
      fullName,
      trackNo,
      level,
      schoolId,
      facultyId,
      departmentId,
      termsAccepted,
      privacyAccepted,
    } = body

    if (!fullName || fullName.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Full name must be at least 2 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!trackNo || !trackNo.trim()) {
      return new Response(JSON.stringify({ error: 'Track / Student ID number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    // Verify session
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

    // Check track_no uniqueness
    const { data: existingTrack } = await adminClient
      .from('profiles')
      .select('id')
      .eq('track_no', trackNo.trim())
      .neq('id', user.id)
      .maybeSingle()

    if (existingTrack) {
      return new Response(JSON.stringify({ error: 'This Track / Student ID is already registered by another user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch names for school, faculty, department
    let schoolName = session.school_name || ''
    let facultyName = ''
    let departmentName = ''

    if (schoolId) {
      const { data: s } = await adminClient.from('schools').select('name').eq('id', schoolId).single()
      if (s?.name) schoolName = s.name
    }
    if (facultyId) {
      const { data: f } = await adminClient.from('faculties').select('name').eq('id', facultyId).single()
      if (f?.name) facultyName = f.name
    }
    if (departmentId) {
      const { data: d } = await adminClient.from('departments').select('name').eq('id', departmentId).single()
      if (d?.name) departmentName = d.name
    }

    // 1. Update profile
    const { error: profileUpdateErr } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        track_no: trackNo.trim(),
        level: level || null,
        school_id: schoolId || null,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
        role: 'student',
        registered: true,
      })
      .eq('id', user.id)

    if (profileUpdateErr) throw profileUpdateErr

    // 2. Record consent if provided
    const userAgent = req.headers.get('user-agent') || ''
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    let ipHash = ''
    if (forwardedFor) {
      const clientIp = forwardedFor.split(',')[0].trim()
      const ipBuf = await crypto.subtle.digest('SHA-256', enc.encode(`salt_${clientIp}`))
      ipHash = Array.from(new Uint8Array(ipBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
    }

    if (privacyAccepted) {
      await adminClient.from('consents').insert({
        user_id: user.id,
        doc_type: 'privacy',
        version: '1.0',
        user_agent: userAgent,
        ip_hash: ipHash,
      })
    }
    if (termsAccepted) {
      await adminClient.from('consents').insert({
        user_id: user.id,
        doc_type: 'terms',
        version: '1.0',
        user_agent: userAgent,
        ip_hash: ipHash,
      })
    }

    // 3. Mark attendance with snapshot
    const { data: attendanceRecord, error: insertErr } = await adminClient
      .from('attendance')
      .insert({
        session_id: session.id,
        student_id: user.id,
        full_name: fullName.trim(),
        track_no: trackNo.trim(),
        level: level || '',
        school_name: schoolName,
        faculty_name: facultyName,
        department_name: departmentName,
        entry_type: 'qr',
      })
      .select()
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: 'Attendance already marked for this session', code: 'ALREADY_MARKED' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw insertErr
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registered and attendance recorded successfully',
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
