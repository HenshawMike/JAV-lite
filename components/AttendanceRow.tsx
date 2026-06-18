import React from 'react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Profile } from './StudentCard'

interface AttendanceRowProps {
  student: Profile
  present: boolean
  markedAt: string | null
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
  markedAt 
}) => {
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
        <span 
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold ${
            present 
              ? 'bg-success/10 border border-success/20 text-success' 
              : 'bg-error/10 border border-error/20 text-error'
          }`}
        >
          <span 
            className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-success animate-pulse shadow-[0_0_8px_var(--color-success)]' : 'bg-error'}`}
          />
          {present ? 'Present' : 'Absent'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-text-primary pr-6 text-right">
        {fmtTime(markedAt)}
      </td>
    </tr>
  )
}
