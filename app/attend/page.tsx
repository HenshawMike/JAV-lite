'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ComboBox } from '@/components/ui/ComboBox'
import { FACULTIES, DEPARTMENTS, LEVELS } from '@/lib/constants'
import {
  Coffee,
  CheckCircle2,
  Clock,
  ScanFace,
  Sparkles,
  AlertCircle,
  Loader2,
  GraduationCap,
  Menu,
  X,
  Edit3,
  Settings,
  ShieldCheck,
  User,
  LogOut
} from '@/components/ui/icons'
import Image from 'next/image'

interface Event {
  id: string
  name: string
  description: string | null
  date: string
  is_active: boolean
}

interface ClassSessionWithCourse {
  id: string
  course_id: string
  title: string | null
  date: string
  is_active: boolean
  course: {
    name: string
    code: string | null
    faculty: string
    department: string
    level: string
    lecturer_id: string
  }
}

interface ClassAttendanceStatus {
  sessionId: string
  marked: boolean
  markedAt: string | null
  status: string | null
}

export default function AttendPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Drawer and profile setup modal states
  const [menuOpen, setMenuOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Profile edit form fields
  const [editFullName, setEditFullName] = useState('')
  const [editTrackNo, setEditTrackNo] = useState('')
  const [editFaculty, setEditFaculty] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editLevel, setEditLevel] = useState('')

  // Admin event state
  const [activeEvent, setActiveEvent] = useState<Event | null>(null)
  const [alreadyMarked, setAlreadyMarked] = useState(false)
  const [markedTime, setMarkedTime] = useState<string | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Class session state
  const [classSessions, setClassSessions] = useState<ClassSessionWithCourse[]>([])
  const [classAttendance, setClassAttendance] = useState<Record<string, ClassAttendanceStatus>>({})
  const [markingClassId, setMarkingClassId] = useState<string | null>(null)
  const [classError, setClassError] = useState<string | null>(null)

  const fetchClassSessions = async (faculty: string, department: string, level: string, studentId: string) => {
    if (!faculty || !department || !level) return

    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, course_id, title, date, is_active, course:courses(name, code, faculty, department, level, lecturer_id)')
      .eq('is_active', true)

    if (sessions) {
      // Filter to sessions matching this student's faculty/department/level
      const matching = (sessions as unknown as ClassSessionWithCourse[]).filter(s => {
        const c = s.course
        return c && c.faculty === faculty && c.department === department && c.level === level
      })
      setClassSessions(matching)

      // Check existing class attendance for each
      const statuses: Record<string, ClassAttendanceStatus> = {}
      for (const session of matching) {
        const { data: ca } = await supabase
          .from('class_attendance')
          .select('marked_at, status')
          .eq('session_id', session.id)
          .eq('student_id', studentId)
          .maybeSingle()

        statuses[session.id] = {
          sessionId: session.id,
          marked: !!ca,
          markedAt: ca?.marked_at ?? null,
          status: ca?.status ?? null,
        }
      }
      setClassAttendance(statuses)
    }
  }

  useEffect(() => {
    async function checkAuthAndFetch() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) {
          router.push('/')
          return
        }

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single()

        if (profErr || !prof?.registered) {
          router.push('/register')
          return
        }

        setUser(u)
        setProfile(prof)

        // Initialize edit form
        setEditFullName(prof.full_name || '')
        setEditTrackNo(prof.track_no || '')
        setEditFaculty(prof.faculty || '')
        setEditDepartment(prof.department || '')
        setEditLevel(prof.level || '')

        // Auto prompt if academic info is missing
        if (!prof.faculty || !prof.department || !prof.level) {
          setEditProfileOpen(true)
        }

        // ── Fetch admin event ──
        const { data: actEv } = await supabase
          .from('events')
          .select('*')
          .eq('is_active', true)
          .maybeSingle()

        if (actEv) {
          setActiveEvent(actEv)

          const { data: att } = await supabase
            .from('attendance')
            .select('marked_at, status')
            .eq('event_id', actEv.id)
            .eq('student_id', u.id)
            .maybeSingle()

          if (att) {
            setAlreadyMarked(true)
            setMarkedTime(att.marked_at)
            setAttendanceStatus(att.status)
          }
        }

        // ── Fetch class sessions matching student's faculty/dept/level ──
        if (prof.faculty && prof.department && prof.level) {
          await fetchClassSessions(prof.faculty, prof.department, prof.level, u.id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    checkAuthAndFetch()
  }, [router])

  // ── Realtime: admin event attendance ──
  useEffect(() => {
    if (!activeEvent || !user) return

    const channel = supabase
      .channel(`attendance:${activeEvent.id}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `event_id=eq.${activeEvent.id}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          const oldRecord = payload.old as any
          
          if (payload.eventType === 'DELETE') {
            if (oldRecord && oldRecord.student_id === user.id) {
              setAlreadyMarked(false)
              setMarkedTime(null)
              setAttendanceStatus(null)
            }
          } else if (newRecord && newRecord.student_id === user.id) {
            setAlreadyMarked(true)
            setMarkedTime(newRecord.marked_at)
            setAttendanceStatus(newRecord.status || 'pending')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeEvent, user, supabase])

  // ── Realtime: class session attendance ──
  useEffect(() => {
    if (!user || classSessions.length === 0) return

    const channels = classSessions.map(session => {
      return supabase
        .channel(`class-att:${session.id}:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'class_attendance',
            filter: `session_id=eq.${session.id}`,
          },
          (payload) => {
            const newRecord = payload.new as any
            if (newRecord && newRecord.student_id === user.id) {
              setClassAttendance(prev => ({
                ...prev,
                [session.id]: {
                  sessionId: session.id,
                  marked: true,
                  markedAt: newRecord.marked_at,
                  status: newRecord.status || 'pending',
                },
              }))
            }
          }
        )
        .subscribe()
    })

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [classSessions, user, supabase])

  // ── Save Student Academic Profile ──
  const handleSaveProfile = async () => {
    setProfileError(null)
    if (!editFaculty.trim()) return setProfileError('Faculty is required.')
    if (!editDepartment.trim()) return setProfileError('Department is required.')
    if (!editLevel.trim()) return setProfileError('Level is required.')
    if (!editTrackNo.trim()) return setProfileError('Track / Student ID is required.')
    if (!user) return

    setSavingProfile(true)
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim() || profile?.full_name,
          track_no: editTrackNo.trim(),
          faculty: editFaculty.trim(),
          department: editDepartment.trim(),
          level: editLevel.trim(),
          role: profile?.role || 'student'
        })
        .eq('id', user.id)

      if (updateErr) throw updateErr

      const updatedProf = {
        ...profile,
        full_name: editFullName.trim() || profile?.full_name,
        track_no: editTrackNo.trim(),
        faculty: editFaculty.trim(),
        department: editDepartment.trim(),
        level: editLevel.trim(),
      }
      setProfile(updatedProf)
      setEditProfileOpen(false)

      // Refresh class sessions with updated academic info
      await fetchClassSessions(editFaculty.trim(), editDepartment.trim(), editLevel.trim(), user.id)
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update academic profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Mark admin event attendance ──
  const handleMarkAttendance = async () => {
    if (!activeEvent || !user) return
    setMarking(true)
    setError(null)

    try {
      const { data, error: markErr } = await supabase
        .from('attendance')
        .insert({
          event_id: activeEvent.id,
          student_id: user.id,
          status: 'pending'
        })
        .select('marked_at, status')
        .single()

      if (markErr) {
        if (markErr.code === '23505') {
          const { data: existing } = await supabase
            .from('attendance')
            .select('marked_at, status')
            .eq('event_id', activeEvent.id)
            .eq('student_id', user.id)
            .maybeSingle()

          if (existing) {
            setAlreadyMarked(true)
            setMarkedTime(existing.marked_at)
            setAttendanceStatus(existing.status)
          } else {
            setAlreadyMarked(true)
            setMarkedTime(new Date().toISOString())
            setAttendanceStatus('pending')
          }
        } else {
          throw markErr
        }
      } else {
        setAlreadyMarked(true)
        setMarkedTime(data.marked_at)
        setAttendanceStatus(data.status)
      }
    } catch (err: any) {
      setError(err.message || 'Verification rejected. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  // ── Mark class session attendance ──
  const handleMarkClassAttendance = async (sessionId: string) => {
    if (!user) return
    setMarkingClassId(sessionId)
    setClassError(null)

    try {
      const { data, error: markErr } = await supabase
        .from('class_attendance')
        .insert({
          session_id: sessionId,
          student_id: user.id,
          status: 'pending'
        })
        .select('marked_at, status')
        .single()

      if (markErr) {
        if (markErr.code === '23505') {
          const { data: existing } = await supabase
            .from('class_attendance')
            .select('marked_at, status')
            .eq('session_id', sessionId)
            .eq('student_id', user.id)
            .maybeSingle()

          setClassAttendance(prev => ({
            ...prev,
            [sessionId]: {
              sessionId,
              marked: true,
              markedAt: existing?.marked_at ?? new Date().toISOString(),
              status: existing?.status ?? 'pending',
            },
          }))
        } else {
          throw markErr
        }
      } else {
        setClassAttendance(prev => ({
          ...prev,
          [sessionId]: {
            sessionId,
            marked: true,
            markedAt: data.marked_at,
            status: data.status,
          },
        }))
      }
    } catch (err: any) {
      setClassError(err.message || 'Failed to mark class attendance.')
    } finally {
      setMarkingClassId(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isProfileIncomplete = !profile?.faculty || !profile?.department || !profile?.level

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center dynamic-gradient-bg">
        <div className="flex flex-col items-center gap-5 animate-pulse bg-bg-secondary/40 p-10 rounded-3xl border border-border-default/50 backdrop-blur-xl">
          <Loader2 size={40} strokeWidth={2} className="text-primary" />
          <span className="text-text-secondary font-bold tracking-widest text-xs uppercase">Getting things ready...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-bg-tertiary flex flex-col relative overflow-hidden">

      {/* Decorative shapes behind dashboard */}
      <div className="ambient-orb bg-primary w-[600px] h-[600px] -top-[300px] -right-[200px]" />

      {/* Header */}
      <header className="w-full border-b border-border-default px-5 sm:px-8 py-3.5 sm:py-4 flex justify-between items-center sticky top-0 bg-bg-primary/95 backdrop-blur-md z-30 shadow-sm relative">
        {/* Left: Brand + Student identity */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2.5 pr-3 sm:pr-6 border-r border-border-default flex-shrink-0">
            <div className="bg-bg-tertiary p-1.5 rounded-xl border border-border-default">
              <Image src="/logo.png" alt="JAV Lite" width={26} height={26} className="select-none w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="font-bold text-base tracking-[3px] text-text-primary hidden md:flex items-center gap-1.5" style={{ fontFamily: "var(--font-rajdhani)" }}>
              JAV
              <Image src="/lite.png" alt="Lite" width={36} height={14} className="object-contain w-auto h-3.5" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Avatar name={profile?.full_name || 'User'} photoUrl={profile?.photo_url} size={34} className="shadow-sm" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-text-primary leading-none truncate pr-2">
                {profile?.full_name || 'Student'}
              </div>
              <div className="text-[10px] text-primary font-mono mt-1 tracking-wider truncate font-bold bg-primary/10 inline-block px-1.5 py-0.5 rounded-md">
                {profile?.track_no || 'No ID'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions + Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <ThemeToggle />
          
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="p-2 sm:p-2.5 rounded-xl border border-border-default bg-bg-secondary hover:bg-bg-tertiary hover:border-primary/40 text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer flex items-center justify-center shadow-sm"
          >
            <Menu size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Body Area */}
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 z-10 w-full">
        <div className="w-full max-w-[640px] animate-fade-in flex flex-col gap-6 sm:gap-8">

          {/* Incomplete Profile Banner for Existing Users */}
          {isProfileIncomplete && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/15 via-accent/10 to-bg-secondary border border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-scale-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary text-white flex-shrink-0 mt-0.5">
                  <GraduationCap size={18} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary leading-snug">Setup Your Academic Profile</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Select your Faculty, Department, and Level so you can see and check into your classes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditProfileOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition-opacity whitespace-nowrap shadow-sm cursor-pointer"
              >
                Complete Setup
              </button>
            </div>
          )}

          {/* Context Ribbon */}
          <div className="flex items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-border-default">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[3px] uppercase text-text-tertiary mb-1">
                Student Zone
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                Check-in Booth
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {profile?.department && (
                <Badge text={profile.department} type="department" />
              )}
              {profile?.level && (
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
                  L{profile.level}
                </span>
              )}
              <button
                onClick={() => setEditProfileOpen(true)}
                title="Edit Academic Details"
                className="p-1.5 rounded-lg border border-border-default bg-bg-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <Edit3 size={13} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* ── Class Sessions Section (Lecturer Classes) ── */}
          {classSessions.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <GraduationCap size={15} strokeWidth={1.75} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>Live Class Sessions</h2>
                    <p className="text-[10px] text-text-secondary">{profile?.department} · Level {profile?.level}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                  {classSessions.length} Active
                </span>
              </div>

              {classError && (
                <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl p-3 text-xs text-error font-semibold">
                  <AlertCircle size={14} strokeWidth={2} className="flex-shrink-0" />
                  <span>{classError}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {classSessions.map(session => {
                  const att = classAttendance[session.id]
                  const isMarked = att?.marked
                  const isConfirmed = att?.status === 'confirmed'
                  const isPending = att?.marked && att?.status !== 'confirmed'
                  const isMarking = markingClassId === session.id

                  return (
                    <div key={session.id} className={`card-minimal p-5 sm:p-6 flex flex-col gap-4 shadow-lg relative overflow-hidden ${
                      isConfirmed ? 'border-success/30 bg-gradient-to-b from-bg-primary to-success/5' :
                      isPending ? 'border-warning/30 bg-gradient-to-b from-bg-primary to-warning/5' :
                      'border-t-4 border-t-primary bg-bg-primary'
                    }`}>
                      {isConfirmed && <div className="absolute top-0 left-0 right-0 h-1.5 bg-success" />}
                      {isPending && <div className="absolute top-0 left-0 right-0 h-1.5 bg-warning" />}

                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge text="Class Session" type="info" />
                            {session.course.code && (
                              <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                                {session.course.code}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-rajdhani)" }}>
                            {session.course.name}
                          </h3>
                          <span className="text-[10px] font-mono text-text-secondary mt-1 inline-block">
                            {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {!isMarked && (
                          <div className="animate-pulse flex-shrink-0">
                            <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
                          </div>
                        )}
                      </div>

                      {isConfirmed ? (
                        <div className="flex flex-col items-center text-center py-4 gap-3">
                          <div className="w-14 h-14 rounded-full bg-success-glow border-4 border-success flex items-center justify-center">
                            <CheckCircle2 size={28} strokeWidth={2.5} className="text-success" />
                          </div>
                          <Badge text="Confirmed by lecturer" type="success" />
                          <code className="text-xs sm:text-sm font-mono text-success font-bold bg-success/10 px-3 py-1 rounded-lg border border-success/20">
                            {att?.markedAt ? new Date(att.markedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                          </code>
                        </div>
                      ) : isPending ? (
                        <div className="flex flex-col items-center text-center py-4 gap-3">
                          <div className="w-14 h-14 rounded-full bg-warning-glow border-4 border-warning flex items-center justify-center">
                            <Clock size={26} strokeWidth={2} className="text-warning animate-pulse" />
                          </div>
                          <Badge text="Awaiting Lecturer Approval" type="warning" />
                          <p className="text-xs text-text-secondary max-w-[320px]">
                            You&apos;ve checked in! The lecturer will confirm your attendance shortly.
                          </p>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-border-default/50">
                          <button
                            onClick={() => handleMarkClassAttendance(session.id)}
                            disabled={isMarking}
                            className="group w-full py-4 sm:py-5 bg-text-primary text-bg-primary font-bold text-sm sm:text-base rounded-xl hover:bg-primary active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:bg-border-default cursor-pointer flex items-center justify-center gap-3 shadow-xl hover:shadow-primary-glow"
                            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: '2px' }}
                          >
                            {isMarking ? (
                              <>
                                <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                                Checking in...
                              </>
                            ) : (
                              <>
                                <ScanFace size={18} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                                I&apos;M HERE!
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Admin Event Section ── */}
          {activeEvent ? (
            alreadyMarked && attendanceStatus === 'confirmed' ? (
              /* Confirmed Event State */
              <div className="card-minimal p-6 sm:p-10 border border-success/30 flex flex-col items-center text-center shadow-lg shadow-success/5 bg-gradient-to-b from-bg-primary to-success/5 relative overflow-hidden animate-scale-in">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-success" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-success-glow border-4 border-success flex items-center justify-center text-success mb-5 font-bold">
                  <CheckCircle2 size={32} strokeWidth={2.5} className="text-success" />
                </div>
                <Badge text="School Event — Tapped in" type="success" className="mb-4" />
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  {activeEvent.name}
                </h2>
                {activeEvent.description && (
                  <p className="text-xs sm:text-sm text-text-secondary max-w-[380px] italic leading-relaxed">
                    &ldquo;{activeEvent.description}&rdquo;
                  </p>
                )}
                <div className="mt-6 border-t border-border-default/50 w-full pt-4 flex flex-col gap-1 items-center">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-[2px]">Timestamp</span>
                  <code className="text-xs sm:text-sm font-mono text-success font-bold mt-1 bg-success/10 px-3 py-1 rounded-lg border border-success/20">
                    {markedTime ? new Date(markedTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                  </code>
                </div>
              </div>
            ) : alreadyMarked && (attendanceStatus === 'pending' || !attendanceStatus) ? (
              /* Pending Event State */
              <div className="card-minimal p-6 sm:p-10 border border-warning/30 flex flex-col items-center text-center shadow-lg shadow-warning/5 bg-gradient-to-b from-bg-primary to-warning/5 relative overflow-hidden animate-scale-in">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-warning" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-warning-glow border-4 border-warning flex items-center justify-center text-warning mb-5 font-bold">
                  <Clock size={30} strokeWidth={2} className="text-warning animate-pulse" />
                </div>
                <Badge text="School Event — Awaiting Approval" type="warning" className="mb-4" />
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  {activeEvent.name}
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary max-w-[380px] leading-relaxed">
                  Checked in! Waiting for admin confirmation.
                </p>
                <div className="mt-6 border-t border-border-default/50 w-full pt-4 flex flex-col gap-1 items-center">
                  <code className="text-xs sm:text-sm font-mono text-warning font-bold mt-1 bg-warning/10 px-3 py-1 rounded-lg border border-warning/20">
                    {markedTime ? new Date(markedTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                  </code>
                </div>
              </div>
            ) : (
              /* Active Event Ready to Mark */
              <div className="card-minimal p-6 sm:p-8 flex flex-col gap-5 sm:gap-6 shadow-lg border-t-4 border-t-primary bg-bg-primary relative">
                <div className="flex flex-col gap-3">
                  <Badge text="School-Wide Event" type="info" className="self-start" />
                  <h2 className="text-2xl sm:text-3xl font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-rajdhani)" }}>
                    {activeEvent.name}
                  </h2>
                  <span className="font-mono bg-bg-secondary border border-border-default rounded-md px-2.5 py-1 text-text-secondary font-bold text-xs inline-block w-fit">
                    {new Date(activeEvent.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {activeEvent.description && (
                  <div className="p-3.5 bg-bg-secondary rounded-lg border-l-4 border-primary">
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {activeEvent.description}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl p-3 text-xs text-error font-semibold">
                    <AlertCircle size={16} strokeWidth={2} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-border-default/50">
                  <button
                    onClick={handleMarkAttendance}
                    disabled={marking}
                    className="group w-full py-4 sm:py-5 bg-text-primary text-bg-primary font-bold text-sm sm:text-base rounded-xl hover:bg-primary active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:bg-border-default cursor-pointer flex items-center justify-center gap-3 shadow-xl"
                    style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: '2px' }}
                  >
                    {marking ? (
                      <>
                        <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                        Scanning face...
                      </>
                    ) : (
                      <>
                        <ScanFace size={18} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                        ATTEND EVENT
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          ) : null}

          {/* Standby State when NO event and NO class sessions active */}
          {!activeEvent && classSessions.length === 0 && (
            <div className="card-minimal p-8 sm:p-12 flex flex-col items-center text-center shadow-lg border-t-4 border-t-border-default bg-bg-primary">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-bg-tertiary border border-border-default flex items-center justify-center text-text-tertiary mb-5 shadow-inner">
                <Coffee size={28} strokeWidth={1.5} className="text-text-tertiary" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-text-primary mb-2 flex items-center gap-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
                No Active Sessions
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-[340px]">
                Nothing is live right now for your department ({profile?.department || 'Not set'}) and Level ({profile?.level || '—'}). Check back when your lecturer goes live!
              </p>
              <button
                onClick={() => setEditProfileOpen(true)}
                className="mt-5 text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={13} strokeWidth={2} />
                Need to change department or level?
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Slide-Out Hamburger Drawer ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[340px] bg-bg-primary h-full border-l border-border-default shadow-2xl flex flex-col p-6 overflow-y-auto animate-scale-in">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-5 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-bg-secondary border border-border-default">
                  <Image src="/logo.png" alt="JAV" width={20} height={20} />
                </div>
                <span className="font-bold text-sm tracking-[2px] text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  STUDENT HUB
                </span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="py-6 flex flex-col gap-4 border-b border-border-default">
              <div className="flex items-center gap-3">
                <Avatar name={profile?.full_name || 'Student'} photoUrl={profile?.photo_url} size={48} className="shadow-md" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-text-primary truncate">{profile?.full_name || 'Student'}</h3>
                  <p className="text-xs text-text-secondary truncate">{user?.email}</p>
                  <span className="inline-block mt-1 text-[9px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    ID: {profile?.track_no || 'Not set'}
                  </span>
                </div>
              </div>

              {/* Academic Badges */}
              <div className="p-3.5 bg-bg-secondary rounded-xl border border-border-default flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-tertiary font-medium">Faculty:</span>
                  <span className="text-text-primary font-bold truncate max-w-[170px] text-right">{profile?.faculty || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-tertiary font-medium">Department:</span>
                  <span className="text-text-primary font-bold truncate max-w-[170px] text-right">{profile?.department || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-tertiary font-medium">Level:</span>
                  <span className="text-text-primary font-bold">Level {profile?.level || '—'}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  setEditProfileOpen(true)
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-primary/30 text-primary hover:bg-primary hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 size={14} strokeWidth={2} />
                Edit Academic Info
              </button>
            </div>

            {/* Quick Actions & Help */}
            <div className="py-6 flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 text-xs text-text-tertiary font-bold uppercase tracking-wider">
                <ShieldCheck size={14} strokeWidth={2} className="text-success" />
                Verified Student Account
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Your attendance is automatically matched by your department and level when your lecturer starts a live class session.
              </p>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-border-default flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-text-tertiary font-mono">
                <span>Theme Mode</span>
                <ThemeToggle />
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl border border-error/30 text-error hover:bg-error hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={14} strokeWidth={2} />
                Sign Out
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Complete / Edit Academic Profile Modal ── */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-primary rounded-2xl border border-border-default shadow-2xl w-full max-w-[480px] flex flex-col overflow-hidden animate-scale-in max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <div>
                <h2 className="font-bold text-text-primary text-base" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  {isProfileIncomplete ? 'Setup Your Class Profile' : 'Update Academic Profile'}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Ensure your faculty and level are accurate to see live class sessions.
                </p>
              </div>
              {!isProfileIncomplete && (
                <button
                  onClick={() => {
                    setEditProfileOpen(false)
                    setProfileError(null)
                  }}
                  className="p-2 rounded-xl hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Amara Osei"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Student / Track ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Track / Student ID *</label>
                <input
                  type="text"
                  placeholder="e.g. CS-2026-001"
                  value={editTrackNo}
                  onChange={e => setEditTrackNo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-mono"
                />
              </div>

              {/* Faculty */}
              <ComboBox
                label="Faculty *"
                placeholder="Select or enter your faculty..."
                suggestions={FACULTIES}
                value={editFaculty}
                onChange={setEditFaculty}
                required
              />

              {/* Department */}
              <ComboBox
                label="Department *"
                placeholder="Select or enter your department..."
                suggestions={DEPARTMENTS}
                value={editDepartment}
                onChange={setEditDepartment}
                required
              />

              {/* Level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Academic Level *</label>
                <div className="flex gap-2 flex-wrap">
                  {LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEditLevel(lvl)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        editLevel === lvl
                          ? 'border-primary bg-primary text-white'
                          : 'border-border-default bg-bg-secondary text-text-secondary hover:border-primary/50'
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))}
                </div>
              </div>

              {profileError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium flex items-center gap-2">
                  <AlertCircle size={14} strokeWidth={2} className="flex-shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border-default flex gap-3">
              {!isProfileIncomplete && (
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileOpen(false)
                    setProfileError(null)
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-border-default text-sm font-bold text-text-secondary hover:bg-bg-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
              >
                {savingProfile ? (
                  <>
                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} strokeWidth={2.5} />
                    Save & Get Ready for Class
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  )
}
