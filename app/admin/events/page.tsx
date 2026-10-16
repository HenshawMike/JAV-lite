'use client'

// ============================================================================
// Admin Events & QR — v2.0
// Uses the unified 'sessions' table (kind = 'event') with rotating QR codes.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QrDisplay } from '@/components/QrDisplay'
import {
  Radio,
  CalendarX,
  CalendarPlus,
  AlertCircle,
  Loader2,
  QrCode,
  CheckCircle2,
  Clock,
  Users,
  X,
  ChevronDown,
  ChevronUp,
} from '@/components/ui/icons'

interface EventSession {
  id: string
  name: string
  description: string | null
  host_name: string
  school_name: string
  session_date: string
  status: 'open' | 'ended'
  started_at: string
  expires_at: string
  ended_at: string | null
  attendance_count?: number
}

interface School {
  id: string
  name: string
}

export default function AdminEventsPage() {
  const supabase = createClient()

  const [events, setEvents] = useState<EventSession[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [activeQrSessionId, setActiveQrSessionId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [hostName, setHostName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [durationHrs, setDurationHrs] = useState('2')
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Ending state
  const [endingId, setEndingId] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const { data: sessionsData, error: sessErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('kind', 'event')
        .order('started_at', { ascending: false })

      if (sessErr) throw sessErr

      // Fetch attendance counts
      const { data: attData } = await supabase
        .from('attendance')
        .select('session_id')

      const countMap = (attData || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.session_id] = (acc[row.session_id] || 0) + 1
        return acc
      }, {})

      const enriched = (sessionsData || []).map((s: any) => ({
        ...s,
        attendance_count: countMap[s.id] || 0,
      }))

      setEvents(enriched)
    } catch (err) {
      console.error('Fetch events error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: schoolsList } = await supabase.from('schools').select('id, name').order('name')
      setSchools(schoolsList || [])

      // Pre-fill host name from admin profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        if (prof?.full_name) setHostName(prof.full_name)
      }

      await fetchEvents()
    }
    init()
  }, [fetchEvents, supabase])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)

    if (!name.trim()) { setFormErr('Event name is required.'); return }
    if (!hostName.trim()) { setFormErr('Host name is required.'); return }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: prof } = await supabase
        .from('profiles')
        .select('school_id, schools(name)')
        .eq('id', user.id)
        .single()

      const chosenSchoolId = schoolId || (prof as any)?.school_id || null
      const schoolRes = chosenSchoolId
        ? await supabase.from('schools').select('name').eq('id', chosenSchoolId).single()
        : null
      const resolvedSchoolName = (schoolRes?.data as any)?.name || 'JAV Institution'

      const expiresAt = new Date(Date.now() + parseFloat(durationHrs) * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('sessions').insert({
        kind: 'event',
        name: name.trim(),
        description: description.trim() || null,
        host_name: hostName.trim(),
        school_id: chosenSchoolId,
        school_name: resolvedSchoolName,
        created_by: user.id,
        status: 'open',
        rotating: true,
        session_date: sessionDate,
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      })

      if (error) throw error

      setName('')
      setDescription('')
      setSessionDate(new Date().toISOString().split('T')[0])
      setDurationHrs('2')
      await fetchEvents()
    } catch (err: any) {
      setFormErr(err.message || 'Failed to create event.')
    } finally {
      setCreating(false)
    }
  }

  const handleEndEvent = async (eventId: string) => {
    if (!confirm('End this event? Students will no longer be able to scan in.')) return
    setEndingId(eventId)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', eventId)

      if (error) throw error
      if (activeQrSessionId === eventId) setActiveQrSessionId(null)
      await fetchEvents()
    } catch (err) {
      console.error('End event error:', err)
    } finally {
      setEndingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <Loader2 size={36} className="text-primary animate-spin" />
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Loading Events...</span>
      </div>
    )
  }

  const openEvents = events.filter(e => e.status === 'open')
  const pastEvents = events.filter(e => e.status === 'ended')

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* Header */}
      <div className="border-b border-border-default pb-6">
        <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Event Management</span>
        <h1 className="text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          Events & QR Codes
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Create events with rotating QR codes. Students scan to mark attendance in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: Event List */}
        <div className="lg:col-span-8 flex flex-col gap-8">

          {/* Live Events */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary">Live Events</h2>
              <span className="text-[10px] bg-success/10 border border-success/20 text-success px-2 py-0.5 rounded-full font-mono font-bold">
                {openEvents.length} active
              </span>
            </div>

            {openEvents.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-border-default text-center flex flex-col items-center gap-2 text-text-tertiary">
                <Radio size={32} strokeWidth={1.5} className="opacity-40" />
                <p className="text-sm font-bold text-text-primary">No live events</p>
                <p className="text-xs">Create an event using the form to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {openEvents.map(ev => (
                  <div key={ev.id} className="rounded-2xl border border-success/30 bg-success/5 overflow-hidden">
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                            Broadcasting
                          </span>
                          <span className="text-[10px] text-text-tertiary font-mono">
                            {new Date(ev.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                          {ev.name}
                        </h3>
                        <div className="flex items-center gap-3 text-[11px] text-text-tertiary mt-1">
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {ev.attendance_count} checked in
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            Expires {new Date(ev.expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setActiveQrSessionId(activeQrSessionId === ev.id ? null : ev.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
                        >
                          <QrCode size={14} />
                          {activeQrSessionId === ev.id ? 'Hide QR' : 'Show QR'}
                        </button>
                        <button
                          onClick={() => handleEndEvent(ev.id)}
                          disabled={endingId === ev.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bg-secondary border border-border-default text-xs font-bold text-text-secondary hover:border-error hover:text-error transition-all cursor-pointer disabled:opacity-50"
                        >
                          {endingId === ev.id ? <Loader2 size={13} className="animate-spin" /> : <CalendarX size={13} />}
                          End Event
                        </button>
                      </div>
                    </div>

                    {/* QR Display Panel */}
                    {activeQrSessionId === ev.id && (
                      <div className="border-t border-success/20 bg-bg-primary p-6 flex flex-col items-center gap-4 animate-fade-in">
                        <p className="text-xs text-text-secondary text-center max-w-xs">
                          Display this rotating QR on screen. It refreshes every 30 seconds to prevent sharing.
                        </p>
                        <div className="w-full max-w-xs">
                          <QrDisplay
                            sessionId={ev.id}
                            hostName={ev.host_name}
                            sessionName={ev.name}
                            schoolName={ev.school_name}
                            expiresAt={ev.expires_at}
                            onEndSession={async () => { await handleEndEvent(ev.id) }}
                          />
                        </div>
                        <button
                          onClick={() => setActiveQrSessionId(null)}
                          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                        >
                          <X size={12} /> Close QR
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary flex items-center gap-2">
                Past Events
                <span className="text-[10px] bg-bg-secondary border border-border-default text-text-tertiary px-2 py-0.5 rounded-full font-mono font-bold">
                  {pastEvents.length}
                </span>
              </h2>

              <div className="flex flex-col gap-2">
                {pastEvents.map(ev => (
                  <div key={ev.id} className="rounded-2xl border border-border-default bg-bg-secondary overflow-hidden">
                    <button
                      onClick={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                      className="w-full p-4 flex items-center justify-between gap-3 hover:bg-bg-tertiary/50 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                          {ev.name}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-0.5">
                          <span>{new Date(ev.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Users size={10} /> {ev.attendance_count} attended</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-tertiary border border-border-default text-text-tertiary font-bold uppercase">Ended</span>
                        {expandedEventId === ev.id ? <ChevronUp size={14} className="text-text-tertiary" /> : <ChevronDown size={14} className="text-text-tertiary" />}
                      </div>
                    </button>

                    {expandedEventId === ev.id && (
                      <div className="border-t border-border-default p-4 flex flex-col gap-2 text-xs animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-text-tertiary block">Host</span>
                            <span className="font-bold text-text-primary">{ev.host_name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-tertiary block">School</span>
                            <span className="font-bold text-text-primary">{ev.school_name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-tertiary block">Started</span>
                            <span className="font-mono text-text-primary">{new Date(ev.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-tertiary block">Ended</span>
                            <span className="font-mono text-text-primary">{ev.ended_at ? new Date(ev.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                          </div>
                        </div>
                        {ev.description && (
                          <p className="text-text-secondary pt-1 border-t border-border-default/60">{ev.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Create Form */}
        <div className="lg:col-span-4 flex flex-col gap-4 sticky top-24">
          <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary">New Event</h2>
          <form onSubmit={handleCreateEvent} className="p-6 rounded-2xl bg-bg-secondary border border-border-default border-t-4 border-t-primary shadow-md flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>Create Event</h3>
                <div className="p-2 rounded-xl bg-bg-tertiary border border-border-default text-primary">
                  <CalendarPlus size={18} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-xs text-text-secondary">A rotating QR code will be auto-generated.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Event Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tech Seminar 2026"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Host Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Jane Smith"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Description</label>
              <textarea
                rows={2}
                placeholder="Brief event details or agenda..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Date *</label>
                <input
                  type="date"
                  required
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Duration (hrs)</label>
                <select
                  value={durationHrs}
                  onChange={e => setDurationHrs(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  {['1', '2', '3', '4', '6', '8'].map(h => (
                    <option key={h} value={h}>{h} hr{h !== '1' ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {schools.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">School (optional)</label>
                <select
                  value={schoolId}
                  onChange={e => setSchoolId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">-- Use default school --</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {formErr && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-xs text-error font-medium flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                {formErr}
              </div>
            )}

            <button
              type="submit"
              disabled={creating || !name.trim() || !hostName.trim()}
              className="w-full py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:opacity-90 shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {creating ? 'Creating...' : 'Launch Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
