'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from '@/components/ui/icons'

interface LogoutButtonProps {
  /** 'sidebar' renders a full-width row; 'topbar' renders a compact icon button */
  variant?: 'sidebar' | 'topbar'
}

export function LogoutButton({ variant = 'sidebar' }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLogout = () => {
    setLoading(true)
    window.location.href = '/auth/signout'
  }

  if (variant === 'topbar') {
    return (
      <button
        id="admin-logout-btn-topbar"
        onClick={handleLogout}
        disabled={loading}
        title="Sign out"
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-default bg-bg-secondary text-text-tertiary hover:text-error hover:border-error/40 hover:bg-error/10 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <Loader2 size={14} strokeWidth={2} className="text-error" />
        ) : (
          <LogOut size={15} strokeWidth={1.75} />
        )}
      </button>
    )
  }

  return (
    <button
      id="admin-logout-btn-sidebar"
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-text-tertiary hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {loading ? (
        <Loader2 size={16} strokeWidth={2} className="flex-shrink-0 text-error" />
      ) : (
        <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
      )}
      <span>{loading ? 'Signing out…' : 'Sign Out'}</span>
    </button>
  )
}
