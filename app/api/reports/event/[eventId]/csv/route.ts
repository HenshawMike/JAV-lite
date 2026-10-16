import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

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
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Fetch event session from sessions (or fallback events)
    let eventTitle = 'Event'
    let eventDate = ''
    let schoolName = ''

    const { data: session } = await adminClient
      .from('sessions')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (session) {
      eventTitle = session.name
      eventDate = session.session_date
      schoolName = session.school_name || ''
    } else {
      const { data: legacyEv } = await adminClient
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle()
      if (legacyEv) {
        eventTitle = legacyEv.name
        eventDate = legacyEv.date
      }
    }

    // Fetch attendance records
    const { data: attendanceList, error: attErr } = await adminClient
      .from('attendance')
      .select('*')
      .or(`session_id.eq.${eventId},event_id.eq.${eventId}`)
      .order('marked_at', { ascending: true })

    if (attErr) throw attErr

    const sanitizeCsvCell = (val: any) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        return `'${str}`
      }
      return str
    }

    const rows = (attendanceList || []).map((att, idx) => ({
      'S/N': idx + 1,
      'Event Name': sanitizeCsvCell(eventTitle),
      'Event Date': sanitizeCsvCell(eventDate),
      'Full Name': sanitizeCsvCell(att.full_name),
      'Track No / Matric': sanitizeCsvCell(att.track_no),
      'Level': sanitizeCsvCell(att.level || '—'),
      'Faculty': sanitizeCsvCell(att.faculty_name || '—'),
      'Department': sanitizeCsvCell(att.department_name || '—'),
      'Status': 'Present',
      'Time Marked': new Date(att.marked_at).toLocaleTimeString('en-GB'),
      'Entry Type': att.entry_type === 'manual' ? 'Manual' : 'QR Scan',
    }))

    const csvContent = Papa.unparse(rows, {
      quotes: true,
      header: true,
    })

    const safeFilename = eventTitle.replace(/[^a-zA-Z0-9_-]/g, '_')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}_attendance_${eventDate || 'report'}.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
