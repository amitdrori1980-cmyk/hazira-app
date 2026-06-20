'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// HAZIRA-GOOGLE-TEST-PAGE
export default function GoogleTestPage() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data && data.session ? data.session.access_token : null
  }

  async function loadStatus() {
    const t = await getToken()
    if (!t) {
      setStatus({ connected: false })
      return
    }
    try {
      const res = await fetch('/api/google/status', { headers: { Authorization: 'Bearer ' + t } })
      setStatus(await res.json())
    } catch (e) {
      setStatus({ connected: false })
    }
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('google') === 'connected') setMsg('החיבור לגוגל הצליח, ויומן "הזירה" נוצר בחשבון שלך.')
    if (p.get('google') === 'error') setMsg('משהו השתבש בחיבור. נסה שוב.')
    loadStatus()
  }, [])

  async function connect() {
    setBusy(true)
    const t = await getToken()
    if (!t) {
      setMsg('צריך להיות מחובר לאפליקציה קודם.')
      setBusy(false)
      return
    }
    try {
      const res = await fetch('/api/google/connect', { headers: { Authorization: 'Bearer ' + t } })
      const j = await res.json()
      if (j.url) {
        window.location.href = j.url
      } else {
        setMsg('שגיאה: ' + (j.error || 'לא ידועה'))
        setBusy(false)
      }
    } catch (e) {
      setMsg('שגיאה בחיבור.')
      setBusy(false)
    }
  }

  return (
    <div dir="rtl" className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">בדיקת חיבור יומן גוגל</h1>
      {msg ? <div className="mb-4 p-3 rounded-lg bg-[#FCE4F3] text-[#A0106A]">{msg}</div> : null}
      {status && status.connected ? (
        <div className="mb-4 text-green-700">מחובר ✓ {status.email ? '(' + status.email + ')' : ''}</div>
      ) : (
        <div className="mb-4 text-gray-600">לא מחובר עדיין.</div>
      )}
      <button
        onClick={connect}
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-[#E0197D] text-white disabled:opacity-50"
      >
        {status && status.connected ? 'חבר מחדש' : 'חבר את גוגל'}
      </button>
    </div>
  )
}
