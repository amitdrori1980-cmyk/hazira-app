import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// HAZIRA-GOOGLE-API

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar'

function admin() {
  return createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

function originOf(req) {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return proto + '://' + host
}
function redirectUri(req) {
  return originOf(req) + '/api/google/callback'
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', CLIENT_SECRET).update(body).digest('base64url')
  return body + '.' + sig
}
function verifyState(state) {
  if (!state || !state.includes('.')) return null
  const [body, sig] = state.split('.')
  const expect = crypto.createHmac('sha256', CLIENT_SECRET).update(body).digest('base64url')
  if (sig !== expect) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (Date.now() - payload.ts > 10 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}

async function userFromAuthHeader(req) {
  const h = req.headers.get('authorization') || ''
  const jwt = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!jwt) return null
  const { data, error } = await admin().auth.getUser(jwt)
  if (error || !data || !data.user) return null
  return data.user
}

async function exchangeCode(code, req) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error('token exchange failed: ' + (await res.text()))
  return res.json()
}

async function refreshAccess(refresh_token) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('token refresh failed')
  return res.json()
}

async function validAccessToken(db, acct) {
  const exp = acct.token_expiry ? new Date(acct.token_expiry).getTime() : 0
  if (acct.access_token && exp - Date.now() > 60000) return acct.access_token
  if (!acct.refresh_token) throw new Error('no refresh token')
  const t = await refreshAccess(acct.refresh_token)
  const expiry = new Date(Date.now() + (t.expires_in || 3500) * 1000).toISOString()
  await db
    .from('google_accounts')
    .update({ access_token: t.access_token, token_expiry: expiry, updated_at: new Date().toISOString() })
    .eq('user_id', acct.user_id)
  return t.access_token
}

async function ensureCalendar(db, acct, accessToken) {
  if (acct.hazira_calendar_id) return acct.hazira_calendar_id
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'הזירה', timeZone: 'Asia/Jerusalem' }),
  })
  if (!res.ok) throw new Error('calendar create failed: ' + (await res.text()))
  const cal = await res.json()
  await db
    .from('google_accounts')
    .update({ hazira_calendar_id: cal.id, updated_at: new Date().toISOString() })
    .eq('user_id', acct.user_id)
  return cal.id
}

export async function GET(req, { params }) {
  const action = params.action
  const db = admin()

  if (action === 'connect') {
    const user = await userFromAuthHeader(req)
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const state = signState({ uid: user.id, ts: Date.now() })
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    u.searchParams.set('client_id', CLIENT_ID)
    u.searchParams.set('redirect_uri', redirectUri(req))
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', SCOPES)
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('include_granted_scopes', 'true')
    u.searchParams.set('state', state)
    return Response.json({ url: u.toString() })
  }

  if (action === 'status') {
    const user = await userFromAuthHeader(req)
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { data } = await db
      .from('google_accounts')
      .select('google_email, hazira_calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()
    return Response.json({ connected: !!data, email: (data && data.google_email) || null })
  }

  if (action === 'callback') {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const back = originOf(req) + '/dashboard/google-test'
    const payload = verifyState(state)
    if (!code || !payload) return Response.redirect(back + '?google=error', 302)
    try {
      const tok = await exchangeCode(code, req)
      let email = null
      try {
        const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: 'Bearer ' + tok.access_token },
        })
        if (ui.ok) email = (await ui.json()).email
      } catch (e) {}
      const expiry = new Date(Date.now() + (tok.expires_in || 3500) * 1000).toISOString()
      const { data: existing } = await db
        .from('google_accounts')
        .select('refresh_token, hazira_calendar_id')
        .eq('user_id', payload.uid)
        .maybeSingle()
      const refresh = tok.refresh_token || (existing && existing.refresh_token) || null
      await db.from('google_accounts').upsert(
        {
          user_id: payload.uid,
          google_email: email,
          access_token: tok.access_token,
          refresh_token: refresh,
          token_expiry: expiry,
          scope: tok.scope || SCOPES,
          hazira_calendar_id: (existing && existing.hazira_calendar_id) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      const { data: acct } = await db.from('google_accounts').select('*').eq('user_id', payload.uid).maybeSingle()
      const at = await validAccessToken(db, acct)
      await ensureCalendar(db, acct, at)
      return Response.redirect(back + '?google=connected', 302)
    } catch (e) {
      return Response.redirect(back + '?google=error', 302)
    }
  }

  return Response.json({ error: 'unknown action' }, { status: 404 })
}
