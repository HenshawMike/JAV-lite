'use client'

import { useState } from 'react'

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
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--error,#ef4444)] hover:border-[var(--error,#ef4444)] hover:bg-[color-mix(in_srgb,var(--error,#ef4444)_8%,transparent)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <button
      id="admin-logout-btn-sidebar"
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-[var(--text-tertiary)] hover:text-[var(--error,#ef4444)] hover:bg-[color-mix(in_srgb,var(--error,#ef4444)_8%,transparent)] border border-transparent hover:border-[color-mix(in_srgb,var(--error,#ef4444)_30%,transparent)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
      <span>{loading ? 'Signing out…' : 'Sign Out'}</span>
    </button>
  )
}
