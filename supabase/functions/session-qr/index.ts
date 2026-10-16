import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Client with user's JWT to verify caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { sessionId } = await req.json()
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client to read session secret
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check caller role or ownership
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select('id, name, created_by, status, rotating, qr_secret, expires_at')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isOwner = session.created_by === user.id
    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: only session owner or admin can view QR' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (session.status === 'ended') {
      return new Response(JSON.stringify({ error: 'Session has ended' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate window and HMAC
    const now = Math.floor(Date.now() / 1000)
    const windowNum = session.rotating ? Math.floor(now / 30) : 0
    const message = `${session.id}.${windowNum}`

    const enc = new TextEncoder()
    const keyData = enc.encode(session.qr_secret)
    const msgData = enc.encode(message)

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

    const qrPayload = `JAV1.${session.id}.${windowNum}.${sigHex}`
    const secondsRemainingInWindow = session.rotating ? 30 - (now % 30) : null

    return new Response(
      JSON.stringify({
        payload: qrPayload,
        window: windowNum,
        secondsRemaining: secondsRemainingInWindow,
        status: session.status,
        expiresAt: session.expires_at,
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
