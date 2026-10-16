'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/BottomNav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import {
  User,
  ShieldCheck,
  Download,
  Trash2,
  FileText,
  LogOut,
  ChevronRight,
  Loader2,
  Building,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  BookOpen
} from '@/components/ui/icons'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [downloadingData, setDownloadingData] = useState(false)

  // Account deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/')
          return
        }
        setUser(authUser)

        const { data: prof } = await supabase
          .from('profiles')
          .select('*, schools(name), faculties(name), departments(name)')
          .eq('id', authUser.id)
          .single()

        setProfile(prof)
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router, supabase])

  const handleDownloadData = async () => {
    setDownloadingData(true)
    try {
      const res = await fetch('/api/user/data')
      if (!res.ok) throw new Error('Failed to export personal data')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jav_lite_personal_data_${user?.id?.slice(0, 8)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'Error exporting personal data.')
    } finally {
      setDownloadingData(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE exactly to confirm.')
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process account deletion')

      router.push('/')
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting account.')
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white pb-28">
      
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md border-b border-border-default px-5 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
          </div>
          <span className="font-bold text-sm tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            STUDENT PROFILE
          </span>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in">
        
        {/* Profile Card */}
        <div className="p-6 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Avatar name={profile?.full_name || user?.email || 'User'} size={72} />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full mb-1">
              Verified Student Account
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              {profile?.full_name || 'Anonymous Student'}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5 font-mono">{user?.email}</p>

            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              <div className="p-2.5 rounded-xl bg-bg-primary border border-border-default">
                <span className="text-text-tertiary block text-[10px]">Track / ID No.</span>
                <span className="font-mono font-bold text-text-primary">{profile?.track_no || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-bg-primary border border-border-default">
                <span className="text-text-tertiary block text-[10px]">Academic Level</span>
                <span className="font-bold text-text-primary">{profile?.level ? `${profile.level}L` : 'N/A'}</span>
              </div>
            </div>

            {profile?.schools?.name && (
              <p className="text-[11px] text-text-tertiary mt-2">
                {profile.schools.name} · {profile?.departments?.name || profile?.faculties?.name || ''}
              </p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary px-1">
            Academic Ledger
          </h2>

          <Link
            href="/records"
            className="p-4 rounded-2xl bg-bg-secondary border border-border-default hover:border-primary/40 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">View Official Attendance Ledger</p>
                <p className="text-xs text-text-secondary">Read-only immutable records of verified classes</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-text-tertiary" />
          </Link>
        </section>

        {/* Privacy & NDPA 2023 Compliance Center */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary px-1">
            NDPA 2023 Privacy &amp; Data Rights
          </h2>

          <div className="p-5 rounded-2xl bg-bg-secondary border border-border-default flex flex-col gap-4">
            
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Download My Data (Portability)</h3>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Export a complete machine-readable archive containing your profile, signed consent logs, and attendance snapshots.
                </p>
              </div>
              <button
                onClick={handleDownloadData}
                disabled={downloadingData}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingData ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Export JSON</span>
              </button>
            </div>

            <div className="pt-3 border-t border-border-default flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Request Account Erasure</h3>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Permanently anonymize profile details and remove account credentials in accordance with NDPA 2023 guidelines.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-error/10 hover:bg-error text-error hover:text-white border border-error/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>

          </div>
        </section>

        {/* Legal Agreements */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary px-1">
            Legal Agreements
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/terms"
              target="_blank"
              className="p-3.5 rounded-2xl bg-bg-secondary border border-border-default hover:border-primary/40 flex items-center justify-between text-xs font-bold text-text-secondary hover:text-primary transition-all"
            >
              <span className="flex items-center gap-2">
                <FileText size={15} />
                <span>Terms of Service</span>
              </span>
              <ChevronRight size={14} />
            </Link>

            <Link
              href="/privacy"
              target="_blank"
              className="p-3.5 rounded-2xl bg-bg-secondary border border-border-default hover:border-primary/40 flex items-center justify-between text-xs font-bold text-text-secondary hover:text-primary transition-all"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} />
                <span>Privacy Policy</span>
              </span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl border border-error/30 text-error hover:bg-error hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <LogOut size={16} />
          <span>Sign Out of JAV Lite</span>
        </button>

      </main>

      {/* Account Erasure Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-5">
            <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center border border-error/20">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Request Account Deletion
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">
                This will anonymize your profile data and revoke your sign-in access. Academic attendance rows are retained under school audit obligations.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-primary">
                Type <strong className="text-error font-mono">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm font-mono text-text-primary focus:outline-none focus:border-error"
              />
            </div>

            {deleteError && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 py-3 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>Confirm Erasure</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
