// HAZIRA-PUSH-SUBSCRIBE-V1
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'no token' }), { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createClient(url, serviceKey)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData || !userData.user) {
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 })
    }
    const userId = userData.user.id

    const body = await req.json()
    const sub = body && body.subscription
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return new Response(JSON.stringify({ error: 'bad subscription' }), { status: 400 })
    }

    const row = {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    }

    const { error } = await admin
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}
