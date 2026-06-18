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

interface Event {
  id: string
  name: string
  description: string | null
  date: string
}

interface AttendanceRecord {
  student_id: string
  marked_at: string
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

  // Filters & searches
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('All')
  
  // Export states
  const [exportDept, setExportDept] = useState('All')
  const [exporting, setExporting] = useState(false)

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
        .select('student_id, marked_at')
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

  // Map students with attendance status
  const studentsWithStatus = students.map(s => {
    const record = attendance.find(a => a.student_id === s.id)
    return {
      student: s,
      present: !!record,
      markedAt: record?.marked_at || null
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
        const status = row.present ? 'Present' : 'Absent'
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

  const attendeesCount = attendance.length
  const totalStudents = students.length
  const rate = totalStudents ? Math.round(attendeesCount / totalStudents * 100) : 0

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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Folks Here', value: `${attendeesCount} / ${totalStudents}` },
          { label: 'Turnout %', value: `${rate}%` },
          { label: 'MIA', value: `${totalStudents - attendeesCount} profiles` }
        ].map((item, idx) => (
          <div key={idx} className="card-minimal p-6 flex flex-col gap-2 border-t-2 overflow-hidden relative" style={{ borderTopColor: idx === 0 ? 'var(--success)' : idx === 1 ? 'var(--primary)' : 'var(--error)' }}>
            <span className="block text-[10px] text-text-tertiary tracking-[2px] font-bold uppercase">
              {item.label}
            </span>
            <span className="text-3xl font-bold text-text-primary font-mono tracking-tighter">
              {item.value}
            </span>
            <div className="absolute -bottom-1 -right-2 text-6xl opacity-5 pointer-events-none">
              {idx === 0 ? (
                <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              ) : idx === 1 ? (
                <span className="text-6xl font-bold font-mono -mt-2 inline-block">%</span>
              ) : (
                <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              )}
            </div>
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

        {/* The Table */}
        <div className="card-minimal overflow-hidden border border-border-default shadow-sm bg-bg-primary">
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
                      markedAt={row.markedAt} 
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
