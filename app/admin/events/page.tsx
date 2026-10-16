'use client'

// ============================================================================
// Admin Events & QR — v2.0
// Uses the unified 'sessions' table (kind = 'event') with rotating QR codes.
// Features: Live attendee check-in stream, manual add student with reason,
// and full CSV/PDF export for active and ended/cancelled events.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QrDisplay } from '@/components/QrDisplay'
import { Avatar } from '@/components/ui/Avatar'
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
  Download,
  FileText,
  UserPlus,
  Search,
  Check,
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

interface AttendeeRow {
  id: string
  student_id: string
  full_name: string
  track_no: string
  level?: string | null
  department_name?: string | null
  faculty_name?: string | null
  entry_type: 'qr' | 'manual'
  marked_at: string
}

export default function AdminEventsPage() {
  const supabase = createClient()

  const [events, setEvents] = useState<EventSession[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [activeQrSessionId, setActiveQrSessionId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Attendees map by eventId
  const [attendeesMap, setAttendeesMap] = useState<Record<string, AttendeeRow[]>>({})
  const [loadingAttendees, setLoadingAttendees] = useState<Record<string, boolean>>({})

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

  // Manual Add Student Modal State
  const [manualModalEvent, setManualModalEvent] = useState<EventSession | null>(null)
  const [manualForm, setManualForm] = useState({
    fullName: '',
    trackNo: '',
    level: '100',
    department: '',
    reason: '',
  })
  const [submittingManual, setSubmittingManual] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSuccess, setManualSuccess] = useState(false)

  // Registered students search for autocomplete
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([])
  const [studentSearch, setStudentSearch] = useState('')

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

  // Load attendees for an event
  const loadAttendees = useCallback(async (eventId: string) => {
    setLoadingAttendees(prev => ({ ...prev, [eventId]: true }))
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .or(`session_id.eq.${eventId},event_id.eq.${eventId}`)
        .order('marked_at', { ascending: false })

      if (error) throw error
      setAttendeesMap(prev => ({ ...prev, [eventId]: data || [] }))
    } catch (err) {
      console.error('Failed to load attendees:', err)
    } finally {
      setLoadingAttendees(prev => ({ ...prev, [eventId]: false }))
    }
  }, [supabase])

  // Realtime subscription for live attendance check-ins
  useEffect(() => {
    const channel = supabase
      .channel('admin-events-attendance-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        (payload: any) => {
          const newRow = payload.new as AttendeeRow & { session_id?: string; event_id?: string }
          const sid = newRow.session_id || newRow.event_id
          if (!sid) return

          // Update attendees list if loaded
          setAttendeesMap(prev => {
            const list = prev[sid] || []
            if (list.some(item => item.id === newRow.id)) return prev
            return { ...prev, [sid]: [newRow, ...list] }
          })

          // Bump count in events list
          setEvents(prev =>
            prev.map(ev =>
              ev.id === sid ? { ...ev, attendance_count: (ev.attendance_count || 0) + 1 } : ev
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const [schoolsList, profList] = await Promise.all([
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, track_no, level, department').eq('registered', true).order('full_name'),
      ])
      setSchools(schoolsList.data || [])
      setRegisteredStudents(profList.data || [])

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

  // Automatically load attendees for active events
  useEffect(() => {
    events.filter(e => e.status === 'open').forEach(ev => {
      if (!attendeesMap[ev.id]) {
        loadAttendees(ev.id)
      }
    })
  }, [events, attendeesMap, loadAttendees])

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

  // Manual Add Student Handler
  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualModalEvent) return

    if (!manualForm.fullName.trim() || !manualForm.trackNo.trim()) {
      setManualError('Please provide both full name and track/matric number.')
      return
    }

    if (!manualForm.reason.trim()) {
      setManualError('Reason for manual check-in is mandatory for audit logging.')
      return
    }

    setSubmittingManual(true)
    setManualError(null)

    try {
      const res = await fetch('/api/lecturer/manual-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: manualModalEvent.id,
          fullName: manualForm.fullName.trim(),
          trackNo: manualForm.trackNo.trim(),
          level: manualForm.level,
          reason: manualForm.reason.trim(),
          action: 'manual_add',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add student')

      setManualSuccess(true)
      setTimeout(() => {
        setManualSuccess(false)
        setManualModalEvent(null)
        setManualForm({ fullName: '', trackNo: '', level: '100', department: '', reason: '' })
        loadAttendees(manualModalEvent.id)
        fetchEvents()
      }, 1000)
    } catch (err: any) {
      setManualError(err.message || 'Error adding student.')
    } finally {
      setSubmittingManual(false)
    }
  }

  const selectStudentForManual = (st: any) => {
    setManualForm(prev => ({
      ...prev,
      fullName: st.full_name || '',
      trackNo: st.track_no || '',
      level: st.level || '100',
      department: st.department || '',
    }))
    setStudentSearch('')
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
  const pastEvents = events.filter(e => e.status !== 'open')

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* Header */}
      <div className="border-b border-border-default pb-6">
        <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Event Management</span>
        <h1 className="text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          Events &amp; QR Codes
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Create events with rotating QR codes, track live incoming students, add manual attendees with reasons, and export reports.
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
              <div className="flex flex-col gap-5">
                {openEvents.map(ev => {
                  const attendees = attendeesMap[ev.id] || []
                  const isLoadingList = loadingAttendees[ev.id]

                  return (
                    <div key={ev.id} className="rounded-2xl border border-success/30 bg-success/5 overflow-hidden shadow-sm">
                      {/* Event Banner */}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                              Broadcasting Live
                            </span>
                            <span className="text-[10px] text-text-tertiary font-mono">
                              {new Date(ev.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                            {ev.name}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-text-tertiary mt-1">
                            <span className="flex items-center gap-1 font-bold text-text-primary">
                              <Users size={12} className="text-primary" />
                              {ev.attendance_count} checked in
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              Expires {new Date(ev.expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setManualModalEvent(ev)
                              setManualError(null)
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-secondary hover:bg-bg-tertiary border border-border-default text-xs font-bold text-text-primary transition-all cursor-pointer"
                          >
                            <UserPlus size={13} className="text-primary" />
                            <span>+ Add Student</span>
                          </button>

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
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg-secondary border border-border-default text-xs font-bold text-text-secondary hover:border-error hover:text-error transition-all cursor-pointer disabled:opacity-50"
                          >
                            {endingId === ev.id ? <Loader2 size={13} className="animate-spin" /> : <CalendarX size={13} />}
                            <span>End Event</span>
                          </button>
                        </div>
                      </div>

                      {/* Export & Records Quick Bar */}
                      <div className="px-5 py-2.5 bg-bg-secondary/60 border-t border-border-default/60 flex items-center justify-between gap-3 text-xs flex-wrap">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary">
                          Event Exports
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/reports/event/${ev.id}/csv`}
                            download
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-primary hover:bg-primary hover:text-white border border-border-default text-text-secondary text-[11px] font-bold transition-all"
                          >
                            <Download size={12} />
                            <span>Export CSV</span>
                          </a>
                          <a
                            href={`/api/reports/event/${ev.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-primary hover:bg-primary hover:text-white border border-border-default text-text-secondary text-[11px] font-bold transition-all"
                          >
                            <FileText size={12} />
                            <span>Export PDF</span>
                          </a>
                          <Link
                            href={`/admin/records/${ev.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-primary hover:bg-primary hover:text-white border border-border-default text-text-secondary text-[11px] font-bold transition-all"
                          >
                            <span>Full Records</span>
                          </Link>
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

                      {/* Live Attendees Check-in Stream */}
                      <div className="border-t border-border-default bg-bg-primary p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                              Incoming Check-in Stream
                            </h4>
                            <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                          </div>
                          <button
                            onClick={() => loadAttendees(ev.id)}
                            className="text-[10px] text-text-tertiary hover:text-primary transition-colors font-bold cursor-pointer"
                          >
                            Refresh List
                          </button>
                        </div>

                        {isLoadingList ? (
                          <div className="py-6 flex items-center justify-center gap-2 text-text-secondary text-xs">
                            <Loader2 size={16} className="animate-spin text-primary" />
                            <span>Loading live check-ins...</span>
                          </div>
                        ) : attendees.length === 0 ? (
                          <div className="py-6 text-center text-xs text-text-tertiary italic">
                            Waiting for students to scan in...
                          </div>
                        ) : (
                          <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-border-default">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-bg-secondary text-text-tertiary text-[10px] uppercase border-b border-border-default sticky top-0">
                                <tr>
                                  <th className="p-2.5">Student</th>
                                  <th className="p-2.5">Track / Matric</th>
                                  <th className="p-2.5">Level</th>
                                  <th className="p-2.5">Department</th>
                                  <th className="p-2.5">Method</th>
                                  <th className="p-2.5 text-right">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-default/60">
                                {attendees.map(a => (
                                  <tr key={a.id} className="hover:bg-bg-secondary/40 transition-colors">
                                    <td className="p-2.5 font-bold text-text-primary flex items-center gap-2">
                                      <Avatar name={a.full_name} size={22} />
                                      <span className="truncate max-w-[140px]">{a.full_name}</span>
                                    </td>
                                    <td className="p-2.5 font-mono text-text-secondary text-[11px]">{a.track_no}</td>
                                    <td className="p-2.5 text-text-secondary">{a.level || '—'}</td>
                                    <td className="p-2.5 text-text-secondary truncate max-w-[120px]">{a.department_name || a.faculty_name || '—'}</td>
                                    <td className="p-2.5">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        a.entry_type === 'manual'
                                          ? 'bg-warning/10 text-warning border border-warning/20'
                                          : 'bg-primary/10 text-primary border border-primary/20'
                                      }`}>
                                        {a.entry_type}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-[10px] text-text-tertiary">
                                      {new Date(a.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-[10px] font-bold tracking-[3px] uppercase text-text-tertiary flex items-center gap-2">
                Past &amp; Ended Events
                <span className="text-[10px] bg-bg-secondary border border-border-default text-text-tertiary px-2 py-0.5 rounded-full font-mono font-bold">
                  {pastEvents.length}
                </span>
              </h2>

              <div className="flex flex-col gap-3">
                {pastEvents.map(ev => {
                  const attendees = attendeesMap[ev.id] || []
                  const isExpanded = expandedEventId === ev.id

                  return (
                    <div key={ev.id} className="rounded-2xl border border-border-default bg-bg-secondary overflow-hidden shadow-sm">
                      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div
                          onClick={() => {
                            const next = isExpanded ? null : ev.id
                            setExpandedEventId(next)
                            if (next && !attendeesMap[ev.id]) {
                              loadAttendees(ev.id)
                            }
                          }}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <h4 className="text-sm font-bold text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                            {ev.name}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-0.5">
                            <span>{new Date(ev.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Users size={10} /> {ev.attendance_count} attended</span>
                          </div>
                        </div>

                        {/* Export Buttons directly on Past Event Card */}
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                          <a
                            href={`/api/reports/event/${ev.id}/csv`}
                            download
                            title="Export CSV"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bg-primary hover:bg-primary hover:text-white border border-border-default text-text-secondary text-xs font-bold transition-all shadow-sm"
                          >
                            <Download size={12} />
                            <span>CSV</span>
                          </a>

                          <a
                            href={`/api/reports/event/${ev.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Export PDF Report"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bg-primary hover:bg-primary hover:text-white border border-border-default text-text-secondary text-xs font-bold transition-all shadow-sm"
                          >
                            <FileText size={12} />
                            <span>PDF</span>
                          </a>

                          <Link
                            href={`/admin/records/${ev.id}`}
                            className="px-3 py-1.5 rounded-xl bg-bg-primary hover:bg-bg-tertiary border border-border-default text-text-primary text-xs font-bold transition-all"
                          >
                            Records
                          </Link>

                          <button
                            onClick={() => {
                              const next = isExpanded ? null : ev.id
                              setExpandedEventId(next)
                              if (next && !attendeesMap[ev.id]) {
                                loadAttendees(ev.id)
                              }
                            }}
                            className="p-1.5 rounded-xl bg-bg-primary border border-border-default text-text-tertiary hover:text-text-primary cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details and Attendee List */}
                      {isExpanded && (
                        <div className="border-t border-border-default p-4 flex flex-col gap-4 text-xs animate-fade-in bg-bg-primary/50">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-bg-secondary p-3 rounded-xl border border-border-default">
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

                          {/* Attendee List Table */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-xs uppercase tracking-wider text-text-tertiary">
                                Recorded Attendees ({attendees.length})
                              </span>
                              <button
                                onClick={() => {
                                  setManualModalEvent(ev)
                                  setManualError(null)
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                              >
                                <UserPlus size={12} />
                                <span>+ Add Missing Student</span>
                              </button>
                            </div>

                            {loadingAttendees[ev.id] ? (
                              <div className="py-4 text-center text-text-tertiary">Loading attendees...</div>
                            ) : attendees.length === 0 ? (
                              <div className="py-4 text-center text-text-tertiary italic">No attendees recorded.</div>
                            ) : (
                              <div className="overflow-x-auto max-h-52 overflow-y-auto rounded-xl border border-border-default bg-bg-secondary">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-bg-tertiary text-text-tertiary text-[10px] uppercase border-b border-border-default sticky top-0">
                                    <tr>
                                      <th className="p-2">Name</th>
                                      <th className="p-2">Track No</th>
                                      <th className="p-2">Department</th>
                                      <th className="p-2">Type</th>
                                      <th className="p-2 text-right">Time</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-default/60">
                                    {attendees.map(a => (
                                      <tr key={a.id}>
                                        <td className="p-2 font-bold text-text-primary">{a.full_name}</td>
                                        <td className="p-2 font-mono text-[11px] text-text-secondary">{a.track_no}</td>
                                        <td className="p-2 text-text-secondary">{a.department_name || '—'}</td>
                                        <td className="p-2">
                                          <span className="text-[9px] font-bold uppercase text-text-tertiary">{a.entry_type}</span>
                                        </td>
                                        <td className="p-2 text-right font-mono text-[10px] text-text-tertiary">
                                          {new Date(a.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
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
                placeholder="e.g. Faculty Orientation 2026"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Description</label>
              <textarea
                placeholder="Brief description of the event..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Host / Organizer *</label>
              <input
                type="text"
                placeholder="Host name"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Institution / School</label>
              <select
                value={schoolId}
                onChange={e => setSchoolId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">Default School</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-primary">Duration (hrs)</label>
                <select
                  value={durationHrs}
                  onChange={e => setDurationHrs(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border-default bg-bg-primary text-text-primary text-xs focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                  <option value="5">5 hours</option>
                  <option value="8">8 hours</option>
                </select>
              </div>
            </div>

            {formErr && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2 text-xs text-error font-medium">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{formErr}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl bg-primary hover:opacity-90 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Creating Event...</span>
                </>
              ) : (
                <>
                  <CalendarPlus size={15} strokeWidth={2.2} />
                  <span>Create &amp; Broadcast</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* Manual Add Student Modal with Mandatory Reason (Audited) */}
      {manualModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-primary border border-border-default rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Attendance Audit</span>
                <h3 className="text-lg font-bold text-text-primary">Add Student to Event</h3>
                <p className="text-xs text-text-secondary">{manualModalEvent.name}</p>
              </div>
              <button
                onClick={() => setManualModalEvent(null)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Registered student search / picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-primary">Quick Search Registered Student</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type name or matric number..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
              </div>

              {studentSearch.trim() && (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-border-default bg-bg-secondary divide-y divide-border-default/60 shadow-lg">
                  {registeredStudents
                    .filter(s =>
                      s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                      s.track_no?.toLowerCase().includes(studentSearch.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectStudentForManual(s)}
                        className="w-full p-2.5 text-left text-xs flex items-center justify-between hover:bg-bg-tertiary transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-text-primary block">{s.full_name}</span>
                          <span className="text-[10px] text-text-tertiary font-mono">{s.track_no} · {s.department || 'General'}</span>
                        </div>
                        <span className="text-[10px] text-primary font-bold">Select</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <form onSubmit={handleManualAddSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-primary">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={manualForm.fullName}
                    onChange={e => setManualForm({ ...manualForm, fullName: e.target.value })}
                    className="p-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-primary">Track No / Matric *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2024/00123"
                    value={manualForm.trackNo}
                    onChange={e => setManualForm({ ...manualForm, trackNo: e.target.value })}
                    className="p-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-primary">Level</label>
                  <select
                    value={manualForm.level}
                    onChange={e => setManualForm({ ...manualForm, level: e.target.value })}
                    className="p-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="100">100 Level</option>
                    <option value="200">200 Level</option>
                    <option value="300">300 Level</option>
                    <option value="400">400 Level</option>
                    <option value="500">500 Level</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-primary">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={manualForm.department}
                    onChange={e => setManualForm({ ...manualForm, department: e.target.value })}
                    className="p-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Mandatory Reason with Audit Trail */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                  <span>Reason for Manual Addition *</span>
                  <span className="text-[10px] text-text-tertiary">Logged to audit trail</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Camera lens broken, battery exhausted, or verified in person by coordinator."
                  value={manualForm.reason}
                  onChange={e => setManualForm({ ...manualForm, reason: e.target.value })}
                  className="p-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {manualError && (
                <div className="p-2.5 rounded-xl bg-error/10 border border-error/20 text-xs text-error font-medium">
                  {manualError}
                </div>
              )}

              {manualSuccess && (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-xs text-success font-medium flex items-center gap-2">
                  <Check size={14} />
                  <span>Student attendance recorded with audit trail!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setManualModalEvent(null)}
                  disabled={submittingManual}
                  className="px-4 py-2.5 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold shadow-md shadow-primary/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingManual ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>Confirm &amp; Audit Log</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
