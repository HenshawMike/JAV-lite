'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import Image from 'next/image'

interface Event {
  id: string
  name: string
  description: string | null
  date: string
  is_active: boolean
}

export default function AttendPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [activeEvent, setActiveEvent] = useState<Event | null>(null)
  const [alreadyMarked, setAlreadyMarked] = useState(false)
  const [markedTime, setMarkedTime] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        const { data: actEv } = await supabase
          .from('events')
          .select('*')
          .eq('is_active', true)
          .maybeSingle()

        if (actEv) {
          setActiveEvent(actEv)
          
          const { data: att } = await supabase
            .from('attendance')
            .select('marked_at')
            .eq('event_id', actEv.id)
            .eq('student_id', u.id)
            .maybeSingle()
            
          if (att) {
            setAlreadyMarked(true)
            setMarkedTime(att.marked_at)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    checkAuthAndFetch()
  }, [router])

  const handleMarkAttendance = async () => {
    if (!activeEvent || !user) return
    setMarking(true)
    setError(null)

    try {
      const { data, error: markErr } = await supabase
        .from('attendance')
        .insert({
          event_id: activeEvent.id,
          student_id: user.id
        })
        .select('marked_at')
        .single()

      if (markErr) {
        if (markErr.code === '23505') {
          setAlreadyMarked(true)
          setMarkedTime(new Date().toISOString())
        } else {
          throw markErr
        }
      } else {
        setAlreadyMarked(true)
        setMarkedTime(data.marked_at)
      }
    } catch (err: any) {
      setError(err.message || 'Verification rejected. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center dynamic-gradient-bg">
        <div className="flex flex-col items-center gap-6 animate-pulse bg-bg-secondary/40 p-10 rounded-3xl border border-border-default/50 backdrop-blur-xl">
          <svg className="animate-spin h-12 w-12 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
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
      <header className="w-full border-b border-border-default px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center sticky top-0 bg-bg-primary/95 backdrop-blur-md z-30 shadow-sm relative">
        {/* Left: Brand + Student identity */}
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex items-center gap-3 pr-4 sm:pr-6 border-r border-border-default flex-shrink-0">
            <div className="bg-bg-tertiary p-1.5 rounded-lg border border-border-default">
              <Image src="/logo.png" alt="JAV Lite" width={28} height={28} className="select-none w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="font-bold text-base tracking-[3px] text-text-primary hidden md:flex items-center gap-1.5" style={{ fontFamily: "var(--font-rajdhani)" }}>
              JAV
              <Image src="/lite.png" alt="Lite" width={36} height={14} className="object-contain w-auto h-3.5" />
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Avatar name={profile?.full_name || 'User'} photoUrl={profile?.photo_url} size={36} className="sm:!w-10 sm:!h-10 shadow-sm" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-text-primary leading-none truncate pr-2">
                {profile?.full_name || 'Student'}
              </div>
              <div className="text-[10px] sm:text-[11px] text-primary font-mono mt-1.5 tracking-wider truncate font-bold bg-primary/10 inline-block px-2 py-0.5 rounded-md">
                {profile?.track_no || '—'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 pl-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-[11px] sm:text-xs font-bold text-text-secondary hover:text-text-primary border border-border-default px-3 sm:px-4 py-2.5 rounded-lg hover:bg-bg-secondary transition-all duration-200 cursor-pointer whitespace-nowrap uppercase tracking-wider"
          >
            <span className="hidden sm:inline">Sign Out</span>
            <span className="sm:hidden">Exit</span>
          </button>
        </div>
      </header>

      {/* Body Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 z-10 w-full">
        <div className="w-full max-w-[640px] animate-fade-in">

          {/* Context Ribbon */}
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border-default">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[3px] uppercase text-text-tertiary mb-1">
                Student Zone
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                Check-in Booth
              </h1>
            </div>
            {profile?.department && (
              <div className="scale-110 origin-right">
                <Badge text={profile.department} type="department" />
              </div>
            )}
          </div>

          {!activeEvent ? (
            /* Standby State */
            <div className="card-minimal p-10 sm:p-14 flex flex-col items-center text-center shadow-lg border-t-4 border-t-border-default bg-bg-primary">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-bg-tertiary border-2 border-border-default flex items-center justify-center text-text-tertiary mb-6 shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-text-primary mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
                Chilling... <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-[340px]">
                Nothing&apos;s happening right now. Grab a coffee and check back when the teacher starts the class!
              </p>
            </div>
          ) : alreadyMarked ? (
            /* Confirmed Validation State */
            <div className="card-minimal p-8 sm:p-12 border border-success/30 flex flex-col items-center text-center shadow-lg shadow-success/5 bg-gradient-to-b from-bg-primary to-success/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-success" />
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-success-glow border-4 border-success flex items-center justify-center text-2xl sm:text-3xl text-success mb-6 font-bold shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                ✓
              </div>
              
              <Badge text="Boom! You're tapped in." type="success" className="mb-6 scale-110" />
              
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
                {activeEvent.name}
              </h2>
              
              {activeEvent.description && (
                <p className="text-xs sm:text-sm text-text-secondary max-w-[380px] italic leading-relaxed text-balance">
                  &ldquo;{activeEvent.description}&rdquo;
                </p>
              )}
              
              <div className="mt-8 sm:mt-10 border-t border-border-default/50 w-full pt-6 flex flex-col gap-1 items-center">
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-[3px]">Timestamp Hash</span>
                <code className="text-sm sm:text-base font-mono text-success font-bold mt-1.5 bg-success/10 px-4 py-1.5 rounded-lg border border-success/20">
                  {markedTime ? new Date(markedTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                </code>
              </div>
            </div>
          ) : (
            /* Active Event Ready to Validate */
            <div className="card-minimal p-6 sm:p-10 flex flex-col gap-6 sm:gap-8 shadow-lg border-t-4 border-t-primary bg-bg-primary relative">
              <div className="absolute top-4 right-4 animate-pulse">
                <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
              </div>

              <div className="flex flex-col gap-4">
                <Badge text="Live Check-in" type="info" className="self-start scale-110 origin-left" />
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  {activeEvent.name}
                </h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono bg-bg-secondary border border-border-default rounded-md px-3 py-1.5 text-text-secondary font-bold inline-block">
                    {new Date(activeEvent.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {activeEvent.description && (
                <div className="p-4 bg-bg-secondary rounded-lg border-l-4 border-primary">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {activeEvent.description}
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-lg p-4 text-sm text-error font-semibold shadow-sm">
                  <span className="text-lg">✖</span> {error}
                </div>
              )}

              <div className="pt-2 border-t border-border-default/50">
                <button
                  onClick={handleMarkAttendance}
                  disabled={marking}
                  className="group w-full py-5 sm:py-6 bg-text-primary text-bg-primary font-bold text-base sm:text-lg rounded-xl hover:bg-primary active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:bg-border-default cursor-pointer flex items-center justify-center gap-3 shadow-xl hover:shadow-primary-glow"
                  style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: '2px' }}
                >
                  {marking ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Scanning your awesome face...
                    </>
                  ) : (
                    <>
                      <span className="group-hover:-translate-y-1 transition-transform flex items-center justify-center h-full mr-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M6 10h6"></path><path strokeLinecap="round" strokeLinejoin="round" d="M9 7v6"></path></svg>
                      </span>
                      I&apos;M HERE!
                    </>
                  )}
                </button>
                <div className="text-center mt-4 text-[11px] text-text-tertiary uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> As simple as that
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
