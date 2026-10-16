import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { parseQrPayload, verifyQrCode, createClaimTicket } from '@/lib/qr'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized: please sign in first' }, { status: 401 })
    }

    const { code } = await request.json()
    const parsed = parseQrPayload(code)

    if (!parsed) {
      return NextResponse.json({ error: 'This is not a valid JAV Lite QR code' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select('id, name, course_code, description, host_name, school_name, session_date, kind, status, rotating, qr_secret, expires_at')
      .eq('id', parsed.sessionId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'ended') {
      return NextResponse.json({ error: 'This session has ended and is no longer accepting attendance.' }, { status: 410 })
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This session has expired.' }, { status: 410 })
    }

    const verification = await verifyQrCode(parsed, session.qr_secret, session.rotating)
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason || 'Invalid QR code' }, { status: 400 })
    }

    // Check if student already marked
    const { data: existingAttendance } = await adminClient
      .from('attendance')
      .select('id, marked_at')
      .eq('session_id', session.id)
      .eq('student_id', user.id)
      .maybeSingle()

    // Fetch user profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, track_no, level, school_id, faculty_id, department_id, registered')
      .eq('id', user.id)
      .single()

    // Generate signed claim ticket
    const { ticket, expiresAt } = await createClaimTicket(user.id, session.id, serviceRoleKey)

    return NextResponse.json({
      success: true,
      claimTicket: ticket,
      claimExpiresAt: expiresAt,
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
