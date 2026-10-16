import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { BrandCarousel } from '@/components/BrandCarousel'
import { SignInButton } from '@/components/SignInButton'
import { GraduationCap, BookOpen, ShieldCheck } from '@/components/ui/icons'
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

    if (profile?.is_admin || profile?.role === 'admin') {
      redirect('/admin')
    }

    // Check if user has consented / completed role onboarding
    const { data: consents } = await supabase
      .from('consents')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const hasOnboarded = Boolean((consents && consents.length > 0) || profile?.registered)

    if (!hasOnboarded) {
      redirect('/onboarding')
    } else if (profile?.role === 'lecturer') {
      redirect('/lecturer')
    } else {
      redirect('/home')
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

      {/* Right Pane — Sign in content (Desktop) */}
      <div className="hidden lg:flex w-1/2 min-h-[100dvh] items-center justify-center p-8 relative">
        <div className="w-full max-w-[420px] flex flex-col items-start text-left animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <span className="text-[11px] font-bold tracking-[3px] uppercase text-primary mb-2">
            Academic Attendance
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Welcome to <span className="text-primary">JAV Lite</span>
          </h1>
          <p className="text-sm text-text-secondary mb-8 leading-relaxed">
            Sign in with your Google account to get started. You&apos;ll choose whether you are a Student or Lecturer right after signing in.
          </p>

          <div className="w-full mb-6">
            <SignInButton />
          </div>

          <div className="w-full flex flex-col gap-3 p-4 rounded-2xl bg-bg-secondary border border-border-default mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">Students</p>
                <p className="text-[11px] text-text-secondary">Scan live QR codes & check into classes</p>
              </div>
            </div>
            <div className="h-px w-full bg-border-default/60" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                <BookOpen size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">Lecturers</p>
                <p className="text-[11px] text-text-secondary">Broadcast attendance sessions & manage class rosters</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-text-tertiary text-left w-full">
            By proceeding, you agree to the{' '}
            <a href="/terms" className="underline hover:text-text-primary transition-colors">Terms of Service</a> and{' '}
            <a href="/privacy" className="underline hover:text-text-primary transition-colors">Privacy Policy</a>.
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

        {/* Center content space */}
        <div className="flex-1 flex flex-col justify-center gap-6 animate-fade-in my-8">
          <div>
            <span className="text-[10px] font-bold tracking-[3px] uppercase text-primary">
              Academic Attendance
            </span>
            <h1
              className="text-3xl font-bold text-text-primary leading-tight mt-1 mb-2"
              style={{ fontFamily: "var(--font-rajdhani)" }}
            >
              Welcome to <span className="text-primary">JustAttendVirtually</span>
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              Sign in with your Google account to get started. Choose Student or Lecturer next.
            </p>
          </div>

          <div className="w-full">
            <SignInButton />
          </div>

          <div className="w-full flex flex-col gap-3 p-4 rounded-2xl bg-bg-secondary border border-border-default">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">Students</p>
                <p className="text-[11px] text-text-secondary">Scan live QR codes & check into classes</p>
              </div>
            </div>
            <div className="h-px w-full bg-border-default/60" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                <BookOpen size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">Lecturers</p>
                <p className="text-[11px] text-text-secondary">Broadcast attendance sessions & manage class rosters</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-text-tertiary text-center pt-4">
          By proceeding, you agree to the{' '}
          <a href="/terms" className="underline hover:text-text-primary transition-colors">Terms of Service</a> and{' '}
          <a href="/privacy" className="underline hover:text-text-primary transition-colors">Privacy Policy</a>.
        </p>
      </div>

    </main>
  )
}
