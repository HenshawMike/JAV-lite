import { NextResponse } from 'next/server'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerBanner: {
    borderBottomWidth: 2,
    borderBottomColor: '#C41EBB',
    paddingBottom: 12,
    marginBottom: 16,
  },
  institutionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  reportSubtitle: {
    fontSize: 11,
    color: '#C41EBB',
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaCol: {
    width: '50%',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  metaValue: {
    fontSize: 9,
    color: '#0f172a',
    fontFamily: 'Helvetica-Bold',
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#C41EBB',
  },
  statDesc: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  table: {
    width: '100%',
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#334155',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 6,
    fontSize: 8,
  },
  colNum: { width: '8%' },
  colName: { width: '36%' },
  colTrack: { width: '24%' },
  colDept: { width: '20%' },
  colTime: { width: '12%', textAlign: 'right' },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
})

interface EventReportPdfProps {
  eventName: string
  sessionDate: string
  schoolName: string
  hostName: string
  totalAttendees: number
  generatedAt: string
  attendees: Array<{
    sn: number
    name: string
    trackNo: string
    dept: string
    time: string
    entryType: string
  }>
}

function EventReportDocument({
  eventName,
  sessionDate,
  schoolName,
  hostName,
  totalAttendees,
  generatedAt,
  attendees,
}: EventReportPdfProps) {
  return (
    <Document title={`${eventName} Attendance Report`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBanner}>
          <Text style={styles.institutionTitle}>{schoolName || 'OFFICIAL EVENT ATTENDANCE REPORT'}</Text>
          <Text style={styles.reportSubtitle}>{eventName}</Text>
        </View>

        {/* Metadata */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Event Name</Text>
            <Text style={styles.metaValue}>{eventName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{sessionDate || 'N/A'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Host / Organizer</Text>
            <Text style={styles.metaValue}>{hostName || 'Admin'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Generated On</Text>
            <Text style={styles.metaValue}>{generatedAt}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalAttendees}</Text>
            <Text style={styles.statDesc}>Total Confirmed Attendees</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNum}>S/N</Text>
            <Text style={styles.colName}>Student Name</Text>
            <Text style={styles.colTrack}>Track / Matric No</Text>
            <Text style={styles.colDept}>Department</Text>
            <Text style={styles.colTime}>Time Marked</Text>
          </View>

          {attendees.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ width: '100%', textAlign: 'center', color: '#94a3b8', padding: 8 }}>
                No attendance records marked for this event.
              </Text>
            </View>
          ) : (
            attendees.map(a => (
              <View key={a.sn} style={styles.tableRow}>
                <Text style={styles.colNum}>{a.sn}</Text>
                <Text style={styles.colName}>{a.name}</Text>
                <Text style={styles.colTrack}>{a.trackNo}</Text>
                <Text style={styles.colDept}>{a.dept}</Text>
                <Text style={styles.colTime}>{a.time}</Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Certified Official Attendance Record</Text>
          <Text style={styles.footerText}>{generatedAt}</Text>
        </View>
      </Page>
    </Document>
  )
}

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

    // Fetch event session from sessions or fallback events
    let eventName = 'Event'
    let sessionDate = ''
    let schoolName = ''
    let hostName = ''

    const { data: session } = await adminClient
      .from('sessions')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (session) {
      eventName = session.name
      sessionDate = session.session_date
      schoolName = session.school_name || ''
      hostName = session.host_name || ''
    } else {
      const { data: legacyEv } = await adminClient
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle()
      if (legacyEv) {
        eventName = legacyEv.name
        sessionDate = legacyEv.date
      }
    }

    // Fetch attendance records
    const { data: attendanceList, error: attErr } = await adminClient
      .from('attendance')
      .select('*')
      .or(`session_id.eq.${eventId},event_id.eq.${eventId}`)
      .order('marked_at', { ascending: true })

    if (attErr) throw attErr

    const attendees = (attendanceList || []).map((att, idx) => ({
      sn: idx + 1,
      name: att.full_name,
      trackNo: att.track_no,
      dept: att.department_name || att.faculty_name || '—',
      time: new Date(att.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      entryType: att.entry_type || 'qr',
    }))

    const pdfBuffer = await renderToBuffer(
      <EventReportDocument
        eventName={eventName}
        sessionDate={sessionDate}
        schoolName={schoolName}
        hostName={hostName}
        totalAttendees={attendees.length}
        generatedAt={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        attendees={attendees}
      />
    )

    const safeFilename = eventName.replace(/[^a-zA-Z0-9_-]/g, '_')

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}_attendance_report.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: err.message || 'PDF generation failed' }, { status: 500 })
  }
}
