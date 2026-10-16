'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/BottomNav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { LogoutButton } from '@/components/LogoutButton'
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  Radio,
  QrCode,
  Loader2,
  LogOut,
  ChevronRight,
  BookOpen,
  Sparkles,
  User,
  ShieldCheck,
  AlertCircle
} from '@/components/ui/icons'

interface PublicSession {
  id: string
  kind: 'class' | 'event'
  name: string
  course_code: string | null
  description: string | null
  host_name: string
  school_name: string
  session_date: string
  status: 'open' | 'ended'
  started_at: string
  expires_at: string
}

interface AttendedRecord {
  id: string
  session_id: string
  session_name: string
  kind: 'class' | 'event'
  course_code?: string | null
  host_name: string
  session_date: string
  marked_at: string
  entry_type: 'qr' | 'manual'
}

export default function StudentHomePage() {
  const router = useRouter()
  // Stable ref — prevents supabase from being a useCallback dependency that
  // changes on every render and causes an infinite loadData → re-render loop.
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [activeTab, setActiveTab] = useState<'class' | 'event'>('class')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  const [openSessions, setOpenSessions] = useState<PublicSession[]>([])
  const [historyRecords, setHistoryRecords] = useState<AttendedRecord[]>([])

  const loadData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/')
        return
      }
      setUser(authUser)

      // Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (prof?.role === 'admin' || prof?.is_admin) {
        router.push('/admin')
        return
      } else if (prof?.role === 'lecturer') {
        router.push('/lecturer')
        return
      }

      setProfile(prof)

      // Check if consent given
      const { data: consentRows } = await supabase
        .from('consents')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)

      if (!consentRows || consentRows.length === 0) {
        router.push('/onboarding')
        return
      }

      // 1. Fetch Open Sessions from session_public view
      const { data: sessionsData } = await supabase
        .from('session_public')
        .select('*')
        .eq('status', 'open')
        .order('started_at', { ascending: false })

      setOpenSessions((sessionsData as PublicSession[]) || [])

      // 2. Fetch Student's Attended Records from my_records view
      const { data: recordsData } = await supabase
        .from('my_records')
        .select('*')
        .order('marked_at', { ascending: false })

      setHistoryRecords((recordsData as AttendedRecord[]) || [])
    } catch (err) {
      console.error('Error loading student home:', err)
    } finally {
      setLoading(false)
    }
  // supabase is stable (via useRef) so this is safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    loadData()

    // Realtime subscription for sessions
    const channel = supabaseRef.current
      .channel('public:sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData, supabase])

  const filteredOpenSessions = openSessions.filter((s) => s.kind === activeTab)
  const filteredHistory = historyRecords.filter((r) => r.kind === activeTab)

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Loading your sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white pb-28">
      
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md border-b border-border-default px-5 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              JAV LITE
            </span>
            <span className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">
              Student Hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LogoutButton variant="topbar" />
          <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Avatar name={profile?.full_name || user?.email || 'Student'} size={32} />
          </Link>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in">
        
        {/* Welcome Greeting Banner */}
        <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-bg-secondary via-bg-secondary to-primary/10 border border-border-default shadow-sm">
          <div className="relative z-10">
            <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Attendance Portal</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 leading-tight" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              Welcome, {profile?.full_name?.split(' ')[0] || 'Scholar'}!
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              {profile?.track_no ? `ID: ${profile.track_no}` : 'First time? Tap Scan QR to register and mark attendance.'}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Tab Switcher: Classes vs Events */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-bg-secondary border border-border-default">
          <button
            onClick={() => setActiveTab('class')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'class'
                ? 'bg-bg-primary text-primary shadow-sm border border-border-default'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            <GraduationCap size={16} strokeWidth={2.2} />
            <span>Classes</span>
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'event'
                ? 'bg-bg-primary text-primary shadow-sm border border-border-default'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            <Calendar size={15} strokeWidth={2.2} />
            <span>Events</span>
          </button>
        </div>

        {/* Section 1: Open Now (Broadcasting in room) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
                Live &amp; Open Now
              </h2>
              {filteredOpenSessions.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  {filteredOpenSessions.length} active
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-tertiary">
              Scan lecturer&apos;s code to mark
            </span>
          </div>

          {filteredOpenSessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-2 text-text-tertiary">
              <Radio size={28} strokeWidth={1.5} className="opacity-40" />
              <p className="text-xs font-medium">No open {activeTab === 'class' ? 'classes' : 'events'} right now.</p>
              <p className="text-[11px] text-text-tertiary">
                When your lecturer starts a session, it will show here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOpenSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-5 rounded-2xl bg-bg-secondary border border-border-default hover:border-primary/40 transition-all flex flex-col gap-3 shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-mono">
                          {session.course_code || 'LIVE'}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {session.school_name}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                        {session.name}
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Host: <strong className="text-text-primary">{session.host_name}</strong>
                      </p>
                    </div>

                    <Link
                      href="/scan"
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
                    >
                      <QrCode size={14} />
                      <span>Scan Code</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-text-tertiary pt-2 border-t border-border-default/60">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-accent" />
                      Started {new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>·</span>
                    <span className="text-text-secondary font-medium">
                      Attendance verified via dynamic rotating QR
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: My Attended History */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary">
              My Attendance History
            </h2>
            <Link
              href="/records"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Full Records</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-2 text-text-tertiary">
              <CheckCircle2 size={28} strokeWidth={1.5} className="opacity-40" />
              <p className="text-xs font-medium">No attended {activeTab === 'class' ? 'classes' : 'events'} recorded yet.</p>
              <p className="text-[11px] text-text-tertiary">
                Scan your first session QR code using the center button below.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredHistory.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-bg-secondary/70 border border-border-default flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-primary truncate">
                        {item.session_name}
                      </p>
                      <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                        {item.host_name} · {new Date(item.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0 text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-md">
                      {item.entry_type === 'manual' ? 'Manual' : 'Verified QR'}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary mt-0.5">
                      {new Date(item.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
