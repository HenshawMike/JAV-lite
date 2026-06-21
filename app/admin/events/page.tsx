'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Event {
  id: string
  name: string
  description: string | null
  date: string
  is_active: boolean
  created_at: string
  attendance_count?: number
}

export default function AdminEventsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  // Create event form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Actions loading states
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Fetch events list and count attendance rows
  const fetchEvents = async () => {
    try {
      // Fetch events
      const { data: evs, error: evsErr } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
      
      if (evsErr) throw evsErr

      // Fetch attendance counts (all statuses; filter to confirmed in JS)
      const { data: atts, error: attsErr } = await supabase
        .from('attendance')
        .select('event_id, status')
      
      if (attsErr) throw attsErr

      const counts = (atts || []).reduce((acc, a) => {
        if (a.status === 'confirmed') {
          acc[a.event_id] = (acc[a.event_id] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const enrichedEvents = (evs || []).map(e => ({
        ...e,
        attendance_count: counts[e.id] || 0
      }))

      setEvents(enrichedEvents)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    
    if (!name.trim() || !date) {
      setFormErr('Name and Date are required.')
      return
    }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('events')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          date,
          is_active: false, // Create as inactive by default
          created_by: user.id
        })

      if (error) throw error

      setName('')
      setDescription('')
      setDate('')
      await fetchEvents()
    } catch (err: any) {
      setFormErr(err.message || 'Failed to create event.')
    } finally {
      setCreating(false)
    }
  }

  const handleActivateEvent = async (eventId: string) => {
    setActioningId(eventId)
    try {
      // 1. Deactivate all events
      const { error: deacErr } = await supabase
        .from('events')
        .update({ is_active: false })
        .neq('id', eventId) // Set all other events to active = false

      if (deacErr) throw deacErr

      // 2. Activate target event
      const { error: acErr } = await supabase
        .from('events')
        .update({ is_active: true })
        .eq('id', eventId)

      if (acErr) throw acErr

      await fetchEvents()
    } catch (err) {
      console.error('Activation failed:', err)
    } finally {
      setActioningId(null)
    }
  }

  const handleCloseEvent = async (eventId: string) => {
    setActioningId(eventId)
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('id', eventId)

      if (error) throw error
      await fetchEvents()
    } catch (err) {
      console.error(err)
    } finally {
      setActioningId(null)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will permanently delete all attendance records for it.')) return
    setActioningId(eventId)
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      await fetchEvents()
    } catch (err) {
      console.error(err)
    } finally {
      setActioningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 animate-pulse">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Synchronizing Calendar...</span>
      </div>
    )
  }

  const activeEvent = events.find(e => e.is_active)
  const previousEvents = events.filter(e => !e.is_active)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in relative z-10">
      
      {/* Column 1 & 2: Events Management Lists */}
      <div className="lg:col-span-8 flex flex-col gap-10">
        <div className="max-w-2xl border-b border-border-default pb-6">
          <h1 className="text-3xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Classes & Hangouts
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Start up a class, get people checked in, and see who decided to show up today.
          </p>
        </div>

        {/* Active Session Card */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[10px] text-text-tertiary font-bold tracking-[3px] uppercase">
            Live Right Now!
          </h2>
          {activeEvent ? (
            <div className="card-minimal p-6 sm:p-8 shadow-md border-t-4 border-t-success bg-gradient-to-br from-bg-primary to-success/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-success/10 blur-3xl rounded-full pointer-events-none" />
              
              <div className="min-w-0 w-full sm:w-auto relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <Badge text="Broadcasting" type="success" />
                  <span className="text-[11px] font-mono text-text-secondary font-bold bg-bg-secondary px-2 py-0.5 rounded border border-border-default">
                    {new Date(activeEvent.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-text-primary truncate mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
                  {activeEvent.name}
                </h3>
                {activeEvent.description && (
                  <p className="text-sm text-text-secondary truncate max-w-[400px]">
                    {activeEvent.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto flex-shrink-0 relative z-10">
                <Button 
                  onClick={() => router.push(`/admin/records/${activeEvent.id}`)}
                  variant="secondary"
                  className="py-3 px-5 text-xs font-bold border-border-default bg-bg-secondary hover:border-primary flex-1 sm:flex-none justify-center gap-2"
                >
                  <span className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">{activeEvent.attendance_count}</span>
                  Logs
                </Button>
                <Button
                  onClick={() => handleCloseEvent(activeEvent.id)}
                  loading={actioningId === activeEvent.id}
                  className="py-3 px-5 text-xs font-bold bg-text-primary text-bg-primary hover:bg-info flex-1 sm:flex-none justify-center"
                >
                  End it
                </Button>
              </div>
            </div>
          ) : (
            <div className="card-minimal p-10 text-center flex flex-col gap-3 shadow-none border-dashed bg-transparent items-center">
               <svg className="w-10 h-10 mb-2 opacity-30 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path></svg>
               <h3 className="text-base font-bold text-text-primary">System Idle</h3>
               <p className="text-xs text-text-secondary max-w-[300px]">No active session currently broadcasting. Terminals are in standby.</p>
            </div>
          )}
        </section>

        {/* Previous Sessions list */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] text-text-tertiary font-bold tracking-[3px] uppercase">
              Archived Sessions
            </h2>
            <span className="text-[10px] bg-bg-secondary border border-border-default px-2 py-0.5 rounded-full font-mono text-text-secondary font-bold">
              {previousEvents.length}
            </span>
          </div>

          {previousEvents.length === 0 ? (
            <div className="card-minimal p-8 text-center text-xs text-text-secondary shadow-none border-dashed bg-transparent">
              No previous events recorded.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {previousEvents.map(ev => (
                <div 
                  key={ev.id}
                  className="card-minimal p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/40 transition-colors shadow-sm group"
                >
                  <div className="min-w-0 w-full sm:w-auto">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-mono text-text-secondary bg-bg-tertiary px-2 py-1 rounded border border-border-default font-bold">
                        {new Date(ev.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                      {ev.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0 grid grid-cols-3 sm:flex">
                    <Button 
                      onClick={() => router.push(`/admin/records/${ev.id}`)}
                      variant="secondary"
                      className="py-2.5 px-0 sm:px-4 text-xs font-bold w-full sm:w-auto"
                    >
                      Logs <span className="ml-1 text-primary font-mono">{ev.attendance_count}</span>
                    </Button>
                    <Button
                      onClick={() => handleActivateEvent(ev.id)}
                      variant="secondary"
                      loading={actioningId === ev.id}
                      className="py-2.5 px-0 sm:px-4 text-xs font-bold w-full sm:w-auto hover:text-success hover:border-success/40"
                    >
                      Boot
                    </Button>
                    <Button
                      onClick={() => handleDeleteEvent(ev.id)}
                      variant="secondary"
                      loading={actioningId === ev.id}
                      className="py-2.5 px-0 sm:px-4 text-xs font-bold w-full sm:w-auto hover:bg-error hover:text-white hover:border-error"
                    >
                      Drop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Column 3: Create Session Form */}
      <div className="lg:col-span-4 flex flex-col gap-4 sticky top-24">
        <h2 className="text-[10px] text-text-tertiary font-bold tracking-[3px] uppercase">
          New Event
        </h2>
        <form onSubmit={handleCreateEvent} className="card-minimal p-6 sm:p-8 flex flex-col gap-6 shadow-md border-t-4 border-t-primary bg-bg-secondary">
          <div className="mb-2">
            <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: "var(--font-rajdhani)" }}>Plan a Hangout</h3>
            <p className="text-xs text-text-secondary mt-1">Get the squad together.</p>
          </div>
          
          <div className="flex flex-col gap-5">
            <Input 
              label="Identifier *"
              placeholder="e.g. Technical Seminar 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input 
              label="Parameters"
              placeholder="Brief details or agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input 
              label="Timestamp Date *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-mono text-sm uppercase"
              required
            />
          </div>

          {formErr && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-sm text-error font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> {formErr}
            </div>
          )}

          <Button 
            type="submit"
            variant="primary"
            loading={creating}
            disabled={!name || !date}
            className="w-full py-4 text-sm mt-2 shadow-lg"
          >
            Kick it off!
          </Button>
        </form>
      </div>
    </div>
  )
}
