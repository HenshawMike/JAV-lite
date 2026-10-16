'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Users,
  Download,
  FileText,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  HelpCircle,
  Send,
  UserPlus,
  UserMinus,
  UploadCloud,
  FileCheck,
  X
} from '@/components/ui/icons'

interface SessionItem {
  id: string
  name: string
  course_code: string | null
  session_date: string
  status: 'open' | 'ended'
  started_at: string
  expires_at: string
  school_name?: string
  attendance_count?: number
}

interface StudentSummary {
  student_id: string
  full_name: string
  track_no: string
  level?: string
  department_name?: string
  sessions_attended: number
  percentage: number
}

interface CorrectionReq {
  id: string
  student_id: string
  session_id: string
  reason: string
  status: 'open' | 'resolved' | 'rejected'
  response: string | null
  created_at: string
  profiles?: {
    full_name: string
    track_no: string
  }
}

export default function LecturerClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const classKey = decodeURIComponent(params.key as string)

  const [activeTab, setActiveTab] = useState<'sessions' | 'students' | 'reports' | 'requests'>('sessions')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [requests, setRequests] = useState<CorrectionReq[]>([])
  const [rosterCount, setRosterCount] = useState<number>(0)

  // Modals
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [rosterCsvFile, setRosterCsvFile] = useState<File | null>(null)
  const [uploadingRoster, setUploadingRoster] = useState(false)

  const [showManualModal, setShowManualModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    sessionId: '',
    trackNo: '',
    fullName: '',
    level: '100',
    reason: 'Student device battery exhausted during lecture',
  })
  const [submittingManual, setSubmittingManual] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  // Request reply modal
  const [selectedReq, setSelectedReq] = useState<CorrectionReq | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  const loadClassData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/')
        return
      }
      setUser(authUser)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setProfile(prof)

      // Fetch all sessions matching this classKey (either course_code or name)
      const { data: sessList } = await supabase
        .from('sessions')
        .select('*')
        .eq('created_by', authUser.id)
        .or(`course_code.eq.${classKey},name.eq.${classKey}`)
        .order('started_at', { ascending: false })

      const sessionItems = sessList || []

      // Fetch attendance counts for these sessions
      const sessionIds = sessionItems.map(s => s.id)
      let allAttendance: any[] = []

      if (sessionIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('id, session_id, student_id, full_name, track_no, level, department_name, marked_at')
          .in('session_id', sessionIds)

        allAttendance = attData || []
      }

      // Map sessions with attendance count
      const mappedSessions: SessionItem[] = sessionItems.map(s => ({
        ...s,
        attendance_count: allAttendance.filter(a => a.session_id === s.id).length,
      }))
      setSessions(mappedSessions)

      // Aggregate student attendance
      const studentMap = new Map<string, StudentSummary>()
      const totalSessions = sessionItems.length || 1

      allAttendance.forEach(a => {
        if (!studentMap.has(a.student_id)) {
          studentMap.set(a.student_id, {
            student_id: a.student_id,
            full_name: a.full_name,
            track_no: a.track_no,
            level: a.level,
            department_name: a.department_name,
            sessions_attended: 0,
            percentage: 0,
          })
        }
        const st = studentMap.get(a.student_id)!
        st.sessions_attended += 1
        st.percentage = Math.round((st.sessions_attended / totalSessions) * 100)
      })

      setStudents(Array.from(studentMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)))

      // Fetch correction requests for these sessions
      if (sessionIds.length > 0) {
        const { data: reqData } = await supabase
          .from('correction_requests')
          .select('*, profiles(full_name, track_no)')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })

        setRequests((reqData as any) || [])
      }
    } catch (err) {
      console.error('Error loading class details:', err)
    } finally {
      setLoading(false)
    }
  }, [classKey, router, supabase])

  useEffect(() => {
    loadClassData()
  }, [loadClassData])

  // Start new session for this same class
  const handleStartAnotherSession = async () => {
    if (!profile) return
    const first = sessions[0]
    const className = first?.name || classKey
    const courseCode = first?.course_code || null
    const schoolName = first?.school_name || 'University'

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + 3 * 60 * 60 * 1000)

    const { data: newSess, error } = await supabase
      .from('sessions')
      .insert({
        kind: 'class',
        name: className,
        course_code: courseCode,
        host_name: profile.full_name || 'Lecturer',
        school_id: profile.school_id || null,
        school_name: schoolName,
        created_by: profile.id,
        status: 'open',
        rotating: true,
        session_date: startedAt.toISOString().slice(0, 10),
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (!error && newSess) {
      router.push(`/lecturer/session/${newSess.id}`)
    }
  }

  // Upload Class Roster CSV
  const handleUploadRosterCsv = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rosterCsvFile) return
    setUploadingRoster(true)

    try {
      Papa.parse(rosterCsvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[]
          const rosterEntries = rows.map(r => ({
            owner_id: user.id,
            full_name: r.full_name || r.name || 'Student',
            track_no: r.track_no || r.id || '',
            level: r.level || '',
          })).filter(r => r.track_no)

          if (rosterEntries.length > 0) {
            await supabase.from('roster').insert(rosterEntries)
            setRosterCount(rosterEntries.length)
          }

          setShowRosterModal(false)
          setUploadingRoster(false)
          alert(`Successfully uploaded ${rosterEntries.length} students to the class roster!`)
        },
      })
    } catch (err: any) {
      alert(err.message || 'Error parsing CSV file.')
      setUploadingRoster(false)
    }
  }

  // Manual Attendance Add (Section 7.5)
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.sessionId || !manualForm.trackNo.trim() || !manualForm.fullName.trim()) {
      setManualError('Please fill all required fields.')
      return
    }

    setSubmittingManual(true)
    setManualError(null)

    try {
      // Find or create profile
      let { data: stProfile } = await supabase
        .from('profiles')
        .select('id, full_name, track_no, level')
        .eq('track_no', manualForm.trackNo.trim())
        .maybeSingle()

      let studentId = stProfile?.id

      if (!studentId) {
        // Find by auth if exists or use placeholder UUID
        studentId = crypto.randomUUID()
      }

      // Call manual attendance insert API
      const res = await fetch('/api/lecturer/manual-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: manualForm.sessionId,
          studentId: studentId,
          fullName: manualForm.fullName.trim(),
          trackNo: manualForm.trackNo.trim(),
          level: manualForm.level,
          reason: manualForm.reason.trim(),
          action: 'manual_add',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to manually add student')

      setShowManualModal(false)
      setManualForm({
        sessionId: '',
        trackNo: '',
        fullName: '',
        level: '100',
        reason: 'Student device battery exhausted during lecture',
      })
      await loadClassData()
    } catch (err: any) {
      setManualError(err.message || 'Error recording manual attendance.')
    } finally {
      setSubmittingManual(false)
    }
  }

  // Handle Request Resolution
  const handleResolveRequest = async (status: 'resolved' | 'rejected') => {
    if (!selectedReq) return
    setSubmittingReply(true)

    try {
      const { error } = await supabase
        .from('correction_requests')
        .update({
          status,
          response: replyText.trim() || (status === 'resolved' ? 'Approved and resolved by lecturer.' : 'Inquiry reviewed and declined.'),
        })
        .eq('id', selectedReq.id)

      if (error) throw error

      setSelectedReq(null)
      setReplyText('')
      await loadClassData()
    } catch (err: any) {
      alert(err.message || 'Failed to update request.')
    } finally {
      setSubmittingReply(false)
    }
  }

  const courseTitle = sessions[0]?.name || classKey
  const courseCode = sessions[0]?.course_code || null

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/lecturer"
          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>All Classes</span>
        </Link>
      </div>

      {/* Class Overview Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {courseCode && (
              <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold font-mono">
                {courseCode}
              </span>
            )}
            <span className="text-xs text-text-tertiary">
              {sessions.length} sessions held
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {courseTitle}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Host: <strong className="text-text-primary">{profile?.full_name}</strong> · {profile?.schools?.name || 'Academic Course'}
          </p>
        </div>

        <button
          onClick={handleStartAnotherSession}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-primary/25 cursor-pointer transition-all"
        >
          <Play size={14} fill="currentColor" />
          <span>Start New Session</span>
        </button>
      </div>

      {/* Navigation Tabs (Section 7.4) */}
      <div className="grid grid-cols-4 p-1.5 rounded-2xl bg-bg-secondary border border-border-default">
        {[
          { key: 'sessions', label: 'Sessions', count: sessions.length },
          { key: 'students', label: 'Students', count: students.length },
          { key: 'reports', label: 'Reports & Export' },
          { key: 'requests', label: 'Inquiries', count: requests.filter(r => r.status === 'open').length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === tab.key
                ? 'bg-bg-primary text-primary shadow-sm border border-border-default'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                tab.key === 'requests' ? 'bg-warning/20 text-warning font-bold' : 'bg-bg-tertiary text-text-secondary'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: SESSIONS LIST ────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
              Session History ({sessions.length})
            </h2>
          </div>

          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-5 rounded-2xl bg-bg-secondary border border-border-default flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/30 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                  sess.status === 'open' ? 'bg-success/10 text-success animate-pulse' : 'bg-bg-tertiary text-text-tertiary'
                }`}>
                  <Calendar size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                      {new Date(sess.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      sess.status === 'open' ? 'bg-success/10 text-success' : 'bg-bg-tertiary text-text-tertiary'
                    }`}>
                      {sess.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Started at {new Date(sess.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · Auto-ended at {new Date(sess.expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-border-default/60">
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-primary">{sess.attendance_count}</span>
                  <span className="text-[10px] text-text-tertiary block -mt-1 uppercase font-bold">Present</span>
                </div>

                {sess.status === 'open' ? (
                  <Link
                    href={`/lecturer/session/${sess.id}`}
                    className="px-4 py-2 rounded-xl bg-success text-white text-xs font-bold shadow-md hover:opacity-90"
                  >
                    Open Live QR
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setManualForm(f => ({ ...f, sessionId: sess.id }))
                      setShowManualModal(true)
                    }}
                    className="px-3 py-1.5 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus size={13} />
                    <span>Manual Add</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 2: STUDENTS REGISTER & ATTENDANCE STATS ─────────────────────── */}
      {activeTab === 'students' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
                Enrolled Students &amp; Attendance Rate
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Calculated across all {sessions.length} lecture sessions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRosterModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary border border-border-default px-3 py-2 rounded-xl transition-all"
              >
                <UploadCloud size={14} />
                <span>Upload Class List (CSV)</span>
              </button>
              <button
                onClick={() => {
                  if (sessions.length > 0) {
                    setManualForm(f => ({ ...f, sessionId: sessions[0].id }))
                    setShowManualModal(true)
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white hover:bg-primary border border-primary/30 px-3 py-2 rounded-xl transition-all"
              >
                <UserPlus size={14} />
                <span>Manual Correction</span>
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-3 text-text-tertiary">
              <Users size={36} strokeWidth={1.5} className="opacity-40" />
              <p className="text-xs font-medium">No student attendance recorded for this class yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border-default rounded-2xl bg-bg-secondary shadow-sm">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-bg-primary border-b border-border-default text-text-primary font-bold">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5 font-mono">Track No</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5 text-center">Attended</th>
                    <th className="p-3.5 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {students.map((st, idx) => (
                    <tr key={st.student_id} className="hover:bg-bg-primary/50 transition-colors">
                      <td className="p-3.5 font-mono text-text-tertiary text-xs">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-text-primary">{st.full_name}</td>
                      <td className="p-3.5 font-mono text-primary">{st.track_no}</td>
                      <td className="p-3.5 text-text-secondary text-xs">{st.department_name || '—'}</td>
                      <td className="p-3.5 text-center font-mono font-bold">
                        {st.sessions_attended} / {sessions.length}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                          st.percentage >= 75 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                        }`}>
                          {st.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: REPORTS & EXPORTS (Section 9.1 & 9.2) ────────────────────── */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in">
          
          {/* CSV Export Card */}
          <div className="p-6 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col justify-between gap-5">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center mb-3">
                <FileCheck size={24} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Export Class Spreadsheet (CSV)
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                Download formatted CSV containing full attendance snapshots, formula-escaped student names, track IDs, marked timestamps, and QR/Manual entry types.
              </p>
            </div>

            <a
              href={`/api/reports/${encodeURIComponent(classKey)}/csv`}
              download
              className="w-full py-3.5 rounded-xl bg-success hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <Download size={15} />
              <span>Download CSV Report</span>
            </a>
          </div>

          {/* PDF Academic Report Card */}
          <div className="p-6 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col justify-between gap-5">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <FileText size={24} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Official Academic PDF Report
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                Generate tamper-evident official PDF report complete with Cover, Summary Statistics, Register Grid, Method Note, Sign-Off Lines, Report ID, and SHA-256 Hash.
              </p>
            </div>

            <a
              href={`/api/reports/${encodeURIComponent(classKey)}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <FileText size={15} />
              <span>Generate Official PDF</span>
            </a>
          </div>

        </div>
      )}

      {/* ── TAB 4: STUDENT INQUIRIES & CORRECTION REQUESTS ─────────────────── */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
              Problem Inquiries ({requests.length})
            </h2>
          </div>

          {requests.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-2 text-text-tertiary">
              <CheckCircle2 size={32} strokeWidth={1.5} className="opacity-40" />
              <p className="text-xs font-medium">No open problem inquiries for this course.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-bg-secondary border border-border-default flex flex-col gap-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text-primary">
                        {req.profiles?.full_name || 'Student'}
                      </span>
                      <span className="font-mono text-xs text-primary font-bold">
                        {req.profiles?.track_no}
                      </span>
                    </div>

                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      req.status === 'resolved'
                        ? 'bg-success/10 text-success border border-success/20'
                        : req.status === 'rejected'
                        ? 'bg-error/10 text-error border border-error/20'
                        : 'bg-warning/10 text-warning border border-warning/20'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-bg-primary border border-border-default text-xs text-text-secondary italic">
                    &quot;{req.reason}&quot;
                  </div>

                  {req.response && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-primary">
                      <strong className="text-primary block text-[10px] uppercase">Lecturer Response:</strong>
                      {req.response}
                    </div>
                  )}

                  {req.status === 'open' && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
                      <button
                        onClick={() => {
                          setSelectedReq(req)
                          setReplyText('')
                        }}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        Answer / Resolve
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Correction Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Manual Attendance Entry
              </h3>
              <button onClick={() => setShowManualModal(false)} className="p-2 text-text-tertiary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-primary">Target Session *</label>
                <select
                  required
                  value={manualForm.sessionId}
                  onChange={e => setManualForm(f => ({ ...f, sessionId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                >
                  <option value="">-- Select Session Date --</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.session_date).toLocaleDateString('en-GB')} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-primary">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={manualForm.fullName}
                  onChange={e => setManualForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-primary">Track / ID Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRK-9901"
                  value={manualForm.trackNo}
                  onChange={e => setManualForm(f => ({ ...f, trackNo: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-secondary font-mono text-text-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-primary">Audit Reason (Logged) *</label>
                <textarea
                  required
                  rows={2}
                  value={manualForm.reason}
                  onChange={e => setManualForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary resize-none"
                />
              </div>

              {manualError && (
                <div className="p-2.5 bg-error/10 border border-error/20 text-error rounded-xl font-medium">
                  {manualError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingManual}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 mt-2 cursor-pointer flex items-center justify-center gap-2"
              >
                {submittingManual ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Record Audited Manual Entry</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Answer Inquiry Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Resolve Student Inquiry
              </h3>
              <button onClick={() => setSelectedReq(null)} className="p-2 text-text-tertiary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-bg-secondary rounded-xl text-xs">
              <p className="font-bold text-text-primary">{selectedReq.profiles?.full_name} ({selectedReq.profiles?.track_no})</p>
              <p className="italic text-text-secondary mt-1">&quot;{selectedReq.reason}&quot;</p>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-text-primary">Response Message:</label>
              <textarea
                rows={3}
                placeholder="Type response to student..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="w-full p-3 rounded-xl border border-border-default bg-bg-secondary text-text-primary resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleResolveRequest('rejected')}
                disabled={submittingReply}
                className="flex-1 py-2.5 rounded-xl border border-error/30 text-error hover:bg-error hover:text-white font-bold text-xs"
              >
                Reject Inquiry
              </button>
              <button
                onClick={() => handleResolveRequest('resolved')}
                disabled={submittingReply}
                className="flex-1 py-2.5 rounded-xl bg-success text-white font-bold text-xs hover:opacity-90"
              >
                Approve &amp; Resolve
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
