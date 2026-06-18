import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
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
          return NextResponse.redirect(`${origin}/admin`)
        }
        if (profile?.registered) {
          return NextResponse.redirect(`${origin}/attend`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/register`)
}
