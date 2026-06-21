'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * OAuth callback page — handles implicit flow.
 * After Google redirects here with #access_token=… in the hash,
 * onAuthStateChange fires with SIGNED_IN and we route the user.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let handled = false

    async function handleSession(session: any) {
      if (handled) return
      handled = true

      if (!session?.user) {
        router.replace('/')
        return
      }

      const user = session.user

      // Fetch the user's profile
      let { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('registered, is_admin')
        .eq('id', user.id)
        .single()

      // Create profile if it doesn't exist yet
      if (profileErr?.code === 'PGRST116' || !profile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
            registered: false,
          })
          .select('registered, is_admin')
          .single()
        profile = newProfile
      }

      if (profile?.is_admin) {
        router.replace('/admin')
      } else if (profile?.registered) {
        router.replace('/attend')
      } else {
        router.replace('/register')
      }
    }

    // onAuthStateChange reliably detects implicit-flow tokens from the URL hash.
    // INITIAL_SESSION fires immediately with existing session (already logged in).
    // SIGNED_IN fires when tokens are newly parsed from the hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          handleSession(session)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-5">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs font-bold tracking-widest uppercase text-text-secondary">
          Signing you in…
        </span>
      </div>
    </div>
  )
}
