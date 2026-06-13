'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'dashboard', label: 'דשבורד', icon: 'ti-layout-dashboard' },
  { id: 'gantts',    label: 'גאנטים',  icon: 'ti-timeline-event' },
  { id: 'tasks',     label: 'משימות',  icon: 'ti-checklist' },
]

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// ---------- date helpers ----------
function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}
function dayName(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-').map(Number)
  return HE_DAYS[new Date(y, m - 1, d).getDay()]
}
function toStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function addDays(ds, n) {
  const [y, m, d] = ds.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return dt
}
// שישי(5)/שבת(6) -> מקדימים ליום חמישי שלפני
function weekendShift(dt) {
  const x = new Date(dt)
  const day = x.getDay()
  if (day === 5) x.setDate(x.getDate() - 1)
  else if (day === 6) x.setDate(x.getDate() - 2)
  return x
}
function planDate(showDs, offset) {
  return toStr(weekendShift(addDays(showDs, offset)))
}
function endOf(e) { return e.end_date || e.date }
function resolveShowType(types) {
  const list = types || []
  const exact = list.find(t => t.label === 'מופע' || t.value === 'מופע')
  if (exact) return exact.value
  const inc = list.find(t => (t.label || '').includes('מופע') || (t.value || '').includes('מופע'))
  return inc ? inc.value : 'מופע'
}

// תכנית הפעולה — היסטים בימים מתאריך המופע (מהמוקדם למאוחר)
const PLAN_ACTIONS = [
  { key: 'teasers',        label: 'טיזרים מוכנים',                        offset: -26 },
  { key: 'texts',          label: 'טקסטים לפוסטים מוכנים',                offset: -25 },
  { key: 'transfer_print', label: 'העברת חומרים לדפוס',                   offset: -24 },
  { key: 'campaign_start', label: 'תחילת קמפיין - פוסט 1 + הודעת וואטסאפ', offset: -21 },
  { key: 'print_ready',    label: 'חומרי דפוס מוכנים',                     offset: -17 },
  { key: 'distrib1',       label: 'הפצה 1',                                offset: -14 },
  { key: 'fund_post1',     label: 'מימון פוסט 1',                          offset: -14 },
  { key: 'post_story_10',  label: 'פוסט/סטורי',                           offset: -10 },
  { key: 'distrib2',       label: 'הפצה 2',                                offset: -7 },
  { key: 'post_story_tom', label: 'פוסט/סטורי "מחר"',                     offset: -1 },
]

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

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'gantts' && <Gantts />}
      {tab === 'tasks' && (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400">
          <i className={`ti ${active.icon}`} style={{ fontSize: 36 }} />
          <div className="mt-3 text-sm">אזור "{active.label}" — בהקמה</div>
          <div className="mt-1 text-[12px] text-gray-300">התוכן יתווסף בהמשך</div>
        </div>
      )}
    </div>
  )
}

// ===================== דשבורד — הודעות =====================
function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState([])
  const [nextEv, setNextEv] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const todayStr = toStr(new Date())
    const [{ data: types }, { data: evs }, { data: done }] = await Promise.all([
      supabase.from('event_types').select('value,label'),
      supabase.from('events').select('id,title,date,end_date,type').order('date'),
      supabase.from('monitor_swaps').select('event_id'),
    ])
    const showType = resolveShowType(types)
    const doneSet = new Set((done || []).map(d => String(d.event_id)))
    const shows = (evs || []).filter(e => e.type === showType)
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

// ===================== גאנטים — תכניות פעולה =====================
function Gantts() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [plan, setPlan] = useState({})
  const [open, setOpen] = useState(null)
  const [noteModal, setNoteModal] = useState(null)
  const [editModal, setEditModal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const todayStr = toStr(new Date())
    const [{ data: types }, { data: evs }, { data: rows }] = await Promise.all([
      supabase.from('event_types').select('value,label'),
      supabase.from('events').select('id,title,date,type').order('date'),
      supabase.from('marketing_plan').select('event_id,action_key,custom_date,notes,done,custom_label,deleted'),
    ])
    const showType = resolveShowType(types)
    const hidden = new Set((rows || []).filter(r => r.action_key === '__event__' && r.deleted).map(r => String(r.event_id)))
    const shows = (evs || []).filter(e => e.type === showType && e.date >= todayStr && !hidden.has(String(e.id)))
    const map = {}
    for (const r of (rows || [])) {
      map[`${r.event_id}::${r.action_key}`] = { custom_date: r.custom_date, notes: r.notes, done: r.done, custom_label: r.custom_label, deleted: r.deleted }
    }
    setEvents(shows)
    setPlan(map)
    setOpen(shows[0]?.id ?? null)
    setLoading(false)
  }

  function cell(eventId, actionKey) {
    return plan[`${eventId}::${actionKey}`] || { custom_date: null, notes: null, done: false, custom_label: null, deleted: false }
  }

  async function persist(eventId, actionKey, patch) {
    const k = `${eventId}::${actionKey}`
    const cur = plan[k] || { custom_date: null, notes: null, done: false, custom_label: null, deleted: false }
    const next = { ...cur, ...patch }
    setPlan(p => ({ ...p, [k]: next }))
    const { error } = await supabase.from('marketing_plan').upsert(
      {
        event_id: String(eventId), action_key: actionKey,
        custom_date: next.custom_date || null, notes: next.notes || null,
        done: !!next.done, custom_label: next.custom_label || null, deleted: !!next.deleted,
      },
      { onConflict: 'event_id,action_key' }
    )
    if (error) alert('שגיאה בשמירה: ' + error.message)
  }

  function labelOf(ev, action) { return cell(ev.id, action.key).custom_label || action.label }
  function effDate(ev, action) {
    const c = cell(ev.id, action.key)
    return c.custom_date || planDate(ev.date, action.offset)
  }
  function visibleActions(ev) { return PLAN_ACTIONS.filter(a => !cell(ev.id, a.key).deleted) }
  function progress(ev) {
    const vis = visibleActions(ev)
    let d = 0
    for (const a of vis) if (cell(ev.id, a.key).done) d++
    return { done: d, total: vis.length }
  }

  function deleteAction(ev, action) {
    if (!confirm(`למחוק את הפעולה "${labelOf(ev, action)}"?`)) return
    persist(ev.id, action.key, { deleted: true })
  }
  async function deleteEvent(ev) {
    if (!confirm(`להסיר את "${ev.title}" מאזור הגאנטים?\n(האירוע עצמו לא יימחק מהיומן)`)) return
    await persist(ev.id, '__event__', { deleted: true })
    setEvents(es => es.filter(e => e.id !== ev.id))
  }

  if (loading) return <div className="text-center text-gray-400 text-[13px] py-10">טוען…</div>
  if (events.length === 0) return (
    <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-400 text-[13px]">
      אין מופעים עתידיים ביומן. הוסף אירוע מסוג "מופע" כדי לבנות עבורו תכנית פעולה.
    </div>
  )

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      {events.map(ev => {
        const isOpen = open === ev.id
        const pr = progress(ev)
        const vis = visibleActions(ev)
        return (
          <div key={ev.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="w-full flex items-center justify-between gap-3 px-4 py-3">
              <button onClick={() => setOpen(isOpen ? null : ev.id)}
                className="flex items-center gap-2 flex-1 text-right hover:opacity-80 transition-opacity">
                <i className={`ti ti-chevron-${isOpen ? 'down' : 'left'} text-gray-400`} style={{ fontSize: 16 }} />
                <div>
                  <div className="text-[14px] font-bold text-gray-800">{ev.title}</div>
                  <div className="text-[12px] text-gray-400">מופע ב{dayName(ev.date)}, {fmtDate(ev.date)}</div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-[12px] rounded-full px-2.5 py-0.5 ${pr.total > 0 && pr.done === pr.total ? 'bg-[#FCE4F3] text-[#A0106A]' : 'bg-gray-100 text-gray-500'}`}>
                  {pr.done}/{pr.total} בוצעו
                </span>
                <button onClick={() => deleteEvent(ev)} title="הסר אירוע מהגאנטים"
                  className="text-gray-300 hover:text-red-500 transition-colors"><i className="ti ti-trash" style={{ fontSize: 16 }} /></button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-100">
                {vis.length === 0 && (
                  <div className="px-4 py-4 text-center text-[12px] text-gray-300">כל הפעולות נמחקו</div>
                )}
                {vis.map(action => {
                  const c = cell(ev.id, action.key)
                  const d = effDate(ev, action)
                  const isCustom = !!c.custom_date
                  return (
                    <div key={action.key}
                      className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0 ${c.done ? 'bg-[#FCE4F3]' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] ${c.done ? 'text-[#A0106A] font-medium' : 'text-gray-800'}`}>{labelOf(ev, action)}</span>
                      </div>

                      <span className="text-[11px] text-gray-400 w-12 text-center shrink-0">יום {dayName(d)}</span>

                      <div className="flex items-center gap-1.5">
                        <input type="date" value={d}
                          onChange={e => persist(ev.id, action.key, { custom_date: e.target.value })}
                          className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white" />
                        {isCustom && (
                          <button title="חזרה לתאריך אוטומטי" onClick={() => persist(ev.id, action.key, { custom_date: null })}
                            className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-rotate" style={{ fontSize: 15 }} /></button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button title="הערות" onClick={() => setNoteModal({ eventId: ev.id, action, draft: c.notes || '' })}
                          className={c.notes ? 'text-[#E0197D]' : 'text-gray-300 hover:text-[#E0197D]'}>
                          <i className="ti ti-note" style={{ fontSize: 17 }} />
                        </button>
                        <button title="עריכת שם הפעולה" onClick={() => setEditModal({ eventId: ev.id, action, label: labelOf(ev, action) })}
                          className="text-gray-300 hover:text-[#E0197D]">
                          <i className="ti ti-pencil" style={{ fontSize: 16 }} />
                        </button>
                        <button title="מחיקת פעולה" onClick={() => deleteAction(ev, action)}
                          className="text-gray-300 hover:text-red-500">
                          <i className="ti ti-trash" style={{ fontSize: 16 }} />
                        </button>
                      </div>

                      <button onClick={() => persist(ev.id, action.key, { done: !c.done })}
                        className={`text-[12px] px-3 py-1 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${c.done ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                        {c.done ? '✓ בוצע' : 'בוצע'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {noteModal && (
        <NoteModal modal={noteModal} onClose={() => setNoteModal(null)}
          onSave={(text) => { persist(noteModal.eventId, noteModal.action.key, { notes: text }); setNoteModal(null) }} />
      )}
      {editModal && (
        <EditModal modal={editModal} onClose={() => setEditModal(null)}
          onSave={(text) => { persist(editModal.eventId, editModal.action.key, { custom_label: text || null }); setEditModal(null) }} />
      )}
    </div>
  )
}

function NoteModal({ modal, onClose, onSave }) {
  const [text, setText] = useState(modal.draft || '')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div dir="rtl" className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800 mb-1">הערות לפעולה</h3>
        <p className="text-[12px] text-gray-400 mb-3">{modal.action ? (modal.label || '') : ''}</p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
          placeholder="פרטים על הפעולה…"
          className="w-full text-[13px] border border-gray-200 rounded-lg p-3 text-gray-800 resize-none focus:outline-none focus:border-[#E0197D]" />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="text-[13px] px-4 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">ביטול</button>
          <button onClick={() => onSave(text)} className="text-[13px] px-4 py-1.5 rounded-lg bg-[#E0197D] text-white hover:bg-[#A0106A]">שמירה</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ modal, onClose, onSave }) {
  const [label, setLabel] = useState(modal.label || '')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div dir="rtl" className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800 mb-3">עריכת פעולה</h3>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="שם הפעולה"
          className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:border-[#E0197D]" />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="text-[13px] px-4 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">ביטול</button>
          <button onClick={() => onSave(label.trim())} className="text-[13px] px-4 py-1.5 rounded-lg bg-[#E0197D] text-white hover:bg-[#A0106A]">שמירה</button>
        </div>
      </div>
    </div>
  )
}
