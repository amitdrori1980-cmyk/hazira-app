'use client'
// HAZIRA-PUSH-TEST-PAGE-V1
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushTestPage() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ok =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      setSupported(ok)
      if (!ok) setStatus('הדפדפן הזה לא תומך בהתראות דחיפה')
    }
  }, [])

  async function enableNotifications() {
    setBusy(true)
    setStatus('מבקש הרשאה...')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setStatus('ההרשאה נדחתה. צריך לאשר התראות בדפדפן.')
        setBusy(false)
        return
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapid) {
        setStatus('חסר מפתח VAPID ציבורי. בדוק את משתני הסביבה.')
        setBusy(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })

      const { data: sess } = await supabase.auth.getSession()
      const token = sess && sess.session ? sess.session.access_token : null
      if (!token) {
        setStatus('לא מחובר. התחבר מחדש ונסה שוב.')
        setBusy(false)
        return
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ subscription: sub }),
      })
      const out = await res.json()
      if (res.ok) {
        setStatus('ההתראות הופעלו בהצלחה.')
      } else {
        setStatus('שגיאה ברישום: ' + (out.error || res.status))
      }
    } catch (e) {
      setStatus('שגיאה: ' + (e && e.message ? e.message : String(e)))
    }
    setBusy(false)
  }

  async function sendTest() {
    setBusy(true)
    setStatus('שולח התראת בדיקה...')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess && sess.session ? sess.session.access_token : null
      if (!token) {
        setStatus('לא מחובר. התחבר מחדש ונסה שוב.')
        setBusy(false)
        return
      }
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({}),
      })
      const out = await res.json()
      if (res.ok) {
        setStatus('נשלח ל-' + out.sent + ' מנויים. ההתראה אמורה להופיע.')
      } else {
        setStatus('שגיאה בשליחה: ' + (out.error || res.status))
      }
    } catch (e) {
      setStatus('שגיאה: ' + (e && e.message ? e.message : String(e)))
    }
    setBusy(false)
  }

  return (
    <div className="p-6 max-w-lg mx-auto text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-[#E0197D] mb-4">בדיקת התראות דחיפה</h1>
      <p className="text-gray-600 mb-6 leading-relaxed">
        כאן אפשר להפעיל התראות דחיפה במחשב הזה ולשלוח לעצמך התראת בדיקה.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={enableNotifications}
          disabled={busy || !supported}
          className="px-4 py-2 rounded-lg bg-[#E0197D] text-white font-medium disabled:opacity-50"
        >
          אפשר התראות
        </button>
        <button
          onClick={sendTest}
          disabled={busy || !supported}
          className="px-4 py-2 rounded-lg border border-[#E0197D] text-[#E0197D] font-medium disabled:opacity-50"
        >
          שלח התראת בדיקה
        </button>
      </div>
      {status && (
        <div className="mt-6 p-3 rounded-lg bg-gray-100 border border-black/20 text-sm text-gray-800">
          {status}
        </div>
      )}
    </div>
  )
}
