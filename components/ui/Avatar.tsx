import React from 'react'
import { PALETTE } from '@/lib/constants'

interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

const getInitials = (n: string) => 
  n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

const getColor = (n: string) => 
  PALETTE[n.charCodeAt(0) % PALETTE.length]

export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  photoUrl, 
  size = 40, 
  className = '', 
  style = {} 
}) => {
  const color = getColor(name || '?')
  
  if (photoUrl) {
    return (
      <img 
        src={photoUrl} 
        alt={name} 
        className={`object-cover rounded-full flex-shrink-0 transition-all duration-300 hover:scale-105 ${className}`}
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}`,
          boxShadow: `0 0 10px ${color}20`,
          ...style
        }}
      />
    )
  }

  return (
    <div 
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 user-none transition-all duration-300 hover:scale-105 ${className}`}
      style={{
        width: size,
        height: size,
        background: `${color}15`,
        border: `2px solid ${color}`,
        color: color,
        fontSize: size * 0.35,
        fontFamily: "'Rajdhani', sans-serif",
        textShadow: `0 0 10px ${color}30`,
        ...style
      }}
    >
      {getInitials(name || '?')}
    </div>
  )
}
