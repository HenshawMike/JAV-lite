'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ConsentBox } from '@/components/ConsentBox'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  GraduationCap,
  BookOpen,
  UserCheck,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Building2,
  CheckCircle2,
  LogOut
} from '@/components/ui/icons'
import Image from 'next/image'

interface School {
  id: string
  name: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [schools, setSchools] = useState<School[]>([])

  // Selection
  const [selectedRole, setSelectedRole] = useState<'student' | 'lecturer' | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)

  // Lecturer specific fields
  const [lecturerName, setLecturerName] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
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

        if (prof?.is_admin || prof?.role === 'admin') {
          router.push('/admin')
          return
        }

        // Check if user has already completed onboarding
        const { data: consents } = await supabase
          .from('consents')
          .select('id')
          .eq('user_id', authUser.id)
          .limit(1)

        if ((consents && consents.length > 0) || prof?.registered) {
          if (prof?.role === 'lecturer') {
            router.push('/lecturer')
            return
          } else {
            router.push('/home')
            return
          }
        }

        setProfile(prof)
        if (prof?.full_name) {
          setLecturerName(prof.full_name)
        } else if (authUser.user_metadata?.full_name) {
          setLecturerName(authUser.user_metadata.full_name)
        }

        // Fetch schools
        const { data: schoolList } = await supabase
          .from('schools')
          .select('id, name')
          .order('name')

        setSchools(schoolList || [])
      } catch (err) {
        console.error('Error loading onboarding:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router, supabase])

  const handleStudentContinue = async () => {
    if (!consentAccepted) {
      setConsentError('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      // Record consent in consents table
      const { error: consentErr } = await supabase.from('consents').insert([
        { user_id: user.id, doc_type: 'privacy', version: '1.0' },
        { user_id: user.id, doc_type: 'terms', version: '1.0' },
      ])
      if (consentErr) throw consentErr

      // Ensure profile role is student
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ role: 'student' })
        .eq('id', user.id)
      if (profErr) throw profErr

      router.push('/home')
    } catch (err: any) {
      console.error('Consent save error:', err)
      setFormError(err.message || 'Failed to save consent. Please try again.')
      setSubmitting(false)
    }
  }

  const handleLecturerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consentAccepted) {
      setConsentError('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    if (!lecturerName.trim()) {
      setFormError('Please enter your full name.')
      return
    }
    if (schools.length > 0 && !selectedSchoolId) {
      setFormError('Please select your institution / school.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      // Record consents
      const { error: consentErr } = await supabase.from('consents').insert([
        { user_id: user.id, doc_type: 'privacy', version: '1.0' },
        { user_id: user.id, doc_type: 'terms', version: '1.0' },
      ])
      if (consentErr) throw consentErr

      // Update profile with lecturer role & pending status
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: lecturerName.trim(),
          school_id: selectedSchoolId || null,
          role: 'lecturer',
          lecturer_status: 'pending',
        })
        .eq('id', user.id)

      if (profErr) throw profErr

      router.push('/lecturer')
    } catch (err: any) {
      console.error('Lecturer registration error:', err)
      setFormError(err.message || 'Failed to register as lecturer. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Loading onboarding...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-border-default flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={24} height={24} className="select-none" priority />
          </div>
          <span className="font-bold text-base tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            JAV LITE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/')
            }}
            className="text-xs text-text-tertiary hover:text-error transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-default hover:border-error/30"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-lg bg-bg-primary sm:bg-bg-secondary/50 sm:p-8 rounded-3xl sm:border sm:border-border-default shadow-xl flex flex-col gap-6 animate-fade-in">
          
          <div>
            <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Get Started</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              Choose your account type
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Select how you will be using JAV Lite at your institution.
            </p>
          </div>

          {/* Role Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* Student Card */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole('student')
                setFormError(null)
              }}
              className={`p-5 rounded-2xl border text-left flex flex-col gap-3 transition-all cursor-pointer relative ${
                selectedRole === 'student'
                  ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(196,30,187,0.15)] ring-2 ring-primary/20'
                  : 'border-border-default bg-bg-secondary hover:border-text-tertiary'
              }`}
            >
              {selectedRole === 'student' && (
                <div className="absolute top-4 right-4 text-primary">
                  <CheckCircle2 size={18} />
                </div>
              )}
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <GraduationCap size={22} strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-primary">I am a Student</h3>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                  Scan attendance QR codes for your lectures, seminars, and events.
                </p>
              </div>
            </button>

            {/* Lecturer Card */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole('lecturer')
                setFormError(null)
              }}
              className={`p-5 rounded-2xl border text-left flex flex-col gap-3 transition-all cursor-pointer relative ${
                selectedRole === 'lecturer'
                  ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(196,30,187,0.15)] ring-2 ring-primary/20'
                  : 'border-border-default bg-bg-secondary hover:border-text-tertiary'
              }`}
            >
              {selectedRole === 'lecturer' && (
                <div className="absolute top-4 right-4 text-primary">
                  <CheckCircle2 size={18} />
                </div>
              )}
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <BookOpen size={20} strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-primary">I am a Lecturer</h3>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                  Broadcast rotating QR codes, manage rosters, and generate academic reports.
                </p>
              </div>
            </button>

          </div>

          {/* Lecturer Form */}
          {selectedRole === 'lecturer' && (
            <form onSubmit={handleLecturerSubmit} className="flex flex-col gap-4 p-4 rounded-2xl bg-bg-secondary border border-border-default animate-fade-in">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Smith"
                  value={lecturerName}
                  onChange={(e) => setLecturerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">School / Institution *</label>
                <select
                  required
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select your School --</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {schools.length === 0 && (
                  <p className="text-[11px] text-text-tertiary">
                    No schools registered yet. You can still submit and an administrator will link your department.
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-text-secondary flex items-start gap-2">
                <UserCheck size={16} className="text-accent flex-shrink-0 mt-0.5" />
                <span>
                  Lecturer accounts require administrator approval before you can broadcast live QR sessions.
                </span>
              </div>
            </form>
          )}

          {/* Mandatory Consent Box (Section 11) */}
          {selectedRole && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border-default animate-fade-in">
              <ConsentBox
                checked={consentAccepted}
                onChange={(checked) => {
                  setConsentAccepted(checked)
                  if (checked) setConsentError(null)
                }}
                error={consentError}
              />
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-xs text-error font-medium">
              {formError}
            </div>
          )}

          {/* Action Button */}
          {selectedRole && (
            <button
              type="button"
              onClick={selectedRole === 'lecturer' ? handleLecturerSubmit : handleStudentContinue}
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{selectedRole === 'lecturer' ? 'Submit for Lecturer Approval' : 'Continue to Dashboard'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}

        </div>
      </div>
    </main>
  )
}
