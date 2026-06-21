'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * OAuth callback page for implicit flow.
 * With implicit flow, Supabase redirects back to this page with tokens in the
 * URL hash fragment (e.g. #access_token=...&refresh_token=...).
 * The Supabase browser client automatically picks up these tokens from the hash,
 * establishes the session, and stores it in cookies via the SSR client.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // getSession() triggers the client SDK to parse the hash fragment tokens
    // and persist the session into cookies automatically.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/')
        return
      }

      const user = session.user

      // Fetch or create the user's profile
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('registered, is_admin')
        .eq('id', user.id)
        .single()

      if (profileError?.code === 'PGRST116') {
        // Profile doesn't exist yet — insert it
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
            registered: false,
          })
          .select('registered, is_admin')
          .single()

        if (!insertError) {
          profile = newProfile
        }
      }

      if (profile?.is_admin) {
        router.replace('/admin')
      } else if (profile?.registered) {
        router.replace('/attend')
      } else {
        router.replace('/register')
      }
    })
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
