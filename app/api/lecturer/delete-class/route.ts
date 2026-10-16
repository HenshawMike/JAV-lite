import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { classKey } = body

    if (!classKey || typeof classKey !== 'string') {
      return NextResponse.json({ error: 'Missing classKey' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    // Check user role
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true

    // Find all sessions belonging to this class created by this user (or any if admin)
    let query = adminClient
      .from('sessions')
      .select('id, created_by')
      .or(`course_code.eq.${classKey},name.eq.${classKey}`)

    if (!isAdmin) {
      query = query.eq('created_by', user.id)
    }

    const { data: targetSessions, error: findErr } = await query

    if (findErr) throw findErr

    if (!targetSessions || targetSessions.length === 0) {
      return NextResponse.json({ error: 'No matching class found to delete, or permission denied.' }, { status: 404 })
    }

    const sessionIds = targetSessions.map(s => s.id)

    // Cascade delete: attendance, correction_requests, attendance_audit, then sessions
    await adminClient.from('attendance_audit').delete().in('session_id', sessionIds)
    await adminClient.from('correction_requests').delete().in('session_id', sessionIds)
    await adminClient.from('attendance').delete().in('session_id', sessionIds)
    const { error: delErr } = await adminClient.from('sessions').delete().in('id', sessionIds)

    if (delErr) throw delErr

    return NextResponse.json({
      success: true,
      deletedCount: sessionIds.length,
      message: `Successfully deleted class and ${sessionIds.length} session(s).`,
    })
  } catch (err: any) {
    console.error('Delete class error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
