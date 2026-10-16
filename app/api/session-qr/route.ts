import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQrPayload } from '@/lib/qr'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Check user profile for admin / ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, name, created_by, status, rotating, qr_secret, expires_at')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const isOwner = session.created_by === user.id
    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: only session owner or admin can view QR' }, { status: 403 })
    }

    if (session.status === 'ended') {
      return NextResponse.json({ error: 'Session has ended' }, { status: 410 })
    }

    const now = Math.floor(Date.now() / 1000)
    const { payload, window } = await generateQrPayload(session.id, session.qr_secret, session.rotating, now)
    const secondsRemaining = session.rotating ? 30 - (now % 30) : null

    return NextResponse.json({
      payload,
      window,
      secondsRemaining,
      status: session.status,
      expiresAt: session.expires_at,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
