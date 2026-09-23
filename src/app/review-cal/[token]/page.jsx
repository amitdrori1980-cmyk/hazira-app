'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
// HAZIRA-REVIEWCAL-CHUNKRETRY-V5

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DOW = ['א','ב','ג','ד','ה','ו','ש']
function fmtDate(ds) { if (!ds) return ''; const [y, m, d] = ds.split('-').map(Number); return d + ' ' + HE_MONTHS[m - 1] }
function heDow(ds) { const [y, m, d] = String(ds).split('-').map(Number); if (!y) return ''; return HE_DOW[new Date(y, m - 1, d).getDay()] }
function ym(ds) { const [y, m] = String(ds).split('-').map(Number); return { y, m } }
function normNm(x) { return (x || '').trim().replace(/\s+/g, ' ') }

export default function ReviewCalPage() {
  const params = useParams()
  const token = params?.token
  const [link, setLink] = useState(null)
  const [items, setItems] = useState([])
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [savingDs, setSavingDs] = useState(null)
  const [monthIdx, setMonthIdx] = useState(0)
  const [openDs, setOpenDs] = useState(null)

  async function fetchInChunks(table, cols, col, ids, chunkSize) {
    const out = []
    for (let i = 0; i < ids.length; i += chunkSize) {
      const { data, error } = await supabase.from(table).select(cols).in(col, ids.slice(i, i + chunkSize))
      if (error) throw error
      if (data) out.push(...data)
    }
    return out
  }

  async function loadAll(attempt = 0) {
    if (!token) return
    setLoadError(false)
    try {
      const { data: l, error: lErr } = await supabase.from('review_links').select('*').eq('token', token).maybeSingle()
      if (lErr) throw lErr
      if (!l) { setNotFound(true); setLoading(false); return }
      setLink(l)

      // ---- LIVE: for plan-review links, compute events from production in real time ----
      let liveItems = null
      if (l.plan_id) {
        const { data: cells, error: cErr } = await supabase.from('project_plan_cells').select('source_event_id').eq('plan_id', l.plan_id)
        if (cErr) throw cErr
        const eids = [...new Set((cells || []).map(c => c.source_event_id).filter(Boolean))]
        if (eids.length) {
          // chunked .in() so the request URL stays short (mobile Safari / cellular proxies can drop very long URLs)
          const [evs, ppl] = await Promise.all([
            fetchInChunks('production_events', 'id,event_name,date,venue', 'id', eids, 25),
            fetchInChunks('production_people', 'production_event_id,slot,name,status', 'production_event_id', eids, 25),
          ])
          const evMap = {}; (evs || []).forEach(e => { evMap[e.id] = e })
          const target = normNm(l.person_name)
          liveItems = (ppl || [])
            .filter(p => normNm(p.name) === target)
            .map(p => {
              const ev = evMap[p.production_event_id]; if (!ev) return null
              return { source: 'production', key: ev.id + ':' + p.slot, eid: ev.id, slot: p.slot, name: p.name, event_name: ev.event_name || '', date: ev.date || '', venue: ev.venue || '' }
            })
            .filter(Boolean)
            .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.event_name || '').localeCompare(b.event_name || '', 'he'))
        } else {
          liveItems = []
        }
      }
      const finalItems = liveItems != null ? liveItems : (l.items || [])
      setItems(finalItems)

      const { data: rs, error: rErr } = await supabase.from('review_responses').select('*').eq('token', token)
      if (rErr) throw rErr
      const map = {}
      ;(rs || []).forEach(r => {
        let idx = -1
        if (r.item_key) idx = finalItems.findIndex(x => (x.key || (x.eid + ':' + x.slot)) === r.item_key)
        if (idx < 0 && r.item_index != null) idx = r.item_index
        if (idx >= 0) map[idx] = { decision: r.decision || '', note: r.note || '', updated_at: r.updated_at || null }
      })
      setResponses(map); setLoading(false)
    } catch (e) {
      // network/server error — retry a couple of times, then show a connection error (not "no events")
      if (attempt < 2) { setTimeout(() => loadAll(attempt + 1), 800 * (attempt + 1)); return }
      setLoadError(true); setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [token])

  function itemKey(idx) { const it = items[idx]; return it ? (it.key || (it.eid != null ? it.eid + ':' + it.slot : 'idx:' + idx)) : ('idx:' + idx) }

  const byDate = {}
  items.forEach((it, idx) => { const d = it.date || 'no-date'; (byDate[d] = byDate[d] || []).push(idx) })
  const datesSorted = Object.keys(byDate).filter(d => d !== 'no-date').sort()

  function dayIdxs(ds) { return byDate[ds] || [] }
  function dayNames(ds) { return dayIdxs(ds).map(i => items[i] && items[i].event_name).filter(Boolean) }
  function dayDecision(ds) {
    const decs = dayIdxs(ds).map(i => (responses[i] || {}).decision || '')
    if (!decs.some(Boolean)) return ''
    if (decs.every(d => d === 'approve')) return 'approve'
    if (decs.every(d => d === 'reject')) return 'reject'
    return 'mixed'
  }
  function dayNote(ds) { for (const i of dayIdxs(ds)) { const n = (responses[i] || {}).note; if (n) return n } return '' }
  function dayUpdated(ds) { let u = null; dayIdxs(ds).forEach(i => { const t = (responses[i] || {}).updated_at; if (t && (!u || t > u)) u = t }); return u }

  async function writeDay(ds, decision, note) {
    const idxs = dayIdxs(ds); const nowIso = new Date().toISOString()
    setResponses(prev => { const n = { ...prev }; idxs.forEach(i => { n[i] = { ...(n[i] || {}), decision, note, updated_at: nowIso } }); return n })
    setSavingDs(ds)
    const results = await Promise.all(idxs.map(i => supabase.from('review_responses').upsert(
      { token, item_key: itemKey(i), decision, note, updated_at: nowIso }, { onConflict: 'token,item_key' })))
    setSavingDs(null)
    const err = results.find(r => r.error); if (err) alert('שגיאה בשמירה: ' + err.error.message)
  }
  function setDayDecision(ds, decision) { writeDay(ds, decision, dayNote(ds)) }
  function clearDay(ds) { writeDay(ds, '', dayNote(ds)) }
  function setDayNoteLocal(ds, note) { const idxs = dayIdxs(ds); setResponses(prev => { const n = { ...prev }; idxs.forEach(i => { n[i] = { ...(n[i] || {}), note } }); return n }) }
  function saveDayNote(ds) { const d = dayDecision(ds); writeDay(ds, d === 'mixed' ? '' : d, dayNote(ds)) }

  if (loading) return <div style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>
  if (loadError) return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-center px-6 bg-[#FCE4F3]/40">
      <div>
        <div className="text-[#E0197D] text-2xl font-bold mb-2">הזירה</div>
        <div className="text-gray-600 text-[15px] mb-1">בעיית חיבור</div>
        <div className="text-gray-400 text-[13px] mb-4">לא הצלחנו לטעון את האירועים. בדקו את החיבור לאינטרנט ונסו שוב.</div>
        <button onClick={() => { setLoading(true); loadAll() }} className="bg-[#E0197D] text-white text-[14px] px-6 py-2.5 rounded-xl hover:bg-[#A0106A] flex items-center gap-2 mx-auto">
          <i className="ti ti-refresh" style={{ fontSize: 16 }} /> נסה שוב
        </button>
      </div>
    </div>
  )
  if (notFound) return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-center px-6">
      <div><div className="text-[#E0197D] text-2xl font-bold mb-2">הזירה</div><div className="text-gray-500 text-[14px]">הלינק לא נמצא או שפג תוקפו.</div></div>
    </div>
  )

  const doneDays = datesSorted.filter(ds => dayDecision(ds)).length

  const months = []; const seenM = new Set()
  datesSorted.forEach(d => { const { y, m } = ym(d); const key = y + '-' + m; if (!seenM.has(key)) { seenM.add(key); months.push({ y, m }) } })
  const curMonth = months[Math.min(monthIdx, Math.max(0, months.length - 1))] || null

  const decColor = dec => dec === 'approve' ? 'bg-yellow-400 text-yellow-950 border-yellow-400'
    : dec === 'reject' ? 'bg-red-500 text-white border-red-500'
    : dec === 'mixed' ? 'bg-orange-100 text-orange-700 border-orange-300'
    : 'bg-[#FCE4F3] text-[#A0106A] border-[#F3C9E2]'
  const decLabel = dec => dec === 'approve' ? 'אישר' : dec === 'reject' ? 'לא יכול' : dec === 'mixed' ? 'חלקי' : ''

  function monthCells(y, m) {
    const startDow = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) { const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); cells.push({ d, ds, idxs: byDate[ds] || [] }) }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen bg-[#FCE4F3]/40 py-6 px-3">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <div className="text-[#E0197D] text-2xl font-bold">הזירה</div>
          <div className="text-gray-600 text-[14px] mt-1">בדיקת זמינות — {link.person_name}</div>
          <div className="text-gray-400 text-[12px] mt-0.5">לחצו על יום וסמנו: אישור / לא יכול. הסימון חל על כל הפעולות באותו יום.</div>
          <div className="text-gray-400 text-[12px] mt-1">{doneDays}/{datesSorted.length} ימים סומנו</div>
        </div>

        {datesSorted.length === 0 ? (
          <div className="bg-white border border-[#F3C9E2] rounded-2xl p-8 text-center text-[14px] text-gray-400">אין כרגע אירועים לבדיקה עבורך.</div>
        ) : (<>
        <div className="hidden md:block">
          {curMonth && (
            <div className="bg-white border border-[#F3C9E2] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <button disabled={monthIdx <= 0} onClick={() => setMonthIdx(i => Math.max(0, i - 1))} className="text-gray-400 hover:text-[#E0197D] disabled:opacity-30 p-1"><i className="ti ti-chevron-right" style={{ fontSize: 20 }} /></button>
                <div className="text-[15px] font-bold text-[#E0197D]">{HE_MONTHS[curMonth.m - 1]} {curMonth.y}</div>
                <button disabled={monthIdx >= months.length - 1} onClick={() => setMonthIdx(i => Math.min(months.length - 1, i + 1))} className="text-gray-400 hover:text-[#E0197D] disabled:opacity-30 p-1"><i className="ti ti-chevron-left" style={{ fontSize: 20 }} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 mb-1">{HE_DOW.map(d => <div key={d}>{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells(curMonth.y, curMonth.m).map((c, i) => (
                  <div key={i} className={'min-h-[92px] rounded-lg border p-1 ' + (c ? 'border-gray-100 bg-gray-50/50' : 'border-transparent')}>
                    {c && (
                      <>
                        <div className="text-[11px] text-gray-400 text-left px-0.5">{c.d}</div>
                        {c.idxs.length > 0 && (() => {
                          const dec = dayDecision(c.ds)
                          return (
                            <button onClick={() => setOpenDs(c.ds)} className={'mt-0.5 w-full text-right rounded-md border px-1.5 py-1 ' + decColor(dec)}>
                              <div className="text-[10px] leading-tight space-y-0.5">
                                {dayNames(c.ds).map((nm, k) => <div key={k} className="font-semibold truncate">{nm}</div>)}
                              </div>
                              <div className="text-[9px] mt-0.5 opacity-90">{dec ? decLabel(dec) : 'לחצו לסימון'}</div>
                            </button>
                          )
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:hidden flex flex-col gap-2.5">
          {datesSorted.map(ds => {
            const dec = dayDecision(ds)
            return (
              <button key={ds} onClick={() => setOpenDs(ds)} className="bg-white border border-[#F3C9E2] rounded-xl p-3 text-right shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={'text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ' + decColor(dec)}>{dec ? decLabel(dec) : 'לסימון'}</span>
                  <span className="text-[13px] font-bold text-gray-700 flex-1">יום {heDow(ds)} · {fmtDate(ds)}</span>
                </div>
                <div className="text-[13px] text-gray-800 space-y-0.5">
                  {dayNames(ds).map((nm, k) => <div key={k}>• {nm}</div>)}
                </div>
              </button>
            )
          })}
        </div>
        </>)}

        <div className="text-center text-[12px] text-gray-400 mt-6">התגובות נשמרות אוטומטית. אפשר לסגור את הדף ולחזור אליו מאוחר יותר.</div>
      </div>

      {openDs && (() => {
        const ds = openDs; const dec = dayDecision(ds); const note = dayNote(ds); const upd = dayUpdated(ds)
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setOpenDs(null)}>
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-4 shadow-2xl" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setOpenDs(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 20 }} /></button>
                <div className="text-[16px] font-bold text-gray-800 text-right">יום {heDow(ds)} · {fmtDate(ds)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 mb-3 text-right">
                <div className="text-[11px] text-gray-400 mb-1">פעולות ביום זה</div>
                <div className="text-[13px] text-gray-800 space-y-0.5">
                  {dayIdxs(ds).map(i => <div key={i}>• {items[i] && items[i].event_name}{items[i] && items[i].venue ? <span className="text-gray-400"> · {items[i].venue}</span> : null}</div>)}
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDayDecision(ds, 'approve')} className={'flex-1 text-[14px] py-2.5 rounded-xl border font-medium ' + (dec === 'approve' ? 'bg-yellow-400 border-yellow-400 text-yellow-950' : 'bg-white border-gray-200 text-gray-500 hover:border-yellow-400')}><i className="ti ti-check" /> מאשר</button>
                <button onClick={() => setDayDecision(ds, 'reject')} className={'flex-1 text-[14px] py-2.5 rounded-xl border font-medium ' + (dec === 'reject' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-red-400')}><i className="ti ti-x" /> לא יכול</button>
              </div>
              {dec && <button onClick={() => clearDay(ds)} className="text-[12px] text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"><i className="ti ti-eraser" style={{ fontSize: 13 }} /> נקה בחירה</button>}
              <textarea value={note} onChange={e => setDayNoteLocal(ds, e.target.value)} onBlur={() => saveDayNote(ds)} placeholder="הערה ליום (לא חובה)..." rows={2}
                className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
              {savingDs === ds && <div className="text-[11px] text-gray-400 mt-1 text-left">נשמר…</div>}
              {upd && <div className="text-[11px] text-gray-400 mt-1 text-left">עודכן: {new Date(upd).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
