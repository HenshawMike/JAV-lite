import React from 'react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  track_no: string | null
  level: string | null
  department: string | null
  faculty: string | null
  photo_url: string | null
  is_admin: boolean
  registered: boolean
  created_at: string
}

interface StudentCardProps {
  student: Profile
  onClick?: () => void
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`card-minimal p-4 flex flex-col justify-between card-minimal-hover ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 mb-4">
        <Avatar 
          name={student.full_name || 'Student'} 
          photoUrl={student.photo_url} 
          size={46}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">
            {student.full_name || 'No Name'}
          </h3>
          <code className="block font-mono text-[10px] text-[var(--text-secondary)] mt-0.5">
            {student.track_no || 'NO_TRACK_NO'}
          </code>
        </div>
        {student.level && (
          <span className="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-full px-2.5 py-0.5 text-[var(--text-secondary)] font-mono flex-shrink-0">
            L{student.level}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center mt-auto">
        {student.department && (
          <Badge text={student.department} type="department" />
        )}
        {onClick && (
          <span className="text-xs text-[var(--primary)] font-semibold flex items-center gap-0.5 hover:opacity-80 transition-opacity">
            View Details <span className="text-[10px]">→</span>
          </span>
        )}
      </div>
    </div>
  )
}
