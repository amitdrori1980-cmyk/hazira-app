import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // 1. אימות: רק מנהל מחובר רשאי להוסיף משתמשים
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
  const { data: callerProfile } = await admin
    .from('profiles').select('is_manager').eq('id', caller.id).single()
  if (!callerProfile?.is_manager) {
    return NextResponse.json({ error: 'אין הרשאה — רק מנהל יכול להוסיף משתמשים' }, { status: 403 })
  }

  // 2. קלט
  const body = await request.json()
  const { full_name, email, password, dept, is_manager, areas, add_to_operations } = body
  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'חסרים שדות חובה (שם, אימייל, סיסמה)' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'הסיסמה הראשונית צריכה להיות 8 תווים לפחות' }, { status: 400 })
  }

  // 3. יצירת המשתמש
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
  const newId = created.user.id

  // 4. פרופיל + חיוב החלפת סיסמה בכניסה הראשונה
  // צוות תפעול -> מחלקה "תפעול" והתפקיד נשמר ברשומת התפעול; צוות כללי -> המחלקה שנבחרה
  const { error: profErr } = await admin.from('profiles').upsert({
    id: newId,
    full_name,
    role: add_to_operations ? (dept || '') : '',
    dept: add_to_operations ? 'תפעול' : (dept || null),
    is_manager: !!is_manager,
    must_change_password: true
  })
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 })

  // 5. הרשאות אזורים (מנהל ממילא רואה הכל, אז רק ללא־מנהל)
  if (!is_manager) {
    const grantAreas = Array.isArray(areas) ? [...new Set(areas)] : []
    if (add_to_operations && !grantAreas.includes('operations')) grantAreas.push('operations')
    if (grantAreas.length) {
      const rows = grantAreas.map(a => ({ user_id: newId, area: a, level: 'edit' }))
      const { error: grantErr } = await admin.from('user_area_access').insert(rows)
      if (grantErr) return NextResponse.json({ error: grantErr.message }, { status: 400 })
    }
  }

  // 6. רשומת צוות תפעול (לפי בחירה) — התפקיד הוא הבחירה מהרשימה
  if (add_to_operations) {
    await admin.from('operations_crew').insert({
      full_name, role: dept || '', phone: '', email, user_id: newId, active: true
    })
  }

  return NextResponse.json({ ok: true, id: newId })
}
