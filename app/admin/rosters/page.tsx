'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import {
  BookOpen,
  Users,
  Search,
  X,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
} from '@/components/ui/icons'

interface School { id: string; name: string }
interface Faculty { id: string; school_id: string; name: string }
interface Department { id: string; faculty_id: string; name: string }
interface RosterEntry {
  id: string
  full_name: string
  track_no: string
  level: string | null
  department_id: string | null
  departments?: { name: string }
  faculties?: { name: string }
  schools?: { name: string }
}

export default function AdminRostersPage() {
  const supabase = createClient()

  const [schools, setSchools] = useState<School[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterSchool, setFilterSchool] = useState('All')
  const [filterDept, setFilterDept] = useState('All')

  // Add entry modal
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ fullName: '', trackNo: '', level: '100', departmentId: '' })
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Expanded department groups
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      const [schoolsRes, facsRes, deptsRes, rosterRes] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('faculties').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase
          .from('roster')
          .select('*, departments(name, faculties(name, schools(name)))')
          .order('full_name'),
      ])

      setSchools(schoolsRes.data || [])
      setFaculties(facsRes.data || [])
      setDepartments(deptsRes.data || [])

      // Flatten nested joins for display
      const flat = (rosterRes.data || []).map((r: any) => ({
        ...r,
        departments: r.departments ? { name: r.departments.name } : undefined,
        faculties: r.departments?.faculties ? { name: r.departments.faculties.name } : undefined,
        schools: r.departments?.faculties?.schools ? { name: r.departments.faculties.schools.name } : undefined,
      }))
      setRoster(flat)
    } catch (err) {
      console.error('Roster load error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter roster
  const filtered = roster.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.full_name.toLowerCase().includes(q) || r.track_no.toLowerCase().includes(q)
    const matchDept = filterDept === 'All' || r.department_id === filterDept
    return matchSearch && matchDept
  })

  // Group by department
  const byDept = filtered.reduce((acc, r) => {
    const key = r.departments?.name || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, RosterEntry[]>)

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!addForm.fullName.trim()) { setAddError('Full name is required.'); return }
    if (!addForm.trackNo.trim()) { setAddError('Track / Student ID is required.'); return }
    if (!addForm.departmentId) { setAddError('Please select a department.'); return }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('roster').insert({
        full_name: addForm.fullName.trim(),
        track_no: addForm.trackNo.trim(),
        level: addForm.level || null,
        department_id: addForm.departmentId,
        owner_id: user.id,
      })
      if (error) throw error

      setAddSuccess(true)
      setAddForm({ fullName: '', trackNo: '', level: '100', departmentId: '' })
      await loadData()
      setTimeout(() => { setAddSuccess(false); setShowAdd(false) }, 1500)
    } catch (err: any) {
      setAddError(err.message || 'Failed to add roster entry.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this student from the roster?')) return
    setDeletingId(id)
    try {
      const { error } = await supabase.from('roster').delete().eq('id', id)
      if (error) throw error
      await loadData()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <Loader2 size={36} className="text-primary animate-spin" />
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Loading Rosters...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* Header */}
      <div className="border-b border-border-default pb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Administration</span>
          <h1 className="text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Department Rosters
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage pre-registered student lists. These are used for manual attendance cross-referencing.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError(null); setAddSuccess(false) }}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 cursor-pointer transition-all"
        >
          <Plus size={14} />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center p-4 rounded-2xl bg-bg-secondary border border-border-default">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name or track ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary"
        >
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="px-3 py-2 rounded-xl bg-bg-tertiary text-xs font-mono font-bold text-text-tertiary border border-border-default">
          {filtered.length} students
        </div>
      </div>

      {/* Roster grouped by department */}
      {filtered.length === 0 ? (
        <div className="p-16 rounded-3xl border border-dashed border-border-default text-center flex flex-col items-center gap-3">
          <GraduationCap size={36} className="text-text-tertiary opacity-40" />
          <p className="text-sm font-bold text-text-primary">No roster entries found</p>
          <p className="text-xs text-text-secondary">Add students using the button above or adjust your search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byDept).map(([deptName, students]) => {
            const isExpanded = expandedDepts.has(deptName) || Object.keys(byDept).length === 1

            return (
              <section key={deptName} className="rounded-2xl border border-border-default overflow-hidden">
                <button
                  onClick={() => toggleDept(deptName)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={15} className="text-primary" />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{deptName}</span>
                    <span className="text-[10px] bg-bg-primary border border-border-default text-text-tertiary px-2 py-0.5 rounded-md font-mono font-bold">
                      {students.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={15} className="text-text-tertiary" /> : <ChevronRight size={15} className="text-text-tertiary" />}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-border-default">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar name={student.full_name} size={36} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-primary truncate">{student.full_name}</p>
                            <p className="text-[11px] text-text-tertiary font-mono">
                              {student.track_no}
                              {student.level && ` · ${student.level}L`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(student.id)}
                          disabled={deletingId === student.id}
                          className="ml-4 p-2 rounded-xl text-text-tertiary hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === student.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Add Student Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                  Add to Roster
                </h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-2 text-text-tertiary hover:text-text-primary cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {addSuccess ? (
              <div className="p-6 rounded-2xl bg-success/10 border border-success/20 text-success text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={28} />
                <p className="font-bold text-sm">Student added to roster!</p>
              </div>
            ) : (
              <form onSubmit={handleAddEntry} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-primary">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={addForm.fullName}
                    onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-primary">Track / Student ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TRK-2024-001"
                    value={addForm.trackNo}
                    onChange={e => setAddForm(f => ({ ...f, trackNo: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm font-mono text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Level</label>
                    <select
                      value={addForm.level}
                      onChange={e => setAddForm(f => ({ ...f, level: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary focus:outline-none focus:border-primary"
                    >
                      {['100', '200', '300', '400', '500', '600'].map(l => (
                        <option key={l} value={l}>Level {l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Department *</label>
                    <select
                      required
                      value={addForm.departmentId}
                      onChange={e => setAddForm(f => ({ ...f, departmentId: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">Select...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {addError && (
                  <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-xs text-error flex items-center gap-2">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    {addError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border-default text-text-secondary hover:bg-bg-secondary text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add to Roster
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
