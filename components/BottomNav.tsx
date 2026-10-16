'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, QrCode, User, BookOpen } from '@/components/ui/icons'

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
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary/95 backdrop-blur-md border-t border-border-default shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-4 items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="flex flex-col items-center justify-center gap-0.5 group"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${
                    item.active
                      ? 'bg-gradient-to-tr from-primary to-[#FF9D66] text-white shadow-primary/30 scale-105'
                      : 'bg-gradient-to-tr from-primary to-[#FF9D66] text-white shadow-primary/20 group-hover:scale-105 group-active:scale-95'
                  }`}
                >
                  <Icon size={22} strokeWidth={2.4} />
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
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all ${
                item.active
                  ? 'text-primary font-bold'
                  : 'text-text-tertiary hover:text-text-primary font-medium'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <Icon size={22} strokeWidth={item.active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
