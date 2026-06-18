import React from 'react'
import { DEPT_COLORS } from '@/lib/constants'

interface BadgeProps {
  text: string
  type?: 'department' | 'level' | 'success' | 'error' | 'warning' | 'info'
  className?: string
  style?: React.CSSProperties
}

export const Badge: React.FC<BadgeProps> = ({ 
  text, 
  type = 'department', 
  className = '', 
  style = {} 
}) => {
  let color = '#22d3ee' // Default cyan
  
  if (type === 'department') {
    color = DEPT_COLORS[text] || '#22d3ee'
  } else if (type === 'level') {
    color = '#a78bfa' // purple
  } else if (type === 'success') {
    color = '#10B981' // green
  } else if (type === 'error') {
    color = '#EF4444' // red
  } else if (type === 'warning') {
    color = '#F59E0B' // orange
  } else if (type === 'info') {
    color = '#3B82F6' // blue
  }

  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap transition-all duration-200 hover:brightness-110 ${className}`}
      style={{
        background: `${color}15`,
        border: `1px solid ${color}40`,
        color: color,
        textShadow: `0 0 8px ${color}20`,
        ...style
      }}
    >
      <span 
        className="rounded-full inline-block flex-shrink-0 animate-pulse"
        style={{
          width: 6,
          height: 6,
          background: color,
          boxShadow: `0 0 8px ${color}`
        }}
      />
      {text}
    </span>
  )
}
