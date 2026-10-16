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
    const { claimTicket, sessionId: directSessionId } = body

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

    // Check session
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

    // Fetch user profile with names
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('id, full_name, track_no, level, school_id, faculty_id, department_id, registered, schools(name), faculties(name), departments(name)')
      .eq('id', user.id)
      .single()

    if (profErr || !profile || !profile.registered) {
      return NextResponse.json({ error: 'User profile is not registered. Please complete registration first.' }, { status: 400 })
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
        return NextResponse.json({ error: 'Attendance has already been marked for this session', code: 'ALREADY_MARKED' }, { status: 409 })
      }
      throw insertErr
    }

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully',
      attendance: attendanceRecord,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
