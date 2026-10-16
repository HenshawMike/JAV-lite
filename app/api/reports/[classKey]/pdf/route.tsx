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
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
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
    padding: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 5,
    fontSize: 8,
  },
  colNum: { width: '6%' },
  colName: { width: '38%' },
  colTrack: { width: '22%' },
  colDept: { width: '18%' },
  colAtt: { width: '8%', textAlign: 'center' },
  colPct: { width: '8%', textAlign: 'right' },
  methodBox: {
    padding: 8,
    backgroundColor: '#faf5ff',
    borderLeftWidth: 3,
    borderLeftColor: '#C41EBB',
    marginTop: 10,
    marginBottom: 16,
  },
  methodText: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.3,
  },
  signOffContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 10,
  },
  signOffBox: {
    width: '30%',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingTop: 4,
    alignItems: 'center',
  },
  signOffRole: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  signOffDate: {
    fontSize: 7,
    color: '#64748b',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
    fontSize: 7,
    color: '#94a3b8',
  },
})

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

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    let sessionsQuery = adminClient
      .from('sessions')
      .select('*')
      .or(`course_code.eq.${classKey},name.eq.${classKey}`)
      .order('session_date', { ascending: true })

    if (!isAdmin) {
      sessionsQuery = sessionsQuery.eq('created_by', user.id)
    }

    const { data: sessions } = await sessionsQuery
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No sessions found for class' }, { status: 404 })
    }

    const sessionIds = sessions.map(s => s.id)
    const { data: attendanceList } = await adminClient
      .from('attendance')
      .select('*')
      .in('session_id', sessionIds)

    const totalSessions = sessions.length
    const attRows = attendanceList || []

    // Aggregate student counts
    const studentMap = new Map<string, any>()
    attRows.forEach(a => {
      if (!studentMap.has(a.student_id)) {
        studentMap.set(a.student_id, {
          full_name: a.full_name,
          track_no: a.track_no,
          department_name: a.department_name,
          attended: 0,
        })
      }
      studentMap.get(a.student_id).attended += 1
    })

    const studentList = Array.from(studentMap.values()).map(st => ({
      ...st,
      percentage: Math.round((st.attended / totalSessions) * 100),
    })).sort((a, b) => a.full_name.localeCompare(b.full_name))

    const uniqueStudents = studentList.length
    const avgAttendance = uniqueStudents > 0 ? (attRows.length / totalSessions).toFixed(1) : '0'

    const reportCode = `REP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const firstSession = sessions[0]

    // Create SHA-256 hash for document proof
    const hashData = `${reportCode}_${classKey}_${totalSessions}_${attRows.length}_${firstSession.created_by}`
    const enc = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(hashData))
    const sha256Hex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    // Save report to database (Section 9.2 & 4)
    await adminClient.from('reports').insert({
      generated_by: user.id,
      scope: { classKey, totalSessions, totalAttendance: attRows.length, sessionIds },
      sha256: sha256Hex,
      report_code: reportCode,
    })

    // Generate PDF Document
    const ReportDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <Text style={styles.institutionTitle}>{firstSession.school_name || 'Academic Institution'}</Text>
            <Text style={styles.reportSubtitle}>Official Course Attendance &amp; Verification Register</Text>
          </View>

          {/* Meta Information Grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Course Title</Text>
              <Text style={styles.metaValue}>{firstSession.name} ({firstSession.course_code || 'N/A'})</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Lecturer / Course Host</Text>
              <Text style={styles.metaValue}>{firstSession.host_name}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Report ID</Text>
              <Text style={styles.metaValue}>{reportCode}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Date Generated</Text>
              <Text style={styles.metaValue}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
          </View>

          {/* Summary Statistics */}
          <Text style={styles.sectionTitle}>Summary Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalSessions}</Text>
              <Text style={styles.statDesc}>Sessions Held</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{uniqueStudents}</Text>
              <Text style={styles.statDesc}>Unique Students</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{avgAttendance}</Text>
              <Text style={styles.statDesc}>Avg Present / Class</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{attRows.length}</Text>
              <Text style={styles.statDesc}>Total Attendances</Text>
            </View>
          </View>

          {/* Student Register Table */}
          <Text style={styles.sectionTitle}>Student Attendance Register ({studentList.length} Students)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colNum}>#</Text>
              <Text style={styles.colName}>Student Full Name</Text>
              <Text style={styles.colTrack}>Track / ID No</Text>
              <Text style={styles.colDept}>Department</Text>
              <Text style={styles.colAtt}>Attended</Text>
              <Text style={styles.colPct}>Rate %</Text>
            </View>

            {studentList.slice(0, 25).map((st, idx) => (
              <View key={st.track_no} style={styles.tableRow}>
                <Text style={styles.colNum}>{idx + 1}</Text>
                <Text style={styles.colName}>{st.full_name}</Text>
                <Text style={styles.colTrack}>{st.track_no}</Text>
                <Text style={styles.colDept}>{st.department_name || '—'}</Text>
                <Text style={styles.colAtt}>{st.attended}/{totalSessions}</Text>
                <Text style={styles.colPct}>{st.percentage}%</Text>
              </View>
            ))}
          </View>

          {/* Method Note (Section 9.2) */}
          <View style={styles.methodBox}>
            <Text style={styles.methodText}>
              Method Note: Attendance was cryptographically recorded via authenticated student accounts scanning dynamic rotating QR codes (refreshed at 30-second intervals). All snapshots are immutable and stored in compliance with NDPA 2023 regulations.
            </Text>
          </View>

          {/* Sign-off Lines */}
          <View style={styles.signOffContainer}>
            <View style={styles.signOffBox}>
              <Text style={styles.signOffRole}>Course Lecturer</Text>
              <Text style={styles.signOffDate}>Signature &amp; Date</Text>
            </View>
            <View style={styles.signOffBox}>
              <Text style={styles.signOffRole}>Head of Department</Text>
              <Text style={styles.signOffDate}>Signature &amp; Date</Text>
            </View>
            <View style={styles.signOffBox}>
              <Text style={styles.signOffRole}>Dean of Faculty</Text>
              <Text style={styles.signOffDate}>Signature &amp; Date</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>Report ID: {reportCode} · SHA256: {sha256Hex.slice(0, 16)}...</Text>
            <Text>Generated by JAV Lite · Blim Technologies</Text>
          </View>

        </Page>
      </Document>
    )

    const pdfBuffer = await renderToBuffer(ReportDocument)

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${classKey}_official_report.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: err.message || 'Server error generating PDF' }, { status: 500 })
  }
}
