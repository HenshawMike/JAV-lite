import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { eventId, department } = await req.json()

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'eventId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch registered students (optionally filtered by department)
    let query = supabase
      .from('profiles')
      .select('id, full_name, track_no, department, level')
      .eq('registered', true)

    if (department && department !== 'All') {
      query = query.eq('department', department)
    }

    const { data: students, error: stdError } = await query.order('department, full_name')
    if (stdError) throw stdError

    // Fetch attendance records for this event
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('student_id, marked_at, status')
      .eq('event_id', eventId)

    if (attError) throw attError

    // Build CSV content
    const header = 'Full Name,Track ID,Department,Level,Status,Time Marked'
    const rows = (students || []).map((s: any) => {
      const record = attendance.find((a: any) => a.student_id === s.id)
      let statusText = 'Absent'
      if (record) {
        statusText = record.status === 'confirmed' ? 'Present' : 'Pending'
      }
      const time = record?.marked_at ? new Date(record.marked_at).toISOString() : '—'
      return `"${s.full_name || 'No Name'}","${s.track_no || ''}","${s.department || ''}","L${s.level || ''}","${statusText}","${time}"`
    })

    const csvContent = [header, ...rows].join('\n')

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance-${eventId}.csv"`
      }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
