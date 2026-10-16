import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    // Gather profile, consents, and attendance rows
    const [profileRes, consentsRes, attendanceRes, editsRes] = await Promise.all([
      adminClient.from('profiles').select('*').eq('id', user.id).single(),
      adminClient.from('consents').select('*').eq('user_id', user.id),
      adminClient.from('attendance').select('*').eq('student_id', user.id),
      adminClient.from('profile_edits').select('*').eq('student_id', user.id),
    ])

    const exportData = {
      exportMetadata: {
        platform: 'JAV Lite (Blim Technologies)',
        compliance: 'Nigeria Data Protection Act (NDPA) 2023 - Right of Data Portability',
        exportedAt: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
      },
      profile: profileRes.data || null,
      consents: consentsRes.data || [],
      attendanceHistory: attendanceRes.data || [],
      profileEditsAudit: editsRes.data || [],
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="jav_lite_data_export_${user.id.slice(0, 8)}.json"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
