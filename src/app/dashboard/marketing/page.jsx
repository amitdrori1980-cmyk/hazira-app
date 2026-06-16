'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'dashboard', label: 'דשבורד', icon: 'ti-layout-dashboard' },
  { id: 'gantts',    label: 'גאנטים',  icon: 'ti-timeline-event' },
  { id: 'campaign',  label: 'קמפיין',  icon: 'ti-rocket' },
  { id: 'tasks',     label: 'משימות',  icon: 'ti-checklist' },
]

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const EMPTY_CELL = { custom_date: null, notes: null, done: false, custom_label: null, deleted: false, free_text: null }

// ---------- date helpers ----------
function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}
function fmtShort(ds) {
  const [y, m, d] = ds.split('-')
  return `${d}/${m}`
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
function weekKey(ds) {
  const [y, m, d] = ds.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - dt.getDay())
  return toStr(dt)
}
function weekRangeLabel(wk) {
  return `${fmtShort(wk)}\u2013${fmtShort(toStr(addDays(wk, 6)))}`
}
function ymKey(ds) {
  const [y, m] = ds.split('-')
  return `${y}-${m}`
}
function ymLabel(ym) {
  const [y, m] = ym.split('-')
  return `${HE_MONTHS[parseInt(m, 10) - 1]} ${y}`
}
function groupWeekDay(items) {
  const weekMap = {}
  const order = []
  for (const it of items) {
    const wk = weekKey(it.date)
    if (!weekMap[wk]) { weekMap[wk] = {}; order.push(wk) }
    if (!weekMap[wk][it.date]) weekMap[wk][it.date] = []
    weekMap[wk][it.date].push(it)
  }
  return order.map(wk => ({ week: wk, days: Object.keys(weekMap[wk]).sort().map(date => ({ date, items: weekMap[wk][date] })) }))
}
function endOf(e) { return e.end_date || e.date }
function resolveShowType(types) {
  const list = types || []
  const exact = list.find(t => t.label === 'מופע' || t.value === 'מופע')
  return exact ? exact.value : 'מופע'
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
    <div className="w-full">
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

      {tab === 'dashboard' && (
        <div className="flex flex-col gap-4">
          <Dashboard />
          <Monitor />
        </div>
      )}
      {tab === 'gantts' && <Gantts />}
      {tab === 'campaign' && <Campaign />}
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
function Campaign() {
  const [campaigns, setCampaigns] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState({})
  const [form, setForm] = useState({ title: '', start: '', end: '' })
  const [sel, setSel] = useState({})
  const [viewMode, setViewMode] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: cs }, { data: as }] = await Promise.all([
      supabase.from('marketing_campaigns').select('*').order('start_date', { ascending: false }),
      supabase.from('marketing_campaign_actions').select('*'),
    ])
    setCampaigns(cs || [])
    setActions(as || [])
    setLoading(false)
  }
  async function createCampaign() {
    if (!form.title.trim() || !form.start || !form.end) { alert('יש למלא כותרת, תאריך התחלה ותאריך סיום'); return }
    if (form.end < form.start) { alert('תאריך הסיום מוקדם מתאריך ההתחלה'); return }
    setBusy(true)
    const { data, error } = await supabase.from('marketing_campaigns').insert({ title: form.title.trim(), start_date: form.start, end_date: form.end }).select().single()
    setBusy(false)
    if (error) { alert('שגיאה: ' + error.message); return }
    setCampaigns(prev => [data, ...prev])
    setOpen(o => ({ ...o, [data.id]: true }))
    setForm({ title: '', start: '', end: '' })
  }
  async function deleteCampaign(id) {
    if (!window.confirm('למחוק את הקמפיין וכל הפעולות שבו?')) return
    await supabase.from('marketing_campaign_actions').delete().eq('campaign_id', id)
    await supabase.from('marketing_campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setActions(prev => prev.filter(a => a.campaign_id !== id))
  }
  async function addAction(campaignId, date) {
    const { data, error } = await supabase.from('marketing_campaign_actions').insert({ campaign_id: campaignId, date, label: '', free_text: '', done: false }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return }
    setActions(prev => [...prev, data])
  }
  async function updateAction(id, patch) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    await supabase.from('marketing_campaign_actions').update(patch).eq('id', id)
  }
  async function deleteAction(id) {
    setActions(prev => prev.filter(a => a.id !== id))
    await supabase.from('marketing_campaign_actions').delete().eq('id', id)
  }
  function datesOf(c) {
    const out = []; let d = c.start_date; let g = 0
    while (d <= c.end_date && g < 400) { out.push(d); d = toStr(addDays(d, 1)); g++ }
    return out
  }
  function monthsOf(c) {
    const out = []
    const [sy, sm] = c.start_date.split('-').map(Number)
    const [ey, em] = c.end_date.split('-').map(Number)
    let y = sy, m = sm, g = 0
    while ((y < ey || (y === ey && m <= em)) && g < 60) {
      out.push({ y, m }); m++; if (m > 12) { m = 1; y++ } ; g++
    }
    return out
  }

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-gray-800 mb-3">קמפיין חדש</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[12px] text-gray-500 mb-1">כותרת</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="שם הקמפיין"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
          </div>
          <div>
            <label className="block text-[12px] text-gray-500 mb-1">מתאריך</label>
            <input type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          </div>
          <div>
            <label className="block text-[12px] text-gray-500 mb-1">עד תאריך</label>
            <input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          </div>
          <button onClick={createCampaign} disabled={busy}
            className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50 flex items-center gap-1">
            <i className="ti ti-plus" /> צור קמפיין
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-[13px] py-8">טוען…</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-400 text-[13px]">אין קמפיינים עדיין</div>
      ) : campaigns.map(c => {
        const isOpen = !!open[c.id]
        const cActions = actions.filter(a => a.campaign_id === c.id)
        const doneCount = cActions.filter(a => a.done).length
        return (
          <div key={c.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <button onClick={() => setOpen(o => ({ ...o, [c.id]: !o[c.id] }))} className="flex items-center gap-2 flex-1 text-right">
                <i className={`ti ti-chevron-${isOpen ? 'down' : 'left'} text-gray-400`} style={{ fontSize: 16 }} />
                <div>
                  <div className="text-[14px] font-bold text-gray-800">{c.title}</div>
                  <div className="text-[12px] text-gray-400">{fmtDate(c.start_date)} – {fmtDate(c.end_date)} · {doneCount}/{cActions.length} בוצעו</div>
                </div>
              </button>
              <button onClick={() => deleteCampaign(c.id)} className="text-gray-300 hover:text-red-500 p-1"><i className="ti ti-trash" style={{ fontSize: 15 }} /></button>
            </div>
            {isOpen && (() => {
              const selDate = sel[c.id] || c.start_date
              const mode = viewMode[c.id] || 'month'
              const WD = ['א','ב','ג','ד','ה','ו','ש']
              const renderRow = (a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <button onClick={() => updateAction(a.id, { done: !a.done })}
                    className={`text-[11px] px-2 py-1 rounded-lg border flex items-center gap-1 shrink-0 ${a.done ? 'bg-[#FCE4F3] border-[#F3C9E2] text-[#A0106A]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                    <i className={`ti ${a.done ? 'ti-check' : 'ti-circle'}`} style={{ fontSize: 12 }} /> בוצע
                  </button>
                  <input value={a.label || ''} onChange={e => setActions(prev => prev.map(x => x.id === a.id ? { ...x, label: e.target.value } : x))} onBlur={e => updateAction(a.id, { label: e.target.value })}
                    placeholder="פעולה" className="flex-1 min-w-0 text-[13px] px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                  <input value={a.free_text || ''} onChange={e => setActions(prev => prev.map(x => x.id === a.id ? { ...x, free_text: e.target.value } : x))} onBlur={e => updateAction(a.id, { free_text: e.target.value })}
                    placeholder="הערות" className="flex-1 min-w-0 text-[13px] px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                  <button onClick={() => deleteAction(a.id)} className="text-gray-300 hover:text-red-500 shrink-0"><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
                </div>
              )
              const dayEditor = (ds) => {
                const acts = cActions.filter(x => x.date === ds)
                return (
                  <div key={ds} className="border border-gray-100 rounded-xl px-3 py-2.5" dir="rtl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[13px] font-bold text-gray-700">יום {dayName(ds)} · {fmtDate(ds)}</div>
                      <button onClick={() => addAction(c.id, ds)} className="text-[12px] text-[#E0197D] hover:text-[#A0106A] flex items-center gap-0.5"><i className="ti ti-plus" style={{ fontSize: 13 }} /> הוסף שורת פעולה</button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {acts.length === 0 && <div className="text-[12px] text-gray-300">אין פעולות ביום זה — הוסף שורת פעולה</div>}
                      {acts.map(renderRow)}
                    </div>
                  </div>
                )
              }
              return (
                <div className="border-t border-gray-100 px-3 py-3">
                  <div className="flex justify-center gap-1.5 mb-3" dir="rtl">
                    {[{ id: 'month', label: 'חודשי' }, { id: 'week', label: 'שבועי' }].map(v => (
                      <button key={v.id} onClick={() => setViewMode(o => ({ ...o, [c.id]: v.id }))}
                        className={`text-[12px] px-3 py-1 rounded-lg border transition-colors ${mode === v.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>{v.label}</button>
                    ))}
                  </div>

                  {mode === 'month' ? (
                    <>
                      <div className="flex flex-col lg:flex-row gap-4" dir="rtl">
                      <div className="flex flex-wrap gap-5 justify-center lg:justify-start lg:shrink-0">
                        {monthsOf(c).map(({ y, m }) => {
                          const mm = String(m).padStart(2, '0')
                          const daysInMonth = new Date(y, m, 0).getDate()
                          const firstDow = new Date(y, m - 1, 1).getDay()
                          const cells = []
                          for (let i = 0; i < firstDow; i++) cells.push(null)
                          for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${mm}-${String(d).padStart(2, '0')}`)
                          return (
                            <div key={`${y}-${mm}`} className="w-[340px]">
                              <div className="text-center text-[15px] font-bold text-gray-700 mb-3">{HE_MONTHS[m - 1]} {y}</div>
                              <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] text-gray-400 mb-1.5">
                                {WD.map(d => <div key={d}>{d}</div>)}
                              </div>
                              <div className="grid grid-cols-7 gap-1.5">
                                {cells.map((ds, i) => {
                                  if (!ds) return <div key={i} />
                                  const dnum = Number(ds.split('-')[2])
                                  const inRange = ds >= c.start_date && ds <= c.end_date
                                  if (!inRange) return <div key={i} className="h-14 flex items-center justify-center text-[14px] text-gray-300 border border-gray-100 rounded-lg">{dnum}</div>
                                  const dayActs = cActions.filter(a => a.date === ds)
                                  const hasActs = dayActs.length > 0
                                  const allDone = hasActs && dayActs.every(a => a.done)
                                  const isSel = ds === selDate
                                  return (
                                    <button key={i} onClick={() => setSel(o => ({ ...o, [c.id]: ds }))}
                                      className={`h-14 rounded-lg flex flex-col items-center justify-center border transition-colors ${isSel ? 'bg-[#E0197D] text-white border-[#E0197D]' : hasActs ? (allDone ? 'bg-[#FCE4F3] border-[#F3C9E2] text-[#A0106A]' : 'bg-pink-50 border-pink-100 text-[#A0106A]') : 'bg-white border-gray-300 text-gray-600 hover:border-[#E0197D]'}`}>
                                      <span className="text-[15px] leading-none">{dnum}</span>
                                      {hasActs && <span className={`text-[11px] leading-none mt-1 ${isSel ? 'text-white' : 'text-[#E0197D]'}`}>{dayActs.filter(a => a.done).length}/{dayActs.length}</span>}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="lg:flex-1 lg:border-r lg:border-gray-100 lg:pr-4">
                        <div className="text-[13px] font-bold text-gray-700 mb-2">סיכום פעולות · {doneCount}/{cActions.length} בוצעו</div>
                        <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto pl-1">
                          {cActions.length === 0 && <div className="text-[12px] text-gray-300">אין פעולות עדיין</div>}
                          {[...cActions].sort((x, y) => x.date.localeCompare(y.date)).map(a => (
                            <div key={a.id} onClick={() => setSel(o => ({ ...o, [c.id]: a.date }))}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border ${a.date === selDate ? 'border-[#E0197D] bg-pink-50' : 'border-transparent hover:bg-gray-50'}`}>
                              <button onClick={(e) => { e.stopPropagation(); updateAction(a.id, { done: !a.done }) }}
                                className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${a.done ? 'bg-[#E0197D] border-[#E0197D] text-white' : 'border-gray-300 hover:border-[#E0197D]'}`}>
                                {a.done && <i className="ti ti-check" style={{ fontSize: 10 }} />}
                              </button>
                              <span className="text-[11px] text-gray-400 shrink-0 w-[44px] text-center">{fmtShort(a.date)}</span>
                              <span className={`text-[12px] flex-1 min-w-0 truncate ${a.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{a.label || '(פעולה)'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      </div>
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        {dayEditor(selDate)}
                      </div>
                    </>
                  ) : (() => {
                    const wk = weekKey(selDate)
                    const weekDays = []
                    for (let i = 0; i < 7; i++) weekDays.push(toStr(addDays(wk, i)))
                    const inWeek = weekDays.filter(ds => ds >= c.start_date && ds <= c.end_date)
                    const firstWk = weekKey(c.start_date)
                    const lastWk = weekKey(c.end_date)
                    const go = (delta) => {
                      let nd = toStr(addDays(wk, delta * 7))
                      if (nd < c.start_date) nd = c.start_date
                      if (nd > c.end_date) nd = c.end_date
                      setSel(o => ({ ...o, [c.id]: nd }))
                    }
                    return (
                      <div dir="rtl">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <button disabled={wk <= firstWk} onClick={() => go(-1)}
                            className="text-[12px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#E0197D] disabled:opacity-30">› קודם</button>
                          <div className="text-[13px] font-bold text-[#A0106A]">שבוע {weekRangeLabel(wk)}</div>
                          <button disabled={wk >= lastWk} onClick={() => go(1)}
                            className="text-[12px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#E0197D] disabled:opacity-30">הבא ‹</button>
                        </div>
                        {inWeek.length === 0 ? (
                          <div className="text-center text-gray-300 text-[12px] py-4">אין ימים מהקמפיין בשבוע זה</div>
                        ) : (
                          <div className="overflow-x-auto pb-1">
                            <div className="flex gap-2 min-w-[840px]">
                              {weekDays.map(ds => {
                                const inRange = ds >= c.start_date && ds <= c.end_date
                                const acts = cActions.filter(a => a.date === ds)
                                return (
                                  <div key={ds} className={`flex-1 min-w-[120px] rounded-xl border overflow-hidden ${inRange ? 'border-gray-200' : 'border-gray-100'}`}>
                                    <div className={`text-center py-1.5 text-[12px] font-bold ${inRange ? 'bg-[#FCE4F3] text-[#A0106A]' : 'bg-gray-50 text-gray-300'}`}>
                                      <div>{dayName(ds)}</div>
                                      <div className="text-[11px] font-normal">{fmtShort(ds)}</div>
                                    </div>
                                    {inRange && (
                                      <div className="p-1.5 flex flex-col gap-1.5">
                                        {acts.map(a => (
                                          <div key={a.id} className={`rounded-lg border p-1.5 flex flex-col gap-1 ${a.done ? 'bg-[#FCE4F3] border-[#F3C9E2]' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex items-center justify-between">
                                              <button onClick={() => updateAction(a.id, { done: !a.done })} className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${a.done ? 'bg-white border-[#F3C9E2] text-[#A0106A]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}><i className={`ti ${a.done ? 'ti-check' : 'ti-circle'}`} style={{ fontSize: 11 }} /> בוצע</button>
                                              <button onClick={() => deleteAction(a.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
                                            </div>
                                            <input value={a.label || ''} onChange={e => setActions(prev => prev.map(x => x.id === a.id ? { ...x, label: e.target.value } : x))} onBlur={e => updateAction(a.id, { label: e.target.value })}
                                              placeholder="פעולה" className="w-full text-[12px] px-1.5 py-1 border border-gray-200 rounded bg-white outline-none focus:border-[#E0197D] text-right" />
                                            <input value={a.free_text || ''} onChange={e => setActions(prev => prev.map(x => x.id === a.id ? { ...x, free_text: e.target.value } : x))} onBlur={e => updateAction(a.id, { free_text: e.target.value })}
                                              placeholder="הערות" className="w-full text-[11px] px-1.5 py-1 border border-gray-200 rounded bg-white outline-none focus:border-[#E0197D] text-right text-gray-500" />
                                          </div>
                                        ))}
                                        <button onClick={() => addAction(c.id, ds)} className="text-[11px] text-[#E0197D] hover:text-[#A0106A] flex items-center justify-center gap-0.5 py-1.5 border border-dashed border-[#F3C9E2] rounded-lg">
                                          <i className="ti ti-plus" style={{ fontSize: 12 }} /> פעולה
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )
      })}
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
    <div className="bg-white border border-gray-100 rounded-xl p-5">
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

// ===================== מוניטור — לוז שבועי =====================
function Monitor() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState({})
  const planRef = useRef({})
  const [view, setView] = useState('current')
  const [curWeeks, setCurWeeks] = useState([])
  const [archMonths, setArchMonths] = useState([])
  const [openMonths, setOpenMonths] = useState({})
  const [showPast, setShowPast] = useState(false)
  const [showFuture, setShowFuture] = useState(false)
  const todayStr = toStr(new Date())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const today = toStr(new Date())
    const [{ data: types }, { data: evs }, { data: rows }, { data: camps }, { data: cacts }] = await Promise.all([
      supabase.from('event_types').select('value,label'),
      supabase.from('events').select('id,title,date,type').order('date'),
      supabase.from('marketing_plan').select('event_id,action_key,custom_date,custom_label,done,deleted,free_text,notes'),
      supabase.from('marketing_campaigns').select('id,title,start_date,end_date'),
      supabase.from('marketing_campaign_actions').select('id,campaign_id,date,label,free_text,done'),
    ])
    const showType = resolveShowType(types)
    const map = {}
    const hidden = new Set()
    for (const r of (rows || [])) {
      map[`${r.event_id}::${r.action_key}`] = r
      if (r.action_key === '__event__' && r.deleted) hidden.add(String(r.event_id))
    }
    const shows = (evs || []).filter(e => e.type === showType && !hidden.has(String(e.id)))
    function buildItems(evList) {
      const items = []
      for (const ev of evList) {
        for (const a of PLAN_ACTIONS) {
          const c = map[`${ev.id}::${a.key}`] || {}
          if (c.deleted) continue
          items.push({
            id: `${ev.id}::${a.key}`, source: 'gantt',
            eventId: ev.id, actionKey: a.key,
            date: c.custom_date || planDate(ev.date, a.offset),
            eventTitle: ev.title,
            label: c.custom_label || a.label,
            done: !!c.done, free_text: c.free_text || '',
            archiveYm: ymKey(ev.date),
          })
        }
      }
      return items
    }
    const campById = {}
    for (const c of (camps || [])) campById[c.id] = c
    const campItems = []
    for (const a of (cacts || [])) {
      const c = campById[a.campaign_id]
      if (!c) continue
      const it = {
        id: `camp::${a.id}`, source: 'campaign', actionId: a.id,
        date: a.date, eventTitle: c.title,
        label: (a.label && a.label.trim()) ? a.label : 'פעולת קמפיין',
        done: !!a.done, free_text: a.free_text || '',
        archiveYm: ymKey(a.date), campEnd: c.end_date,
      }
      map[it.id] = { done: !!a.done }
      campItems.push(it)
    }
    planRef.current = map
    setPlan(map)
    const sortItems = arr => arr.slice().sort((x, y) => x.date.localeCompare(y.date) || (x.eventTitle || '').localeCompare(y.eventTitle || ''))
    const curGantt = buildItems(shows.filter(e => e.date >= today))
    const curCamp = campItems.filter(it => (it.campEnd || it.date) >= today)
    setCurWeeks(groupWeekDay(sortItems([...curGantt, ...curCamp])))
    const pastGantt = buildItems(shows.filter(e => e.date < today))
    const pastCamp = campItems.filter(it => (it.campEnd || it.date) < today)
    const allPast = sortItems([...pastGantt, ...pastCamp])
    const monthMap = {}
    const order = []
    for (const it of allPast) {
      const ym = it.archiveYm
      if (!monthMap[ym]) { monthMap[ym] = {}; order.push(ym) }
      if (!monthMap[ym][it.date]) monthMap[ym][it.date] = []
      monthMap[ym][it.date].push(it)
    }
    order.sort((a, b) => b.localeCompare(a))
    setArchMonths(order.map(ym => ({ ym, days: Object.keys(monthMap[ym]).sort().map(date => ({ date, items: monthMap[ym][date] })) })))
    setLoading(false)
  }

  async function persist(eventId, actionKey, patch) {
    const k = `${eventId}::${actionKey}`
    const cur = planRef.current[k] || EMPTY_CELL
    const next = { ...cur, ...patch }
    const merged = { ...planRef.current, [k]: next }
    planRef.current = merged
    setPlan(merged)
    const { error } = await supabase.from('marketing_plan').upsert(
      {
        event_id: String(eventId), action_key: actionKey,
        custom_date: next.custom_date || null, notes: next.notes || null,
        done: !!next.done, custom_label: next.custom_label || null,
        deleted: !!next.deleted, free_text: next.free_text || null,
      },
      { onConflict: 'event_id,action_key' }
    )
    if (error) alert('שגיאה בשמירה: ' + error.message)
  }

  async function toggleItem(it, curDone) {
    const done = !curDone
    if (it.source === 'campaign') {
      const merged = { ...planRef.current, [it.id]: { ...(planRef.current[it.id] || {}), done } }
      planRef.current = merged
      setPlan(merged)
      await supabase.from('marketing_campaign_actions').update({ done }).eq('id', it.actionId)
    } else {
      persist(it.eventId, it.actionKey, { done })
    }
  }

  function renderDays(days) {
    return (
      <div className="flex flex-col">
        {days.map(day => (
          <div key={day.date} className="flex items-start gap-3 px-2 py-2 border-b border-gray-100 last:border-0">
            <div className="w-16 shrink-0 text-[12px] leading-tight pt-1">
              <div className="text-gray-600 font-medium">יום {dayName(day.date)}</div>
              <div className="text-gray-400">{fmtShort(day.date)}</div>
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
              {day.items.map(it => {
                const done = plan[it.id] ? !!plan[it.id].done : it.done
                const overdue = !done && it.date < todayStr
                return (
                  <button key={it.id} onClick={() => toggleItem(it, done)}
                    title={it.eventTitle + (it.free_text ? ' · ' + it.free_text : '')}
                    className={`text-[12px] rounded-lg px-2 py-1 border transition-colors text-right ${done ? 'bg-[#FCE4F3] border-[#F3C9E2] text-[#A0106A] line-through' : overdue ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-[#E0197D]'}`}>
                    {it.source === 'campaign' && <i className="ti ti-rocket" style={{ fontSize: 11 }} />} {it.label}
                    <span className="text-gray-400 mr-1">· {it.eventTitle}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4" dir="rtl">
        <div className="flex items-center gap-2">
          <i className="ti ti-calendar text-[#E0197D]" style={{ fontSize: 18 }} />
          <h2 className="text-[15px] font-bold text-gray-800">מוניטור — לוז שבועי</h2>
        </div>
        <div className="flex gap-1.5">
          {[{ id: 'current', label: 'נוכחי' }, { id: 'archive', label: 'ארכיון' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`text-[12px] px-3 py-1 rounded-lg border transition-colors ${view === v.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-[13px] py-8">טוען…</div>
      ) : view === 'current' ? ((() => {
        const curWk = weekKey(todayStr)
        const pastWeeks = curWeeks.filter(w => w.week < curWk)
        const thisWeek = curWeeks.find(w => w.week === curWk)
        const futureWeeks = curWeeks.filter(w => w.week > curWk)
        const renderWeek = (w) => (
          <div key={w.week}>
            <div className="text-[13px] font-bold text-[#A0106A] bg-[#FCE4F3] rounded-lg px-3 py-1.5 mb-2">שבוע {weekRangeLabel(w.week)}</div>
            {renderDays(w.days)}
          </div>
        )
        if (curWeeks.length === 0) return <div className="text-center text-gray-400 text-[13px] py-8">אין פעולות מתוכננות</div>
        return (
          <div dir="rtl" className="flex flex-col gap-4">
            {pastWeeks.length > 0 && (
              <div>
                <button onClick={() => setShowPast(x => !x)} className="text-[12px] text-gray-500 hover:text-[#E0197D] flex items-center gap-1 mb-2">
                  <i className={`ti ti-chevron-${showPast ? 'down' : 'left'}`} style={{ fontSize: 14 }} />
                  שבועות קודמים ({pastWeeks.length})
                </button>
                {showPast && <div className="flex flex-col gap-4">{pastWeeks.map(renderWeek)}</div>}
              </div>
            )}
            {thisWeek ? renderWeek(thisWeek) : (
              <div className="text-center text-gray-400 text-[13px] py-6">אין פעולות בשבוע הנוכחי</div>
            )}
            {futureWeeks.length > 0 && (
              <div>
                <button onClick={() => setShowFuture(x => !x)} className="text-[12px] text-gray-500 hover:text-[#E0197D] flex items-center gap-1 mb-2">
                  <i className={`ti ti-chevron-${showFuture ? 'down' : 'left'}`} style={{ fontSize: 14 }} />
                  שבועות הבאים ({futureWeeks.length})
                </button>
                {showFuture && <div className="flex flex-col gap-4">{futureWeeks.map(renderWeek)}</div>}
              </div>
            )}
          </div>
        )
      })()) : (
        archMonths.length === 0 ? (
          <div className="text-center text-gray-400 text-[13px] py-8">אין אירועי עבר בארכיון</div>
        ) : (
          <div dir="rtl" className="flex flex-col gap-2">
            {archMonths.map(m => {
              const isOpen = !!openMonths[m.ym]
              return (
                <div key={m.ym} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setOpenMonths(o => ({ ...o, [m.ym]: !o[m.ym] }))}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <i className="ti ti-folder text-[#E0197D]" style={{ fontSize: 16 }} />
                      <span className="text-[13px] font-bold text-gray-800">{ymLabel(m.ym)}</span>
                    </div>
                    <i className={`ti ti-chevron-${isOpen ? 'down' : 'left'} text-gray-400`} style={{ fontSize: 15 }} />
                  </button>
                  {isOpen && <div className="border-t border-gray-100 px-2 py-1">{renderDays(m.days)}</div>}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ===================== גאנטים — תכניות פעולה =====================
function Gantts() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [past, setPast] = useState([])
  const [plan, setPlan] = useState({})
  const planRef = useRef({})
  const [open, setOpen] = useState(null)
  const [view, setView] = useState('active')
  const [openMonths, setOpenMonths] = useState({})
  const [noteModal, setNoteModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [allShows, setAllShows] = useState([])
  const [hiddenSet, setHiddenSet] = useState(new Set())
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const todayStr = toStr(new Date())
    const [{ data: types }, { data: evs }, { data: rows }] = await Promise.all([
      supabase.from('event_types').select('value,label'),
      supabase.from('events').select('id,title,date,type').order('date'),
      supabase.from('marketing_plan').select('event_id,action_key,custom_date,notes,done,custom_label,deleted,free_text'),
    ])
    const showType = resolveShowType(types)
    const hidden = new Set((rows || []).filter(r => r.action_key === '__event__' && r.deleted).map(r => String(r.event_id)))
    const allShowsList = (evs || []).filter(e => e.type === showType)
    const visible = allShowsList.filter(e => !hidden.has(String(e.id)))
    const upcoming = visible.filter(e => e.date >= todayStr)
    const pastEv = visible.filter(e => e.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))
    const map = {}
    for (const r of (rows || [])) {
      map[`${r.event_id}::${r.action_key}`] = { custom_date: r.custom_date, notes: r.notes, done: r.done, custom_label: r.custom_label, deleted: r.deleted, free_text: r.free_text }
    }
    planRef.current = map
    setAllShows(allShowsList)
    setHiddenSet(hidden)
    setEvents(upcoming)
    setPast(pastEv)
    setPlan(map)
    setOpen(upcoming[0]?.id ?? null)
    setLoading(false)
  }

  function cell(eventId, actionKey) {
    return plan[`${eventId}::${actionKey}`] || EMPTY_CELL
  }
  async function persist(eventId, actionKey, patch) {
    const k = `${eventId}::${actionKey}`
    const cur = planRef.current[k] || EMPTY_CELL
    const next = { ...cur, ...patch }
    const merged = { ...planRef.current, [k]: next }
    planRef.current = merged
    setPlan(merged)
    const { error } = await supabase.from('marketing_plan').upsert(
      {
        event_id: String(eventId), action_key: actionKey,
        custom_date: next.custom_date || null, notes: next.notes || null,
        done: !!next.done, custom_label: next.custom_label || null,
        deleted: !!next.deleted, free_text: next.free_text || null,
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
    setPast(es => es.filter(e => e.id !== ev.id))
    setHiddenSet(h => { const n = new Set(h); n.add(String(ev.id)); return n })
  }
  async function importEvent(ev) {
    await persist(ev.id, '__event__', { deleted: false })
    setHiddenSet(h => { const n = new Set(h); n.delete(String(ev.id)); return n })
    const todayStr = toStr(new Date())
    if (ev.date >= todayStr) setEvents(es => [...es.filter(e => e.id !== ev.id), ev].sort((a, b) => a.date.localeCompare(b.date)))
    else setPast(es => [...es.filter(e => e.id !== ev.id), ev].sort((a, b) => b.date.localeCompare(a.date)))
  }

  function renderEventCard(ev) {
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
          <div className="border-t-2 border-gray-200">
            {vis.length === 0 && (
              <div className="px-4 py-4 text-center text-[12px] text-gray-300">כל הפעולות נמחקו</div>
            )}
            {vis.map(action => {
              const c = cell(ev.id, action.key)
              const d = effDate(ev, action)
              const isCustom = !!c.custom_date
              return (
                <div key={action.key}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 last:border-0 ${c.done ? 'bg-[#FCE4F3]' : ''}`}>
                  <div className="w-52 shrink-0">
                    <span className={`text-[13px] ${c.done ? 'text-[#A0106A] font-medium' : 'text-gray-800'}`}>{labelOf(ev, action)}</span>
                  </div>

                  <input type="text" defaultValue={c.free_text || ''} placeholder="טקסט חופשי…"
                    onBlur={e => { if ((e.target.value || '') !== (c.free_text || '')) persist(ev.id, action.key, { free_text: e.target.value }) }}
                    className="flex-1 min-w-0 text-[12.5px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:border-[#E0197D]" />

                  <span className="text-[11px] text-gray-400 w-12 text-center shrink-0">יום {dayName(d)}</span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input type="date" value={d}
                      onChange={e => persist(ev.id, action.key, { custom_date: e.target.value })}
                      className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white" />
                    {isCustom && (
                      <button title="חזרה לתאריך אוטומטי" onClick={() => persist(ev.id, action.key, { custom_date: null })}
                        className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-rotate" style={{ fontSize: 15 }} /></button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button title="הערות" onClick={() => setNoteModal({ eventId: ev.id, action, label: labelOf(ev, action), draft: c.notes || '' })}
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
  }

  // תיקיות ארכיון לפי חודש
  const folders = []
  const fidx = {}
  for (const ev of past) {
    const ym = ymKey(ev.date)
    if (!(ym in fidx)) { fidx[ym] = folders.length; folders.push({ ym, events: [] }) }
    folders[fidx[ym]].events.push(ev)
  }

  if (loading) return <div className="text-center text-gray-400 text-[13px] py-10">טוען…</div>

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {[{ id: 'active', label: 'פעילים' }, { id: 'archive', label: 'ארכיון' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`text-[12px] px-3 py-1 rounded-lg border transition-colors ${view === v.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={() => setImportOpen(true)}
          className="text-[12px] px-3 py-1 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center gap-1">
          <i className="ti ti-download" style={{ fontSize: 14 }} /> ייבוא אירוע מהיומן
        </button>
      </div>

      {view === 'active' ? (
        events.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-400 text-[13px]">
            אין מופעים עתידיים ביומן. הוסף אירוע מסוג "מופע" כדי לבנות עבורו תכנית פעולה.
          </div>
        ) : (
          events.map(renderEventCard)
        )
      ) : (
        folders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-400 text-[13px]">
            אין אירועי עבר בארכיון
          </div>
        ) : (
          folders.map(f => {
            const isOpen = !!openMonths[f.ym]
            return (
              <div key={f.ym} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                <button onClick={() => setOpenMonths(o => ({ ...o, [f.ym]: !o[f.ym] }))}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <i className="ti ti-folder text-[#E0197D]" style={{ fontSize: 16 }} />
                    <span className="text-[13px] font-bold text-gray-800">{ymLabel(f.ym)}</span>
                    <span className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{f.events.length}</span>
                  </div>
                  <i className={`ti ti-chevron-${isOpen ? 'down' : 'left'} text-gray-400`} style={{ fontSize: 15 }} />
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 p-3 flex flex-col gap-3 bg-gray-50">
                    {f.events.map(renderEventCard)}
                  </div>
                )}
              </div>
            )
          })
        )
      )}

      {noteModal && (
        <NoteModal modal={noteModal} onClose={() => setNoteModal(null)}
          onSave={(text) => { persist(noteModal.eventId, noteModal.action.key, { notes: text }); setNoteModal(null) }} />
      )}
      {editModal && (
        <EditModal modal={editModal} onClose={() => setEditModal(null)}
          onSave={(text) => { persist(editModal.eventId, editModal.action.key, { custom_label: text || null }); setEditModal(null) }} />
      )}
      {importOpen && (
        <ImportModal allShows={allShows} hiddenSet={hiddenSet} onClose={() => setImportOpen(false)} onImport={importEvent} />
      )}
    </div>
  )
}

function ImportModal({ allShows, hiddenSet, onClose, onImport }) {
  const [q, setQ] = useState('')
  const list = (allShows || [])
    .filter(e => !q || (e.title || '').includes(q))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div dir="rtl" className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800 mb-1">ייבוא אירוע מהיומן</h3>
        <p className="text-[12px] text-gray-400 mb-3">מוצגים אירועים מסוג "מופע" בלבד</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם…"
          className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 text-gray-800 mb-3 focus:outline-none focus:border-[#E0197D]" />
        <div className="overflow-y-auto flex flex-col gap-1.5">
          {list.length === 0 ? (
            <div className="text-center text-gray-400 text-[13px] py-6">לא נמצאו אירועי מופע</div>
          ) : (
            list.map(e => {
              const inGantts = !hiddenSet.has(String(e.id))
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 border border-gray-100 rounded-lg">
                  <div className="min-w-0">
                    <div className="text-[13px] text-gray-800 truncate">{e.title}</div>
                    <div className="text-[11px] text-gray-400">{dayName(e.date)}, {fmtDate(e.date)}</div>
                  </div>
                  {inGantts ? (
                    <span className="text-[11px] text-gray-400 shrink-0">כבר בגאנטים</span>
                  ) : (
                    <button onClick={() => onImport(e)}
                      className="text-[12px] px-3 py-1 rounded-lg bg-[#E0197D] text-white hover:bg-[#A0106A] shrink-0">ייבוא</button>
                  )}
                </div>
              )
            })
          )}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="text-[13px] px-4 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">סגירה</button>
        </div>
      </div>
    </div>
  )
}

function NoteModal({ modal, onClose, onSave }) {
  const [text, setText] = useState(modal.draft || '')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div dir="rtl" className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800 mb-1">הערות לפעולה</h3>
        <p className="text-[12px] text-gray-400 mb-3">{modal.label || ''}</p>
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
