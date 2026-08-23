import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LogoutButton } from '@/components/LogoutButton'
import { SessionGuard } from '@/components/SessionGuard'
import { Users, CalendarDays } from '@/components/ui/icons'
import Image from 'next/image'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  const navItems = [
    { href: '/admin', icon: Users, label: 'The Squad' },
    { href: '/admin/events', icon: CalendarDays, label: 'Classes & Hangouts' }
  ]

  return (
    <SessionGuard>
    <div className="flex min-h-screen min-h-[100dvh] bg-bg-primary text-text-primary">
      {/* Sidebar – desktop only */}
      <aside className="hidden md:flex w-[220px] bg-bg-secondary border-r border-border-default flex-col fixed top-0 bottom-0 left-0 z-20 flex-shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-border-default flex items-center gap-3">
          <Image src="/logo.png" alt="JAV Lite" width={32} height={32} className="select-none flex-shrink-0" />
          <div>
            <div 
              className="font-bold text-sm text-primary tracking-[2px] leading-none flex items-center gap-1"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              JAV
              <Image src="/lite.png" alt="Lite" width={32} height={12} className="object-contain w-auto h-3" />
            </div>
            <span className="text-[10px] text-text-tertiary font-semibold tracking-widest uppercase">
              Control Room
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 flex-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-transparent hover:border-border-default transition-all duration-150 group"
              >
                <Icon size={16} strokeWidth={1.75} className="text-text-tertiary group-hover:text-primary transition-colors flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-border-default flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.full_name || 'Admin'} photoUrl={profile?.photo_url} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-text-primary truncate">
                {profile?.full_name}
              </div>
              <div className="text-[10px] text-success font-mono flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                Administrator
              </div>
            </div>
          </div>
          <LogoutButton variant="sidebar" />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 md:pl-[220px] flex flex-col min-h-screen min-h-[100dvh]">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-bg-primary border-b border-border-default px-4 sm:px-6 md:px-8 py-3 flex justify-between items-center">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 sm:gap-2.5 md:hidden">
            <Image src="/logo.png" alt="JAV Lite" width={26} height={26} className="select-none w-6 h-6" />
            <div 
              className="font-bold text-xs sm:text-sm tracking-[2px] text-primary flex items-center gap-1"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              JAV
              <Image src="/lite.png" alt="Lite" width={28} height={10} className="object-contain w-auto h-2.5 sm:h-3" />
            </div>
            <span className="text-[9px] sm:text-[10px] text-text-tertiary uppercase tracking-wider">Control Room</span>
          </div>

          {/* Desktop breadcrumb placeholder */}
          <div className="hidden md:block" />

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-2">
              <Avatar name={profile?.full_name || 'Admin'} photoUrl={profile?.photo_url} size={28} />
              <span className="text-xs text-text-secondary font-medium">{profile?.full_name?.split(' ')[0]}</span>
            </div>
            {/* Logout — always visible in topbar on mobile */}
            <LogoutButton variant="topbar" />
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile to clear bottom nav */}
        <main className="flex-1 px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8 pb-20 md:pb-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border-default flex z-20 pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center py-2.5 sm:py-3 gap-1 text-text-tertiary hover:text-primary active:text-primary transition-colors"
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="text-[9px] font-semibold tracking-wide uppercase">{item.label.split(' ')[0]}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
    </SessionGuard>
  )
}
