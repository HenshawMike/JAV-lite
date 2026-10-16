import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, studentId, fullName, trackNo, level, reason, action } = body

    if (!sessionId || !fullName || !trackNo) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    // Check caller permission (Session owner or admin)
    const { data: session } = await adminClient
      .from('sessions')
      .select('id, name, created_by, school_name')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const isOwner = session.created_by === user.id
    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (action === 'manual_add') {
      const targetStudentId = studentId || crypto.randomUUID()

      // 1. Insert or update attendance record
      const { data: attRecord, error: attErr } = await adminClient
        .from('attendance')
        .insert({
          session_id: session.id,
          student_id: targetStudentId,
          full_name: fullName.trim(),
          track_no: trackNo.trim(),
          level: level || '',
          school_name: session.school_name,
          entry_type: 'manual',
        })
        .select()
        .single()

      if (attErr) {
        if (attErr.code === '23505') {
          return NextResponse.json({ error: 'Student already marked for this session' }, { status: 409 })
        }
        throw attErr
      }

      // 2. Insert audit log in attendance_audit
      await adminClient.from('attendance_audit').insert({
        attendance_id: attRecord.id,
        session_id: session.id,
        student_id: targetStudentId,
        action: 'manual_add',
        changed_by: user.id,
        reason: reason || 'Added manually by host',
        new_data: attRecord,
      })

      return NextResponse.json({
        success: true,
        message: 'Student manually added to attendance with audit log.',
        attendance: attRecord,
      })
    } else if (action === 'manual_remove') {
      // Remove record and log
      const { data: existingAtt } = await adminClient
        .from('attendance')
        .select('*')
        .eq('session_id', session.id)
        .eq('student_id', studentId)
        .single()

      if (existingAtt) {
        await adminClient
          .from('attendance')
          .delete()
          .eq('id', existingAtt.id)

        await adminClient.from('attendance_audit').insert({
          attendance_id: existingAtt.id,
          session_id: session.id,
          student_id: studentId,
          action: 'manual_remove',
          changed_by: user.id,
          reason: reason || 'Removed manually by host',
          old_data: existingAtt,
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Attendance record removed with audit log.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
