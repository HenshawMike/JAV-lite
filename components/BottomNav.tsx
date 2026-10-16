'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, QrCode, User, BookOpen } from '@/components/ui/icons'
import { StudentSwipeNavigation } from '@/components/StudentSwipeNavigation'

export function BottomNav() {
  const pathname = usePathname()

  const isHome = pathname === '/home'
  const isRecords = pathname === '/records'
  const isScan = pathname === '/scan'
  const isProfile = pathname === '/profile'

  const navItems = [
    {
      href: '/home',
      label: 'Sessions',
      icon: Home,
      active: isHome,
    },
    {
      href: '/records',
      label: 'Records',
      icon: BookOpen,
      active: isRecords,
    },
    {
      href: '/scan',
      label: 'Scan QR',
      icon: QrCode,
      active: isScan,
      isPrimary: true,
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: User,
      active: isProfile,
    },
  ]

  return (
    <>
      <StudentSwipeNavigation />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary/95 backdrop-blur-md border-t border-border-default shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="flex flex-col items-center justify-center h-full gap-1 py-1 transition-all group"
              >
                <div
                  className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${
                    item.isPrimary
                      ? 'bg-gradient-to-tr from-primary to-[#FF9D66] text-white shadow-sm shadow-primary/25 scale-105'
                      : item.active
                      ? 'text-primary'
                      : 'text-text-tertiary group-hover:text-text-primary'
                  }`}
                >
                  <Icon size={20} strokeWidth={item.active || item.isPrimary ? 2.4 : 2} />
                </div>
                <span
                  className={`text-[10px] tracking-tight transition-colors ${
                    item.active ? 'text-primary font-bold' : 'text-text-secondary font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
