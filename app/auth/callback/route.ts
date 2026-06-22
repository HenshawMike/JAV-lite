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
        .select('registered, is_admin')
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
          .select('registered, is_admin')
          .single()

        if (!createErr && newProfile) {
          profile = newProfile
        }
      }

      // Route users based on profile status
      let redirectTo = '/register'
      if (profile?.is_admin) {
        redirectTo = '/admin'
      } else if (profile?.registered) {
        redirectTo = '/attend'
      }

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Fallback to home page if exchange fails or no code is present
  return NextResponse.redirect(`${origin}/`)
}
