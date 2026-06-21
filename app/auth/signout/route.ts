import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const redirectTo = searchParams.get('redirect_to') || '/'
  
  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}${redirectTo}`, {
    status: 302,
  })
}
