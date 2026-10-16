'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import {
  BookOpen,
  Clock,
  LogOut,
  Loader2,
  AlertCircle,
  Plus,
  Radio,
  CheckCircle2,
  GraduationCap
} from '@/components/ui/icons'

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function checkLecturer() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/')
          return
        }
        setUser(authUser)

        const { data: prof } = await supabase
          .from('profiles')
          .select('*, schools(name)')
          .eq('id', authUser.id)
          .single()

        if (!prof) {
          router.push('/onboarding')
          return
        }

        if (prof.role === 'admin' || prof.is_admin) {
          // Admins can access lecturer pages
          setProfile(prof)
        } else if (prof.role === 'lecturer') {
          setProfile(prof)
        } else {
          router.push('/home')
          return
        }
      } catch (err) {
        console.error('Lecturer auth check error:', err)
      } finally {
        setLoading(false)
      }
    }
    checkLecturer()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Verifying lecturer credentials...</p>
        </div>
      </div>
    )
  }

  // 1. Pending Approval Screen (Section 3.2 & 17.2)
  if (profile?.role === 'lecturer' && profile?.lecturer_status === 'pending') {
    return (
      <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
        <header className="px-6 py-4 border-b border-border-default flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
              <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
            </div>
            <span className="font-bold text-base tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              JAV LITE LECTURER
            </span>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-bg-secondary p-8 rounded-3xl border border-border-default shadow-xl text-center flex flex-col items-center gap-5 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-warning/10 text-warning flex items-center justify-center border border-warning/20">
              <Clock size={32} strokeWidth={2.2} />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-[3px] text-warning">Pending Verification</span>
              <h1 className="text-2xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Account Under Review
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-2 leading-relaxed">
                Welcome, <strong>{profile.full_name}</strong>. Your lecturer registration for{' '}
                <strong>{profile.schools?.name || 'your institution'}</strong> is currently pending administrator verification.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-bg-primary border border-border-default text-xs text-text-tertiary text-left">
              <p className="font-bold text-text-primary mb-1">Why this check exists:</p>
              <p>
                To prevent fraud and fake attendance reports, an institution administrator must approve all lecturer accounts before classes can be broadcasted.
              </p>
            </div>

            <div className="w-full flex gap-3 pt-2">
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/')
                }}
                className="flex-1 py-3 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-primary transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md"
              >
                Check Status
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 2. Rejected Screen
  if (profile?.role === 'lecturer' && profile?.lecturer_status === 'rejected') {
    return (
      <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans">
        <header className="px-6 py-4 border-b border-border-default flex items-center justify-between">
          <Image src="/logo.png" alt="JAV Lite" width={24} height={24} priority />
          <ThemeToggle />
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-bg-secondary p-8 rounded-3xl border border-error/20 shadow-xl text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-error/10 text-error flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Registration Declined</h1>
            <p className="text-xs text-text-secondary">
              Your lecturer account request was not approved. Please contact your institution&apos;s administrator.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/')
              }}
              className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3. Approved Lecturer / Admin Layout
  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      
      {/* Lecturer Top Header */}
      <header className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md border-b border-border-default px-5 sm:px-8 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/lecturer" className="flex items-center gap-3">
            <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
              <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                JAV LITE
              </span>
              <span className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">
                Lecturer Portal
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/lecturer/new"
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 px-3.5 py-2 rounded-xl shadow-md shadow-primary/20 transition-all"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Start Class</span>
          </Link>

          <ThemeToggle />

          <div className="flex items-center gap-2 pl-2 border-l border-border-default">
            <Avatar name={profile?.full_name || user?.email || 'Lecturer'} size={32} />
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/')
              }}
              title="Sign Out"
              className="p-2 rounded-xl text-text-tertiary hover:text-error hover:bg-bg-secondary transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Child Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  )
}
