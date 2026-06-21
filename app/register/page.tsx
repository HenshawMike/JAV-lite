'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { FaceCapture } from '@/components/FaceCapture'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ComboBox } from '@/components/ui/ComboBox'
import { LEVELS } from '@/lib/constants'
import Image from 'next/image'

const DEFAULT_FACULTIES = [
  'Faculty Of Natural and Applied Science',
  'Faculty of Basic Medical Science',
  'Faculty of Humanities and Social Sciences',
  'Faculty of Law',
  'Faculty of Administrative and Management Science',

]

const DEFAULT_DEPARTMENTS = [
  'Computer Science',
  'Accounting',
  'Software Engineering',
  'Cybersecurity',
  'Medical Laboratory Science',
  'Nursing Science',
  'Mass Communication',
  'Economics',
  'Business Administration',
  'Law',
]

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sessionUser, setSessionUser] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  // Form states
  const [fullName, setFullName] = useState('')
  const [trackNo, setTrackNo] = useState('')
  const [level, setLevel] = useState('')
  const [faculty, setFaculty] = useState('')
  const [department, setDepartment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  // Suggestion states
  const [existingFaculties, setExistingFaculties] = useState<string[]>(DEFAULT_FACULTIES)
  const [existingDepartments, setExistingDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS)

  // Interaction states
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackNoValidating, setTrackNoValidating] = useState(false)
  const [trackNoErr, setTrackNoErr] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuthAndLoadSuggestions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('registered, full_name')
        .eq('id', user.id)
        .single()

      if (profile?.registered) {
        router.push('/attend')
        return
      }

      setSessionUser(user)
      if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name)
      }
      setLoadingSession(false)

      // Load suggestion data from profiles
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('faculty, department')
          .not('registered', 'is', false)

        if (profilesData) {
          const dbFaculties = profilesData.map(p => p.faculty).filter(Boolean) as string[]
          const dbDepartments = profilesData.map(p => p.department).filter(Boolean) as string[]

          const combinedFaculties = Array.from(new Set([...DEFAULT_FACULTIES, ...dbFaculties]))
          const combinedDepartments = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...dbDepartments]))

          setExistingFaculties(combinedFaculties)
          setExistingDepartments(combinedDepartments)
        }
      } catch (err) {
        console.error('Failed to load profile suggestions:', err)
      }
    }
    checkAuthAndLoadSuggestions()
  }, [router])

  const validateTrackNo = async () => {
    if (!trackNo.trim()) return
    setTrackNoValidating(true)
    setTrackNoErr(null)

    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id')
        .eq('track_no', trackNo.trim())
        .neq('id', sessionUser.id)
        .maybeSingle()

      if (err) throw err

      if (data) {
        setTrackNoErr('This ID / Track Number is already registered by another student.')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setTrackNoValidating(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full Name must be at least 2 characters.')
      return
    }
    if (!trackNo.trim()) {
      setError('ID / Track Number is required.')
      return
    }
    if (trackNoErr) {
      setError('Please resolve the track number error before submitting.')
      return
    }
    if (!faculty.trim()) {
      setError('Faculty is required.')
      return
    }
    if (!department.trim()) {
      setError('Department is required.')
      return
    }
    if (!level) {
      setError('Please select a student level.')
      return
    }
    if (!photoUrl) {
      setError('Please capture your face photo before finalizing enrollment.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .upsert({
          id: sessionUser.id,
          email: sessionUser.email!,
          full_name: fullName.trim(),
          track_no: trackNo.trim(),
          level,
          faculty: faculty.trim(),
          department: department.trim(),
          photo_url: photoUrl,
          registered: true
        })

      if (updateErr) throw updateErr

      router.push('/attend')
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile.')
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    window.location.href = '/auth/signout'
  }

  if (loadingSession) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center dynamic-gradient-bg">
        <div className="card-minimal p-12 flex flex-col items-center gap-6 animate-pulse">
          <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-text-secondary font-bold tracking-widest uppercase text-xs">Authenticating...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-bg-tertiary flex flex-col font-sans">
      {/* Header bar */}
      <header className="w-full border-b border-border-default px-6 md:px-12 py-5 flex justify-between items-center sticky top-0 bg-bg-primary z-30 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="bg-bg-secondary p-2.5 rounded-xl border border-border-default shadow-sm hover:border-primary/30 transition-colors">
            <Image
              src="/logo.png"
              alt="JAV Lite"
              width={28}
              height={28}
              className="flex-shrink-0 select-none drop-shadow-sm"
            />
          </div>
          <div>
            <div
              className="font-bold text-xl tracking-[4px] text-text-primary leading-none flex items-center gap-2"
              style={{ fontFamily: "var(--font-rajdhani)" }}
            >
              JAV
              <Image src="/lite.png" alt="Lite" width={42} height={18} className="object-contain w-auto h-[18px] opacity-90" />
            </div>
            <span className="text-[10px] text-primary tracking-[0.2em] font-semibold uppercase mt-1.5 block opacity-80">
              Say Hello!
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-xs font-bold text-text-secondary hover:text-text-primary border border-border-default px-5 py-2.5 rounded-xl hover:bg-bg-secondary transition-all duration-300 cursor-pointer uppercase tracking-[0.15em] hover:border-text-tertiary hover:shadow-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 px-4 md:px-8 lg:px-12 py-12 lg:py-20 w-full max-w-[1400px] mx-auto animate-fade-in flex flex-col">

        {/* Page heading */}
        <div className="mb-12 lg:mb-16 max-w-3xl pl-2">
          <div className="inline-flex items-center gap-3 mb-6 bg-primary/10 px-4 py-2 rounded-full border border-primary/20 shadow-sm backdrop-blur-sm">
            <span className="h-2 w-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary">
              New Here?
            </p>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[4rem] lg:leading-[1.1] font-bold text-text-primary mb-6 tracking-tight" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Set Up Your Profile
          </h1>
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl font-medium opacity-90">
            Tell us a bit about yourself and snap a quick pic so we can link your beautiful face to your classes!
          </p>
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start">

          {/* Left: Photo Setup (5 cols) */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            <div className="card-minimal p-6 md:p-10 flex flex-col gap-8 shadow-sm hover:shadow-md border border-border-default rounded-[24px] relative overflow-hidden transition-all duration-500 bg-bg-primary">
              {/* Decorative top strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary to-accent opacity-90" />

              <div className="mt-2">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-4 mb-3 tracking-wide" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-xl border border-primary/20">01</span>
                  Selfie Time!
                  <svg className="w-6 h-6 text-primary ml-auto opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </h2>
                <p className="text-sm text-text-secondary font-medium pl-[56px]">Capture your face for magical check-ins.</p>
              </div>

              <div className="p-3 border border-border-default rounded-2xl bg-bg-secondary/50 shadow-inner">
                <FaceCapture onUpload={setPhotoUrl} currentUrl={photoUrl} />
              </div>

              {/* Status Indicator */}
              <div className="mt-2 flex items-center gap-3.5 p-5 bg-bg-secondary/80 border border-border-default rounded-xl text-sm font-medium shadow-sm">
                <div className={`w-3.5 h-3.5 rounded-full shadow-[0_0_12px_currentColor] flex-shrink-0 transition-colors duration-300 ${photoUrl ? 'bg-success text-success' : 'bg-warning text-warning'}`} />
                <span className={`tracking-wide transition-colors duration-300 ${photoUrl ? 'text-success font-bold' : 'text-warning font-semibold'}`}>
                  {photoUrl ? "Looking good! Pic saved." : "Waiting for your awesome smile..."}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Academic Info Form (7 cols) */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            <div className="card-minimal p-6 md:p-10 lg:p-12 flex flex-col gap-10 shadow-sm hover:shadow-md border border-border-default rounded-[24px] relative overflow-hidden transition-all duration-500 bg-bg-primary">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-border-default opacity-40" />

              <div className="mt-2">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-4 mb-3 tracking-wide" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-tertiary text-text-tertiary text-xl border border-border-default">02</span>
                  School Info
                  <svg className="w-6 h-6 text-text-tertiary ml-auto opacity-70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                </h2>
                <p className="text-sm text-text-secondary font-medium pl-[56px]">Just the basics so we know where to put you.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7 lg:gap-8">
                <div className="md:col-span-2">
                  <Input
                    label="What should we call you? *"
                    placeholder="e.g. Amara Osei"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="text-base py-4"
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Your ID / Track Number *"
                    placeholder="e.g. CS-2026-001"
                    value={trackNo}
                    onChange={(e) => setTrackNo(e.target.value)}
                    onBlur={validateTrackNo}
                    error={trackNoErr || undefined}
                    className="font-mono text-lg py-4"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <ComboBox
                    label="Faculty *"
                    placeholder="e.g. Faculty Of Natural and Applied Science"
                    suggestions={existingFaculties}
                    value={faculty}
                    onChange={setFaculty}
                    required
                  />
                </div>

                <div className="w-full">
                  <ComboBox
                    label="Department *"
                    placeholder="e.g. Computer Science"
                    suggestions={existingDepartments}
                    value={department}
                    onChange={setDepartment}
                    required
                  />
                </div>

                <div className="w-full">
                  <Select
                    label="Academic Level Validation *"
                    placeholder="Assign Level..."
                    options={LEVELS.map(l => ({ value: l, label: `Level ${l}` }))}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    required
                    className="text-base py-4"
                  />
                </div>
              </div>

              <div className="pt-10 mt-4 border-t border-border-default/60 flex flex-col gap-6">
                {error && (
                  <div className="flex items-center gap-4 p-5 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-medium animate-fade-in shadow-sm">
                    <span className="text-xl bg-error/10 p-2 rounded-lg">⚠️</span> {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={!fullName || !trackNo || !level || !department || !faculty || !photoUrl || !!trackNoErr || trackNoValidating}
                  className="w-full py-5 text-[17px] font-bold shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex gap-3 rounded-xl"
                >
                  All done! Jump in <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </Button>
                <div className="flex justify-center items-center gap-2.5 mt-2 opacity-80 pt-2">
                  <svg className="w-4 h-4 text-success drop-shadow-[0_0_4px_var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  <p className="text-[11px] text-text-tertiary uppercase tracking-[0.2em] font-bold">
                    Safe & Sound in the cloud
                  </p>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>
    </main>
  )
}
