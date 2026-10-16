import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classKey: string }> }
) {
  try {
    const { classKey: rawClassKey } = await params
    const classKey = decodeURIComponent(rawClassKey)

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    // Check caller permission
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    // Fetch sessions
    let sessionsQuery = adminClient
      .from('sessions')
      .select('id, name, course_code, session_date, created_by')
      .or(`course_code.eq.${classKey},name.eq.${classKey}`)

    if (!isAdmin) {
      sessionsQuery = sessionsQuery.eq('created_by', user.id)
    }

    const { data: sessions, error: sessErr } = await sessionsQuery
    if (sessErr || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No sessions found for this course' }, { status: 404 })
    }

    const sessionIds = sessions.map(s => s.id)

    // Fetch attendance records
    const { data: attendanceList, error: attErr } = await adminClient
      .from('attendance')
      .select('*')
      .in('session_id', sessionIds)
      .order('marked_at', { ascending: true })

    if (attErr) throw attErr

    // Helper to sanitize formula injection (Section 9.1)
    const sanitizeCsvCell = (val: any) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        return `'${str}`
      }
      return str
    }

    // Build CSV rows
    const rows = (attendanceList || []).map(att => {
      const parentSession = sessions.find(s => s.id === att.session_id)
      return {
        'Class': sanitizeCsvCell(parentSession?.name || ''),
        'Course Code': sanitizeCsvCell(parentSession?.course_code || ''),
        'Session Date': sanitizeCsvCell(parentSession?.session_date || ''),
        'Full Name': sanitizeCsvCell(att.full_name),
        'Track No': sanitizeCsvCell(att.track_no),
        'Level': sanitizeCsvCell(att.level || ''),
        'Faculty': sanitizeCsvCell(att.faculty_name || ''),
        'Department': sanitizeCsvCell(att.department_name || ''),
        'Status': 'Present',
        'Time Marked': new Date(att.marked_at).toLocaleTimeString('en-GB'),
        'Entry Type': att.entry_type === 'manual' ? 'Manual' : 'QR',
      }
    })

    const csvContent = Papa.unparse(rows, {
      quotes: true,
      header: true,
    })

    const safeFilename = classKey.replace(/[^a-zA-Z0-9_-]/g, '_')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}_attendance_report.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
