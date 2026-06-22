'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AttendanceRow } from '@/components/AttendanceRow'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { DEPARTMENTS } from '@/lib/constants'
import { Profile } from '@/components/StudentCard'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

interface Event {
  id: string
  name: string
  description: string | null
  date: string
}

interface AttendanceRecord {
  student_id: string
  marked_at: string
  status?: string
}

interface RecordsPageProps {
  params: Promise<{ eventId: string }>
}

export default function AttendanceRecordsPage({ params }: RecordsPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const eventId = resolvedParams.eventId
  
  const supabase = createClient()

  const [event, setEvent] = useState<Event | null>(null)
  const [students, setStudents] = useState<Profile[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Filters & searches
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('All')
  
  // Export states
  const [exportDept, setExportDept] = useState('All')
  const [exporting, setExporting] = useState(false)

  // Bulk confirm state
  const [confirmingAll, setConfirmingAll] = useState(false)

  const fetchData = async () => {
    try {
      // 1. Fetch target event
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      
      if (evErr) throw evErr
      setEvent(ev)

      // 2. Fetch registered students
      const { data: stds, error: stdsErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('registered', true)
        .order('full_name')

      if (stdsErr) throw stdsErr
      setStudents(stds || [])

      // 3. Fetch attendance records
      const { data: atts, error: attsErr } = await supabase
        .from('attendance')
        .select('student_id, marked_at, status')
        .eq('event_id', eventId)

      if (attsErr) throw attsErr
      setAttendance(atts || [])
    } catch (err) {
      console.error(err)
      router.push('/admin/events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [eventId])

  // Confirm all pending attendance records for this event
  const handleConfirmAll = async () => {
    if (confirmingAll) return
    const pendingIds = attendance
      .filter(a => a.status === 'pending' || !a.status)
      .map(a => a.student_id)

    if (pendingIds.length === 0) return

    setConfirmingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Client-side session for bulk confirm:', session)

      const { data, error, status, statusText } = await supabase
        .from('attendance')
        .update({ status: 'confirmed' })
        .eq('event_id', eventId)
        .in('student_id', pendingIds)
        .select()

      console.log('Bulk confirm result:', { data, error, status, statusText })

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error(`No records updated. Rows might not exist, or permission denied via RLS. Active session: ${!!session}`)
      }

      await fetchData()
    } catch (err: any) {
      console.error('Confirm all failed:', err)
      alert('Failed to confirm all attendance records: ' + (err.message || JSON.stringify(err)))
    } finally {
      setConfirmingAll(false)
    }
  }

  const handleConfirmStudent = async (studentId: string) => {
    if (confirmingId) return
    setConfirmingId(studentId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Client-side session for confirm single:', session)

      const { data, error, status, statusText } = await supabase
        .from('attendance')
        .update({ status: 'confirmed' })
        .eq('event_id', eventId)
        .eq('student_id', studentId)
        .select()

      console.log('Confirm single result:', { data, error, status, statusText })

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error(`No records updated. Row might not exist, or permission denied via RLS. Active session: ${!!session}`)
      }

      await fetchData()
    } catch (err: any) {
      console.error('Confirm failed:', err)
      alert('Failed to confirm attendance: ' + (err.message || JSON.stringify(err)))
    } finally {
      setConfirmingId(null)
    }
  }

  // Map students with attendance status
  const studentsWithStatus = students.map(s => {
    const record = attendance.find(a => a.student_id === s.id)
    return {
      student: s,
      present: record?.status === 'confirmed',
      pending: record?.status === 'pending',
      markedAt: record?.marked_at || null,
      rawStatus: record?.status || null
    }
  })

  // Filter students
  const filteredRows = studentsWithStatus.filter(row => {
    const s = row.student
    const matchesSearch = 
      !search || 
      (s.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
      (s.track_no || '').toLowerCase().includes(search.toLowerCase())
    
    const matchesDept = selectedDept === 'All' || s.department === selectedDept

    return matchesSearch && matchesDept
  })

  // Export CSV Action
  const handleExportCSV = async () => {
    if (!event) return
    setExporting(true)

    try {
      // Attempt to invoke the Supabase Edge Function first
      const { data, error } = await supabase.functions.invoke('export-attendance', {
        body: { eventId: event.id, department: exportDept }
      })

      if (error || !data) {
        throw new Error('Edge function fallback triggered')
      }

      // Read streamed CSV blob and trigger download
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, event.name, event.date, exportDept)
    } catch (err) {
      console.warn('Supabase Edge Function not reachable. Running client-side export fallback.')
      
      // Fallback: Generate CSV content dynamically in memory
      const header = 'Full Name,Track ID,Department,Academic Level,Status,Time Marked'
      
      // Filter list of students to include in the CSV
      const targetStudents = studentsWithStatus.filter(row => 
        exportDept === 'All' || row.student.department === exportDept
      )

      const csvRows = targetStudents.map(row => {
        const s = row.student
        const status = row.rawStatus === 'confirmed' ? 'Present' : 'Absent'
        const time = row.markedAt ? new Date(row.markedAt).toISOString() : '—'
        return `"${s.full_name || 'No Name'}","${s.track_no || ''}","${s.department || ''}","L${s.level || ''}","${status}","${time}"`
      })

      const csvContent = [header, ...csvRows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, event.name, event.date, exportDept)
    } finally {
      setExporting(false)
    }
  }

  const triggerDownload = (url: string, eventName: string, eventDate: string, dept: string) => {
    const formattedName = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const formattedDept = dept.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${formattedName}-${eventDate}-${formattedDept}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 animate-pulse">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Counting heads...</span>
      </div>
    )
  }

  if (!event) return null

  const confirmedCount = attendance.filter(a => a.status === 'confirmed').length
  const pendingCount = attendance.filter(a => a.status === 'pending' || !a.status).length
  const attendeesCount = attendance.length
  const totalStudents = students.length
  const rate = totalStudents ? Math.round(confirmedCount / totalStudents * 100) : 0

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      
      {/* Back button & header */}
      <div className="flex flex-col gap-4 relative z-10 border-b border-border-default pb-6">
        <button 
          onClick={() => router.push('/admin/events')}
          className="text-xs font-bold uppercase tracking-widest text-text-tertiary flex items-center gap-2 hover:text-text-primary transition-colors underline-offset-4 hover:underline self-start"
        >
          <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Back to Calendar
        </button>

        <div className="flex justify-between items-start gap-4 flex-wrap mt-2">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              {event.name}
            </h1>
             <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono bg-bg-secondary border border-border-default rounded-md px-3 py-1 text-text-secondary font-bold">
                {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-xs text-text-tertiary font-medium">Who Showed Up?</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Select 
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
              placeholder="Export Dept"
              value={exportDept}
              onChange={(e) => setExportDept(e.target.value || 'All')}
              className="w-[140px] py-2 text-xs bg-bg-primary"
            />
            <Button 
              onClick={handleExportCSV}
              variant="primary"
              loading={exporting}
              className="py-2.5 px-6 text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Export CSV →
            </Button>
          </div>
        </div>
      </div>

      {/* Pending confirmation banner */}
      {pendingCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-warning/5 border border-warning/20 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-warning">
                {pendingCount} student{pendingCount !== 1 ? 's' : ''} pending confirmation
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Marked attendance but not yet confirmed. Review and confirm below.
              </p>
            </div>
          </div>
          <button
            onClick={handleConfirmAll}
            disabled={confirmingAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmingAll ? (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {confirmingAll ? 'Confirming…' : `Confirm All ${pendingCount}`}
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Confirmed', value: `${confirmedCount}`, color: 'var(--success)' },
          { label: 'Pending', value: `${pendingCount}`, color: 'var(--warning, #f59e0b)' },
          { label: 'Turnout %', value: `${rate}%`, color: 'var(--primary)' },
          { label: 'MIA', value: `${totalStudents - attendeesCount}`, color: 'var(--error)' },
        ].map((item, idx) => (
          <div key={idx} className="card-minimal p-5 flex flex-col gap-2 border-t-2 overflow-hidden relative" style={{ borderTopColor: item.color }}>
            <span className="block text-[10px] text-text-tertiary tracking-[2px] font-bold uppercase">
              {item.label}
            </span>
            <span className="text-3xl font-bold text-text-primary font-mono tracking-tighter">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Records Table Section */}
      <div className="flex flex-col gap-4">
        {/* Table filters */}
        <div className="flex gap-4 flex-wrap items-center bg-bg-secondary p-4 rounded-xl border border-border-default shadow-sm">
          <div className="flex-1 min-w-[240px]">
            <Input 
              placeholder="Search specific student names or IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-primary"
            />
          </div>
          <div className="w-[180px]">
             <Select 
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
              placeholder="Filter Faculty"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value || 'All')}
              className="w-full bg-bg-primary"
            />
          </div>
          <div className="px-4 py-2 bg-bg-tertiary rounded-lg border border-border-default text-xs text-text-tertiary font-mono tracking-wider font-bold h-full flex items-center justify-center">
            {filteredRows.length} MATCH{filteredRows.length !== 1 ? 'ES' : ''}
          </div>
        </div>

        {/* Mobile Cards View (Visible on mobile, hidden on desktop) */}
        <div className="flex flex-col gap-4 md:hidden">
          {filteredRows.length === 0 ? (
            <div className="card-minimal p-10 text-center bg-bg-secondary/30 border-dashed">
              <div className="flex justify-center mb-3 opacity-30 text-text-tertiary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-1">No matching logs</h3>
              <span className="text-xs text-text-secondary">Adjust your search parameters.</span>
            </div>
          ) : (
            filteredRows.map((row) => (
              <div 
                key={row.student.id} 
                className="card-minimal p-5 flex flex-col gap-4 bg-bg-primary border border-border-default"
              >
                {/* Header: Student Info */}
                <div className="flex items-center gap-3">
                  <Avatar name={row.student.full_name || 'Student'} photoUrl={row.student.photo_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
                      {row.student.full_name || 'No Name'}
                    </h4>
                    <p className="text-[10px] text-text-secondary font-mono mt-0.5 truncate">
                      {row.student.email}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="block text-[10px] text-text-tertiary font-mono">
                      Level {row.student.level || '—'}
                    </span>
                    <span className="block text-[10px] text-text-secondary font-mono mt-0.5 bg-bg-tertiary border border-border-default px-1.5 py-0.5 rounded-md font-bold">
                      {row.student.track_no || '—'}
                    </span>
                  </div>
                </div>

                {/* Body: Department & Time */}
                <div className="flex justify-between items-center text-xs border-t border-b border-border-default/50 py-3">
                  <div>
                    <span className="block text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Faculty</span>
                    {row.student.department ? (
                      <Badge text={row.student.department} type="department" />
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Checked In</span>
                    <span className="font-mono text-xs font-bold text-text-primary">
                      {row.markedAt ? new Date(row.markedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </span>
                  </div>
                </div>

                {/* Footer: Status Badge & Confirmation Button */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Status</span>
                    {row.pending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] uppercase tracking-widest font-bold bg-warning/10 border border-warning/20 text-warning">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> Pending
                      </span>
                    ) : (
                      <span 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] uppercase tracking-widest font-bold ${
                          row.present 
                            ? 'bg-success/10 border border-success/20 text-success' 
                            : 'bg-error/10 border border-error/20 text-error'
                        }`}
                      >
                        <span 
                          className={`w-1.5 h-1.5 rounded-full ${row.present ? 'bg-success animate-pulse shadow-[0_0_8px_var(--color-success)]' : 'bg-error'}`}
                        />
                        {row.present ? 'Present' : 'Absent'}
                      </span>
                    )}
                  </div>

                  {row.pending && (
                    <button
                      onClick={() => handleConfirmStudent(row.student.id)}
                      disabled={confirmingId === row.student.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                    >
                      {confirmingId === row.student.id ? (
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {confirmingId === row.student.id ? 'Confirming…' : 'Confirm'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (Hidden on mobile) */}
        <div className="hidden md:block card-minimal overflow-hidden border border-border-default shadow-sm bg-bg-primary">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default text-sm">
              <thead className="bg-bg-secondary border-b border-border-default">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest pl-6">
                    Who's Who
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Track / ID
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Faculty
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Level
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest pr-6">
                    When?
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/50">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center shadow-none bg-bg-secondary/30">
                      <div className="flex justify-center mb-3 opacity-30 text-text-tertiary">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      </div>
                      <h3 className="text-sm font-bold text-text-primary mb-1">No matching logs</h3>
                      <span className="text-xs text-text-secondary">Adjust your search parameters.</span>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <AttendanceRow 
                      key={row.student.id} 
                      student={row.student} 
                      present={row.present} 
                      pending={row.pending}
                      markedAt={row.markedAt} 
                      rawStatus={row.rawStatus}
                      eventId={event.id}
                      onConfirm={() => fetchData()}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
