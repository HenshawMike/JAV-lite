'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  GraduationCap,
  Plus,
  Play,
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  Radio,
  Loader2,
  BookOpen,
  MessageSquare,
  Trash2,
  AlertTriangle,
  X
} from '@/components/ui/icons'

interface ClassGroup {
  key: string
  name: string
  course_code: string | null
  school_name: string
  latest_session_id: string
  latest_session_date: string
  latest_status: 'open' | 'ended'
  total_sessions: number
  total_attendees: number
  open_requests_count: number
}

export default function LecturerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<ClassGroup | null>(null)

  const handleDeleteClass = async (classKey: string) => {
    setDeletingKey(classKey)
    try {
      const res = await fetch('/api/lecturer/delete-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete class')
      setConfirmDeleteGroup(null)
      await loadClasses()
    } catch (err: any) {
      alert(err.message || 'Error deleting class')
    } finally {
      setDeletingKey(null)
    }
  }

  const loadClasses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      // Fetch all sessions created by this lecturer
      const { data: sessionsList } = await supabase
        .from('sessions')
        .select('*')
        .eq('created_by', user.id)
        .order('started_at', { ascending: false })

      const sessions = sessionsList || []
      const sessionIds = sessions.map(s => s.id)

      // Fetch attendance counts and correction requests
      let attendanceRows: any[] = []
      let requestRows: any[] = []

      if (sessionIds.length > 0) {
        const [attRes, reqRes] = await Promise.all([
          supabase.from('attendance').select('session_id').in('session_id', sessionIds),
          supabase.from('correction_requests').select('session_id, status').in('session_id', sessionIds),
        ])
        attendanceRows = attRes.data || []
        requestRows = reqRes.data || []
      }

      // Group sessions by distinct classKey (course_code if exists, else name)
      const groupsMap = new Map<string, ClassGroup>()

      sessions.forEach(sess => {
        const key = sess.course_code || sess.name
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            name: sess.name,
            course_code: sess.course_code,
            school_name: sess.school_name,
            latest_session_id: sess.id,
            latest_session_date: sess.session_date,
            latest_status: sess.status,
            total_sessions: 0,
            total_attendees: 0,
            open_requests_count: 0,
          })
        }

        const grp = groupsMap.get(key)!
        grp.total_sessions += 1
        grp.total_attendees += attendanceRows.filter(a => a.session_id === sess.id).length
        grp.open_requests_count += requestRows.filter(r => r.session_id === sess.id && r.status === 'open').length
      })

      setClassGroups(Array.from(groupsMap.values()))
    } catch (err) {
      console.error('Error loading lecturer classes:', err)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in pb-24">
      
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Lecturer Console</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Welcome, {profile?.full_name?.split(' ')[0] || 'Lecturer'}!
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Broadcast dynamic rotating QR codes and manage academic class rosters.
          </p>
        </div>

        <Link
          href="/lecturer/new"
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-primary/25 cursor-pointer transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Create New Class</span>
        </Link>
      </div>

      {/* Classes List */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
            Your Courses &amp; Classes ({classGroups.length})
          </h2>
          <span className="text-xs text-text-tertiary">
            Newest sessions first
          </span>
        </div>

        {classGroups.length === 0 ? (
          <div className="p-12 rounded-3xl border border-dashed border-border-default text-center flex flex-col items-center gap-3 text-text-tertiary">
            <BookOpen size={36} strokeWidth={1.5} className="opacity-40" />
            <p className="text-sm font-bold text-text-primary">No classes created yet</p>
            <p className="text-xs text-text-secondary max-w-xs">
              Tap the &quot;Create New Class&quot; button to launch your first live attendance session.
            </p>
            <Link
              href="/lecturer/new"
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md"
            >
              Start First Class
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {classGroups.map((grp) => (
              <div
                key={grp.key}
                className="p-5 sm:p-6 rounded-3xl bg-bg-secondary border border-border-default hover:border-primary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-sm group"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold ${
                    grp.latest_status === 'open'
                      ? 'bg-success/10 text-success ring-2 ring-success/20 animate-pulse'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <GraduationCap size={24} strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {grp.course_code && (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-mono">
                          {grp.course_code}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        grp.latest_status === 'open'
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-bg-tertiary text-text-tertiary'
                      }`}>
                        {grp.latest_status === 'open' ? 'Live Now' : 'Ended'}
                      </span>
                      {grp.open_requests_count > 0 && (
                        <span className="text-[9px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <MessageSquare size={10} />
                          {grp.open_requests_count} inquiries
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base sm:text-lg text-text-primary leading-tight truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                      {grp.name}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {grp.total_sessions} {grp.total_sessions === 1 ? 'session' : 'sessions'} held · Last: {new Date(grp.latest_session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-border-default/60">
                  <div className="text-right sm:mr-2">
                    <span className="text-lg font-bold font-mono text-text-primary">{grp.total_attendees}</span>
                    <span className="text-[10px] text-text-tertiary block -mt-1 uppercase font-bold">Total Marks</span>
                  </div>

                  {grp.latest_status === 'open' ? (
                    <Link
                      href={`/lecturer/session/${grp.latest_session_id}`}
                      className="px-4 py-2.5 rounded-xl bg-success text-white text-xs font-bold shadow-md hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio size={14} className="animate-pulse" />
                      <span>Live Screen</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/lecturer/class/${encodeURIComponent(grp.key)}`}
                      className="px-4 py-2.5 rounded-xl bg-bg-primary hover:bg-primary hover:text-white border border-border-default hover:border-primary text-text-primary text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Manage &amp; Reports</span>
                      <ChevronRight size={14} />
                    </Link>
                  )}

                  <button
                    onClick={() => setConfirmDeleteGroup(grp)}
                    title="Delete Class"
                    aria-label="Delete Class"
                    className="p-2.5 rounded-xl bg-bg-secondary hover:bg-error/10 text-text-tertiary hover:text-error border border-border-default hover:border-error/30 transition-all cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {confirmDeleteGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-primary border border-border-default rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-error/10 text-error flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <button
                onClick={() => setConfirmDeleteGroup(null)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-text-primary">Delete Class?</h3>
              <p className="text-xs text-text-secondary mt-1">
                Are you sure you want to permanently delete <strong className="text-text-primary">{confirmDeleteGroup.name}</strong> ({confirmDeleteGroup.key})? This will delete all {confirmDeleteGroup.total_sessions} session(s) and recorded attendance marks. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                onClick={() => setConfirmDeleteGroup(null)}
                disabled={deletingKey === confirmDeleteGroup.key}
                className="px-4 py-2.5 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClass(confirmDeleteGroup.key)}
                disabled={deletingKey === confirmDeleteGroup.key}
                className="px-5 py-2.5 rounded-xl bg-error hover:bg-error/90 text-white text-xs font-bold shadow-md shadow-error/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingKey === confirmDeleteGroup.key ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete Class</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile / Desktop (Section 7.1) */}
      <Link
        href="/lecturer/new"
        aria-label="Start New Class"
        className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-40 w-14 h-14 rounded-full bg-primary hover:scale-105 active:scale-95 text-white shadow-[0_10px_25px_rgba(196,30,187,0.5)] flex items-center justify-center transition-transform cursor-pointer border-2 border-white/20"
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>
    </main>
  )
}
