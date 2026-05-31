import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { email, password, full_name, role, phone } = await request.json()
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data, error } = await admin.from('operations_crew')
    .insert({ full_name, role: role || '', phone: phone || '', email, user_id: authData.user.id, active: true })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('profiles').upsert({ id: authData.user.id, full_name, is_manager: false })
  return NextResponse.json({ member: data })
}
