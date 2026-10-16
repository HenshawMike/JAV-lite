'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { QrScanner } from '@/components/QrScanner'
import { ConsentBox } from '@/components/ConsentBox'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { BottomNav } from '@/components/BottomNav'
import { LEVELS } from '@/lib/constants'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Loader2,
  RefreshCw,
  QrCode,
  GraduationCap,
  Calendar,
  Building,
  User,
  Hash
} from '@/components/ui/icons'

interface School {
  id: string
  name: string
}
interface Faculty {
  id: string
  school_id: string
  name: string
}
interface Department {
  id: string
  faculty_id: string
  name: string
}

import { getCachedStudentData, setCachedStudentData } from '@/lib/studentCache'

export default function ScanPage() {
  const router = useRouter()
  const supabase = createClient()

  const [cachedProfile] = useState(() => getCachedStudentData<any>('profile'))

  const [loadingUser, setLoadingUser] = useState(!cachedProfile)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(cachedProfile)

  // Scanning state
  const [scanStep, setScanStep] = useState<'scanning' | 'registering' | 'confirming' | 'success' | 'error'>('scanning')
  const [claimData, setClaimData] = useState<any>(null)
  const [claiming, setClaiming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<any>(null)

  // Ticket timer
  const [ticketSecondsLeft, setTicketSecondsLeft] = useState<number>(600)

  // Registration form fields
  const [schools, setSchools] = useState<School[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  const [formData, setFormData] = useState({
    fullName: '',
    trackNo: '',
    level: '100',
    schoolId: '',
    facultyId: '',
    departmentId: '',
    termsAccepted: false,
  })
  const [formError, setFormError] = useState<string | null>(null)

  // 1. Initial User & Org Data Fetch
  useEffect(() => {
    async function init() {
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

        setProfile(prof)
        setCachedStudentData('profile', prof)
        if (prof?.full_name) {
          setFormData(f => ({ ...f, fullName: prof.full_name }))
        } else if (authUser.user_metadata?.full_name) {
          setFormData(f => ({ ...f, fullName: authUser.user_metadata.full_name }))
        }

        // Load schools, faculties, departments
        const [schoolsRes, facultiesRes, deptsRes] = await Promise.all([
          supabase.from('schools').select('*').order('name'),
          supabase.from('faculties').select('*').order('name'),
          supabase.from('departments').select('*').order('name'),
        ])

        setSchools(schoolsRes.data || [])
        setFaculties(facultiesRes.data || [])
        setDepartments(deptsRes.data || [])
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setLoadingUser(false)
      }
    }
    init()
  }, [router, supabase])

  // 2. Ticket Countdown Timer
  useEffect(() => {
    if ((scanStep === 'registering' || scanStep === 'confirming') && claimData?.claimExpiresAt) {
      const interval = setInterval(() => {
        const diff = claimData.claimExpiresAt - Math.floor(Date.now() / 1000)
        if (diff <= 0) {
          setTicketSecondsLeft(0)
          setFormError('Claim ticket expired. Please rescan the QR code to verify live attendance.')
        } else {
          setTicketSecondsLeft(diff)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [scanStep, claimData])

  // 3. QR Scan Handler
  const handleScanSuccess = async (decodedText: string) => {
    if (claiming || scanStep !== 'scanning') return
    setClaiming(true)
    setErrorMessage(null)

    try {
      if (!decodedText.startsWith('JAV1.')) {
        setErrorMessage('This is not a JAV Lite QR code. Please scan a valid session code.')
        setScanStep('error')
        setClaiming(false)
        return
      }

      const res = await fetch('/api/claim-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: decodedText }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to verify QR code')
        setScanStep('error')
        setClaiming(false)
        return
      }

      if (data.alreadyMarked) {
        setErrorMessage(`You have already marked attendance for ${data.session.name} at ${new Date(data.markedAt).toLocaleTimeString()}.`)
        setScanStep('error')
        setClaiming(false)
        return
      }

      setClaimData(data)
      setTicketSecondsLeft(data.claimExpiresAt - Math.floor(Date.now() / 1000))

      if (profile?.registered || data.profile?.registered) {
        setScanStep('confirming')
      } else {
        setScanStep('registering')
      }
    } catch (err: any) {
      console.error('Claim error:', err)
      setErrorMessage(err.message || 'Network error while verifying QR code')
      setScanStep('error')
    } finally {
      setClaiming(false)
    }
  }

  // 4. Submit Registration & Mark
  const handleRegisterAndMark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setFormError('Please enter your full name (minimum 2 characters).')
      return
    }
    if (!formData.trackNo.trim()) {
      setFormError('Please enter your Track / Student ID number.')
      return
    }
    if (!formData.termsAccepted) {
      setFormError('You must agree to the Terms of Service and Privacy Policy.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch('/api/register-and-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimTicket: claimData.claimTicket,
          fullName: formData.fullName.trim(),
          trackNo: formData.trackNo.trim(),
          level: formData.level,
          schoolId: formData.schoolId || null,
          facultyId: formData.facultyId || null,
          departmentId: formData.departmentId || null,
          termsAccepted: true,
          privacyAccepted: true,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete registration and attendance.')
      }

      setSuccessInfo({
        sessionName: claimData.session.name,
        hostName: claimData.session.hostName,
        schoolName: claimData.session.schoolName,
        markedAt: new Date().toISOString(),
      })
      setScanStep('success')
    } catch (err: any) {
      console.error('Register and mark error:', err)
      setFormError(err.message || 'An error occurred during submission.')
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Submit Returning Attendance
  const handleMarkAttendance = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimTicket: claimData.claimTicket,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record attendance.')
      }

      setSuccessInfo({
        sessionName: claimData.session.name,
        hostName: claimData.session.hostName,
        schoolName: claimData.session.schoolName,
        markedAt: new Date().toISOString(),
      })
      setScanStep('success')
    } catch (err: any) {
      console.error('Mark attendance error:', err)
      setErrorMessage(err.message || 'Failed to record attendance.')
      setScanStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTicketTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const filteredFaculties = faculties.filter(f => !formData.schoolId || f.school_id === formData.schoolId)
  const filteredDepartments = departments.filter(d => !formData.facultyId || d.faculty_id === formData.facultyId)

  if (loadingUser) {
    return (
      <div className="min-h-[100dvh] bg-bg-primary flex flex-col items-center justify-center pb-24">
        <Loader2 size={36} className="animate-spin text-primary" />
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white pb-24">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md border-b border-border-default px-5 py-3.5 flex justify-between items-center">
        <Link
          href="/home"
          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Home</span>
        </Link>

        <span className="font-bold text-sm tracking-wider text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          QR SCANNER
        </span>

        <ThemeToggle />
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-lg w-full mx-auto p-5 sm:p-8 flex flex-col items-center justify-center animate-fade-in">
        
        {/* ── STEP 1: SCANNING ──────────────────────────────────────────────── */}
        {scanStep === 'scanning' && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Scan JAV Attendance QR
              </h1>
              <p className="text-xs text-text-secondary mt-1 max-w-xs">
                Aim your camera at the rotating code shown on the lecturer&apos;s screen.
              </p>
            </div>

            {/* Viewfinder Scanner */}
            <QrScanner onScanSuccess={handleScanSuccess} />

            {claiming && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span>Verifying Live Code Signature...</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: FIRST-SCAN REGISTRATION FORM (Section 6.4 & 6.5) ─────── */}
        {scanStep === 'registering' && claimData && (
          <div className="w-full bg-bg-secondary p-6 sm:p-8 rounded-3xl border border-border-default shadow-xl flex flex-col gap-6 animate-scale-in">
            
            {/* Live Verification Badge & Session Summary Header */}
            <div className="p-4 rounded-2xl bg-bg-primary border border-border-default flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                  <ShieldCheck size={13} />
                  Live code verified
                </span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${
                  ticketSecondsLeft < 120 ? 'bg-error/10 text-error border-error/30 animate-pulse' : 'bg-bg-secondary text-primary border-border-default'
                }`}>
                  <Clock size={12} className="inline mr-1 -mt-0.5" />
                  {formatTicketTime(ticketSecondsLeft)}
                </span>
              </div>

              <div>
                <h2 className="font-bold text-base text-text-primary leading-tight" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                  {claimData.session.name}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Host: <strong className="text-text-primary">{claimData.session.hostName}</strong> · {claimData.session.schoolName}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Student Registration
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Complete your details once. Future attendance scans will mark with 1-tap.
              </p>
            </div>

            <form onSubmit={handleRegisterAndMark} className="flex flex-col gap-4">
              
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adebayo"
                  value={formData.fullName}
                  onChange={e => setFormData(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              {/* Track / ID Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Track / Student ID Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRK-2024-8891"
                  value={formData.trackNo}
                  onChange={e => setFormData(f => ({ ...f, trackNo: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary font-mono uppercase focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-text-tertiary">
                  Unique ID for your institution. Read-only on your records once submitted.
                </p>
              </div>

              {/* Level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Academic Level *</label>
                <div className="grid grid-cols-5 gap-2">
                  {LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, level: lvl }))}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        formData.level === lvl
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-border-default bg-bg-primary text-text-secondary hover:border-primary/40'
                      }`}
                    >
                      {lvl}L
                    </button>
                  ))}
                </div>
              </div>

              {/* School */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">School / Institution</label>
                <select
                  value={formData.schoolId}
                  onChange={e => setFormData(f => ({ ...f, schoolId: e.target.value, facultyId: '', departmentId: '' }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select School --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Faculty */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Faculty</label>
                <select
                  value={formData.facultyId}
                  onChange={e => setFormData(f => ({ ...f, facultyId: e.target.value, departmentId: '' }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select Faculty --</option>
                  {filteredFaculties.map(fac => (
                    <option key={fac.id} value={fac.id}>{fac.name}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={e => setFormData(f => ({ ...f, departmentId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">-- Select Department --</option>
                  {filteredDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Mandatory Consent Checkbox */}
              <div className="pt-2 border-t border-border-default">
                <ConsentBox
                  checked={formData.termsAccepted}
                  onChange={checked => setFormData(f => ({ ...f, termsAccepted: checked }))}
                />
              </div>

              {formError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || ticketSecondsLeft <= 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-2"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Register &amp; Mark Attendance</span>
                  </>
                )}
              </button>

              {ticketSecondsLeft <= 0 && (
                <button
                  type="button"
                  onClick={() => setScanStep('scanning')}
                  className="w-full py-2.5 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-primary transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  <span>Rescan QR Code (Keep Form Data)</span>
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── STEP 3: RETURNING STUDENT CONFIRMATION ────────────────────────── */}
        {scanStep === 'confirming' && claimData && (
          <div className="w-full bg-bg-secondary p-6 sm:p-8 rounded-3xl border border-border-default shadow-xl flex flex-col gap-6 animate-scale-in">
            
            <div className="p-4 rounded-2xl bg-bg-primary border border-border-default flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                  <ShieldCheck size={13} />
                  Live code verified
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-bg-secondary text-primary border border-border-default">
                  <Clock size={12} className="inline mr-1 -mt-0.5" />
                  {formatTicketTime(ticketSecondsLeft)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                  {claimData.session.courseCode || 'CLASS'}
                </span>
                <h2 className="font-bold text-xl text-text-primary mt-1 leading-tight" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                  {claimData.session.name}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Host: <strong className="text-text-primary">{claimData.session.hostName}</strong> · {claimData.session.schoolName}
                </p>
              </div>
            </div>

            {/* Profile Snapshot Preview */}
            <div className="p-4 rounded-2xl bg-bg-primary/50 border border-border-default text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Student Name:</span>
                <span className="font-bold text-text-primary">{profile?.full_name || user?.user_metadata?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Track / ID No:</span>
                <span className="font-mono font-bold text-text-primary">{profile?.track_no || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Level:</span>
                <span className="font-bold text-text-primary">{profile?.level}L</span>
              </div>
            </div>

            <button
              onClick={handleMarkAttendance}
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                  <span>Confirm Attendance</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 4: SUCCESS SCREEN ────────────────────────────────────────── */}
        {scanStep === 'success' && successInfo && (
          <div className="w-full bg-bg-secondary p-8 rounded-3xl border border-border-default shadow-xl flex flex-col items-center text-center gap-6 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center border-2 border-success/30 shadow-lg">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-[3px] text-success">Verified Present</span>
              <h2 className="text-2xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Attendance Recorded!
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Your presence was verified and locked with a cryptographic snapshot.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-bg-primary border border-border-default text-xs flex flex-col gap-2 text-left">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Session:</span>
                <span className="font-bold text-text-primary">{successInfo.sessionName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Host:</span>
                <span className="text-text-primary">{successInfo.hostName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Timestamp:</span>
                <span className="font-mono text-text-primary">
                  {new Date(successInfo.markedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="w-full flex gap-3">
              <Link
                href="/records"
                className="flex-1 py-3 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-primary transition-all text-center"
              >
                View Records
              </Link>
              <Link
                href="/home"
                className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md text-center"
              >
                Done
              </Link>
            </div>
          </div>
        )}

        {/* ── STEP 5: ERROR SCREEN ──────────────────────────────────────────── */}
        {scanStep === 'error' && (
          <div className="w-full bg-bg-secondary p-8 rounded-3xl border border-error/20 shadow-xl flex flex-col items-center text-center gap-6 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center border border-error/30 shadow-md">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                Unable to Mark Attendance
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary mt-2 leading-relaxed max-w-sm">
                {errorMessage || 'The scanned QR code is invalid, expired, or has already been marked.'}
              </p>
            </div>

            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setScanStep('scanning')
                }}
                className="flex-1 py-3.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Scan Again</span>
              </button>
              <Link
                href="/home"
                className="flex-1 py-3.5 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-primary transition-all text-center"
              >
                Back Home
              </Link>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
