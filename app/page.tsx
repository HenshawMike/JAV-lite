import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/SignInButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ShieldCheck, Zap, Smartphone } from '@/components/ui/icons'
import { RoleSelect } from '@/components/ui/RoleSelect'
import Image from 'next/image'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('registered, is_admin')
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
        .select('registered, is_admin')
        .single()

      if (!insertError) {
        profile = newProfile
      }
    }

    if (profile?.is_admin) {
      redirect('/admin')
    } else if (profile?.registered) {
      redirect('/attend')
    } else {
      redirect('/register')
    }
  }

  return (
    <main className="min-h-[100dvh] w-full flex bg-bg-primary font-sans selection:bg-primary selection:text-white">

      {/* Theme Toggle - Absolute Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Left Pane: Branding & Value Proposition (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 bg-bg-secondary border-r border-border-default flex-col justify-between p-16 relative overflow-hidden">

        {/* Geometric Background Accent (No Glassmorphism, Pure SVG/CSS shapes) */}
        <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary opacity-5 rounded-full" />
        <div className="absolute top-32 -right-32 w-64 h-64 bg-accent opacity-5 rounded-full" />

        {/* Top: Logo & Name */}
        <div className="relative z-10 flex items-center gap-4 animate-fade-in">
          <div className="bg-bg-primary p-2.5 rounded-xl border border-border-default shadow-sm">
            <Image
              src="/logo.png"
              alt="JAV Lite logo"
              width={32}
              height={32}
              className="select-none"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-2xl tracking-[4px] text-text-primary leading-none flex items-center gap-2" style={{ fontFamily: "var(--font-rajdhani)" }}>
              JAV
              <Image src="/lite.png" alt="Lite" width={48} height={20} className="object-contain w-auto h-5 mt-0.5" />
            </span>
          </div>
        </div>

        {/* Middle: Hero Typography */}
        <div className="relative z-10 max-w-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-5xl xl:text-6xl font-bold text-text-primary leading-[1.1] mb-6" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Attendance, <br />
            <span className="text-primary">but fun.</span>
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed font-medium">
            No more boring roll calls! Hop in instantly and let our super-smooth face scanner magically check you into class in a blink.
          </p>

          {/* Feature List */}
          <div className="mt-12 flex flex-col gap-5">
            {[
              { icon: <ShieldCheck size={20} strokeWidth={1.75} className="text-primary" />, title: 'Google Magic', desc: 'Secure login without remembering another password.' },
              { icon: <Zap size={20} strokeWidth={1.75} className="text-accent" />, title: 'Super Fast', desc: 'Tap a button and poof, you are marked present.' },
              { icon: <Smartphone size={20} strokeWidth={1.75} className="text-primary" />, title: 'Works Everywhere', desc: 'From your phone to your laptop, we got you.' }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-bg-primary border border-border-default flex items-center justify-center flex-shrink-0 shadow-sm">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{feature.title}</h3>
                  <p className="text-xs text-text-secondary mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Footer Info */}
        <div className="relative z-10 animate-fade-in flex items-center justify-between border-t border-border-default pt-8" style={{ animationDelay: '0.4s' }}>
          <a href="https://www.blimtechnologies.com" className="text-xs font-bold text-text-tertiary hover:text-primary transition-colors uppercase tracking-[2px]">
            Blim Technologies
          </a>
          <span className="text-xs font-mono text-text-tertiary font-bold">
            v0.1.0
          </span>
        </div>
      </div>

      {/* Mobile View */}
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

      {/* Desktop / Tablet View */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-6 relative">
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

    </main>
  )
}
