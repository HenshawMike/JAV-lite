'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LEVELS, DEPT_COLORS, PALETTE } from '@/lib/constants'
import { Avatar } from '@/components/ui/Avatar'
import {
  SearchX,
  GraduationCap,
  CalendarCheck,
  Calendar,
  Building,
  CalendarX,
  X,
  Loader2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert
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

interface StudentProfile {
  id: string
  full_name: string
  email: string
  track_no: string
  level: string
  school_id: string | null
  faculty_id: string | null
  department_id: string | null
  schools?: { name: string }
  faculties?: { name: string }
  departments?: { name: string }
  created_at: string
}

const getDeptColor = (dept: string) => {
  if (DEPT_COLORS[dept]) return DEPT_COLORS[dept]
  let hash = 0
  for (let i = 0; i < (dept || '').length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % PALETTE.length
  return PALETTE[idx]
}

export default function AdminStudentsPage() {
  const supabase = createClient()

  const [students, setStudents] = useState<StudentProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('All')
  const [selectedFaculty, setSelectedFaculty] = useState('All')
  const [selectedDept, setSelectedDept] = useState('All')
  const [selectedLevel, setSelectedLevel] = useState('All')

  // Detail Modal & Edit Modal (Section 8.1)
  const [activeStudent, setActiveStudent] = useState<StudentProfile | null>(null)
  const [studentAttendedSessions, setStudentAttendedSessions] = useState<any[]>([])
  const [studentEditsHistory, setStudentEditsHistory] = useState<any[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    field: 'track_no' as 'track_no' | 'level',
    newValue: '',
    reason: '',
    applyToPast: true,
  })
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [stdsRes, schoolsRes, facRes, deptsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, schools(name), faculties(name), departments(name)')
          .eq('role', 'student')
          .order('full_name'),
        supabase.from('schools').select('*').order('name'),
        supabase.from('faculties').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
      ])

      setStudents((stdsRes.data as any) || [])
      setSchools(schoolsRes.data || [])
      setFaculties(facRes.data || [])
      setDepartments(deptsRes.data || [])
    } catch (err) {
      console.error('Failed to load admin students:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Fetch student records on selection
  useEffect(() => {
    async function fetchDetails() {
      if (!activeStudent) {
        setStudentAttendedSessions([])
        setStudentEditsHistory([])
        return
      }

      try {
        const [attRes, editsRes] = await Promise.all([
          supabase
            .from('attendance')
            .select('*, sessions(name, course_code, session_date)')
            .eq('student_id', activeStudent.id)
            .order('marked_at', { ascending: false }),
          supabase
            .from('profile_edits')
            .select('*')
            .eq('student_id', activeStudent.id)
            .order('created_at', { ascending: false }),
        ])

        setStudentAttendedSessions(attRes.data || [])
        setStudentEditsHistory(editsRes.data || [])
      } catch (err) {
        console.error(err)
      }
    }
    fetchDetails()
  }, [activeStudent, supabase])

  // Open Edit Modal
  const openEditModal = (student: StudentProfile, field: 'track_no' | 'level') => {
    setActiveStudent(student)
    setEditForm({
      field,
      newValue: field === 'track_no' ? student.track_no : student.level || '100',
      reason: '',
      applyToPast: field === 'track_no', // Default ON for track_no, OFF for level (Section 8.1)
    })
    setEditError(null)
    setEditSuccess(false)
    setShowEditModal(true)
  }

  // Handle Admin Edit Submit (Section 8.1)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeStudent) return

    if (!editForm.newValue.trim()) {
      setEditError('New value is required.')
      return
    }
    if (!editForm.reason.trim() || editForm.reason.trim().length < 5) {
      setEditError('Audit reason is required (minimum 5 characters).')
      return
    }

    setSubmittingEdit(true)
    setEditError(null)

    try {
      const { error } = await supabase.rpc('admin_edit_student', {
        p_student_id: activeStudent.id,
        p_field: editForm.field,
        p_new_value: editForm.newValue.trim(),
        p_reason: editForm.reason.trim(),
        p_apply_to_past: editForm.applyToPast,
      })

      if (error) throw error

      setEditSuccess(true)
      await loadData()

      setTimeout(() => {
        setShowEditModal(false)
        setEditSuccess(false)
      }, 1200)
    } catch (err: any) {
      console.error('Admin edit error:', err)
      setEditError(err.message || 'Failed to update student profile.')
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Filter students
  const filteredStudents = students.filter((s) => {
    const nameMatch = (s.full_name || '').toLowerCase().includes(search.toLowerCase())
    const trackMatch = (s.track_no || '').toLowerCase().includes(search.toLowerCase())
    const emailMatch = (s.email || '').toLowerCase().includes(search.toLowerCase())
    const matchesSearch = !search || nameMatch || trackMatch || emailMatch

    const matchesSchool = selectedSchool === 'All' || s.school_id === selectedSchool
    const matchesFaculty = selectedFaculty === 'All' || s.faculty_id === selectedFaculty
    const matchesDept = selectedDept === 'All' || s.department_id === selectedDept
    const matchesLevel = selectedLevel === 'All' || s.level === selectedLevel

    return matchesSearch && matchesSchool && matchesFaculty && matchesDept && matchesLevel
  })

  // Group by department name
  const studentsByDept = filteredStudents.reduce((acc, s) => {
    const deptName = s.departments?.name || 'Unassigned Department'
    if (!acc[deptName]) acc[deptName] = []
    acc[deptName].push(s)
    return acc
  }, {} as Record<string, StudentProfile[]>)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5 animate-pulse">
        <Loader2 size={36} className="text-primary animate-spin" />
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Loading Student Directory...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      
      {/* Header */}
      <div className="max-w-2xl border-b border-border-default pb-6">
        <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Student Records</span>
        <h1 className="text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          Students Directory
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Inspect student rosters, view attendance snapshots, and perform audited track number/level corrections.
        </p>
      </div>

      {/* Filter Row */}
      <div className="flex gap-3 flex-wrap items-center bg-bg-secondary p-4 rounded-2xl border border-border-default shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Search by name, email, track ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={selectedSchool}
          onChange={(e) => {
            setSelectedSchool(e.target.value)
            setSelectedFaculty('All')
            setSelectedDept('All')
          }}
          className="px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary"
        >
          <option value="All">All Schools</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary"
        >
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary"
        >
          <option value="All">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
        </select>

        <div className="px-3 py-2 rounded-xl bg-bg-tertiary text-xs font-mono font-bold text-text-tertiary">
          {filteredStudents.length} Students
        </div>
      </div>

      {/* Student Cards grouped by department */}
      {filteredStudents.length === 0 ? (
        <div className="p-16 rounded-3xl border border-dashed border-border-default text-center flex flex-col items-center gap-3 text-text-tertiary">
          <SearchX size={36} className="opacity-40" />
          <p className="text-sm font-bold text-text-primary">No matching students found</p>
          <p className="text-xs text-text-secondary">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(studentsByDept).map(([deptName, deptStudents]) => {
            const color = getDeptColor(deptName)
            return (
              <section key={deptName} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 bg-bg-secondary px-5 py-3 rounded-2xl border border-border-default">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                    {deptName}
                  </h2>
                  <span className="ml-auto text-xs bg-bg-primary border border-border-default text-text-tertiary px-2.5 py-0.5 rounded-md font-mono font-bold">
                    {deptStudents.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deptStudents.map(st => (
                    <div
                      key={st.id}
                      className="p-5 rounded-2xl bg-bg-secondary border border-border-default hover:border-primary/40 flex flex-col justify-between gap-4 transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-3.5">
                        <Avatar name={st.full_name} size={44} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                            {st.full_name}
                          </h3>
                          <span className="font-mono text-xs font-bold text-primary block mt-0.5">
                            {st.track_no || 'Unassigned Track ID'}
                          </span>
                          <span className="text-[11px] text-text-tertiary block mt-0.5">
                            {st.level ? `${st.level}L` : 'Level —'} · {st.schools?.name || 'School'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border-default/60">
                        <button
                          onClick={() => setActiveStudent(st)}
                          className="text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        >
                          View History
                        </button>
                        
                        {/* Admin Edit Trigger (Section 8.1) */}
                        <button
                          onClick={() => openEditModal(st, 'track_no')}
                          className="px-3 py-1 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={12} />
                          <span>Edit ID / Level</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Student Details Modal ─────────────────────────────────────────── */}
      {activeStudent && !showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-lg w-full animate-scale-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={activeStudent.full_name} size={48} />
                <div>
                  <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                    {activeStudent.full_name}
                  </h3>
                  <p className="text-xs font-mono text-primary font-bold">{activeStudent.track_no}</p>
                </div>
              </div>
              <button onClick={() => setActiveStudent(null)} className="p-2 text-text-tertiary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-bg-secondary border border-border-default grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-tertiary block text-[10px]">Email</span>
                <span className="font-mono text-text-primary">{activeStudent.email}</span>
              </div>
              <div>
                <span className="text-text-tertiary block text-[10px]">Level</span>
                <span className="font-bold text-text-primary">{activeStudent.level}L</span>
              </div>
              <div>
                <span className="text-text-tertiary block text-[10px]">Department</span>
                <span className="text-text-primary">{activeStudent.departments?.name || '—'}</span>
              </div>
              <div>
                <span className="text-text-tertiary block text-[10px]">School</span>
                <span className="text-text-primary">{activeStudent.schools?.name || '—'}</span>
              </div>
            </div>

            {/* Attendance Records */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary mb-2">
                Attended Classes ({studentAttendedSessions.length})
              </h4>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {studentAttendedSessions.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic">No attendance records found.</p>
                ) : (
                  studentAttendedSessions.map(att => (
                    <div key={att.id} className="p-2.5 rounded-xl bg-bg-secondary border border-border-default flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-text-primary block">{att.sessions?.name || 'Class'}</span>
                        <span className="text-[10px] text-text-tertiary">{att.sessions?.session_date}</span>
                      </div>
                      <span className="font-mono text-[10px] text-success font-bold">
                        {new Date(att.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Audit Edits History (Section 8.1) */}
            {studentEditsHistory.length > 0 && (
              <div className="pt-3 border-t border-border-default">
                <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-text-tertiary mb-2 flex items-center gap-1.5">
                  <History size={13} />
                  <span>Admin Edit Audit Log ({studentEditsHistory.length})</span>
                </h4>
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto text-xs">
                  {studentEditsHistory.map(edit => (
                    <div key={edit.id} className="p-2.5 rounded-xl bg-bg-secondary border border-border-default">
                      <div className="flex justify-between font-mono text-[10px] text-primary font-bold">
                        <span>Field: {edit.field}</span>
                        <span>{new Date(edit.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <p className="text-text-secondary text-[11px] mt-0.5">
                        &quot;{edit.old_value}&quot; → <strong>&quot;{edit.new_value}&quot;</strong>
                      </p>
                      <p className="text-text-tertiary text-[10px] italic mt-0.5">Reason: {edit.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => openEditModal(activeStudent, 'track_no')}
              className="w-full py-3 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md flex items-center justify-center gap-2"
            >
              <Edit size={14} />
              <span>Correct Track Number / Level</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Admin Edit Student Modal (Section 8.1) ─────────────────────────── */}
      {showEditModal && activeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-primary" />
                <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                  Audited Student Correction
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-text-tertiary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Correcting details for <strong>{activeStudent.full_name}</strong>. All changes are immutably logged to the administrative audit ledger.
            </p>

            {editSuccess ? (
              <div className="p-6 rounded-2xl bg-success/10 border border-success/30 text-success text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={32} />
                <p className="font-bold text-sm">Student profile successfully corrected!</p>
              </div>
            ) : (
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5 text-xs">
                
                {/* Field Selector */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary">Field to Edit *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, field: 'track_no', newValue: activeStudent.track_no, applyToPast: true }))}
                      className={`py-2 rounded-xl border text-xs font-bold ${
                        editForm.field === 'track_no' ? 'bg-primary text-white border-primary' : 'bg-bg-secondary border-border-default text-text-secondary'
                      }`}
                    >
                      Track / ID Number
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, field: 'level', newValue: activeStudent.level || '100', applyToPast: false }))}
                      className={`py-2 rounded-xl border text-xs font-bold ${
                        editForm.field === 'level' ? 'bg-primary text-white border-primary' : 'bg-bg-secondary border-border-default text-text-secondary'
                      }`}
                    >
                      Academic Level
                    </button>
                  </div>
                </div>

                {/* New Value */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary">New Value *</label>
                  {editForm.field === 'track_no' ? (
                    <input
                      type="text"
                      required
                      placeholder="e.g. TRK-2024-9900"
                      value={editForm.newValue}
                      onChange={e => setEditForm(f => ({ ...f, newValue: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary font-mono text-text-primary"
                    />
                  ) : (
                    <select
                      value={editForm.newValue}
                      onChange={e => setEditForm(f => ({ ...f, newValue: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                    >
                      {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
                    </select>
                  )}
                </div>

                {/* Audit Reason */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary">Mandatory Audit Reason (min 5 chars) *</label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    placeholder={editForm.field === 'track_no' ? 'e.g. Typo during student registration' : 'e.g. Promoted to 300 level'}
                    value={editForm.reason}
                    onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                  />
                </div>

                {/* Apply to Past Attendance Records Checkbox (Section 8.1) */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-bg-secondary border border-border-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.applyToPast}
                    onChange={e => setEditForm(f => ({ ...f, applyToPast: e.target.checked }))}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <div>
                    <span className="font-bold text-text-primary block">Also correct past attendance records</span>
                    <span className="text-[10px] text-text-tertiary">
                      {editForm.field === 'track_no' ? 'Recommended ON (fixes typing mistake on old reports)' : 'Recommended OFF (past classes were attended at old level)'}
                    </span>
                  </div>
                </label>

                {editError && (
                  <div className="p-2.5 bg-error/10 border border-error/20 rounded-xl text-error font-medium">
                    {editError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border-default text-text-secondary hover:bg-bg-secondary font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:opacity-90 flex items-center justify-center gap-2"
                  >
                    {submittingEdit ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>Save Audited Edit</span>
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
