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
import {
  ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, Loader2, CheckCircle2
} from '@/components/ui/icons'
import Image from 'next/image'

type Role = 'student' | 'lecturer'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sessionUser, setSessionUser] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [role, setRole] = useState<Role>('student')
  const [step, setStep] = useState(0)

  const [fullName, setFullName] = useState('')
  const [trackNo, setTrackNo] = useState('')
  const [level, setLevel] = useState('')
  const [faculty, setFaculty] = useState('')
  const [department, setDepartment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [existingFaculties, setExistingFaculties] = useState<string[]>(FACULTIES)
  const [existingDepartments, setExistingDepartments] = useState<string[]>(DEPARTMENTS)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackNoValidating, setTrackNoValidating] = useState(false)
  const [trackNoErr, setTrackNoErr] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('jav_selected_role')
    if (stored === 'lecturer' || stored === 'student') setRole(stored)
  }, [])

  useEffect(() => {
    async function checkAuthAndLoadSuggestions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('registered, full_name, role')
        .eq('id', user.id)
        .single()

      if (profile?.registered) {
        router.push(profile.role === 'lecturer' ? '/lecturer' : '/attend')
        return
      }

      setSessionUser(user)
      if (user.user_metadata?.full_name) setFullName(user.user_metadata.full_name)
      setLoadingSession(false)

      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('faculty, department')
          .not('registered', 'is', false)

        if (profilesData) {
          const dbFaculties = profilesData.map(p => p.faculty).filter(Boolean) as string[]
          const dbDepartments = profilesData.map(p => p.department).filter(Boolean) as string[]
          setExistingFaculties(Array.from(new Set([...FACULTIES, ...dbFaculties])))
          setExistingDepartments(Array.from(new Set([...DEPARTMENTS, ...dbDepartments])))
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
      if (data) setTrackNoErr('This ID is already registered by another user.')
    } catch (e) {
      console.error(e)
    } finally {
      setTrackNoValidating(false)
    }
  }

  const steps = ['selfie', 'about', 'school'] as const

  const stepTitles: Record<string, string> = {
    selfie: 'Selfie time!',
    about: 'About you',
    school: 'School info',
  }

  const currentKey = steps[step]
  const isLastStep = step === steps.length - 1

  const validateStep = (): string | null => {
    if (currentKey === 'selfie' && !photoUrl) return 'Please capture your face photo to continue.'
    if (currentKey === 'about') {
      if (!fullName.trim() || fullName.trim().length < 2) return 'Full name must be at least 2 characters.'
      if (!trackNo.trim()) return role === 'student' ? 'ID / Track number is required.' : 'Staff ID is required.'
      if (trackNoErr) return 'Please resolve the ID error before continuing.'
    }
    if (currentKey === 'school') {
      if (!faculty.trim()) return 'Faculty is required.'
      if (!department.trim()) return 'Department is required.'
      if (role === 'student' && !level) return 'Please select a student level.'
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(null)
    if (isLastStep) handleSubmit()
    else setStep(s => s + 1)
  }

  const handleBack = () => {
    setError(null)
    setStep(s => Math.max(0, s - 1))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          track_no: trackNo.trim(),
          level: role === 'student' ? level : null,
          faculty: faculty.trim(),
          department: department.trim(),
          photo_url: photoUrl,
          role,
          registered: true
        })
        .eq('id', sessionUser.id)

      if (updateErr) throw updateErr
      router.push(role === 'lecturer' ? '/lecturer' : '/attend')
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile.')
      setSubmitting(false)
    }
  }

  const handleLogout = () => { window.location.href = '/auth/signout' }

  if (loadingSession) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-pulse">
          <Loader2 size={36} strokeWidth={2} className="text-primary" />
          <span className="text-text-secondary font-bold tracking-widest uppercase text-xs">Authenticating...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-bg-primary flex flex-col font-sans">
      <header className="w-full border-b border-border-default px-6 md:px-12 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite" width={26} height={26} />
          </div>
          <span className="font-bold text-lg tracking-[3px] text-text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>JAV</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button onClick={handleLogout} className="text-xs font-bold text-text-secondary hover:text-text-primary border border-border-default px-4 py-2 rounded-xl hover:bg-bg-secondary transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">

          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border-default'}`} />
            ))}
          </div>

          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
              Step {step + 1} of {steps.length}
            </p>
            <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>
              {stepTitles[currentKey]}
            </h1>
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            {currentKey === 'selfie' && (
              <FaceCapture onUpload={setPhotoUrl} currentUrl={photoUrl} />
            )}

            {currentKey === 'about' && (
              <div className="flex flex-col gap-6">
                <Input
                  label="What should we call you? *"
                  placeholder="e.g. Amara Osei"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label={role === 'student' ? 'Your ID / Track Number *' : 'Your Staff ID *'}
                  placeholder={role === 'student' ? 'e.g. CS-2026-001' : 'e.g. STAFF-0042'}
                  value={trackNo}
                  onChange={(e) => setTrackNo(e.target.value)}
                  onBlur={validateTrackNo}
                  error={trackNoErr || undefined}
                  className="font-mono"
                  required
                />
              </div>
            )}

            {currentKey === 'school' && (
              <div className="flex flex-col gap-6">
                <ComboBox
                  label="Faculty *"
                  placeholder="e.g. Faculty Of Natural and Applied Science"
                  suggestions={existingFaculties}
                  value={faculty}
                  onChange={setFaculty}
                  required
                />
                <ComboBox
                  label="Department *"
                  placeholder="e.g. Computer Science"
                  suggestions={existingDepartments}
                  value={department}
                  onChange={setDepartment}
                  required
                />
                {role === 'student' && (
                  <Select
                    label="Academic Level *"
                    placeholder="Assign level..."
                    options={LEVELS.map(l => ({ value: l, label: `Level ${l}` }))}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    required
                  />
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-3.5 bg-error/10 border border-error/20 rounded-xl text-sm text-error font-medium">
                <AlertCircle size={16} strokeWidth={2} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-border-default text-text-secondary font-bold text-sm hover:bg-bg-tertiary transition-colors"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                  Back
                </button>
              )}
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                onClick={handleNext}
                className="flex-1 py-3.5 font-bold flex items-center justify-center gap-2 rounded-xl"
              >
                {isLastStep ? (
                  <>All done! Jump in <CheckCircle2 size={18} strokeWidth={2.5} /></>
                ) : (
                  <>Next <ArrowRight size={16} strokeWidth={2.5} /></>
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-center items-center gap-2 mt-6 opacity-80">
            <ShieldCheck size={14} strokeWidth={2} className="text-success" />
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.15em] font-bold">
              Safe & sound in the cloud
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
