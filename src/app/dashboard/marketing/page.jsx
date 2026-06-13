'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'dashboard', label: 'דשבורד', icon: 'ti-layout-dashboard' },
  { id: 'gantts',    label: 'גאנטים',  icon: 'ti-timeline-event' },
  { id: 'tasks',     label: 'משימות',  icon: 'ti-checklist' },
]

function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}
function endOf(e) { return e.end_date || e.date }
function resolveShowType(types) {
  const list = types || []
  const exact = list.find(t => t.label === 'מופע' || t.value === 'מופע')
  if (exact) return exact.value
  const inc = list.find(t => (t.label || '').includes('מופע') || (t.value || '').includes('מופע'))
  return inc ? inc.value : 'מופע'
}

export default function MarketingPage() {
  const [tab, setTab] = useState('dashboard')
  const active = TABS.find(t => t.id === tab)

  return (
    <div className="max-w-7xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#E0197D]">פרסום ושיווק</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">מחלקת פרסום ושיווק</p>
      </div>

      <div className="flex gap-2 mb-4 flex-row-reverse justify-end">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors flex items-center gap-1.5 flex-row-reverse ${tab === t.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-600 hover:border-[#E0197D]'}`}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? (
        <Dashboard />
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400">
          <i className={`ti ${active.icon}`} style={{ fontSize: 36 }} />
          <div className="mt-3 text-sm">אזור "{active.label}" — בהקמה</div>
          <div className="mt-1 text-[12px] text-gray-300">התוכן יתווסף בהמשך</div>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState([])
  const [nextEv, setNextEv] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [{ data: types }, { data: evs }, { data: done }] = await Promise.all([
      supabase.from('event_types').select('value,label'),
      supabase.from('events').select('id,title,date,end_date,type').order('date'),
      supabase.from('monitor_swaps').select('event_id'),
    ])
    const showType = resolveShowType(types)
    const doneSet = new Set((done || []).map(d => String(d.event_id)))
    const shows = (evs || []).filter(e => e.type === showType)
    // ההודעה מתייחסת תמיד למופע האחרון שהסתיים (מהיום שאחרי הסיום),
    // ומוצגת רק אם טרם סומנה — כך תמיד הודעה אחת לכל היותר.
    const endedShows = shows
      .filter(e => endOf(e) < todayStr)
      .sort((a, b) => endOf(b).localeCompare(endOf(a)))
    const latest = endedShows[0] || null
    const note = (latest && !doneSet.has(String(latest.id))) ? latest : null
    const upcoming = shows
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
    setNextEv(upcoming[0] || null)
    setNotes(note ? [note] : [])
    setLoading(false)
  }

  async function markDone(ev) {
    setBusy(ev.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('monitor_swaps').insert({ event_id: String(ev.id), done_by: user?.id || null })
    setBusy(null)
    if (error) { alert('שגיאה בשמירה: ' + error.message); return }
    setNotes(n => n.filter(x => String(x.id) !== String(ev.id)))
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 max-w-3xl">
      <div className="flex items-center gap-2 flex-row-reverse mb-4">
        <i className="ti ti-bell text-[#E0197D]" style={{ fontSize: 18 }} />
        <h2 className="text-[15px] font-bold text-gray-800">הודעות</h2>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-[13px] py-8">טוען…</div>
      ) : notes.length === 0 ? (
        <div className="text-center text-gray-400 text-[13px] py-8">אין הודעות חדשות</div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map(ev => (
            <div key={ev.id} className="border border-gray-100 rounded-xl p-4 bg-[#FCE4F3] text-right">
              <p className="text-[13.5px] text-gray-800 leading-relaxed">
                בוקר טוב, האירוע "{ev.title}" הסתיים, אפשר להחליף מוניטורים וקאבר באתר.{' '}
                {nextEv
                  ? `האירוע הבא: "${nextEv.title}" בתאריך ${fmtDate(nextEv.date)}.`
                  : 'אין אירוע הבא מתוכנן.'}
              </p>
              <div className="mt-3 flex justify-end">
                <button onClick={() => markDone(ev)} disabled={busy === ev.id}
                  className="text-[13px] px-4 py-1.5 rounded-lg bg-[#E0197D] text-white hover:bg-[#A0106A] transition-colors disabled:opacity-50">
                  {busy === ev.id ? '…' : 'החלפתי'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
