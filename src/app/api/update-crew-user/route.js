import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // אימות: רק מנהל מחובר רשאי לערוך חשבונות
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
  const { data: callerProfile } = await admin
    .from('profiles').select('is_manager').eq('id', caller.id).single()
  if (!callerProfile?.is_manager) {
    return NextResponse.json({ error: 'אין הרשאה — רק מנהל יכול לערוך חשבונות' }, { status: 403 })
  }

  // קלט
  const body = await request.json()
  const { user_id, member_id, email, password } = body
  if (!user_id) return NextResponse.json({ error: 'אין חשבון התחברות מקושר לעריכה' }, { status: 400 })

  const updates = {}
  if (email && String(email).trim()) updates.email = String(email).trim()
  if (password && String(password).length) {
    if (String(password).length < 8) return NextResponse.json({ error: 'הסיסמה צריכה להיות 8 תווים לפחות' }, { status: 400 })
    updates.password = String(password)
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 })

  // עדכון חשבון ההתחברות
  const payload = { ...updates }
  if (payload.email) payload.email_confirm = true
  const { error: updErr } = await admin.auth.admin.updateUserById(user_id, payload)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // סנכרון המייל גם ברשומת התפעול (לתצוגה ולהתאמות עתידיות)
  if (updates.email && member_id) {
    await admin.from('operations_crew').update({ email: updates.email }).eq('id', member_id)
  }

  return NextResponse.json({ ok: true })
}
