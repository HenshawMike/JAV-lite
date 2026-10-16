'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/BottomNav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  BookOpen,
  CheckCircle2,
  Calendar,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  MessageSquare,
  Shield,
  HelpCircle,
  X,
  GraduationCap
} from '@/components/ui/icons'

interface MyRecord {
  id: string
  session_id: string
  session_name: string
  kind: 'class' | 'event'
  course_code?: string | null
  host_name: string
  session_date: string
  entry_type: 'qr' | 'manual'
  full_name: string
  track_no: string
  level?: string | null
  school_name?: string | null
  faculty_name?: string | null
  department_name?: string | null
  marked_at: string
}

interface CorrectionRequest {
  id: string
  session_id: string
  reason: string
  status: 'open' | 'resolved' | 'rejected'
  response?: string | null
  created_at: string
  handled_at?: string | null
  sessions?: {
    name: string
  }
}

import { getCachedStudentData, setCachedStudentData } from '@/lib/studentCache'

export default function MyRecordsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [cachedProfile] = useState(() => getCachedStudentData<any>('profile'))
  const [cachedRecords] = useState(() => getCachedStudentData<MyRecord[]>('records'))

  const [loading, setLoading] = useState(!cachedRecords)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(cachedProfile)
  const [records, setRecords] = useState<MyRecord[]>(cachedRecords || [])
  const [requests, setRequests] = useState<CorrectionRequest[]>([])

  // Modal for Reporting a Problem
  const [selectedRecord, setSelectedRecord] = useState<MyRecord | null>(null)
  const [problemReason, setProblemReason] = useState('')
  const [submittingProblem, setSubmittingProblem] = useState(false)
  const [problemError, setProblemError] = useState<string | null>(null)
  const [problemSuccess, setProblemSuccess] = useState(false)

  // Copy protection deterrents (Section 6.6)
  useEffect(() => {
    const disableCopy = (e: Event) => e.preventDefault()
    const disableContext = (e: MouseEvent) => e.preventDefault()

    document.addEventListener('copy', disableCopy)
    document.addEventListener('cut', disableCopy)
    document.addEventListener('contextmenu', disableContext)
    document.addEventListener('dragstart', disableCopy)
    document.addEventListener('selectstart', disableCopy)

    return () => {
      document.removeEventListener('copy', disableCopy)
      document.removeEventListener('cut', disableCopy)
      document.removeEventListener('contextmenu', disableContext)
      document.removeEventListener('dragstart', disableCopy)
      document.removeEventListener('selectstart', disableCopy)
    }
  }, [])

  const loadData = useCallback(async () => {
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

      // 1. Fetch records from view
      const { data: recs } = await supabase
        .from('my_records')
        .select('*')
        .order('marked_at', { ascending: false })

      const list = (recs as MyRecord[]) || []
      setRecords(list)
      setCachedStudentData('records', list)

      // 2. Fetch correction requests
      const { data: reqs } = await supabase
        .from('correction_requests')
        .select('*, sessions(name)')
        .eq('student_id', authUser.id)
        .order('created_at', { ascending: false })

      setRequests((reqs as any) || [])
    } catch (err) {
      console.error('Error loading records:', err)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecord) return

    if (problemReason.trim().length < 10 || problemReason.trim().length > 500) {
      setProblemError('Reason must be between 10 and 500 characters.')
      return
    }

    setSubmittingProblem(true)
    setProblemError(null)

    try {
      const { error } = await supabase
        .from('correction_requests')
        .insert({
          student_id: user.id,
          session_id: selectedRecord.session_id,
          attendance_id: selectedRecord.id,
          reason: problemReason.trim(),
          status: 'open',
        })

      if (error) {
        if (error.message?.includes('one_open_request')) {
          throw new Error('You already have an open problem request for this session.')
        } else if (error.message?.includes('Too many requests')) {
          throw new Error('Too many requests. At most 5 problem reports per hour.')
        }
        throw error
      }

      setProblemSuccess(true)
      setProblemReason('')
      await loadData()
      setTimeout(() => {
        setSelectedRecord(null)
        setProblemSuccess(false)
      }, 1500)
    } catch (err: any) {
      console.error('Error submitting correction request:', err)
      setProblemError(err.message || 'Failed to submit problem report.')
    } finally {
      setSubmittingProblem(false)
    }
  }

  // Summary statistics
  const classCount = records.filter(r => r.kind === 'class').length
  const eventCount = records.filter(r => r.kind === 'event').length
  const latestDate = records.length > 0 ? records[0].session_date : 'N/A'

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex flex-col items-center justify-center pb-24">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Loading official records...</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans select-none pb-28 relative">
      
      {/* Print protection style */}
      <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>

      {/* Tiled Watermark (Section 6.6) */}
      <div className="fixed inset-0 pointer-events-none z-10 opacity-[0.03] overflow-hidden flex flex-wrap gap-16 p-6 select-none font-mono text-xs uppercase">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="transform -rotate-12 whitespace-nowrap">
            JAV LITE · {profile?.full_name || 'STUDENT'} · {profile?.track_no || 'NO_ID'} · {new Date().toISOString().slice(0, 10)}
          </span>
        ))}
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md border-b border-border-default px-5 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              OFFICIAL RECORDS
            </span>
            <span className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">
              Read-Only Ledger
            </span>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in relative z-20">
        
        {/* Profile Details Snapshot Card */}
        <div className="p-6 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Student Profile Record</span>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              {profile?.full_name || 'Registered Student'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-secondary">
              <span className="font-mono font-bold text-text-primary px-2 py-0.5 rounded-md bg-bg-primary border border-border-default">
                ID: {profile?.track_no || 'Pending'}
              </span>
              <span>Level: {profile?.level ? `${profile.level}L` : '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-primary border border-border-default text-xs text-text-tertiary font-medium">
            <Shield size={14} className="text-success" />
            <span>Immutable RLS Protected</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border-default flex flex-col items-center text-center">
            <span className="text-2xl font-bold font-mono text-primary">{records.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mt-0.5">Total Attended</span>
          </div>
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border-default flex flex-col items-center text-center">
            <span className="text-2xl font-bold font-mono text-success">{classCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mt-0.5">Classes</span>
          </div>
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border-default flex flex-col items-center text-center">
            <span className="text-2xl font-bold font-mono text-accent">{eventCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mt-0.5">Events</span>
          </div>
        </div>

        {/* Attendance Ledger Table / Cards */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
              Attended Sessions ({records.length})
            </h2>
            <span className="text-[10px] text-text-tertiary">
              Tap &quot;Report&quot; to request correction
            </span>
          </div>

          {records.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-2 text-text-tertiary">
              <BookOpen size={32} strokeWidth={1.5} className="opacity-40" />
              <p className="text-xs font-medium">No verified attendance rows recorded.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 sm:p-5 rounded-2xl bg-bg-secondary border border-border-default flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/30 transition-all shadow-sm"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold font-mono">
                          {rec.course_code || rec.kind.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded">
                          {rec.entry_type === 'manual' ? 'Manual Entry' : 'Verified QR'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-text-primary leading-snug truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                        {rec.session_name}
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Host: {rec.host_name} · Date: {new Date(rec.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default/60">
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {new Date(rec.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedRecord(rec)
                        setProblemError(null)
                        setProblemReason('')
                        setProblemSuccess(false)
                      }}
                      className="text-[11px] font-bold text-primary hover:text-white hover:bg-primary border border-primary/30 px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <HelpCircle size={12} />
                      <span>Report a problem</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Correction Requests Section */}
        {requests.length > 0 && (
          <section className="flex flex-col gap-3 pt-4 border-t border-border-default">
            <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
              Problem Reports &amp; Inquiries ({requests.length})
            </h2>

            <div className="flex flex-col gap-2.5">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-bg-secondary/60 border border-border-default text-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">
                      {req.sessions?.name || 'Class Session'}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        req.status === 'resolved'
                          ? 'bg-success/10 text-success border border-success/20'
                          : req.status === 'rejected'
                          ? 'bg-error/10 text-error border border-error/20'
                          : 'bg-warning/10 text-warning border border-warning/20'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-text-secondary italic bg-bg-primary/50 p-2.5 rounded-xl border border-border-default">
                    &quot;{req.reason}&quot;
                  </p>

                  {req.response && (
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-text-primary mt-1">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Lecturer Response:</p>
                      <p>{req.response}</p>
                    </div>
                  )}

                  <span className="text-[10px] text-text-tertiary font-mono">
                    Reported {new Date(req.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Modal: Report a Problem (Section 6.7) */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-5">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                  Report Attendance Issue
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Sends an audited correction request directly to the lecturer.
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-bg-secondary border border-border-default text-xs">
              <p className="text-text-tertiary uppercase text-[9px] font-bold">Target Session</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedRecord.session_name}</p>
              <p className="text-text-secondary">{selectedRecord.host_name} · {selectedRecord.session_date}</p>
            </div>

            {problemSuccess ? (
              <div className="p-6 rounded-2xl bg-success/10 border border-success/30 text-success text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={32} />
                <p className="font-bold text-sm">Problem report submitted successfully!</p>
                <p className="text-xs opacity-90">Your lecturer will review your inquiry.</p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-primary">Describe the problem (10 - 500 chars) *</label>
                  <textarea
                    required
                    rows={4}
                    minLength={10}
                    maxLength={500}
                    placeholder="e.g. My phone died during the lecture and the time marked was recorded as manual..."
                    value={problemReason}
                    onChange={(e) => setProblemReason(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
                  />
                  <span className="text-[10px] text-text-tertiary text-right font-mono">
                    {problemReason.length}/500 chars
                  </span>
                </div>

                {problemError && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium">
                    {problemError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 py-3 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProblem || problemReason.trim().length < 10}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingProblem ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                    <span>Submit Inquiry</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
