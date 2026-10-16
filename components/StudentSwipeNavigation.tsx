'use client'

import React, { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const STUDENT_TABS = [
  '/home',
  '/records',
  '/scan',
  '/profile',
]

interface StudentSwipeNavigationProps {
  children?: React.ReactNode
}

export function StudentSwipeNavigation({ children }: StudentSwipeNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  // Eagerly prefetch all student routes so swipe & click transitions are instantaneous
  useEffect(() => {
    STUDENT_TABS.forEach(tab => {
      try {
        router.prefetch(tab)
      } catch {
        // ignore
      }
    })
  }, [router])

  useEffect(() => {
    // Only activate gesture on student routes
    const isStudentRoute = STUDENT_TABS.some(t => pathname.startsWith(t))
    if (!isStudentRoute) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      const deltaTime = Date.now() - touchStartRef.current.time
      touchStartRef.current = null

      // Must be a swipe within 500ms
      if (deltaTime > 500) return

      // Must be a clear horizontal movement (X displacement > 50px, and horizontal distance > 1.5 * vertical distance)
      if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return

      // Check if target is inside an element that shouldn't swipe (like an input, camera scanner, or horizontal scroll)
      const target = e.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, button, [data-no-swipe], video') ||
        target?.closest('.overflow-x-auto')
      ) {
        return
      }

      // Determine current tab index
      const currentIndex = STUDENT_TABS.findIndex(t => pathname === t)
      if (currentIndex === -1) return

      if (deltaX < 0) {
        // Swiped Left (finger moved right to left) -> Navigate to Next Tab (e.g. Home -> Records -> Scan -> Profile)
        if (currentIndex < STUDENT_TABS.length - 1) {
          const nextTab = STUDENT_TABS[currentIndex + 1]
          router.push(nextTab)
        }
      } else {
        // Swiped Right (finger moved left to right) -> Navigate to Previous Tab (e.g. Profile -> Scan -> Records -> Home)
        if (currentIndex > 0) {
          const prevTab = STUDENT_TABS[currentIndex - 1]
          router.push(prevTab)
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pathname, router])

  return <>{children}</>
}
