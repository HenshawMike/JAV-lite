import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RoleSelect } from '@/components/ui/RoleSelect'
import { BrandCarousel } from '@/components/BrandCarousel'
import Image from 'next/image'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('registered, is_admin, role')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || null,
          registered: false
        })
        .select('registered, is_admin, role')
        .single()

      if (!insertError) {
        profile = newProfile
      }
    }

    if (profile?.is_admin) {
      redirect('/admin')
    } else if (profile?.registered) {
      redirect(profile.role === 'lecturer' ? '/lecturer' : '/attend')
    } else {
      redirect('/register')
    }
  }

  return (
    <main className="min-h-[100dvh] w-full flex bg-bg-primary font-sans selection:bg-primary selection:text-white relative">

      {/* Theme Toggle - Absolute Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Left Pane — Orion-inspired gradient + bottom-anchored copy (Desktop) */}
      <div className="hidden lg:flex w-1/2 min-h-[100dvh] relative overflow-hidden flex-col justify-end p-14 lg:p-16 border-r border-border-default">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 40%, #1a0f14 100%)' }}
        />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary opacity-25 rounded-full blur-3xl pointer-events-none" />

        {/* Logo — Positioned directly above BrandCarousel */}
        <div className="relative z-10 mb-8">
          <div className="bg-bg-primary/80 backdrop-blur p-3 rounded-2xl border border-border-default w-fit shadow-sm">
            <Image src="/logo.png" alt="JAV Lite logo" width={32} height={32} className="select-none" priority />
          </div>
        </div>

        {/* Bottom: Carousel */}
        <BrandCarousel />
      </div>

      {/* Right Pane — Role selection content (Desktop) */}
      <div className="hidden lg:flex w-1/2 min-h-[100dvh] items-center justify-center p-8 relative">
        <div className="w-full max-w-[420px] flex flex-col items-start text-left animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Welcome!
          </h2>
          <p className="text-sm text-text-secondary mb-8 leading-relaxed max-w-[320px]">
            Who are you?
          </p>

          <RoleSelect />

          <p className="mt-8 text-[11px] text-text-tertiary text-left w-full">
            By proceeding, you agree to the{' '}
            <a href="https://jav.blimtechnologies.com/terms" className="underline hover:text-text-primary">Terms of Service</a> and{' '}
            <a href="https://jav.blimtechnologies.com/privacy-policy" className="underline hover:text-text-primary">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Mobile View — Full screen */}
      <div className="lg:hidden w-full min-h-[100dvh] flex flex-col p-6">
        {/* Logo — top-left corner */}
        <div className="flex items-center">
          <div className="bg-bg-secondary p-2 rounded-xl border border-border-default shadow-sm">
            <Image src="/logo.png" alt="JAV Lite logo" width={28} height={28} className="select-none" priority />
          </div>
        </div>

        {/* Remaining space */}
        <div className="flex-1 flex flex-col justify-center gap-8 animate-fade-in">
          <div>
            <h1
              className="text-3xl font-bold text-text-primary leading-tight mb-2"
              style={{ fontFamily: "var(--font-rajdhani)" }}
            >
              Welcome to <span className="text-primary">JustAttendVirtually</span>
            </h1>
            <p className="text-sm text-text-secondary">Who are you?</p>
          </div>

          <RoleSelect />
        </div>

        <p className="text-[11px] text-text-tertiary text-center pt-6">
          By proceeding, you agree to the{' '}
          <a href="https://jav.blimtechnologies.com/terms" className="underline">Terms of Service</a> and{' '}
          <a href="https://jav.blimtechnologies.com/privacy-policy" className="underline">Privacy Policy</a>.
        </p>
      </div>

    </main>
  )
}
