// HAZIRA-PUSH-NOTIFY-V1
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

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
    const senderId = userData.user.id

    const body = await req.json()
    let targets = body && body.user_ids
    if (typeof targets === 'string') targets = [targets]
    if (!Array.isArray(targets) || targets.length === 0) {
      return new Response(JSON.stringify({ error: 'no targets' }), { status: 400 })
    }

    targets = targets.filter(function (id) {
      return id && id !== senderId
    })
    if (targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: 'only self' }), { status: 200 })
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', targets)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    const payload = JSON.stringify({
      title: (body && body.title) || 'הזירה',
      body: (body && body.body) || 'יש לך עדכון חדש',
      icon: (body && body.icon) || '/zira-cursor.png',
      url: (body && body.url) || '/dashboard',
    })

    let sent = 0
    let removed = 0
    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload)
        sent = sent + 1
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed = removed + 1
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, removed }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}
