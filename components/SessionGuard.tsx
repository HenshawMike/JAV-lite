'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/** Inactivity timeout in milliseconds — 30 minutes */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

/** Events that count as "activity" and reset the timer */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
]

interface SessionGuardProps {
  children: React.ReactNode
}

/**
 * Wraps admin pages. Signs the user out and redirects to "/" if they are
 * inactive for SESSION_TIMEOUT_MS (default 30 minutes).
 */
export function SessionGuard({ children }: SessionGuardProps) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const signOutAndRedirect = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/?reason=timeout')
    router.refresh()
  }, [router])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(signOutAndRedirect, SESSION_TIMEOUT_MS)
  }, [signOutAndRedirect])

  useEffect(() => {
    // Start the timer on mount
    resetTimer()

    // Re-attach listeners
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [resetTimer])

  return <>{children}</>
}
