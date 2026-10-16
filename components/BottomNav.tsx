'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, QrCode, User, BookOpen } from '@/components/ui/icons'

export function BottomNav() {
  const pathname = usePathname()

  const isHome = pathname === '/home'
  const isRecords = pathname === '/records'
  const isProfile = pathname === '/profile'
  const isScan = pathname === '/scan'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary/95 backdrop-blur-md border-t border-border-default pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 px-6 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        
        {/* Home / History */}
        <Link
          href="/home"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            isHome ? 'text-primary font-bold' : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Home size={22} strokeWidth={isHome ? 2.5 : 2} />
          <span className="text-[11px] tracking-tight">Sessions</span>
        </Link>

        {/* My Records */}
        <Link
          href="/records"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            isRecords ? 'text-primary font-bold' : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <BookOpen size={22} strokeWidth={isRecords ? 2.5 : 2} />
          <span className="text-[11px] tracking-tight">Records</span>
        </Link>

        {/* Center Scan Button — 64px raised circle with primary color & accent glow */}
        <div className="relative -top-5 flex flex-col items-center">
          <Link
            href="/scan"
            aria-label="Scan Attendance QR Code"
            className="group relative w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_8px_24px_rgba(196,30,187,0.45)] hover:shadow-[0_12px_32px_rgba(255,157,102,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 border-4 border-bg-primary"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-[#FF9D66] opacity-80 group-hover:opacity-100 transition-opacity" />
            <QrCode size={28} strokeWidth={2.2} className="relative z-10 text-white" />
          </Link>
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-1">
            Scan QR
          </span>
        </div>

        {/* Profile */}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            isProfile ? 'text-primary font-bold' : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <User size={22} strokeWidth={isProfile ? 2.5 : 2} />
          <span className="text-[11px] tracking-tight">Profile</span>
        </Link>

      </div>
    </nav>
  )
}
