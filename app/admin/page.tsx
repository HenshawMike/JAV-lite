'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StudentCard, Profile } from '@/components/StudentCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LEVELS, DEPT_COLORS, PALETTE } from '@/lib/constants'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

const getDeptColor = (dept: string) => {
  if (DEPT_COLORS[dept]) return DEPT_COLORS[dept]
  let hash = 0
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % PALETTE.length
  return PALETTE[idx]
}

export default function AdminDashboard() {
  const supabase = createClient()
  
  const [students, setStudents] = useState<Profile[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filtering states
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('All')
  const [selectedLevel, setSelectedLevel] = useState('All')
  
  // Modal state
  const [activeStudent, setActiveStudent] = useState<Profile | null>(null)
  const [studentAttendedEvents, setStudentAttendedEvents] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch registered students
        const { data: stds, error: stdsErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('registered', true)
          .order('full_name')
        
        if (stdsErr) throw stdsErr
        setStudents(stds || [])

        // Fetch events
        const { data: evs, error: evsErr } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: false })

        if (evsErr) throw evsErr
        setEvents(evs || [])
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // When active student changes, fetch their attendance records
  useEffect(() => {
    async function fetchStudentAttendance() {
      if (!activeStudent) {
        setStudentAttendedEvents([])
        return
      }

      try {
        const { data: att, error } = await supabase
          .from('attendance')
          .select('event_id, marked_at')
          .eq('student_id', activeStudent.id)

        if (error) throw error

        const attendedIds = new Set(att.map(a => a.event_id))
        const attended = events.filter(e => attendedIds.has(e.id)).map(e => {
          const record = att.find(a => a.event_id === e.id)
          return {
            ...e,
            marked_at: record?.marked_at
          }
        })
        setStudentAttendedEvents(attended)
      } catch (e) {
        console.error(e)
      }
    }
    fetchStudentAttendance()
  }, [activeStudent, events])

  // Get active departments dynamically
  const activeDepartments = Array.from(new Set(students.map(s => s.department).filter(Boolean))) as string[]

  // Filter students based on inputs
  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      !search || 
      (s.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
      (s.track_no || '').toLowerCase().includes(search.toLowerCase())
    
    const matchesDept = selectedDept === 'All' || s.department === selectedDept
    const matchesLevel = selectedLevel === 'All' || s.level === selectedLevel

    return matchesSearch && matchesDept && matchesLevel
  })

  // Group filtered students by department
  const studentsByDept = filteredStudents.reduce((acc, s) => {
    const dept = s.department || 'Unassigned'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(s)
    return acc
  }, {} as Record<string, Profile[]>)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 animate-pulse">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Rounding up the squad...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Title */}
      <div className="max-w-2xl border-b border-border-default pb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
          The Squad
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          Keep an eye on everyone, check out their selfies, and see how the whole crew is doing!
        </p>
      </div>

      {/* Stats tiles */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x mask-fade-right">
        {activeDepartments.map(d => {
          const count = students.filter(s => s.department === d).length
          if (count === 0) return null
          const color = getDeptColor(d)
          const isActive = selectedDept === d
          
          return (
            <button
              key={d}
              onClick={() => setSelectedDept(isActive ? 'All' : d)}
              className={`card-minimal p-5 flex flex-col items-start gap-2 cursor-pointer transition-all duration-300 select-none min-w-[160px] snap-start border-l-4 ${isActive ? 'scale-105' : 'hover:scale-[1.02]'}`}
              style={{
                borderLeftColor: color,
                background: isActive ? `${color}10` : 'var(--bg-secondary)',
                borderColor: isActive ? `${color}40` : undefined,
                borderLeftWidth: '4px'
              }}
            >
              <code className="text-4xl font-bold font-mono tracking-tighter" style={{ color: isActive ? color : 'var(--text-primary)' }}>
                {count}
              </code>
              <span className="text-[10px] font-bold tracking-[2px] uppercase text-left leading-tight truncate w-full" style={{ color: isActive ? color : 'var(--text-secondary)' }}>
                {d}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters row */}
      <div className="flex gap-4 flex-wrap items-center bg-bg-secondary p-4 rounded-xl border border-border-default shadow-sm w-full">
        <div className="flex-1 min-w-[240px] w-full">
          <Input 
            placeholder="Search by name or Track ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-primary"
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <Select 
            options={activeDepartments.map(d => ({ value: d, label: d }))}
            placeholder="All Departments"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value || 'All')}
            className="w-full bg-bg-primary"
          />
        </div>
        <div className="w-full sm:w-[140px]">
          <Select 
            options={LEVELS.map(l => ({ value: l, label: `Level ${l}` }))}
            placeholder="All Levels"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value || 'All')}
            className="w-full bg-bg-primary"
          />
        </div>
        <div className="w-full sm:w-auto px-4 py-2.5 bg-bg-tertiary rounded-lg border border-border-default text-xs text-text-tertiary font-mono tracking-wider font-bold flex items-center justify-center">
          {filteredStudents.length} MATCH{filteredStudents.length !== 1 ? 'ES' : ''}
        </div>
      </div>

      {/* Students lists grouped by department */}
      {filteredStudents.length === 0 ? (
        <div className="card-minimal p-16 text-center shadow-none border-dashed bg-transparent">
          <div className="mb-4 flex justify-center opacity-50">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">No matching records</h3>
          <p className="text-sm text-text-secondary">Try adjusting your search criteria or clear your active filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {Object.entries(studentsByDept).map(([deptName, deptStudents]) => {
            const color = getDeptColor(deptName)
            return (
              <section key={deptName} className="flex flex-col gap-4">
                {/* Section header */}
                <div className="flex items-center gap-4 bg-bg-secondary px-5 py-3 rounded-xl border border-border-default shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: color, color: color }} />
                  <h2 className="text-sm font-bold text-text-primary font-mono tracking-wider uppercase">
                    {deptName}
                  </h2>
                  <span className="ml-auto text-xs bg-bg-primary border border-border-default text-text-tertiary px-3 py-1 rounded-md font-mono font-bold">
                    Count: {deptStudents.length}
                  </span>
                </div>
                
                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {deptStudents.map(s => (
                    <StudentCard 
                      key={s.id} 
                      student={s} 
                      onClick={() => setActiveStudent(s)} 
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Student Detail Modal */}
      {activeStudent && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[100] animate-fade-in"
          onClick={() => setActiveStudent(null)}
        >
          <div 
            className="bg-bg-primary border border-border-default rounded-2xl p-6 sm:p-10 max-w-[560px] w-full relative shadow-2xl overflow-y-auto max-h-[90vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setActiveStudent(null)}
              className="absolute top-5 right-5 bg-bg-tertiary hover:bg-error hover:text-white hover:border-error text-text-secondary border border-border-default rounded-full w-8 h-8 flex items-center justify-center transition-all cursor-pointer shadow-sm text-sm"
            >
              ✕
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 text-center sm:text-left border-b border-border-default pb-8">
              <div className="relative">
                <Avatar 
                  name={activeStudent.full_name || 'Student'} 
                  photoUrl={activeStudent.photo_url} 
                  size={100} 
                  className="shadow-xl ring-4 ring-bg-secondary"
                />
                <div className="absolute -bottom-2 -right-2 bg-success text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-full border-2 border-bg-primary shadow-sm">
                  Verified
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary leading-tight truncate mb-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                  {activeStudent.full_name}
                </h2>
                <code className="inline-block font-mono text-sm text-primary font-bold bg-primary/10 px-3 py-1 rounded-md mb-3">
                  {activeStudent.track_no}
                </code>
                <div className="flex items-center justify-center sm:justify-start">
                  {activeStudent.department && (
                    <Badge text={activeStudent.department} type="department" />
                  )}
                </div>
              </div>
            </div>

            {/* Attributes Grid */}
            <h3 className="text-[10px] text-text-tertiary font-bold tracking-[3px] uppercase mb-4 pl-1">Quick Peek</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { label: 'Academic Standing', value: `Level ${activeStudent.level || '—'}`, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v10"></path></svg> },
                { label: 'Attended Events', value: `${studentAttendedEvents.length} session(s)`, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> },
                { label: 'Enrollment Date', value: activeStudent.created_at ? new Date(activeStudent.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> },
                { label: 'Network Origin', value: 'OAuth Gateway', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg> }
              ].map(item => (
                <div key={item.label} className="bg-bg-secondary border border-border-default rounded-xl p-4 flex gap-3 shadow-sm hover:border-primary/30 transition-colors">
                  <span className="text-xl opacity-50">{item.icon}</span>
                  <div>
                    <span className="block text-[9px] text-text-tertiary font-bold tracking-widest uppercase mb-1">
                      {item.label}
                    </span>
                    <span className="text-text-primary font-bold text-sm">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance List */}
            <h3 className="text-[10px] text-text-tertiary font-bold tracking-[3px] uppercase mb-4 pl-1">Classes Attended</h3>
            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
              {studentAttendedEvents.length === 0 ? (
                <div className="bg-bg-secondary border border-dashed border-border-default rounded-xl p-8 text-center flex flex-col gap-2 shadow-sm items-center">
                  <svg className="w-8 h-8 opacity-40 mb-1 text-text-tertiary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                  <span className="text-xs text-text-secondary font-medium">No system attendance records found.</span>
                </div>
              ) : (
                studentAttendedEvents.map(ev => (
                  <div 
                    key={ev.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-bg-tertiary border border-border-default rounded-xl p-4 hover:bg-bg-secondary transition-colors"
                  >
                    <span className="font-bold text-sm text-text-primary truncate max-w-full sm:max-w-[200px]" style={{ fontFamily: "var(--font-rajdhani)" }}>
                      {ev.name}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-xs w-full sm:w-auto justify-between sm:justify-start">
                      <span className="text-text-secondary bg-bg-primary px-2 py-1 rounded border border-border-default shadow-sm">{new Date(ev.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-success font-bold flex items-center gap-1.5 bg-success/10 px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        {ev.marked_at ? new Date(ev.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
