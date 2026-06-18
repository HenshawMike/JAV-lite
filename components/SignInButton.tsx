'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './ui/Button'

export const SignInButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (err) throw err
    } catch (e: any) {
      setError(e.message || 'An error occurred during authentication.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <Button 
        onClick={handleSignIn} 
        variant="primary" 
        loading={loading}
        className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2.5"
      >
        {!loading && (
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.692 0-8.503-3.812-8.503-8.503 0-4.692 3.811-8.503 8.503-8.503 2.126 0 4.058.784 5.56 2.072l3.14-3.14C17.658 1.134 15.14 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.94 0 12.06-4.887 12.06-12.24 0-.83-.075-1.635-.216-2.435H12.24z" />
          </svg>
        )}
        Sign in with Google
      </Button>
      {error && (
        <p className="text-xs text-rose-500 text-center animate-fade-in">
          ⚠️ {error}
        </p>
      )}
    </div>
  )
}
