'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from '@/components/ui/icons'

export const ThemeToggle: React.FC = () => {
  // null = not yet mounted (avoids SSR/client mismatch)
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    // Read the theme that was set by the inline script in layout.tsx
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null
    if (current === 'light' || current === 'dark') {
      setTheme(current)
    } else {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', sys)
      setTheme(sys)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  // Render a stable placeholder until we know the real theme (avoids hydration mismatch)
  if (theme === null) {
    return (
      <button
        className="p-2 rounded-xl border border-border-default bg-bg-secondary w-9 h-9 flex items-center justify-center opacity-0 pointer-events-none"
        aria-hidden="true"
        tabIndex={-1}
      />
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl border border-border-default bg-bg-secondary hover:bg-bg-tertiary hover:border-text-tertiary transition-all duration-200 flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer shadow-sm hover:scale-105 active:scale-95"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? (
        <Sun size={17} strokeWidth={1.75} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon size={17} strokeWidth={1.75} className="text-primary transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  )
}
