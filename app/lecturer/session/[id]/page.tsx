'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QrDisplay } from '@/components/QrDisplay'
import { ArrowLeft, Loader2, AlertCircle } from '@/components/ui/icons'

export default function LecturerLiveSessionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: sess, error: sessErr } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (sessErr || !sess) {
          setError('Session not found or access denied.')
          return
        }

        setSession(sess)
      } catch (err: any) {
        console.error('Session load error:', err)
        setError(err.message || 'Error loading session.')
      } finally {
        setLoading(false)
      }
    }
    loadSession()
  }, [sessionId, router, supabase])

  const handleEndSession = async () => {
    try {
      const { error: endErr } = await supabase
        .from('sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (endErr) throw endErr

      const classKey = session?.course_code || encodeURIComponent(session?.name || 'class')
      router.push(`/lecturer/class/${classKey}`)
    } catch (err: any) {
      console.error('Error ending session:', err)
      alert(err.message || 'Failed to end session.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle size={36} className="text-error" />
        <h2 className="text-xl font-bold text-text-primary">Unable to Load Session</h2>
        <p className="text-xs text-text-secondary max-w-sm">{error}</p>
        <Link
          href="/lecturer"
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md"
        >
          Back to Classes
        </Link>
      </div>
    )
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center w-full">
      <QrDisplay
        sessionId={session.id}
        sessionName={session.name}
        courseCode={session.course_code}
        hostName={session.host_name}
        schoolName={session.school_name}
        initialRotating={session.rotating}
        expiresAt={session.expires_at}
        onEndSession={handleEndSession}
      />
    </main>
  )
}
