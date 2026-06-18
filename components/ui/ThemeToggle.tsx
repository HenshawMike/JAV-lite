'use client'

import React, { useEffect, useState } from 'react'

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
        className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] w-9 h-9 flex items-center justify-center opacity-0 pointer-events-none"
        aria-hidden="true"
        tabIndex={-1}
      />
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition-all duration-150 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? (
        // Sun icon → switch to light
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        // Moon icon → switch to dark
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
