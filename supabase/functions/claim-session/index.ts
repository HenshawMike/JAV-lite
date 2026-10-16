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
      return new Response(JSON.stringify({ error: 'Unauthorized: please sign in with Google first' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { code } = await req.json()
    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid QR code string is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parts = code.trim().split('.')
    if (parts.length !== 4 || parts[0] !== 'JAV1') {
      return new Response(JSON.stringify({ error: 'This is not a valid JAV Lite QR code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sessionId = parts[1]
    const windowNum = parseInt(parts[2], 10)
    const clientSig = parts[3]

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select('id, name, course_code, description, host_name, school_name, session_date, kind, status, rotating, qr_secret, expires_at')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (session.status === 'ended') {
      return new Response(JSON.stringify({ error: 'This session has ended and is no longer accepting attendance.' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = Math.floor(Date.now() / 1000)
    if (new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'This session has expired.' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify HMAC
    const currentWin = Math.floor(now / 30)
    if (session.rotating) {
      const isCurrent = windowNum === currentWin
      const isPrev = windowNum === currentWin - 1
      if (!isCurrent && !isPrev) {
        return new Response(JSON.stringify({ error: 'This QR code has rotated and expired. Please scan the current code on screen.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      if (windowNum !== 0) {
        return new Response(JSON.stringify({ error: 'Invalid window for static session' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const enc = new TextEncoder()
    const keyData = enc.encode(session.qr_secret)
    const msgData = enc.encode(`${session.id}.${windowNum}`)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
    const sigHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)

    if (!timingSafeEqual(clientSig, sigHex)) {
      return new Response(JSON.stringify({ error: 'Invalid QR signature for this session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if student is already marked
    const { data: existingAttendance } = await adminClient
      .from('attendance')
      .select('id, marked_at')
      .eq('session_id', sessionId)
      .eq('student_id', user.id)
      .maybeSingle()

    // Fetch user profile status
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, track_no, level, school_id, faculty_id, department_id, registered')
      .eq('id', user.id)
      .single()

    // Generate signed 10-minute Claim Ticket
    const claimExpiry = now + 600 // 10 minutes
    const jti = crypto.randomUUID()
    const claimPayload = {
      jti,
      sub: user.id,
      sid: session.id,
      iat: now,
      exp: claimExpiry,
    }

    const claimB64 = btoa(JSON.stringify(claimPayload))
    const serverTicketKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(supabaseServiceKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const ticketSigBuf = await crypto.subtle.sign('HMAC', serverTicketKey, enc.encode(claimB64))
    const ticketSigHex = Array.from(new Uint8Array(ticketSigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)

    const claimTicket = `${claimB64}.${ticketSigHex}`

    return new Response(
      JSON.stringify({
        success: true,
        claimTicket,
        claimExpiresAt: claimExpiry,
        alreadyMarked: !!existingAttendance,
        markedAt: existingAttendance?.marked_at || null,
        session: {
          id: session.id,
          name: session.name,
          courseCode: session.course_code,
          description: session.description,
          hostName: session.host_name,
          schoolName: session.school_name,
          sessionDate: session.session_date,
          kind: session.kind,
        },
        profile: profile || null,
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
