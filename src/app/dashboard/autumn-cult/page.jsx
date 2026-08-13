'use client'
// HAZIRA-CULT-V1
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEV_ID = '1ad454b6-4087-49c8-86c6-3b6582dc1327'
const HE_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

const ASPECTS = [
  { key: 'times',   label: 'זמנים',      icon: 'ti-clock',          hint: 'לו״ז זמנים (פורמט מלא בשלב הבא)' },
  { key: 'op_crew', label: 'צוות הפעלה', icon: 'ti-users',          hint: 'צוות הפעלה (כמו לוז — בשלב הבא)' },
  { key: 'support', label: 'צוות תומך',  icon: 'ti-user-heart',     hint: 'תגיות שמות + סטטוס (בשלב הבא)' },
  { key: 'gear',    label: 'ציוד',       icon: 'ti-plug',           hint: 'רשימת ציוד + סטטוס (בשלב הבא)' },
  { key: 'notes',   label: 'הערות',      icon: 'ti-note',           hint: 'פתקית / מפרט (בשלב הבא)' },
]

function fmtCell(ds) { if (!ds) return ''; const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}` }
function dayName(ds) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d); return 'יום ' + HE_DAYS[dt.getDay()] }
function isoAdd(ds, n) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') }
function dateRange(from, to) {
  if (!from || !to) return []
  const out = []; let cur = from; let guard = 0
  while (cur <= to && guard < 400) { out.push(cur); cur = isoAdd(cur, 1); guard++ }
  return out
}

export default function CultPage() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [config, setConfig] = useState(null)
  const [prods, setProds] = useState([])
  const [newVenue, setNewVenue] = useState('')
  const [addCell, setAddCell] = useState(null)   // { venue, date }
  const [addName, setAddName] = useState('')
  const [addArtist, setAddArtist] = useState('')
  const [menuFor, setMenuFor] = useState(null)   // production id whose aspect-menu is open
  const [aspectEdit, setAspectEdit] = useState(null) // { prod, key }
  const [aspectDraft, setAspectDraft] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== DEV_ID) { setAllowed(false); setChecking(false); return }
    setAllowed(true)
    let { data: cfg } = await supabase.from('cult_config').select('*').eq('id', 1).maybeSingle()
    if (!cfg) { const { data } = await supabase.from('cult_config').upsert({ id: 1 }).select().single(); cfg = data }
    setConfig(cfg)
    const { data: p } = await supabase.from('cult_productions').select('*').order('sort_order')
    setProds(p || [])
    setChecking(false)
  }

  async function saveConfig(patch) {
    const next = { ...config, ...patch }
    setConfig(next)
    await supabase.from('cult_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
  }
  function addVenue() {
    const v = newVenue.trim(); if (!v) return
    if ((config.venues || []).includes(v)) { setNewVenue(''); return }
    saveConfig({ venues: [...(config.venues || []), v] }); setNewVenue('')
  }
  function removeVenue(v) {
    if (!window.confirm(`להסיר את "${v}" מהלוח?`)) return
    saveConfig({ venues: (config.venues || []).filter(x => x !== v) })
  }

  async function createProduction() {
    if (!addName.trim() || !addCell) return
    const { data } = await supabase.from('cult_productions')
      .insert({ name: addName.trim(), artist: addArtist.trim(), venue: addCell.venue, date: addCell.date, sort_order: prods.length, aspects: {} })
      .select().single()
    if (data) setProds(prev => [...prev, data])
    setAddCell(null); setAddName(''); setAddArtist('')
  }
  async function updateProduction(id, patch) {
    setProds(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    await supabase.from('cult_productions').update(patch).eq('id', id)
  }
  async function deleteProduction(id) {
    if (!window.confirm('למחוק את ההפקה?')) return
    await supabase.from('cult_productions').delete().eq('id', id)
    setProds(prev => prev.filter(p => p.id !== id))
    setMenuFor(null)
  }
  async function saveAspect() {
    const { prod, key } = aspectEdit
    const aspects = { ...(prod.aspects || {}), [key]: aspectDraft }
    await supabase.from('cult_productions').update({ aspects }).eq('id', prod.id)
    setProds(prev => prev.map(p => p.id === prod.id ? { ...p, aspects } : p))
    setAspectEdit(null)
  }

  if (checking) return <div dir="rtl" className="p-8 text-center text-gray-400">טוען...</div>
  if (!allowed) return (
    <div dir="rtl" className="p-10 text-center">
      <div className="text-gray-700 font-semibold">אין הרשאה</div>
      <div className="text-gray-400 text-sm mt-1">האזור הזה בפיתוח וזמין רק למנהל המערכת.</div>
    </div>
  )

  const dates = dateRange(config?.date_from, config?.date_to)
  const venues = config?.venues || []
  const cellProds = (venue, date) => prods.filter(p => p.venue === venue && p.date === date)

  return (
    <div dir="rtl" className="p-4 md:p-6 max-w-full">
      {/* header / config */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input value={config.title || ''} onChange={e => setConfig(c => ({ ...c, title: e.target.value }))} onBlur={e => saveConfig({ title: e.target.value })}
          className="text-xl md:text-2xl font-bold text-[#E0197D] bg-transparent outline-none border-b border-transparent focus:border-[#E0197D] flex-1 min-w-[200px]" />
        <span className="text-[11px] text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">בפיתוח · גלוי רק לך</span>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">מתאריך</label>
          <input type="date" value={config.date_from || ''} onChange={e => saveConfig({ date_from: e.target.value || null })}
            className="text-[13px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        </div>
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">עד תאריך</label>
          <input type="date" value={config.date_to || ''} onChange={e => saveConfig({ date_to: e.target.value || null })}
            className="text-[13px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] text-gray-400 block mb-1">אולמות</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {venues.map(v => (
              <span key={v} className="text-[12px] bg-[#FCE4F3] text-[#A0106A] rounded-lg px-2 py-1 flex items-center gap-1">
                {v}
                <button onClick={() => removeVenue(v)} className="hover:text-red-500"><i className="ti ti-x" style={{ fontSize: 12 }} /></button>
              </span>
            ))}
            <input value={newVenue} onChange={e => setNewVenue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addVenue() }}
              placeholder="+ אולם" className="text-[12px] px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] w-24" />
          </div>
        </div>
      </div>

      {/* grid */}
      {(!config.date_from || !config.date_to) ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">בחר טווח תאריכים כדי להציג את הלוח</div>
      ) : venues.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">הוסף אולמות כדי להציג את הלוח</div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 rounded-xl">
          <table className="border-collapse w-full">
            <thead>
              <tr className="bg-[#B6CFD0]">
                <th className="sticky right-0 z-10 bg-[#B6CFD0] border border-gray-300 px-3 py-2 text-[12px] font-bold text-gray-800 min-w-[90px]">אולם</th>
                {dates.map(ds => (
                  <th key={ds} className="border border-gray-300 px-3 py-2 min-w-[150px]">
                    <div className="text-[12px] font-bold text-gray-800">{fmtCell(ds)}</div>
                    <div className="text-[11px] text-gray-600">{dayName(ds)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venues.map(venue => (
                <tr key={venue}>
                  <th className="sticky right-0 z-10 bg-white border border-gray-300 px-3 py-2 text-[12px] font-bold text-gray-800 text-right">{venue}</th>
                  {dates.map(ds => (
                    <td key={ds} className="border border-gray-200 align-top p-1.5 min-w-[150px]">
                      <div className="flex flex-col gap-1">
                        {cellProds(venue, ds).map(p => (
                          <div key={p.id} className="relative">
                            <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                              className="w-full text-right bg-[#FBEAF3] hover:bg-[#F7D6E8] border border-[#E0197D]/30 rounded-lg px-2 py-1.5">
                              <div className="text-[12px] font-medium text-gray-800 leading-tight">{p.name || '(ללא שם)'}</div>
                              {p.artist && <div className="text-[11px] text-gray-500 leading-tight">{p.artist}</div>}
                            </button>
                            {menuFor === p.id && (
                              <div className="absolute z-20 mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-1 w-48">
                                <div className="px-2 py-1 flex items-center justify-between">
                                  <button onClick={() => deleteProduction(p.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
                                  <span className="text-[11px] text-gray-400">{p.name}</span>
                                </div>
                                {ASPECTS.map(a => {
                                  const has = ((p.aspects || {})[a.key] || '').trim()
                                  return (
                                    <button key={a.key} onClick={() => { setAspectEdit({ prod: p, key: a.key }); setAspectDraft((p.aspects || {})[a.key] || ''); setMenuFor(null) }}
                                      className="w-full text-right px-2 py-1.5 rounded-lg text-[13px] text-gray-700 hover:bg-[#FCE4F3] flex items-center gap-2 flex-row-reverse">
                                      <i className={`ti ${a.icon}`} style={{ fontSize: 14 }} />
                                      <span className="flex-1">{a.label}</span>
                                      {has && <span className="w-1.5 h-1.5 rounded-full bg-[#E0197D]" />}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                        <button onClick={() => { setAddCell({ venue, date: ds }); setAddName(''); setAddArtist('') }}
                          className="text-[11px] text-gray-400 hover:text-[#E0197D] border border-dashed border-gray-200 hover:border-[#E0197D] rounded-lg py-1 flex items-center justify-center gap-1">
                          <i className="ti ti-plus" style={{ fontSize: 12 }} /> הפקה
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* add production modal */}
      {addCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAddCell(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-gray-900 mb-1">הפקה חדשה</div>
            <div className="text-[12px] text-gray-400 mb-3">{addCell.venue} · {fmtCell(addCell.date)}</div>
            <input value={addName} onChange={e => setAddName(e.target.value)} autoFocus placeholder="שם ההפקה *"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <input value={addArtist} onChange={e => setAddArtist(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createProduction() }} placeholder="אמן / הרכב"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3" />
            <div className="flex gap-2">
              <button onClick={createProduction} disabled={!addName.trim()} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">הוסף</button>
              <button onClick={() => setAddCell(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* aspect editor modal */}
      {aspectEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAspectEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <button onClick={() => setAspectEdit(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">{ASPECTS.find(a => a.key === aspectEdit.key)?.label} — {aspectEdit.prod.name}</div>
            </div>
            <div className="text-[11px] text-gray-400 mb-3 text-right">{ASPECTS.find(a => a.key === aspectEdit.key)?.hint}</div>
            <textarea value={aspectDraft} onChange={e => setAspectDraft(e.target.value)} rows={8} autoFocus
              placeholder="תוכן..." className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
            <div className="flex gap-2 mt-3">
              <button onClick={saveAspect} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A]">שמור</button>
              <button onClick={() => setAspectEdit(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
