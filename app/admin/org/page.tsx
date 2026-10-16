'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  GraduationCap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X
} from '@/components/ui/icons'

interface School {
  id: string
  name: string
  faculties?: Faculty[]
}

interface Faculty {
  id: string
  school_id: string
  name: string
  departments?: Department[]
}

interface Department {
  id: string
  faculty_id: string
  name: string
}

export default function AdminOrgManagerPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [schools, setSchools] = useState<School[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // Modal State
  const [modalType, setModalType] = useState<'school' | 'faculty' | 'department' | null>(null)
  const [editingItem, setEditingItem] = useState<{ id?: string; name: string; parentId?: string } | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadOrg = useCallback(async () => {
    try {
      const [sRes, fRes, dRes] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('faculties').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
      ])

      setSchools(sRes.data || [])
      setFaculties(fRes.data || [])
      setDepartments(dRes.data || [])
    } catch (err) {
      console.error('Failed to load org hierarchy:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadOrg()
  }, [loadOrg])

  // Save (Create or Edit, supports bulk creation)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editingItem.name.trim()) return

    setSubmitting(true)
    setErrorMsg(null)

    try {
      if (bulkMode && !editingItem.id) {
        // Parse bulk names separated by newlines or commas
        const rawNames = editingItem.name
          .split(/[\r\n,]+/)
          .map(s => s.trim())
          .filter(Boolean)

        const names = Array.from(new Set(rawNames))
        if (names.length === 0) throw new Error('Please enter at least one name.')

        if (modalType === 'school') {
          const rows = names.map(n => ({ name: n }))
          const { error } = await supabase.from('schools').insert(rows)
          if (error) throw error
        } else if (modalType === 'faculty') {
          if (!editingItem.parentId) throw new Error('Please select a parent school.')
          const rows = names.map(n => ({ name: n, school_id: editingItem.parentId }))
          const { error } = await supabase.from('faculties').insert(rows)
          if (error) throw error
        } else if (modalType === 'department') {
          if (!editingItem.parentId) throw new Error('Please select a parent faculty.')
          const rows = names.map(n => ({ name: n, faculty_id: editingItem.parentId }))
          const { error } = await supabase.from('departments').insert(rows)
          if (error) throw error
        }
      } else {
        // Single create or edit
        if (modalType === 'school') {
          if (editingItem.id) {
            const { error } = await supabase.from('schools').update({ name: editingItem.name.trim() }).eq('id', editingItem.id)
            if (error) throw error
          } else {
            const { error } = await supabase.from('schools').insert({ name: editingItem.name.trim() })
            if (error) throw error
          }
        } else if (modalType === 'faculty') {
          if (!editingItem.parentId) throw new Error('Please select a parent school.')
          if (editingItem.id) {
            const { error } = await supabase.from('faculties').update({ name: editingItem.name.trim() }).eq('id', editingItem.id)
            if (error) throw error
          } else {
            const { error } = await supabase.from('faculties').insert({ name: editingItem.name.trim(), school_id: editingItem.parentId })
            if (error) throw error
          }
        } else if (modalType === 'department') {
          if (!editingItem.parentId) throw new Error('Please select a parent faculty.')
          if (editingItem.id) {
            const { error } = await supabase.from('departments').update({ name: editingItem.name.trim() }).eq('id', editingItem.id)
            if (error) throw error
          } else {
            const { error } = await supabase.from('departments').insert({ name: editingItem.name.trim(), faculty_id: editingItem.parentId })
            if (error) throw error
          }
        }
      }

      setModalType(null)
      setEditingItem(null)
      setBulkMode(false)
      await loadOrg()
    } catch (err: any) {
      console.error('Org save error:', err)
      setErrorMsg(err.message || 'Operation failed. A record with this name may already exist.')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Item
  const handleDelete = async (type: 'school' | 'faculty' | 'department', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return

    try {
      const table = type === 'school' ? 'schools' : type === 'faculty' ? 'faculties' : 'departments'
      const { error } = await supabase.from(table).delete().eq('id', id)

      if (error) {
        if (error.message?.includes('foreign key') || error.code === '23503') {
          alert(`Cannot delete this ${type} because active students or sessions are attached to it.`)
          return
        }
        throw error
      }

      await loadOrg()
    } catch (err: any) {
      alert(err.message || `Failed to delete ${type}.`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-pulse">
        <Loader2 size={36} className="text-primary animate-spin" />
        <span className="text-text-secondary text-xs font-bold uppercase tracking-widest">Loading Org Structure...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-16">
      
      {/* Title & Add Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-6">
        <div>
          <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">Academic Hierarchy</span>
          <h1 className="text-3xl font-bold text-text-primary mt-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Organization Structure Manager
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure Schools, Faculties, and Departments. Populates student registration dropdowns.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setModalType('school')
              setEditingItem({ name: '' })
              setErrorMsg(null)
            }}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-md flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add School</span>
          </button>
        </div>
      </div>

      {/* Org Tree View */}
      <div className="flex flex-col gap-6">
        {schools.length === 0 ? (
          <div className="p-16 rounded-3xl border border-dashed border-border-default text-center flex flex-col items-center gap-3 text-text-tertiary">
            <Building2 size={36} className="opacity-40" />
            <p className="text-sm font-bold text-text-primary">No schools configured yet</p>
            <p className="text-xs text-text-secondary">Click &quot;Add School&quot; above to create your institution structure.</p>
          </div>
        ) : (
          schools.map((school) => {
            const schoolFaculties = faculties.filter((f) => f.school_id === school.id)

            return (
              <div
                key={school.id}
                className="p-6 rounded-3xl bg-bg-secondary border border-border-default shadow-sm flex flex-col gap-5"
              >
                {/* School Header */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border-default">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary">School / Institution</span>
                      <h2 className="text-lg font-bold text-text-primary leading-tight" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                        {school.name}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setModalType('faculty')
                        setEditingItem({ name: '', parentId: school.id })
                        setErrorMsg(null)
                      }}
                      className="px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>Add Faculty</span>
                    </button>
                    <button
                      onClick={() => {
                        setModalType('school')
                        setEditingItem({ id: school.id, name: school.name })
                        setErrorMsg(null)
                      }}
                      className="p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-bg-primary transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete('school', school.id)}
                      className="p-2 rounded-xl text-text-tertiary hover:text-error hover:bg-bg-primary transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Faculties Grid */}
                <div className="flex flex-col gap-4 pl-4 sm:pl-6 border-l-2 border-primary/20">
                  {schoolFaculties.length === 0 ? (
                    <p className="text-xs text-text-tertiary italic">No faculties added yet for this school.</p>
                  ) : (
                    schoolFaculties.map((fac) => {
                      const facDepts = departments.filter((d) => d.faculty_id === fac.id)

                      return (
                        <div
                          key={fac.id}
                          className="p-4 rounded-2xl bg-bg-primary border border-border-default flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Layers size={16} className="text-accent" />
                              <h3 className="font-bold text-sm text-text-primary">{fac.name}</h3>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setModalType('department')
                                  setEditingItem({ name: '', parentId: fac.id })
                                  setErrorMsg(null)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-bg-secondary hover:bg-primary hover:text-white border border-border-default text-[11px] font-bold text-text-secondary transition-all flex items-center gap-1"
                              >
                                <Plus size={11} />
                                <span>Add Dept</span>
                              </button>
                              <button
                                onClick={() => {
                                  setModalType('faculty')
                                  setEditingItem({ id: fac.id, name: fac.name, parentId: fac.school_id })
                                  setErrorMsg(null)
                                }}
                                className="p-1 text-text-tertiary hover:text-text-primary"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete('faculty', fac.id)}
                                className="p-1 text-text-tertiary hover:text-error"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Departments Chips */}
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-border-default/50">
                            {facDepts.length === 0 ? (
                              <span className="text-[11px] text-text-tertiary italic">No departments added.</span>
                            ) : (
                              facDepts.map((dept) => (
                                <div
                                  key={dept.id}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-bg-secondary border border-border-default text-xs font-medium text-text-secondary group"
                                >
                                  <span>{dept.name}</span>
                                  <button
                                    onClick={() => {
                                      setModalType('department')
                                      setEditingItem({ id: dept.id, name: dept.name, parentId: dept.faculty_id })
                                      setErrorMsg(null)
                                    }}
                                    className="text-text-tertiary hover:text-text-primary ml-1"
                                  >
                                    <Edit size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete('department', dept.id)}
                                    className="text-text-tertiary hover:text-error"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal: Create or Edit */}
      {modalType && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-3xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary capitalize" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                {editingItem.id ? 'Edit' : 'Add New'} {modalType}
              </h3>
              <button
                onClick={() => {
                  setModalType(null)
                  setEditingItem(null)
                }}
                className="p-2 text-text-tertiary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3.5 text-xs">
              
              {/* Parent Selector if needed */}
              {modalType === 'faculty' && !editingItem.id && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary">Parent School *</label>
                  <select
                    required
                    value={editingItem.parentId}
                    onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                  >
                    <option value="">-- Select School --</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {modalType === 'department' && !editingItem.id && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary">Parent Faculty *</label>
                  <select
                    required
                    value={editingItem.parentId}
                    onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-text-primary"
                  >
                    <option value="">-- Select Faculty --</option>
                    {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {/* Single vs Bulk Mode Toggle for new items */}
              {!editingItem.id && (
                <div className="flex rounded-xl bg-bg-secondary p-1 border border-border-default mb-1">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !bulkMode ? 'bg-bg-primary text-primary shadow-sm border border-border-default' : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    Single {modalType}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      bulkMode ? 'bg-bg-primary text-primary shadow-sm border border-border-default' : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    Bulk Add (Multiple)
                  </button>
                </div>
              )}

              {bulkMode && !editingItem.id ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-text-primary capitalize">{modalType} Names (Bulk) *</label>
                    <span className="text-[10px] text-primary font-mono font-bold">
                      {editingItem.name.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean).length} item(s) detected
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    required
                    placeholder={
                      modalType === 'faculty'
                        ? "Enter or paste faculties (one per line or comma-separated):\nFaculty of Science\nFaculty of Engineering\nFaculty of Arts\nFaculty of Law"
                        : modalType === 'department'
                        ? "Enter or paste departments (one per line or comma-separated):\nComputer Science\nSoftware Engineering\nInformation Technology\nCybersecurity"
                        : "Enter or paste school names (one per line or comma-separated)..."
                    }
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-xs text-text-primary focus:outline-none focus:border-primary resize-y font-mono"
                  />
                  <p className="text-[10px] text-text-tertiary">
                    Tip: Paste a list from Excel, Google Sheets, or a document. Duplicates will be filtered automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-primary capitalize">{modalType} Name *</label>
                  <input
                    type="text"
                    required
                    placeholder={`e.g. ${modalType === 'school' ? 'University of Lagos' : modalType === 'faculty' ? 'Faculty of Science' : 'Computer Science'}`}
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border-default bg-bg-secondary text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 bg-error/10 border border-error/20 rounded-xl text-error font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null)
                    setEditingItem(null)
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-border-default text-text-secondary hover:bg-bg-secondary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:opacity-90 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save {modalType}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
