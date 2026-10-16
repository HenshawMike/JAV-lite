import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && user) {
      // Sync/load the user's profile
      let { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('registered, is_admin, role')
        .eq('id', user.id)
        .single()

      // Create new profile if it does not exist
      if (profileErr?.code === 'PGRST116' || !profile) {
        const { data: newProfile, error: createErr } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
            registered: false,
          })
          .select('registered, is_admin, role')
          .single()

        if (!createErr && newProfile) {
          profile = newProfile
        }
      }

      // Check admin status
      if (profile?.is_admin || profile?.role === 'admin') {
        return NextResponse.redirect(`${origin}/admin`)
      }

      // Check if user has consented / completed role onboarding
      const { data: consents } = await supabase
        .from('consents')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      const hasOnboarded = Boolean((consents && consents.length > 0) || profile?.registered)

      if (!hasOnboarded) {
        // Users sign in with Google first, then choose between student and lecturer
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      // If user has already completed onboarding, route to their role dashboard
      if (profile?.role === 'lecturer') {
        return NextResponse.redirect(`${origin}/lecturer`)
      }

      const next = searchParams.get('next')
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      return NextResponse.redirect(`${origin}/home`)
    }
  }

  // Fallback to home page if exchange fails or no code is present
  return NextResponse.redirect(`${origin}/`)
}
