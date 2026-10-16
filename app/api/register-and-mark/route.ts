import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyClaimTicket } from '@/lib/qr'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized: please sign in first' }, { status: 401 })
    }

    const body = await request.json()
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
      return NextResponse.json({ error: 'Full name must be at least 2 characters' }, { status: 400 })
    }

    if (!trackNo || !trackNo.trim()) {
      return NextResponse.json({ error: 'Track / Student ID number is required' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    let targetSessionId = directSessionId

    if (claimTicket) {
      const ticketCheck = await verifyClaimTicket(claimTicket, serviceRoleKey)
      if (!ticketCheck.valid || !ticketCheck.payload) {
        return NextResponse.json({ error: ticketCheck.reason || 'Invalid claim ticket' }, { status: 400 })
      }

      if (ticketCheck.payload.sub !== user.id) {
        return NextResponse.json({ error: 'Claim ticket belongs to a different user' }, { status: 403 })
      }

      targetSessionId = ticketCheck.payload.sid
    }

    if (!targetSessionId) {
      return NextResponse.json({ error: 'Missing session ID or ticket' }, { status: 400 })
    }

    // Verify session
    const { data: session, error: sessionErr } = await adminClient
      .from('sessions')
      .select('id, name, status, expires_at, school_name')
      .eq('id', targetSessionId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'ended') {
      return NextResponse.json({ error: 'Session has ended' }, { status: 410 })
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Session has expired' }, { status: 410 })
    }

    // Check track_no uniqueness
    const { data: existingTrack } = await adminClient
      .from('profiles')
      .select('id')
      .eq('track_no', trackNo.trim())
      .neq('id', user.id)
      .maybeSingle()

    if (existingTrack) {
      return NextResponse.json({ error: 'This Track / Student ID is already registered by another user' }, { status: 400 })
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

    // 2. Record consent
    const userAgent = request.headers.get('user-agent') || ''
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    let ipHash = ''
    if (forwardedFor) {
      const clientIp = forwardedFor.split(',')[0].trim()
      const enc = new TextEncoder()
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
        return NextResponse.json({ error: 'Attendance already marked for this session', code: 'ALREADY_MARKED' }, { status: 409 })
      }
      throw insertErr
    }

    return NextResponse.json({
      success: true,
      message: 'Registered and attendance recorded successfully',
      attendance: attendanceRecord,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
