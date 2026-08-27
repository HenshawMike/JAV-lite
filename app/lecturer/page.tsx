'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ComboBox } from '@/components/ui/ComboBox'
import { LEVELS, FACULTIES, DEPARTMENTS } from '@/lib/constants'
import {
  Radio,
  Users,
  UserCheck,
  Clock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  Plus,
  BookOpen,
  Play,
  Square,
  X,
  ChevronDown,
  GraduationCap,
} from '@/components/ui/icons'
import Image from 'next/image'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Course {
  id: string
  name: string
  code: string | null
  faculty: string
  department: string
  level: string
  created_at: string
}

interface ClassSession {
  id: string
  course_id: string
  title: string | null
  date: string
  is_active: boolean
  created_at: string
  course?: Course
}

interface ClassAttendee {
  student_id: string
  marked_at: string
  status: string
  profiles: {
    full_name: string | null
    track_no: string | null
    department: string | null
    photo_url: string | null
    level: string | null
  } | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LecturerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Courses
  const [courses, setCourses] = useState<Course[]>([])
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [creatingCourse, setCreatingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', code: '', faculty: '', department: '', level: '' })
  const [courseFormError, setCourseFormError] = useState<string | null>(null)

  // Active session
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null)
  const [attendees, setAttendees] = useState<ClassAttendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [startingCourseId, setStartingCourseId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Past sessions
  const [pastSessions, setPastSessions] = useState<ClassSession[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [expandedAttendees, setExpandedAttendees] = useState<Record<string, ClassAttendee[]>>({})
  const [loadingExpanded, setLoadingExpanded] = useState<string | null>(null)

  // ─── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!prof?.registered) { router.push('/register'); return }
        if (prof.role !== 'lecturer' && !prof.is_admin) { router.push('/attend'); return }

        setProfile(prof)
        await fetchData(user.id)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // ─── Fetch all data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (lecturerId?: string) => {
    const uid = lecturerId ?? profile?.id
    if (!uid) return

    // Fetch courses
    const { data: coursesData } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', uid)
      .order('created_at', { ascending: false })

    setCourses(coursesData ?? [])

    // Fetch all sessions for this lecturer
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('*, course:courses(*)')
      .eq('lecturer_id', uid)
      .order('created_at', { ascending: false })

    if (!sessions) return

    const active = sessions.find(s => s.is_active) ?? null
    const past = sessions.filter(s => !s.is_active)

    setActiveSession(active)
    setPastSessions(past)

    if (active) {
      await fetchAttendees(active.id)
    }
  }, [supabase, profile?.id])

  // ─── Fetch live attendees ──────────────────────────────────────────────────
  const fetchAttendees = async (sessionId: string) => {
    setLoadingAttendees(true)
    const { data } = await supabase
      .from('class_attendance')
      .select('student_id, marked_at, status, profiles(full_name, track_no, department, photo_url, level)')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: false })

    setAttendees((data as unknown as ClassAttendee[]) ?? [])
    setLoadingAttendees(false)
  }

  // ─── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession) return

    const channel = supabase
      .channel(`lecturer-live:${activeSession.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_attendance', filter: `session_id=eq.${activeSession.id}` },
        () => fetchAttendees(activeSession.id)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSession])

  // ─── Confirm attendance ────────────────────────────────────────────────────
  const confirmAttendance = async (studentId: string) => {
    if (!activeSession) return
    setConfirmingId(studentId)
    const { error } = await supabase
      .from('class_attendance')
      .update({ status: 'confirmed' })
      .eq('session_id', activeSession.id)
      .eq('student_id', studentId)

    if (!error) {
      setAttendees(prev => prev.map(a =>
        a.student_id === studentId ? { ...a, status: 'confirmed' } : a
      ))
    }
    setConfirmingId(null)
  }

  // ─── Start session ─────────────────────────────────────────────────────────
  const startSession = async (courseId: string) => {
    if (!profile) return
    setStartingCourseId(courseId)
    const { data, error } = await supabase
      .from('class_sessions')
      .insert({
        course_id: courseId,
        lecturer_id: profile.id,
        date: new Date().toISOString().split('T')[0],
        is_active: true,
      })
      .select('*, course:courses(*)')
      .single()

    if (!error && data) {
      setActiveSession(data as unknown as ClassSession)
      setAttendees([])
      setPastSessions(prev => prev) // keep existing past sessions
    }
    setStartingCourseId(null)
  }

  // ─── End session ───────────────────────────────────────────────────────────
  const endSession = async () => {
    if (!activeSession || !profile) return
    setEndingSession(true)
    await supabase
      .from('class_sessions')
      .update({ is_active: false })
      .eq('id', activeSession.id)

    setActiveSession(null)
    setAttendees([])
    await fetchData()
    setEndingSession(false)
  }

  // ─── Create course ─────────────────────────────────────────────────────────
  const createCourse = async () => {
    setCourseFormError(null)
    if (!courseForm.name.trim()) return setCourseFormError('Course name is required.')
    if (!courseForm.faculty.trim()) return setCourseFormError('Faculty is required.')
    if (!courseForm.department.trim()) return setCourseFormError('Department is required.')
    if (!courseForm.level) return setCourseFormError('Level is required.')
    if (!profile) return

    setCreatingCourse(true)
    const { error } = await supabase.from('courses').insert({
      lecturer_id: profile.id,
      name: courseForm.name.trim(),
      code: courseForm.code.trim() || null,
      faculty: courseForm.faculty.trim(),
      department: courseForm.department.trim(),
      level: courseForm.level,
    })

    if (error) {
      setCourseFormError(error.message)
    } else {
      setShowCreateCourse(false)
      setCourseForm({ name: '', code: '', faculty: '', department: '', level: '' })
      await fetchData()
    }
    setCreatingCourse(false)
  }

  // ─── Expand past session ───────────────────────────────────────────────────
  const toggleExpanded = async (sessionId: string) => {
    if (expandedSession === sessionId) { setExpandedSession(null); return }
    setExpandedSession(sessionId)
    if (expandedAttendees[sessionId]) return

    setLoadingExpanded(sessionId)
    const { data } = await supabase
      .from('class_attendance')
      .select('student_id, marked_at, status, profiles(full_name, track_no, department, photo_url, level)')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: false })

    setExpandedAttendees(prev => ({ ...prev, [sessionId]: (data as unknown as ClassAttendee[]) ?? [] }))
    setLoadingExpanded(null)
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const confirmedCount = attendees.filter(a => a.status === 'confirmed').length
  const pendingCount = attendees.filter(a => a.status !== 'confirmed').length

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-pulse">
          <Loader2 size={36} strokeWidth={2} className="text-primary" />
          <span className="text-text-secondary font-bold tracking-widest uppercase text-xs">Loading your dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary font-sans flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-bg-primary border-b border-border-default px-5 sm:px-8 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-sm tracking-[2px] text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>JAV LITE</span>
            <span className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">Lecturer View</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {profile && (
            <div className="hidden sm:flex items-center gap-2.5">
              <Avatar name={profile.full_name || 'Lecturer'} photoUrl={profile.photo_url} size={28} />
              <span className="text-xs font-semibold text-text-secondary">{profile.full_name?.split(' ')[0]}</span>
            </div>
          )}
          <a
            href="/auth/signout"
            className="flex items-center gap-1.5 text-xs font-bold text-text-tertiary hover:text-error border border-border-default hover:border-error/40 px-3 py-2 rounded-xl transition-all"
          >
            <LogOut size={13} strokeWidth={2} />
            <span className="hidden sm:inline">Sign out</span>
          </a>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-[1100px] w-full mx-auto flex flex-col gap-10 animate-fade-in">

        {/* Page title */}
        <div className="border-b border-border-default pb-6">
          <h1 className="text-3xl font-bold text-text-primary mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Good day{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-sm text-text-secondary">Manage your courses and live class sessions.</p>
        </div>

        {/* ── Live Session ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary">Live Right Now</h2>
            {activeSession && (
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Broadcasting
              </span>
            )}
          </div>

          {activeSession ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Session info card */}
              <div className="lg:col-span-1 card-minimal p-6 flex flex-col gap-5 border-t-4 border-t-success bg-gradient-to-br from-bg-primary to-success/5">
                <div>
                  <span className="block text-[9px] text-text-tertiary uppercase tracking-widest font-bold mb-1">
                    {new Date(activeSession.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <h3 className="text-xl font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-rajdhani)" }}>
                    {(activeSession as any).course?.name ?? 'Class Session'}
                  </h3>
                  {(activeSession as any).course?.code && (
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {(activeSession as any).course.code}
                    </span>
                  )}
                  <div className="flex gap-2 flex-wrap mt-2">
                    <span className="text-[9px] font-bold text-text-secondary bg-bg-secondary border border-border-default px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {(activeSession as any).course?.department}
                    </span>
                    <span className="text-[9px] font-bold text-text-secondary bg-bg-secondary border border-border-default px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Level {(activeSession as any).course?.level}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total', value: attendees.length, color: 'text-primary' },
                    { label: 'Confirmed', value: confirmedCount, color: 'text-success' },
                    { label: 'Pending', value: pendingCount, color: 'text-warning' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-bg-tertiary rounded-xl p-3 border border-border-default flex flex-col gap-1 items-center text-center">
                      <span className={`text-xl font-bold font-mono tracking-tight ${stat.color}`}>{stat.value}</span>
                      <span className="text-[9px] text-text-tertiary uppercase tracking-wider font-bold">{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => activeSession && fetchAttendees(activeSession.id)}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-text-tertiary hover:text-text-primary border border-border-default hover:border-primary/40 rounded-xl py-2.5 transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} strokeWidth={2} />
                    Refresh
                  </button>
                  <button
                    onClick={endSession}
                    disabled={endingSession}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-error hover:text-white hover:bg-error border border-error/30 hover:border-error rounded-xl py-2.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {endingSession ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Square size={13} strokeWidth={2} />}
                    End Session
                  </button>
                </div>
              </div>

              {/* Live attendee list */}
              <div className="lg:col-span-2 card-minimal p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-[3px] text-text-tertiary">Who's In</h4>
                  <span className="font-mono text-xs text-text-secondary font-bold bg-bg-tertiary border border-border-default px-2.5 py-1 rounded-lg">
                    {attendees.length} present
                  </span>
                </div>

                {loadingAttendees ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} strokeWidth={2} className="text-primary" />
                  </div>
                ) : attendees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 opacity-50">
                    <Radio size={32} strokeWidth={1.5} className="text-text-tertiary" />
                    <span className="text-xs text-text-secondary font-medium">Waiting for students to check in…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-none">
                    {attendees.map((a, idx) => (
                      <div
                        key={a.student_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-bg-secondary border border-border-default hover:border-primary/20 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-text-tertiary w-5 text-right flex-shrink-0">{idx + 1}</span>
                        <Avatar
                          name={a.profiles?.full_name || 'Student'}
                          photoUrl={a.profiles?.photo_url}
                          size={34}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary truncate">
                            {a.profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-[10px] font-mono text-text-secondary mt-0.5">
                            {a.profiles?.track_no || '—'} · {a.profiles?.department || '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {a.status === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={10} strokeWidth={2.5} /> Confirmed
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmAttendance(a.student_id)}
                              disabled={confirmingId === a.student_id}
                              className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 hover:bg-primary hover:text-white px-2 py-0.5 rounded-full transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {confirmingId === a.student_id
                                ? <Loader2 size={10} strokeWidth={2.5} className="animate-spin" />
                                : <CheckCircle2 size={10} strokeWidth={2.5} />}
                              Confirm
                            </button>
                          )}
                          <span className="text-[9px] font-mono text-text-tertiary">
                            {new Date(a.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card-minimal p-12 flex flex-col items-center gap-4 text-center border-dashed shadow-none bg-transparent">
              <Radio size={36} strokeWidth={1.5} className="text-text-tertiary opacity-30" />
              <div>
                <h3 className="text-base font-bold text-text-primary mb-1">No class running right now</h3>
                <p className="text-xs text-text-secondary max-w-[280px]">
                  Pick a course below and tap Start Session to go live.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── My Courses ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary">My Courses</h2>
              <span className="text-[10px] font-mono font-bold text-text-secondary bg-bg-secondary border border-border-default px-2 py-0.5 rounded-full">
                {courses.length}
              </span>
            </div>
            <button
              onClick={() => setShowCreateCourse(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white hover:bg-primary border border-primary/30 hover:border-primary px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              New Course
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="card-minimal p-10 text-center border-dashed shadow-none bg-transparent">
              <BookOpen size={28} strokeWidth={1.5} className="text-text-tertiary opacity-30 mx-auto mb-3" />
              <p className="text-xs text-text-secondary">No courses yet. Create your first course to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map(course => {
                const isRunning = activeSession?.course_id === course.id
                const isStarting = startingCourseId === course.id

                return (
                  <div
                    key={course.id}
                    className={`card-minimal p-5 flex flex-col gap-4 border border-border-default transition-all ${isRunning ? 'border-success/40 bg-success/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <GraduationCap size={15} strokeWidth={1.75} className="text-primary" />
                          </div>
                          {isRunning && (
                            <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full">
                              <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                              Live
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                          {course.name}
                        </h3>
                        {course.code && (
                          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                            {course.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] text-text-tertiary leading-relaxed truncate">{course.faculty}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[9px] font-bold text-text-secondary bg-bg-secondary border border-border-default px-1.5 py-0.5 rounded-full">
                          {course.department}
                        </span>
                        <span className="text-[9px] font-bold text-text-secondary bg-bg-secondary border border-border-default px-1.5 py-0.5 rounded-full">
                          L{course.level}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => !isRunning && !activeSession && startSession(course.id)}
                      disabled={!!activeSession || isStarting}
                      className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl border transition-all
                        ${isRunning
                          ? 'border-success/40 text-success bg-success/10 cursor-default'
                          : activeSession
                            ? 'border-border-default text-text-tertiary opacity-50 cursor-not-allowed'
                            : 'border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary cursor-pointer'
                        }`}
                    >
                      {isStarting
                        ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /> Starting…</>
                        : isRunning
                          ? <><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Session Live</>
                          : <><Play size={13} strokeWidth={2} /> Start Session</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Past Sessions ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4 pb-12">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary">Past Sessions</h2>
            <span className="text-[10px] font-mono font-bold text-text-secondary bg-bg-secondary border border-border-default px-2 py-0.5 rounded-full">
              {pastSessions.length}
            </span>
          </div>

          {pastSessions.length === 0 ? (
            <div className="card-minimal p-10 text-center border-dashed shadow-none bg-transparent">
              <CalendarX size={28} strokeWidth={1.5} className="text-text-tertiary opacity-30 mx-auto mb-3" />
              <p className="text-xs text-text-secondary">No past sessions yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pastSessions.map(session => {
                const isOpen = expandedSession === session.id
                const expanded = expandedAttendees[session.id] ?? []
                const confirmedInSession = expanded.filter(a => a.status === 'confirmed').length

                return (
                  <div key={session.id} className="card-minimal overflow-hidden border border-border-default shadow-sm">
                    <button
                      onClick={() => toggleExpanded(session.id)}
                      className="w-full flex items-center gap-4 p-5 hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                      <div className="p-2.5 rounded-xl bg-bg-tertiary border border-border-default flex-shrink-0">
                        <CalendarDays size={16} strokeWidth={1.75} className="text-text-secondary" />
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                          {(session as any).course?.name ?? 'Class Session'}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(session as any).course?.code && (
                            <span className="text-[9px] font-mono text-primary">{(session as any).course.code}</span>
                          )}
                          <span className="text-[9px] font-mono text-text-secondary">
                            {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-xs text-text-secondary font-mono">
                        <UserCheck size={13} strokeWidth={2} className="text-success" />
                        <span className="font-bold text-text-primary">{isOpen ? confirmedInSession : '—'}</span>
                        <span>confirmed</span>
                      </div>

                      <div className={`text-text-tertiary transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown size={16} strokeWidth={2} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border-default bg-bg-secondary px-5 py-4 flex flex-col gap-3">
                        {loadingExpanded === session.id ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} strokeWidth={2} className="text-primary" />
                          </div>
                        ) : expanded.length === 0 ? (
                          <div className="flex items-center justify-center py-6 gap-2 opacity-50">
                            <CalendarX size={18} strokeWidth={1.75} className="text-text-tertiary" />
                            <span className="text-xs text-text-secondary">No attendance records for this session.</span>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {expanded.map((a, idx) => (
                                <div key={a.student_id} className="flex items-center gap-2.5 p-3 bg-bg-primary rounded-xl border border-border-default">
                                  <span className="text-[9px] font-mono text-text-tertiary w-4 flex-shrink-0">{idx + 1}</span>
                                  <Avatar name={a.profiles?.full_name || 'Student'} photoUrl={a.profiles?.photo_url} size={28} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-text-primary truncate">{a.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-[9px] font-mono text-text-tertiary truncate">{a.profiles?.track_no || '—'}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    {a.status === 'confirmed' ? (
                                      <CheckCircle2 size={14} strokeWidth={2} className="text-success" />
                                    ) : (
                                      <Clock size={14} strokeWidth={2} className="text-warning" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-text-tertiary font-mono pt-1 pl-1">
                              {confirmedInSession} confirmed · {expanded.length - confirmedInSession} pending · {expanded.length} total
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── Create Course Modal ───────────────────────────────────────────── */}
      {showCreateCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-primary rounded-2xl border border-border-default shadow-2xl w-full max-w-[480px] flex flex-col overflow-hidden animate-scale-in">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <div>
                <h2 className="font-bold text-text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>Create New Course</h2>
                <p className="text-xs text-text-secondary mt-0.5">This will appear on students' check-in page.</p>
              </div>
              <button
                onClick={() => { setShowCreateCourse(false); setCourseFormError(null) }}
                className="p-2 rounded-xl hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">

              {/* Course Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Course Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Introduction to Programming"
                  value={courseForm.name}
                  onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Course Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Course Code <span className="text-text-tertiary font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. CSC 101"
                  value={courseForm.code}
                  onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>

              {/* Faculty */}
              <ComboBox
                label="Faculty *"
                placeholder="e.g. Faculty of Natural and Applied Science"
                suggestions={FACULTIES}
                value={courseForm.faculty}
                onChange={v => setCourseForm(f => ({ ...f, faculty: v }))}
                required
              />

              {/* Department */}
              <ComboBox
                label="Department *"
                placeholder="e.g. Computer Science"
                suggestions={DEPARTMENTS}
                value={courseForm.department}
                onChange={v => setCourseForm(f => ({ ...f, department: v }))}
                required
              />

              {/* Level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Level *</label>
                <div className="flex gap-2 flex-wrap">
                  {LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCourseForm(f => ({ ...f, level: lvl }))}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        courseForm.level === lvl
                          ? 'border-primary bg-primary text-white'
                          : 'border-border-default bg-bg-secondary text-text-secondary hover:border-primary/50'
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {courseFormError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium">
                  {courseFormError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-border-default flex gap-3">
              <button
                onClick={() => { setShowCreateCourse(false); setCourseFormError(null) }}
                className="flex-1 py-3 rounded-xl border border-border-default text-sm font-bold text-text-secondary hover:bg-bg-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createCourse}
                disabled={creatingCourse}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creatingCourse
                  ? <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Creating…</>
                  : <><Plus size={15} strokeWidth={2} /> Create Course</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
