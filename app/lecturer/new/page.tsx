'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Clock,
  RefreshCw,
  Loader2,
  Building,
  User,
  CheckCircle2,
  Play
} from '@/components/ui/icons'

interface School {
  id: string
  name: string
}

export default function NewClassSessionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [schools, setSchools] = useState<School[]>([])

  // Form State (Section 7.2)
  const [className, setClassName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [hostName, setHostName] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [autoEndHours, setAutoEndHours] = useState<number>(3)
  const [rotating, setRotating] = useState<boolean>(true)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
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
        if (prof?.full_name) {
          setHostName(prof.full_name)
        }
        if (prof?.school_id) {
          setSelectedSchoolId(prof.school_id)
        }

        const { data: schoolList } = await supabase
          .from('schools')
          .select('id, name')
          .order('name')

        setSchools(schoolList || [])
      } catch (err) {
        console.error('Error loading new class form:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router, supabase])

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!className.trim()) {
      setFormError('Class name is required.')
      return
    }
    if (!hostName.trim()) {
      setFormError('Lecturer / host name is required.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const selectedSchool = schools.find(s => s.id === selectedSchoolId)
      const schoolName = selectedSchool ? selectedSchool.name : 'University'

      const startedAt = new Date()
      const expiresAt = new Date(startedAt.getTime() + autoEndHours * 60 * 60 * 1000)

      const { data: newSession, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          kind: 'class',
          name: className.trim(),
          course_code: courseCode.trim() ? courseCode.trim().toUpperCase() : null,
          host_name: hostName.trim(),
          school_id: selectedSchoolId || null,
          school_name: schoolName,
          created_by: profile.id,
          status: 'open',
          rotating: rotating,
          session_date: startedAt.toISOString().slice(0, 10),
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (sessionErr) throw sessionErr

      // Open live QR screen
      router.push(`/lecturer/session/${newSession.id}`)
    } catch (err: any) {
      console.error('Session start error:', err)
      setFormError(err.message || 'Failed to start class session. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="flex-1 max-w-xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 animate-fade-in">
      
      <div className="flex items-center justify-between">
        <Link
          href="/lecturer"
          className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Back to Classes</span>
        </Link>
      </div>

      <div className="bg-bg-secondary p-6 sm:p-8 rounded-3xl border border-border-default shadow-xl flex flex-col gap-6">
        <div>
          <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">New Live Session</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Start Class Attendance
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Configure session rules and immediately broadcast the live rotating QR code.
          </p>
        </div>

        <form onSubmit={handleStartSession} className="flex flex-col gap-4">
          
          {/* Class Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-primary">Class / Course Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems & Cloud Computing"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Course Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-primary">
              Course Code <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. CSC 401"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-primary text-sm font-mono uppercase text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Host Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-primary">Lecturer Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Prof. David Adeleke"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* School */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-primary">School / Faculty Teaching</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">-- Select School --</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-End Timer Selection (Section 7.2) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-primary">Auto-End Session After</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setAutoEndHours(hrs)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    autoEndHours === hrs
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border-default bg-bg-primary text-text-secondary hover:border-primary/40'
                  }`}
                >
                  {hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-tertiary">
              Sessions automatically close to prevent QR reuse after lecture ends.
            </p>
          </div>

          {/* Rotating QR Toggle */}
          <div className="p-4 rounded-2xl bg-bg-primary border border-border-default flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="text-primary" />
                <span className="text-xs font-bold text-text-primary">Dynamic Rotating QR (Anti-Cheating)</span>
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                Refreshes QR signature every 30 seconds. Prevents code sharing to absent students.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={rotating}
              onClick={() => setRotating(!rotating)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer flex-shrink-0 ${
                rotating ? 'bg-primary' : 'bg-bg-tertiary border border-border-default'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  rotating ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-primary hover:opacity-90 text-white font-bold text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-2"
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                <span>Start &amp; Broadcast Session</span>
              </>
            )}
          </button>
        </form>

      </div>
    </main>
  )
}
