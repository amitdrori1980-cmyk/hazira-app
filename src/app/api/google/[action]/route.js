import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// HAZIRA-GOOGLE-API-V6

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.app.created'

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

function hasTime(t) {
  const s = t == null ? '' : String(t).trim()
  return s !== '' && s.toLowerCase() !== 'null'
}
function timeWithSeconds(t) {
  const s = String(t).trim()
  return s.length === 5 ? s + ':00' : s
}
function pad2(n) {
  return String(n).padStart(2, '0')
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function addHoursToTime(dateStr, timeStr, hours) {
  const parts = timeWithSeconds(timeStr).split(':')
  let total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + hours * 60
  let dayShift = 0
  while (total >= 1440) {
    total -= 1440
    dayShift += 1
  }
  const nh = Math.floor(total / 60)
  const nm = total % 60
  const ndate = dayShift ? addDays(dateStr, dayShift) : dateStr
  return ndate + 'T' + pad2(nh) + ':' + pad2(nm) + ':00'
}

function eventPayloadFromEvent(ev) {
  const summary = ev.title || 'אירוע'
  const location = ev.venue || undefined
  const description = ev.description || ev.crew_notes || undefined
  if (hasTime(ev.time)) {
    return {
      summary,
      location,
      description,
      start: { dateTime: ev.date + 'T' + timeWithSeconds(ev.time), timeZone: 'Asia/Jerusalem' },
      end: { dateTime: addHoursToTime(ev.date, ev.time, 2), timeZone: 'Asia/Jerusalem' },
    }
  }
  const endBase = ev.end_date && ev.end_date >= ev.date ? ev.end_date : ev.date
  return {
    summary,
    location,
    description,
    start: { date: ev.date },
    end: { date: addDays(endBase, 1) },
  }
}

function eventPayloadFromShift(sh, linked) {
  const summary = (sh.event_title || 'משמרת') + (sh.role ? ' — ' + sh.role : '')
  const date = sh.event_date
  const location = (linked && linked.venue) || undefined
  const description = sh.notes || undefined
  const t = linked && linked.time
  if (hasTime(t)) {
    return {
      summary,
      location,
      description,
      start: { dateTime: date + 'T' + timeWithSeconds(t), timeZone: 'Asia/Jerusalem' },
      end: { dateTime: addHoursToTime(date, t, 2), timeZone: 'Asia/Jerusalem' },
    }
  }
  return {
    summary,
    location,
    description,
    start: { date },
    end: { date: addDays(date, 1) },
  }
}

function calUrl(calId, suffix) {
  return 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events' + (suffix || '')
}
async function calInsert(accessToken, calId, payload) {
  const res = await fetch(calUrl(calId, ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('event insert failed: ' + (await res.text()))
  return res.json()
}
async function calUpdate(accessToken, calId, eventId, payload) {
  const res = await fetch(calUrl(calId, '/' + encodeURIComponent(eventId)), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('event update failed: ' + (await res.text()))
  return res.json()
}
async function calDelete(accessToken, calId, eventId) {
  const res = await fetch(calUrl(calId, '/' + encodeURIComponent(eventId)), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken },
  })
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error('event delete failed: ' + (await res.text()))
  }
  return true
}

async function fetchSource(db, source_type, source_id) {
  if (source_type === 'event') {
    const { data } = await db.from('events').select('*').eq('id', source_id).maybeSingle()
    return { row: data, linked: null }
  }
  if (source_type === 'shift') {
    const { data } = await db.from('operations_shifts').select('*').eq('id', source_id).maybeSingle()
    let linked = null
    if (data && data.event_id) {
      const r = await db.from('events').select('*').eq('id', data.event_id).maybeSingle()
      linked = r.data || null
    }
    return { row: data, linked }
  }
  return { row: null, linked: null }
}

async function ensureReady(db, uid) {
  const { data: acct } = await db.from('google_accounts').select('*').eq('user_id', uid).maybeSingle()
  if (!acct) throw new Error('not connected')
  const accessToken = await validAccessToken(db, acct)
  const calId = await ensureCalendar(db, acct, accessToken)
  return { acct, accessToken, calId }
}

function payloadFor(source_type, row, linked) {
  return source_type === 'event' ? eventPayloadFromEvent(row) : eventPayloadFromShift(row, linked)
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
    const back = originOf(req) + '/dashboard/calendar'
    if (!code) return Response.redirect(back + '?google=error&m=no_code', 302)
    const payload = verifyState(state)
    if (!payload) return Response.redirect(back + '?google=error&m=bad_state', 302)
    let grantedScope = ''
    try {
      const tok = await exchangeCode(code, req)
      grantedScope = tok.scope || ''
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
      const m = encodeURIComponent(String((e && e.message) || e).slice(0, 200))
      const sc = encodeURIComponent(grantedScope)
      return Response.redirect(back + '?google=error&m=' + m + '&sc=' + sc, 302)
    }
  }

  return Response.json({ error: 'unknown action' }, { status: 404 })
}

export async function POST(req, { params }) {
  const action = params.action
  const db = admin()
  const user = await userFromAuthHeader(req)
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  let body = {}
  try {
    body = await req.json()
  } catch (e) {}

  try {
    if (action === 'save') {
      const source_type = body.source_type
      const source_id = body.source_id
      if (!source_type || !source_id) return Response.json({ error: 'missing params' }, { status: 400 })
      const { accessToken, calId } = await ensureReady(db, user.id)
      const { row, linked } = await fetchSource(db, source_type, source_id)
      if (!row) return Response.json({ error: 'source not found' }, { status: 404 })
      const payload = payloadFor(source_type, row, linked)
      const { data: existingLink } = await db
        .from('google_calendar_links')
        .select('google_event_id')
        .eq('user_id', user.id)
        .eq('source_type', source_type)
        .eq('source_id', String(source_id))
        .maybeSingle()
      let gid
      if (existingLink) {
        await calUpdate(accessToken, calId, existingLink.google_event_id, payload)
        gid = existingLink.google_event_id
      } else {
        const gev = await calInsert(accessToken, calId, payload)
        gid = gev.id
      }
      await db.from('google_calendar_links').upsert(
        {
          user_id: user.id,
          source_type,
          source_id: String(source_id),
          google_event_id: gid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,source_type,source_id' }
      )
      return Response.json({ saved: true })
    }

    if (action === 'unsave') {
      const source_type = body.source_type
      const source_id = body.source_id
      if (!source_type || !source_id) return Response.json({ error: 'missing params' }, { status: 400 })
      const { accessToken, calId } = await ensureReady(db, user.id)
      const { data: link } = await db
        .from('google_calendar_links')
        .select('google_event_id')
        .eq('user_id', user.id)
        .eq('source_type', source_type)
        .eq('source_id', String(source_id))
        .maybeSingle()
      if (link) {
        try {
          await calDelete(accessToken, calId, link.google_event_id)
        } catch (e) {}
        await db
          .from('google_calendar_links')
          .delete()
          .eq('user_id', user.id)
          .eq('source_type', source_type)
          .eq('source_id', String(source_id))
      }
      return Response.json({ saved: false })
    }

    if (action === 'sync') {
      const { accessToken, calId } = await ensureReady(db, user.id)
      const { data: links } = await db.from('google_calendar_links').select('*').eq('user_id', user.id)
      let updated = 0
      for (const link of links || []) {
        const { row, linked } = await fetchSource(db, link.source_type, link.source_id)
        if (!row || row.deleted_at) {
          try {
            await calDelete(accessToken, calId, link.google_event_id)
          } catch (e) {}
          await db.from('google_calendar_links').delete().eq('id', link.id)
          continue
        }
        const payload = payloadFor(link.source_type, row, linked)
        try {
          await calUpdate(accessToken, calId, link.google_event_id, payload)
          updated++
        } catch (e) {}
      }
      return Response.json({ synced: true, updated })
    }

    if (action === 'disconnect') {
      const { data: acct } = await db
        .from('google_accounts')
        .select('refresh_token, access_token')
        .eq('user_id', user.id)
        .maybeSingle()
      try {
        const tk = acct && (acct.refresh_token || acct.access_token)
        if (tk) {
          await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tk), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
        }
      } catch (e) {}
      await db.from('google_calendar_links').delete().eq('user_id', user.id)
      await db.from('google_accounts').delete().eq('user_id', user.id)
      return Response.json({ disconnected: true })
    }

    if (action === 'purge') {
      const { accessToken, calId } = await ensureReady(db, user.id)
      const ids = []
      let pageToken = ''
      let guard = 0
      while (guard < 50) {
        guard++
        const suffix = '?maxResults=2500&showDeleted=false' + (pageToken ? ('&pageToken=' + encodeURIComponent(pageToken)) : '')
        const res = await fetch(calUrl(calId, suffix), {
          headers: { Authorization: 'Bearer ' + accessToken },
        })
        if (!res.ok) break
        const data = await res.json()
        for (const it of (data.items || [])) {
          if (it.id) ids.push(it.id)
        }
        if (data.nextPageToken) {
          pageToken = data.nextPageToken
        } else {
          break
        }
      }
      let deleted = 0
      for (const id of ids) {
        try {
          await calDelete(accessToken, calId, id)
          deleted++
        } catch (e) {}
      }
      await db.from('google_calendar_links').delete().eq('user_id', user.id)
      return Response.json({ purged: true, deleted })
    }

    return Response.json({ error: 'unknown action' }, { status: 404 })
  } catch (e) {
    return Response.json({ error: String((e && e.message) || e) }, { status: 500 })
  }
}
