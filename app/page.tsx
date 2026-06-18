import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/SignInButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
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
              { icon: <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>, title: 'Google Magic', desc: 'Secure login without remembering another password.' },
              { icon: <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>, title: 'Super Fast', desc: 'Tap a button and poof, you are marked present.' },
              { icon: <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 1H5c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H5V5h14v14z" /><path d="M11 22h2v-2h-2z" /></svg>, title: 'Works Everywhere', desc: 'From your phone to your laptop, we got you.' }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-bg-primary border border-border-default flex items-center justify-center flex-shrink-0 shadow-sm text-lg">
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

      {/* Right Pane: Authentication Module (Centered) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-[420px] flex flex-col items-center sm:items-start text-center sm:text-left animate-fade-in" style={{ animationDelay: '0.1s' }}>

          {/* Mobile Logo Fallback */}
          <div className="lg:hidden bg-bg-secondary p-3 rounded-2xl border border-border-default shadow-sm mb-8">
            <Image
              src="/logo.png"
              alt="JAV Lite logo"
              width={40}
              height={40}
              className="select-none"
              priority
            />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3 flex items-center gap-3" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Welcome!
          </h2>
          <p className="text-sm text-text-secondary mb-10 leading-relaxed max-w-[320px] mx-auto sm:mx-0">
            Log in to check your classes or manage the crew.
          </p>

          {/* Form Context */}
          <div className="w-full bg-bg-secondary border border-border-default p-8 rounded-2xl shadow-sm">


            <SignInButton />


          </div>

          <p className="mt-8 text-[11px] text-text-tertiary text-center sm:text-left w-full">
            By proceeding, you agree to the <a href="https://jav.blimtechnologies.com/terms" className="underline hover:text-text-primary">Terms of Service</a> and <a href="https://jav.blimtechnologies.com/privacy-policy" className="underline hover:text-text-primary">Privacy Policy</a>.
          </p>
        </div>
      </div>

    </main>
  )
}
