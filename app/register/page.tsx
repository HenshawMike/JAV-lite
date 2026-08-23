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
import { LEVELS, DEPARTMENTS, FACULTIES } from '@/lib/constants'
import { Camera, GraduationCap, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from '@/components/ui/icons'
import Image from 'next/image'

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
  const [existingFaculties, setExistingFaculties] = useState<string[]>(FACULTIES)
  const [existingDepartments, setExistingDepartments] = useState<string[]>(DEPARTMENTS)

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

          const combinedFaculties = Array.from(new Set([...FACULTIES, ...dbFaculties]))
          const combinedDepartments = Array.from(new Set([...DEPARTMENTS, ...dbDepartments]))

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
        .update({
          full_name: fullName.trim(),
          track_no: trackNo.trim(),
          level,
          faculty: faculty.trim(),
          department: department.trim(),
          photo_url: photoUrl,
          registered: true
        })
        .eq('id', sessionUser.id)

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
        <div className="card-minimal p-12 flex flex-col items-center gap-5 animate-pulse">
          <Loader2 size={36} strokeWidth={2} className="text-primary" />
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
            Tell us a bit about yourself and snap a quick pic so we can link your face to your classes!
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
                  <Camera size={22} strokeWidth={1.75} className="text-primary ml-auto opacity-80" />
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
                  {photoUrl ? "Looking good! Pic saved." : "Waiting for your photo..."}
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
                  <GraduationCap size={22} strokeWidth={1.75} className="text-text-tertiary ml-auto opacity-70" />
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
                  <div className="flex items-center gap-3 p-4 bg-error/10 border border-error/20 rounded-xl text-sm text-error font-medium animate-fade-in shadow-sm">
                    <AlertCircle size={18} strokeWidth={2} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={!fullName || !trackNo || !level || !department || !faculty || !photoUrl || !!trackNoErr || trackNoValidating}
                  className="w-full py-5 text-[17px] font-bold shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3 rounded-xl"
                >
                  All done! Jump in <ArrowRight size={18} strokeWidth={2.5} />
                </Button>
                <div className="flex justify-center items-center gap-2 mt-2 opacity-80 pt-2">
                  <ShieldCheck size={16} strokeWidth={2} className="text-success" />
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
