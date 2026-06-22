import React from 'react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Profile } from './StudentCard'

interface AttendanceRowProps {
  student: Profile
  present: boolean
  pending?: boolean
  rawStatus?: string | null
  markedAt: string | null
  eventId?: string
  onConfirm?: () => void
}

const fmtTime = (isoString: string | null) => {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  student,
  present,
  pending,
  rawStatus,
  markedAt,
  eventId,
  onConfirm
}) => {
  const [confirming, setConfirming] = React.useState(false)

  const handleConfirm = async () => {
    if (!eventId || confirming) return
    setConfirming(true)
    try {
      const client = (await import('@/lib/supabase/client')).createClient()

      const { data: { user } } = await client.auth.getUser()
      if (!user) throw new Error('You must be logged in to confirm attendance.')

      const { data, error } = await client
        .from('attendance')
        .update({ status: 'confirmed' })
        .eq('event_id', eventId)
        .eq('student_id', student.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error('No records updated. Please ensure you have admin permissions and try again.')
      }

      onConfirm && onConfirm()
    } catch (err: any) {
      alert('Failed to confirm attendance: ' + (err.message || JSON.stringify(err)))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <tr className="border-b border-border-default/50 bg-bg-primary hover:bg-bg-secondary transition-colors group">
      <td className="px-6 py-4 whitespace-nowrap pl-6">
        <div className="flex items-center gap-4">
          <Avatar
            name={student.full_name || 'Student'}
            photoUrl={student.photo_url}
            size={36}
            className="ring-2 ring-bg-secondary group-hover:ring-bg-primary transition-all"
          />
          <div className="min-w-0">
            <div className="font-bold text-sm text-text-primary truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
              {student.full_name || 'No Name'}
            </div>
            <div className="text-[10px] text-text-secondary font-mono mt-1">
              {student.email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap font-mono text-xs font-bold text-text-secondary">
        <span className="bg-bg-tertiary border border-border-default px-2 py-1 rounded-md text-[10px]">
          {student.track_no || '—'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {student.department ? (
          <Badge text={student.department} type="department" />
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-xs font-mono font-bold text-text-secondary">
        L{student.level || '—'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {pending ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold bg-warning/10 border border-warning/20 text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> Pending
            </span>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {confirming ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold ${present
                ? 'bg-success/10 border border-success/20 text-success'
                : 'bg-error/10 border border-error/20 text-error'
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-success animate-pulse shadow-[0_0_8px_var(--color-success)]' : 'bg-error'}`}
            />
            {present ? 'Present' : 'Absent'}
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-text-primary pr-6 text-right">
        {fmtTime(markedAt)}
      </td>
    </tr>
  )
}
