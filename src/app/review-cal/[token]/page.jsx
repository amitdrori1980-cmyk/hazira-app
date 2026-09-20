'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
// HAZIRA-REVIEWCAL-V1

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DOW = ['א','ב','ג','ד','ה','ו','ש']
function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-').map(Number)
  return d + ' ' + HE_MONTHS[m - 1]
}
function heDow(ds) { const [y,m,d] = String(ds).split('-').map(Number); if(!y) return ''; return HE_DOW[new Date(y,m-1,d).getDay()] }
function ym(ds) { const [y,m] = String(ds).split('-').map(Number); return { y, m } } // m: 1-12

export default function ReviewCalPage() {
  const params = useParams()
  const token = params?.token
  const [link, setLink] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [savingIdx, setSavingIdx] = useState(null)
  const [monthIdx, setMonthIdx] = useState(0)   // index into the list of months that have events (desktop)
  const [openIdx, setOpenIdx] = useState(null)  // which item's editor sheet is open

  useEffect(() => {
    async function load() {
      if (!token) return
      const { data: l } = await supabase.from('review_links').select('*').eq('token', token).maybeSingle()
      if (!l) { setNotFound(true); setLoading(false); return }
      setLink(l)
      const { data: rs } = await supabase.from('review_responses').select('*').eq('token', token)
      const map = {}
      const its = l.items || []
      ;(rs || []).forEach(r => {
        let idx = -1
        if (r.item_key) idx = its.findIndex(x => (x.key || (x.eid + ':' + x.slot)) === r.item_key)
        if (idx < 0 && r.item_index != null) idx = r.item_index
        if (idx >= 0) map[idx] = { decision: r.decision || '', note: r.note || '', updated_at: r.updated_at || null }
      })
      setResponses(map)
      setLoading(false)
    }
    load()
  }, [token])

  function itemKey(idx) {
    const it = (link?.items || [])[idx]
    return it ? (it.key || (it.eid != null ? it.eid + ':' + it.slot : 'idx:' + idx)) : ('idx:' + idx)
  }
  async function setDecision(idx, decision) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    setResponses(prev => ({ ...prev, [idx]: { ...cur, decision, updated_at: nowIso } }))
    setSavingIdx(idx)
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision, note: cur.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' })
    setSavingIdx(null)
    if (error) alert('שגיאה בשמירה: ' + error.message)
  }
  async function clearDecision(idx) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    setResponses(prev => ({ ...prev, [idx]: { ...cur, decision: '', updated_at: nowIso } }))
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision: '', note: cur.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' })
    if (error) alert('שגיאה: ' + error.message)
  }
  async function saveNote(idx) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision: cur.decision || '', note: cur.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' })
    setResponses(prev => ({ ...prev, [idx]: { ...(prev[idx] || { decision: '' }), updated_at: nowIso } }))
    if (error) alert('שגיאה בשמירת ההערה: ' + error.message)
  }

  if (loading) return <div style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>
  if (notFound) return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <div className="text-[#E0197D] text-2xl font-bold mb-2">הזירה</div>
        <div className="text-gray-500 text-[14px]">הלינק לא נמצא או שפג תוקפו.</div>
      </div>
    </div>
  )

  const items = link.items || []
  const doneCount = Object.values(responses).filter(r => r.decision).length

  // index items by date -> [idx...]
  const byDate = {}
  items.forEach((it, idx) => { const d = it.date || 'no-date'; (byDate[d] = byDate[d] || []).push(idx) })
  const datesSorted = Object.keys(byDate).filter(d => d !== 'no-date').sort()

  // months (that have events), for desktop pager
  const months = []
  const seenM = new Set()
  datesSorted.forEach(d => { const { y, m } = ym(d); const key = y + '-' + m; if (!seenM.has(key)) { seenM.add(key); months.push({ y, m }) } })
  const curMonth = months[Math.min(monthIdx, Math.max(0, months.length - 1))] || null

  const decColor = dec => dec === 'approve' ? 'bg-yellow-400 text-yellow-950 border-yellow-400' : dec === 'reject' ? 'bg-red-500 text-white border-red-500' : 'bg-[#FCE4F3] text-[#A0106A] border-[#F3C9E2]'
  const decLabel = dec => dec === 'approve' ? 'אישר' : dec === 'reject' ? 'לא יכול' : ''

  // build month grid cells (desktop) — Sunday-first, RTL handled by dir
  function monthCells(y, m) {
    const first = new Date(y, m - 1, 1)
    const startDow = first.getDay() // 0=Sun
    const daysInMonth = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ d, ds, idxs: byDate[ds] || [] })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  const Header = () => (
    <div className="text-center mb-4">
      <div className="text-[#E0197D] text-2xl font-bold">הזירה</div>
      <div className="text-gray-600 text-[14px] mt-1">בדיקת פעולות — {link.person_name}</div>
      <div className="text-gray-400 text-[12px] mt-0.5">לחצו על אירוע וסמנו: אישור / לא יכול, והוסיפו הערה במידת הצורך</div>
      <div className="text-gray-400 text-[12px] mt-1">{doneCount}/{items.length} סומנו</div>
    </div>
  )

  return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen bg-[#FCE4F3]/40 py-6 px-3">
      <div className="max-w-3xl mx-auto">
        <Header />

        {/* ===== DESKTOP: full month calendar ===== */}
        <div className="hidden md:block">
          {curMonth && (
            <div className="bg-white border border-[#F3C9E2] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <button disabled={monthIdx <= 0} onClick={() => setMonthIdx(i => Math.max(0, i - 1))} className="text-gray-400 hover:text-[#E0197D] disabled:opacity-30 p-1"><i className="ti ti-chevron-right" style={{ fontSize: 20 }} /></button>
                <div className="text-[15px] font-bold text-[#E0197D]">{HE_MONTHS[curMonth.m - 1]} {curMonth.y}</div>
                <button disabled={monthIdx >= months.length - 1} onClick={() => setMonthIdx(i => Math.min(months.length - 1, i + 1))} className="text-gray-400 hover:text-[#E0197D] disabled:opacity-30 p-1"><i className="ti ti-chevron-left" style={{ fontSize: 20 }} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 mb-1">
                {HE_DOW.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells(curMonth.y, curMonth.m).map((c, i) => (
                  <div key={i} className={`min-h-[84px] rounded-lg border p-1 ${c ? 'border-gray-100 bg-gray-50/50' : 'border-transparent'}`}>
                    {c && (
                      <>
                        <div className="text-[11px] text-gray-400 text-left px-0.5">{c.d}</div>
                        <div className="flex flex-col gap-1 mt-0.5">
                          {c.idxs.map(idx => {
                            const it = items[idx]; const r = responses[idx] || {}
                            return (
                              <button key={idx} onClick={() => setOpenIdx(idx)}
                                className={`text-[11px] leading-tight rounded-md border px-1.5 py-1 text-right ${decColor(r.decision)}`}>
                                <div className="font-semibold truncate">{it.event_name}</div>
                                {r.decision ? <div className="text-[9px] opacity-90">{decLabel(r.decision)}</div> : <div className="text-[9px] opacity-70">לחצו לסימון</div>}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== MOBILE: day cards ===== */}
        <div className="md:hidden flex flex-col gap-3">
          {datesSorted.map(ds => (
            <div key={ds}>
              <div className="text-[13px] font-bold text-gray-700 mb-1.5 px-1">יום {heDow(ds)} · {fmtDate(ds)}</div>
              <div className="flex flex-col gap-2">
                {byDate[ds].map(idx => {
                  const it = items[idx]; const r = responses[idx] || {}
                  return (
                    <button key={idx} onClick={() => setOpenIdx(idx)}
                      className="bg-white border border-[#F3C9E2] rounded-xl p-3 text-right shadow-sm flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${decColor(r.decision)}`}>{r.decision ? decLabel(r.decision) : 'לסימון'}</span>
                      <span className="flex-1">
                        <span className="text-[14px] font-bold text-gray-800 block">{it.event_name}</span>
                        {it.venue ? <span className="text-[12px] text-gray-500">{it.venue}</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* no-date items fallback */}
        {byDate['no-date'] && (
          <div className="mt-3 flex flex-col gap-2">
            {byDate['no-date'].map(idx => {
              const it = items[idx]; const r = responses[idx] || {}
              return (
                <button key={idx} onClick={() => setOpenIdx(idx)} className="bg-white border border-[#F3C9E2] rounded-xl p-3 text-right shadow-sm">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${decColor(r.decision)}`}>{r.decision ? decLabel(r.decision) : 'לסימון'}</span>
                  <span className="text-[14px] font-bold text-gray-800 mr-2">{it.event_name}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="text-center text-[12px] text-gray-400 mt-6">התגובות נשמרות אוטומטית. אפשר לסגור את הדף ולחזור אליו מאוחר יותר.</div>
      </div>

      {/* ===== editor bottom sheet / modal ===== */}
      {openIdx != null && items[openIdx] && (() => {
        const idx = openIdx; const it = items[idx]; const r = responses[idx] || { decision: '', note: '' }
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setOpenIdx(null)}>
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-4 shadow-2xl" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => setOpenIdx(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 20 }} /></button>
                <div className="text-[16px] font-bold text-gray-800 text-right">{it.event_name}</div>
              </div>
              <div className="text-[12px] text-gray-500 text-right mb-3">{it.date ? `יום ${heDow(it.date)} · ${fmtDate(it.date)}` : ''}{it.venue ? ` · ${it.venue}` : ''}</div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDecision(idx, 'approve')}
                  className={`flex-1 text-[14px] py-2.5 rounded-xl border font-medium ${r.decision === 'approve' ? 'bg-yellow-400 border-yellow-400 text-yellow-950' : 'bg-white border-gray-200 text-gray-500 hover:border-yellow-400'}`}>
                  <i className="ti ti-check" /> מאשר
                </button>
                <button onClick={() => setDecision(idx, 'reject')}
                  className={`flex-1 text-[14px] py-2.5 rounded-xl border font-medium ${r.decision === 'reject' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-red-400'}`}>
                  <i className="ti ti-x" /> לא יכול
                </button>
              </div>
              {r.decision && (
                <button onClick={() => clearDecision(idx)} className="text-[12px] text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
                  <i className="ti ti-eraser" style={{ fontSize: 13 }} /> נקה בחירה
                </button>
              )}
              <textarea value={r.note || ''}
                onChange={e => setResponses(prev => ({ ...prev, [idx]: { ...(prev[idx] || { decision: '' }), note: e.target.value } }))}
                onBlur={() => saveNote(idx)}
                placeholder="הערה (לא חובה)..." rows={2}
                className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
              {savingIdx === idx && <div className="text-[11px] text-gray-400 mt-1 text-left">נשמר…</div>}
              {r.updated_at && <div className="text-[11px] text-gray-400 mt-1 text-left">עודכן: {new Date(r.updated_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
