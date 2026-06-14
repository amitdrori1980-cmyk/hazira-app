import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ---- אחסון עמיד ל-session: עוגיות (שורדות סגירת PWA/iOS) + מראה ב-localStorage ----
const CHUNK = 3200
const YEAR = 60 * 60 * 24 * 365

function setCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; SameSite=Lax`
}
function delCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}
function readCookies() {
  const out = {}
  if (typeof document === 'undefined' || !document.cookie) return out
  for (const part of document.cookie.split('; ')) {
    const i = part.indexOf('=')
    if (i > -1) out[part.slice(0, i)] = part.slice(i + 1)
  }
  return out
}

const durableStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null
    try {
      const ls = window.localStorage.getItem(key)
      if (ls != null) return ls
    } catch (e) {}
    const cookies = readCookies()
    if (cookies[key] != null) return decodeURIComponent(cookies[key])
    const countRaw = cookies[`${key}.chunks`]
    if (countRaw) {
      const n = parseInt(countRaw, 10)
      let enc = ''
      for (let i = 0; i < n; i++) {
        if (cookies[`${key}.${i}`] == null) return null
        enc += cookies[`${key}.${i}`]
      }
      try { return decodeURIComponent(enc) } catch (e) { return null }
    }
    return null
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(key, value) } catch (e) {}
    const enc = encodeURIComponent(value)
    const cookies = readCookies()
    Object.keys(cookies).forEach(k => { if (k === key || k.startsWith(`${key}.`)) delCookie(k) })
    if (enc.length <= CHUNK) {
      setCookie(key, enc)
    } else {
      const n = Math.ceil(enc.length / CHUNK)
      setCookie(`${key}.chunks`, String(n))
      for (let i = 0; i < n; i++) setCookie(`${key}.${i}`, enc.slice(i * CHUNK, (i + 1) * CHUNK))
    }
  },
  removeItem(key) {
    if (typeof window === 'undefined') return
    try { window.localStorage.removeItem(key) } catch (e) {}
    const cookies = readCookies()
    Object.keys(cookies).forEach(k => { if (k === key || k.startsWith(`${key}.`)) delCookie(k) })
  },
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? durableStorage : undefined,
  },
})
