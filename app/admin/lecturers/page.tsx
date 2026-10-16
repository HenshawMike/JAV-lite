'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Building2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
} from '@/components/ui/icons'

interface LecturerProfile {
  id: string
  full_name: string
  email: string
  lecturer_status: 'pending' | 'approved' | 'rejected' | null
  school_id: string | null
  created_at: string
  schools?: { name: string } | null
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Review',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    dot: 'bg-warning',
  },
  approved: {
    label: 'Approved',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    dot: 'bg-success',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-error',
    bg: 'bg-error/10',
    border: 'border-error/20',
    dot: 'bg-error',
  },
}

export default function AdminLecturersPage() {
  const supabase = createClient()

  const [lecturers, setLecturers] = useState<LecturerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const loadLecturers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, lecturer_status, school_id, created_at, schools(name)')
        .eq('role', 'lecturer')
        .order('created_at', { ascending: false })

      if (error) throw error
      const normalized: LecturerProfile[] = (data || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        email: d.email,
        lecturer_status: d.lecturer_status,
        school_id: d.school_id,
        created_at: d.created_at,
        schools: Array.isArray(d.schools) ? d.schools[0] || null : d.schools || null,
      }))
      setLecturers(normalized)
    } catch (err) {
      console.error('Load lecturers error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadLecturers()
  }, [loadLecturers])

  const handleApprove = async (lecturerId: string) => {
    setActioningId(lecturerId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ lecturer_status: 'approved' })
        .eq('id', lecturerId)

      if (error) throw error
      await loadLecturers()
    } catch (err: any) {
      console.error('Approve error:', err)
      alert('Failed to approve: ' + (err.message || 'Unknown error'))
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (lecturerId: string) => {
    setActioningId(lecturerId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ lecturer_status: 'rejected' })
        .eq('id', lecturerId)

      if (error) throw error
      setRejectingId(null)
      setRejectionReason('')
      await loadLecturers()
    } catch (err: any) {
      console.error('Reject error:', err)
      alert('Failed to reject: ' + (err.message || 'Unknown error'))
    } finally {
      setActioningId(null)
    }
  }

  const handleRevokeApproval = async (lecturerId: string) => {
    if (!confirm('Revoke this lecturer\'s approval? They will be set back to pending.')) return
    setActioningId(lecturerId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ lecturer_status: 'pending' })
        .eq('id', lecturerId)

      if (error) throw error
      await loadLecturers()
    } catch (err: any) {
      console.error('Revoke error:', err)
    } finally {
      setActioningId(null)
    }
  }

  const filtered = lecturers.filter(l => {
    if (filter === 'all') return true
    return l.lecturer_status === filter
  })

  const pendingCount = lecturers.filter(l => l.lecturer_status === 'pending').length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <Loader2 size={36} className="text-primary animate-spin" />
        <span className="text-text-secondary font-bold tracking-[3px] uppercase text-xs">Loading Lecturer Applications...</span>
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
            Lecturer Approvals
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review and approve or reject lecturer account applications.
          </p>
        </div>
        <button
          onClick={loadLecturers}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-default text-xs font-bold text-text-secondary hover:border-primary hover:text-primary cursor-pointer transition-all"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 flex items-center gap-3 animate-fade-in">
          <Clock size={18} className="text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-text-primary">
              {pendingCount} application{pendingCount !== 1 ? 's' : ''} awaiting review
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Pending lecturers cannot create sessions until approved.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-bg-secondary border border-border-default w-fit">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              filter === tab
                ? 'bg-bg-primary text-primary shadow-sm border border-border-default'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab !== 'all' && (
              <span className="ml-1.5 text-[10px] font-mono">
                ({lecturers.filter(l => l.lecturer_status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lecturer List */}
      {filtered.length === 0 ? (
        <div className="p-16 rounded-3xl border border-dashed border-border-default text-center flex flex-col items-center gap-3">
          <UserCheck size={36} className="text-text-tertiary opacity-40" />
          <p className="text-sm font-bold text-text-primary">No {filter === 'all' ? '' : filter} lecturers</p>
          <p className="text-xs text-text-secondary">
            {filter === 'pending' ? 'No applications waiting for review.' : `No lecturers with ${filter} status.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(lecturer => {
            const cfg = STATUS_CONFIG[lecturer.lecturer_status || 'pending']
            const isExpanded = expandedId === lecturer.id
            const isRejecting = rejectingId === lecturer.id

            return (
              <div
                key={lecturer.id}
                className="rounded-2xl border border-border-default bg-bg-secondary overflow-hidden transition-all hover:border-primary/30"
              >
                {/* Main row */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={lecturer.full_name || lecturer.email} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                          {lecturer.full_name || 'No name provided'}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color} flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${lecturer.lecturer_status === 'pending' ? 'animate-pulse' : ''}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                          <Mail size={10} />
                          {lecturer.email}
                        </span>
                        {lecturer.schools?.name && (
                          <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                            <Building2 size={10} />
                            {lecturer.schools.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-0.5 font-mono">
                        Applied {new Date(lecturer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lecturer.lecturer_status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(lecturer.id)}
                          disabled={actioningId === lecturer.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success text-white text-xs font-bold hover:opacity-90 shadow-sm shadow-success/20 disabled:opacity-50 cursor-pointer transition-all"
                        >
                          {actioningId === lecturer.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(isRejecting ? null : lecturer.id)}
                          disabled={actioningId === lecturer.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold hover:bg-error hover:text-white disabled:opacity-50 cursor-pointer transition-all"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </>
                    )}

                    {lecturer.lecturer_status === 'approved' && (
                      <button
                        onClick={() => handleRevokeApproval(lecturer.id)}
                        disabled={actioningId === lecturer.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-primary border border-border-default text-text-secondary text-xs font-bold hover:border-warning hover:text-warning disabled:opacity-50 cursor-pointer transition-all"
                      >
                        {actioningId === lecturer.id ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
                        Revoke
                      </button>
                    )}

                    {lecturer.lecturer_status === 'rejected' && (
                      <button
                        onClick={() => handleApprove(lecturer.id)}
                        disabled={actioningId === lecturer.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold hover:bg-success hover:text-white disabled:opacity-50 cursor-pointer transition-all"
                      >
                        {actioningId === lecturer.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Re-approve
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : lecturer.id)}
                      className="p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                    >
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Rejection input */}
                {isRejecting && lecturer.lecturer_status === 'pending' && (
                  <div className="border-t border-border-default px-5 py-4 bg-error/5 flex flex-col gap-3 animate-fade-in">
                    <p className="text-xs font-bold text-error">Confirm rejection for {lecturer.full_name}</p>
                    <textarea
                      rows={2}
                      placeholder="Optional: reason for rejection (visible to admin only)"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-error/30 bg-bg-primary text-xs text-text-primary focus:outline-none focus:border-error resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRejectingId(null); setRejectionReason('') }}
                        className="flex-1 py-2 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReject(lecturer.id)}
                        disabled={actioningId === lecturer.id}
                        className="flex-1 py-2 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {actioningId === lecturer.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-default px-5 py-4 bg-bg-primary animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-text-tertiary block mb-0.5">User ID</span>
                        <span className="font-mono text-text-secondary text-[10px]">{lecturer.id.slice(0, 16)}…</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-tertiary block mb-0.5">Institution</span>
                        <span className="font-bold text-text-primary">{lecturer.schools?.name || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-tertiary block mb-0.5">Application Date</span>
                        <span className="font-mono text-text-primary">{new Date(lecturer.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
