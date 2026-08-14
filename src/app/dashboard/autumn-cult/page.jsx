'use client'
// HAZIRA-CULT-V15
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const DEV_ID = '1ad454b6-4087-49c8-86c6-3b6582dc1327'
const HE_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

const ASPECTS = [
  { key: 'times',  label: 'זמנים',      icon: 'ti-clock', hint: 'לו״ז זמנים (פורמט מלא בשלב הבא)' },
  { key: 'crew',   label: 'צוות',        icon: 'ti-users' },
  { key: 'opcrew', label: 'צוות תפעול',  icon: 'ti-briefcase' },
  { key: 'gear',   label: 'ציוד',        icon: 'ti-plug', hint: 'רשימת ציוד + סטטוס (בשלב הבא)' },
  { key: 'notes',  label: 'הערות',       icon: 'ti-note', hint: 'פתקית / מפרט (בשלב הבא)' },
]

const CREW_ROWS = [
  { key: 'operation', label: 'צוות הפעלה' },
  { key: 'setup',     label: 'צוות הקמה' },
  { key: 'strike',    label: 'צוות פירוק' },
]
const OP_ROWS = [
  { key: 'night_mgmt', label: 'ניהול ערב' },
  { key: 'bar',        label: 'בר' },
  { key: 'cashier',    label: 'קופה' },
]
const CREW_MODES = {
  crew:   { key: 'crew',   rows: CREW_ROWS, label: 'צוות' },
  opcrew: { key: 'opcrew', rows: OP_ROWS,   label: 'צוות תפעול' },
}
const CULT_STATUSES = [
  { value: 'white',  label: 'לא נבדק', bg: '#F3F4F6', text: '#4B5563' },
  { value: 'green',  label: 'מוכן',    bg: '#DCFCE7', text: '#166534' },
  { value: 'teal',   label: 'ממתין',   bg: '#CCFBF1', text: '#0F766E' },
  { value: 'yellow', label: 'אישר',    bg: '#FEF9C3', text: '#854D0E' },
  { value: 'red',    label: 'לא יכול', bg: '#FEE2E2', text: '#991B1B' },
  { value: 'purple', label: 'לבירור',  bg: '#F3E8FF', text: '#6B21A8' },
]
const cultStatus = v => CULT_STATUSES.find(s => s.value === v) || CULT_STATUSES[0]
const newTagId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const KIND = {
  production: { label: 'הפקה',  bg: '#FBEAF3', border: 'rgba(224,25,125,0.35)' },
  action:     { label: 'פעולה', bg: '#DBEAFE', border: 'rgba(37,99,235,0.45)' },
}
const kindOf = p => KIND[p?.kind] || KIND.production

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
  const [kindFilter, setKindFilter] = useState('all')
  const [showVenues, setShowVenues] = useState(false)
  const [addCell, setAddCell] = useState(null)   // { date }
  const [addName, setAddName] = useState('')
  const [addArtist, setAddArtist] = useState('')
  const [addVenue, setAddVenue] = useState('')
  const [addTime, setAddTime] = useState('')
  const [addKind, setAddKind] = useState('production')
  const [menuFor, setMenuFor] = useState(null)   // production id whose aspect-menu is open
  const [aspectEdit, setAspectEdit] = useState(null) // { prod, key }
  const [aspectDraft, setAspectDraft] = useState('')
  const [crewFor, setCrewFor] = useState(null)       // production whose crew window is open
  const [crewMode, setCrewMode] = useState('crew')   // 'crew' | 'opcrew'
  const [crew, setCrew] = useState({})
  const [crewAdd, setCrewAdd] = useState({ operation: '', setup: '', strike: '' })
  const [crewEditing, setCrewEditing] = useState(null) // { row, id }
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats] = useState([])
  const [allItems, setAllItems] = useState([])
  const [gearFor, setGearFor] = useState(null)          // production whose gear window is open
  const [gear, setGear] = useState([])                  // [{ equipment_item_id, quantity }]
  const [gearOpenCat, setGearOpenCat] = useState(null)
  const [gearOpenSub, setGearOpenSub] = useState(null)
  const [timesFor, setTimesFor] = useState(null)   // production whose times (rundown) window is open
  const [times, setTimes] = useState([])           // [{ id, time, what, who, notes }]
  const [editProd, setEditProd] = useState(null)
  const [editName, setEditName] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editKind, setEditKind] = useState('production')
  const [conflictDay, setConflictDay] = useState(null)
  const [crewDayFor, setCrewDayFor] = useState(null)
  const [dayNoteFor, setDayNoteFor] = useState(null)
  const [dayNoteDraft, setDayNoteDraft] = useState('')
  const dragId = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const res = await supabase.auth.getUser().catch(() => null)
      const user = res?.data?.user
      if (!user || user.id !== DEV_ID) { setAllowed(false); setChecking(false); return }
      setAllowed(true)
      let cfg = null
      try {
        const r = await supabase.from('cult_config').select('*').eq('id', 1).maybeSingle()
        cfg = r.data
        if (!cfg) { const up = await supabase.from('cult_config').upsert({ id: 1 }).select().single(); cfg = up.data }
      } catch (e) {}
      setConfig(cfg || { id: 1, title: 'פולחן הסתיו 2026', venues: [], day_notes: {}, date_from: null, date_to: null })
      try {
        const { data: p } = await supabase.from('cult_productions').select('*').order('sort_order')
        setProds(p || [])
      } catch (e) { setProds([]) }
      try {
        const [{ data: cats }, { data: subs }, { data: items }] = await Promise.all([
          supabase.from('equipment_categories').select('*').order('sort_order'),
          supabase.from('equipment_subcategories').select('*').order('sort_order'),
          supabase.from('equipment_items').select('*').order('name'),
        ])
        setCategories(cats || []); setSubcats(subs || []); setAllItems(items || [])
      } catch (e) {}
    } catch (e) {
      setAllowed(false)
    } finally {
      setChecking(false)
    }
  }

  async function saveConfig(patch) {
    const next = { ...config, ...patch }
    setConfig(next)
    await supabase.from('cult_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
  }
  function addConfigVenue() {
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
      .insert({ name: addName.trim(), artist: addArtist.trim(), venue: addVenue || null, time: addTime || null, kind: addKind, date: addCell.date, sort_order: prods.length, aspects: {} })
      .select().single()
    if (data) setProds(prev => [...prev, data])
    setAddCell(null); setAddName(''); setAddArtist(''); setAddVenue(''); setAddTime('')
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

  // ---- crew window ----
  function openCrew(prod, mode = 'crew') {
    const def = CREW_MODES[mode]
    setCrewMode(mode)
    setCrewFor(prod)
    const c = prod.aspects?.[def.key] || {}
    setCrew(Object.fromEntries(def.rows.map(r => [r.key, c[r.key] || []])))
    setCrewAdd(Object.fromEntries(def.rows.map(r => [r.key, ''])))
    setCrewEditing(null)
  }
  async function saveCrew(next) {
    const key = CREW_MODES[crewMode].key
    const aspects = { ...(crewFor.aspects || {}), [key]: next }
    await supabase.from('cult_productions').update({ aspects }).eq('id', crewFor.id)
    setProds(prev => prev.map(p => p.id === crewFor.id ? { ...p, aspects } : p))
    setCrewFor(cf => cf ? { ...cf, aspects } : cf)
  }
  function mutateCrew(next) { setCrew(next); saveCrew(next) }
  function addCrew(row) {
    const name = (crewAdd[row] || '').trim(); if (!name) return
    mutateCrew({ ...crew, [row]: [...(crew[row] || []), { id: newTagId(), name, status: 'white', note: '' }] })
    setCrewAdd(a => ({ ...a, [row]: '' }))
  }
  function updateTag(row, id, patch) {
    mutateCrew({ ...crew, [row]: crew[row].map(t => t.id === id ? { ...t, ...patch } : t) })
  }
  function deleteTag(row, id) {
    mutateCrew({ ...crew, [row]: crew[row].filter(t => t.id !== id) })
    setCrewEditing(null)
  }

  // ---- gear window (equipment spec) ----
  function openGear(prod) {
    setGearFor(prod)
    setGear(prod.aspects?.gear || [])
    setGearOpenCat(null); setGearOpenSub(null)
  }
  async function saveGear(next) {
    const aspects = { ...(gearFor.aspects || {}), gear: next }
    await supabase.from('cult_productions').update({ aspects }).eq('id', gearFor.id)
    setProds(prev => prev.map(p => p.id === gearFor.id ? { ...p, aspects } : p))
    setGearFor(gf => gf ? { ...gf, aspects } : gf)
  }
  const inGear = itemId => gear.some(g => g.equipment_item_id === itemId)
  function toggleGear(item) {
    const exists = gear.some(g => g.equipment_item_id === item.id)
    const next = exists ? gear.filter(g => g.equipment_item_id !== item.id) : [...gear, { equipment_item_id: item.id, quantity: '1' }]
    setGear(next); saveGear(next)
  }
  function gearQtyLocal(itemId, qty) { setGear(prev => prev.map(g => g.equipment_item_id === itemId ? { ...g, quantity: qty } : g)) }

  // ---- times window (rundown) ----
  function openTimes(prod) {
    setTimesFor(prod)
    setTimes(prod.aspects?.times || [])
  }
  async function saveTimes(next) {
    const aspects = { ...(timesFor.aspects || {}), times: next }
    await supabase.from('cult_productions').update({ aspects }).eq('id', timesFor.id)
    setProds(prev => prev.map(p => p.id === timesFor.id ? { ...p, aspects } : p))
    setTimesFor(tf => tf ? { ...tf, aspects } : tf)
  }
  function addTimeRow() {
    const next = [...times, { id: newTagId(), time: '', what: '', who: '', notes: '' }]
    setTimes(next); saveTimes(next)
  }
  function updateTimeLocal(id, field, val) { setTimes(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r)) }
  function deleteTimeRow(id) {
    const next = times.filter(r => r.id !== id)
    setTimes(next); saveTimes(next)
  }
  function moveTimeRow(index, dir) {
    const next = [...times]; const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setTimes(next); saveTimes(next)
  }

  // ---- edit production ----
  function openEdit(p) { setEditProd(p); setEditName(p.name || ''); setEditArtist(p.artist || ''); setEditVenue(p.venue || ''); setEditTime(p.time || ''); setEditKind(p.kind || 'production') }
  async function saveEdit() {
    if (!editProd) return
    await updateProduction(editProd.id, { name: editName.trim(), artist: editArtist.trim(), venue: editVenue || null, time: editTime || null, kind: editKind })
    setEditProd(null)
  }

  // ---- day summaries ----
  function dayGearConflicts(ds) {
    const map = {}
    prods.filter(p => p.date === ds).forEach(p => (p.aspects?.gear || []).forEach(g => {
      const qty = parseInt(g.quantity || 0) || 0
      if (!map[g.equipment_item_id]) map[g.equipment_item_id] = { total: 0, entries: [] }
      map[g.equipment_item_id].total += qty
      map[g.equipment_item_id].entries.push({ name: p.name, qty })
    }))
    return Object.entries(map).map(([itemId, d]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : null
      return { item, total: d.total, entries: d.entries, stock, over: stock != null && d.total > stock }
    }).filter(x => x.item).sort((a, b) => (b.over ? 1 : 0) - (a.over ? 1 : 0) || b.total - a.total)
  }
  function dayCrewByKey(ds, key, rows) {
    const byName = {}
    prods.filter(p => p.date === ds).forEach(p => {
      const c = p.aspects?.[key] || {}
      rows.forEach(r => (c[r.key] || []).forEach(t => {
        if (!t.name) return
        if (!byName[t.name]) byName[t.name] = []
        byName[t.name].push({ role: r.label, prod: p.name, status: t.status, note: t.note })
      }))
    })
    return byName
  }
  function dayCrew(ds) { return dayCrewByKey(ds, 'crew', CREW_ROWS) }
  function dayOpCrew(ds) { return dayCrewByKey(ds, 'opcrew', OP_ROWS) }
  async function saveDayNote(ds, val) {
    const dn = { ...(config.day_notes || {}), [ds]: val }
    setConfig(c => ({ ...c, day_notes: dn }))
    await supabase.from('cult_config').update({ day_notes: dn, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  if (checking) return <div dir="rtl" className="p-8 text-center text-gray-400">טוען...</div>
  if (!allowed) return (
    <div dir="rtl" className="p-10 text-center">
      <div className="text-gray-700 font-semibold">אין הרשאה</div>
      <div className="text-gray-400 text-sm mt-1">האזור הזה בפיתוח וזמין רק למנהל המערכת.</div>
    </div>
  )
  if (!config) return <div dir="rtl" className="p-8 text-center text-gray-400">טוען...</div>

  const dates = dateRange(config?.date_from, config?.date_to)
  const venues = config?.venues || []
  const timeToMin = t => { if (!t) return 99999; const m = String(t).match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 99999 }
  const sortKey = p => (p.manual_order != null ? p.manual_order : timeToMin(p.time))
  const cellProds = date => prods.filter(p => p.date === date && (kindFilter === 'all' || (p.kind || 'production') === kindFilter)).sort((a, b) => sortKey(a) - sortKey(b))
  const isWeekend = ds => { const dow = new Date(ds + 'T00:00:00').getDay(); return dow === 5 || dow === 6 }

  function onCardDrop(date, targetId) {
    const id = dragId.current
    dragId.current = null
    if (!id || id === targetId) return
    const dragged = prods.find(p => p.id === id)
    if (!dragged || dragged.date !== date) return // גרירה רק בתוך אותו יום
    const col = prods.filter(p => p.date === date).sort((a, b) => sortKey(a) - sortKey(b))
    const ids = col.map(p => p.id).filter(x => x !== id)
    const ti = ids.indexOf(targetId)
    if (ti < 0) return
    ids.splice(ti, 0, id)
    const orderMap = {}; ids.forEach((pid, i) => { orderMap[pid] = i })
    setProds(prev => prev.map(p => p.id in orderMap ? { ...p, manual_order: orderMap[p.id] } : p))
    Promise.all(ids.map((pid, i) => supabase.from('cult_productions').update({ manual_order: i }).eq('id', pid)))
  }

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
        <div className="flex-1 min-w-[200px] flex items-end justify-between gap-2 flex-wrap">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">תצוגה</label>
            <div className="flex items-center border border-[#E0197D] rounded-lg overflow-hidden">
              {[['all', 'הכל'], ['production', 'הפקות'], ['action', 'פעולות']].map(([v, l]) => (
                <button key={v} onClick={() => setKindFilter(v)} className={`text-[12px] px-3 py-1.5 ${kindFilter === v ? 'bg-[#E0197D] text-white' : 'bg-white text-[#E0197D] hover:bg-[#FCE4F3]'}`}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowVenues(s => !s)} className="text-[12px] text-gray-500 hover:text-[#E0197D] flex items-center gap-1 pb-1.5">
            <i className="ti ti-settings" style={{ fontSize: 14 }} /> אולמות
          </button>
        </div>
      </div>

      {showVenues && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
          <label className="text-[11px] text-gray-400 block mb-1.5">ניהול אולמות (לבורר בכרטיס)</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {venues.map(v => (
              <span key={v} className="text-[12px] bg-[#FCE4F3] text-[#A0106A] rounded-lg px-2 py-1 flex items-center gap-1">
                {v}
                <button onClick={() => removeVenue(v)} className="hover:text-red-500"><i className="ti ti-x" style={{ fontSize: 12 }} /></button>
              </span>
            ))}
            <input value={newVenue} onChange={e => setNewVenue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addConfigVenue() }}
              placeholder="+ אולם" className="text-[12px] px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] w-24" />
          </div>
        </div>
      )}

      {/* grid */}
      {(!config.date_from || !config.date_to) ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">בחר טווח תאריכים כדי להציג את הלוח</div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 rounded-xl">
          <table className="border-collapse w-full">
            <thead>
              <tr className="bg-[#B6CFD0]">
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  return (
                    <th key={ds} className={`border border-gray-300 ${we ? 'px-1 py-2 w-9 min-w-[34px]' : 'px-3 py-2 min-w-[160px]'}`}>
                      {we ? (
                        <>
                          <div className="text-[11px] font-bold text-gray-500">{dayName(ds).replace('יום ', '')}׳</div>
                          <div className="text-[9px] text-gray-400 whitespace-nowrap">{ds.split('-')[2]}/{ds.split('-')[1]}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[12px] font-bold text-gray-800">{fmtCell(ds)}</div>
                          <div className="text-[11px] text-gray-600">{dayName(ds)}</div>
                        </>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  return (
                    <td key={ds} className={`border border-gray-200 align-top ${we ? 'p-0.5 w-9 min-w-[34px] bg-gray-50/50' : 'p-1.5 min-w-[160px]'}`}>
                      <div className="flex flex-col gap-1">
                        {cellProds(ds).map(p => {
                          const k = kindOf(p)
                          return (
                          <div key={p.id} className="relative"
                            draggable onDragStart={() => { dragId.current = p.id }} onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
                            onDragOver={e => { e.preventDefault(); if (dragId.current && dragId.current !== p.id) setDragOverId(p.id) }}
                            onDragLeave={() => setDragOverId(prev => (prev === p.id ? null : prev))}
                            onDrop={() => { onCardDrop(ds, p.id); setDragOverId(null) }}>
                            {dragOverId === p.id && <div className="h-0.5 bg-[#E0197D] rounded-full mb-1" />}
                            <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                              style={{ backgroundColor: k.bg, borderColor: k.border }}
                              className="w-full text-right border rounded-lg px-2 py-1.5 hover:brightness-95 transition cursor-grab active:cursor-grabbing">
                              {(p.time || p.venue) && (
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  {p.time && <span className="text-[11px] font-mono font-bold text-[#A0106A]">{p.time}</span>}
                                  {p.venue && <span className="text-[10px] bg-[#B6CFD0] text-gray-700 rounded px-1.5 py-0.5 mr-auto">{p.venue}</span>}
                                </div>
                              )}
                              <div className="text-[12px] font-medium text-gray-800 leading-tight">{p.name || '(ללא שם)'}</div>
                              {p.artist && <div className="text-[11px] text-gray-500 leading-tight">{p.artist}</div>}
                            </button>
                            {menuFor === p.id && (
                              <div className="absolute z-20 mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-1 w-48">
                                <div className="px-2 py-1 flex items-center justify-between">
                                  <div className="flex gap-1">
                                    <button onClick={() => { openEdit(p); setMenuFor(null) }} className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-pencil" style={{ fontSize: 13 }} /></button>
                                    <button onClick={() => deleteProduction(p.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
                                  </div>
                                  <span className="text-[11px] text-gray-400">{p.name}</span>
                                </div>
                                {ASPECTS.map(a => {
                                  const has = a.key === 'crew'
                                    ? ['operation','setup','strike'].some(k => (((p.aspects||{}).crew||{})[k]||[]).length)
                                    : a.key === 'opcrew'
                                    ? ['night_mgmt','bar','cashier'].some(k => (((p.aspects||{}).opcrew||{})[k]||[]).length)
                                    : a.key === 'gear'
                                    ? ((p.aspects||{}).gear||[]).length
                                    : a.key === 'times'
                                    ? ((p.aspects||{}).times||[]).length
                                    : ((p.aspects || {})[a.key] || '').trim()
                                  return (
                                    <button key={a.key} onClick={() => { if (a.key === 'crew') { openCrew(p, 'crew') } else if (a.key === 'opcrew') { openCrew(p, 'opcrew') } else if (a.key === 'gear') { openGear(p) } else if (a.key === 'times') { openTimes(p) } else { setAspectEdit({ prod: p, key: a.key }); setAspectDraft((p.aspects || {})[a.key] || '') } setMenuFor(null) }}
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
                          )
                        })}
                        <button onClick={() => { setAddCell({ date: ds }); setAddName(''); setAddArtist(''); setAddVenue(''); setAddTime(''); setAddKind(kindFilter === 'action' ? 'action' : 'production') }}
                          title={we ? 'הוסף הפקה' : undefined}
                          className={`text-gray-400 hover:text-[#E0197D] border border-dashed border-gray-200 hover:border-[#E0197D] rounded-lg flex items-center justify-center gap-1 ${we ? 'py-0.5 text-[10px]' : 'py-1 text-[11px]'}`}>
                          <i className="ti ti-plus" style={{ fontSize: 12 }} />{!we && ' הפקה'}
                        </button>
                      </div>
                    </td>
                  )
                })}
              </tr>
              {/* daily summary — aligned columns under each day */}
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-gray-200 border-t-2 border-t-[#B6CFD0] bg-gray-50/50" />
                  const names = Object.keys(dayCrew(ds))
                  const opNames = Object.keys(dayOpCrew(ds))
                  return (
                    <td key={ds} className="border border-gray-200 border-t-2 border-t-[#B6CFD0] align-top p-1.5 min-w-[160px] bg-[#F6FBFB]">
                      <button onClick={() => setCrewDayFor({ ds, mode: 'crew' })} className="w-full text-right mb-1.5">
                        <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><i className="ti ti-users" style={{ fontSize: 11 }} /> צוות ({names.length})</div>
                        <div className="text-[11px] text-gray-700 leading-snug break-words">{names.length ? names.join(', ') : <span className="text-gray-300">—</span>}</div>
                      </button>
                      <button onClick={() => setCrewDayFor({ ds, mode: 'opcrew' })} className="w-full text-right pt-1.5 border-t border-gray-100">
                        <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><i className="ti ti-briefcase" style={{ fontSize: 11 }} /> צוות תפעול ({opNames.length})</div>
                        <div className="text-[11px] text-gray-700 leading-snug break-words">{opNames.length ? opNames.join(', ') : <span className="text-gray-300">—</span>}</div>
                      </button>
                    </td>
                  )
                })}
              </tr>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-gray-200 bg-gray-50/50" />
                  return (
                    <td key={ds} className="border border-gray-200 align-top p-1 min-w-[160px]">
                      <textarea defaultValue={(config.day_notes || {})[ds] || ''} onBlur={e => saveDayNote(ds, e.target.value)}
                        placeholder="הערות יום…" rows={2}
                        className="w-full text-[11px] px-2 py-1 border border-gray-100 rounded-lg bg-[#FFFDF5] outline-none focus:border-[#E0197D] text-right resize-y" />
                    </td>
                  )
                })}
              </tr>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-gray-200 bg-gray-50/50" />
                  return (
                    <td key={ds} className="border border-gray-200 p-1.5 min-w-[160px]">
                      <button onClick={() => setConflictDay(ds)} className="w-full text-[11px] px-2 py-1 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center justify-center gap-1">
                        <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> התנגשויות
                      </button>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* add production modal */}
      {addCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAddCell(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-gray-900 mb-1">{KIND[addKind].label} חדשה</div>
            <div className="text-[12px] text-gray-400 mb-3">{fmtCell(addCell.date)}</div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-3 text-[13px]">
              {['production', 'action'].map(kk => (
                <button key={kk} onClick={() => setAddKind(kk)}
                  className={`flex-1 py-1.5 ${addKind === kk ? (kk === 'action' ? 'bg-[#2563EB] text-white' : 'bg-[#E0197D] text-white') : 'bg-white text-gray-500'}`}>{KIND[kk].label}</button>
              ))}
            </div>
            <input value={addName} onChange={e => setAddName(e.target.value)} autoFocus placeholder="כותרת *"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <input value={addArtist} onChange={e => setAddArtist(e.target.value)} placeholder="אמן / הרכב"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <div className="flex gap-2 mb-3">
              <select value={addVenue} onChange={e => setAddVenue(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right">
                <option value="">אולם…</option>
                {venues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createProduction() }}
                className="w-28 text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
            </div>
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
      {/* crew window */}
      {crewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => { setCrewFor(null); setCrewEditing(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setCrewFor(null); setCrewEditing(null) }} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">{CREW_MODES[crewMode].label} — {crewFor.name}</div>
            </div>
            {CREW_MODES[crewMode].rows.map(row => (
              <div key={row.key} className="mb-4">
                <div className="text-[12px] font-semibold text-gray-600 mb-1.5 text-right">{row.label}</div>
                <div className="flex flex-wrap gap-1.5 items-center justify-end">
                  <input value={crewAdd[row.key] || ''} onChange={e => setCrewAdd(a => ({ ...a, [row.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addCrew(row.key) }}
                    placeholder="+ שם" className="text-[12px] px-2 py-1 border border-dashed border-gray-300 rounded-lg outline-none focus:border-[#E0197D] w-24 text-right" />
                  {(crew[row.key] || []).map(tag => {
                    const st = cultStatus(tag.status)
                    return (
                      <button key={tag.id} onClick={() => setCrewEditing({ row: row.key, id: tag.id })}
                        style={{ backgroundColor: st.bg, color: st.text }}
                        className="text-[12px] rounded-lg px-2.5 py-1 flex items-center gap-1">
                        {tag.name}
                        {(tag.note || '').trim() && <i className="ti ti-message-dots" style={{ fontSize: 11 }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* crew tag editor (status + note) */}
      {crewFor && crewEditing && (() => {
        const tag = (crew[crewEditing.row] || []).find(t => t.id === crewEditing.id)
        if (!tag) return null
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setCrewEditing(null)}>
            <div className="bg-white rounded-2xl w-full max-w-xs p-4" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCrewEditing(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
                <div className="text-[14px] font-semibold text-gray-800">{tag.name}</div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {CULT_STATUSES.map(s => (
                  <button key={s.value} onClick={() => updateTag(crewEditing.row, tag.id, { status: s.value })}
                    style={{ backgroundColor: s.bg, color: s.text, outline: tag.status === s.value ? '2px solid #E0197D' : 'none', outlineOffset: '1px' }}
                    className="text-[11px] rounded-lg px-1 py-1.5">{s.label}</button>
                ))}
              </div>
              <textarea value={tag.note || ''} onChange={e => updateTag(crewEditing.row, tag.id, { note: e.target.value })}
                placeholder="הערה..." rows={3}
                className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y mb-3" />
              <div className="flex justify-between items-center">
                <button onClick={() => deleteTag(crewEditing.row, tag.id)} className="text-[12px] text-red-500 hover:underline flex items-center gap-1"><i className="ti ti-trash" style={{ fontSize: 13 }} /> מחק</button>
                <button onClick={() => setCrewEditing(null)} className="text-[13px] bg-[#E0197D] text-white px-4 py-1.5 rounded-lg hover:bg-[#A0106A]">סיום</button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* gear window — equipment spec (like building a spec in Specs area) */}
      {gearFor && (() => {
        const gearDisplay = gear.map(g => {
          const item = allItems.find(i => i.id === g.equipment_item_id)
          const sub = subcats.find(s => s.id === item?.subcategory_id)
          const cat = categories.find(c => c.id === sub?.category_id)
          return item ? { ...g, item, sub, cat } : null
        }).filter(Boolean)
        const gearByCat = categories.map(cat => ({ cat, items: gearDisplay.filter(s => s.cat?.id === cat.id) })).filter(x => x.items.length)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setGearFor(null)}>
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button onClick={() => setGearFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">ציוד — {gearFor.name} <span className="text-[12px] text-gray-400 font-normal">({gear.length} פריטים)</span></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4">
                {/* catalog */}
                <div className="w-full md:w-72 flex-shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden self-start">
                  <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-gray-100">לקט ציוד</div>
                  {categories.map(cat => {
                    const catSubs = subcats.filter(s => s.category_id === cat.id)
                    const isOpen = gearOpenCat === cat.id
                    return (
                      <div key={cat.id}>
                        <button onClick={() => setGearOpenCat(isOpen ? null : cat.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium border-b border-gray-50 flex-row-reverse ${isOpen ? 'text-[#E0197D] bg-[#FCE4F3]' : 'text-gray-700 hover:bg-gray-50'}`}>
                          <span>{cat.name}</span>
                          <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{ fontSize: 11 }} />
                        </button>
                        {isOpen && catSubs.map(sub => {
                          const items = allItems.filter(i => i.subcategory_id === sub.id)
                          const isSubOpen = gearOpenSub === sub.id
                          return (
                            <div key={sub.id}>
                              <button onClick={() => setGearOpenSub(isSubOpen ? null : sub.id)}
                                className={`w-full flex items-center justify-between px-5 py-2 text-[11px] border-b border-gray-50 flex-row-reverse ${isSubOpen ? 'text-[#E0197D]' : 'text-gray-500 hover:bg-gray-50'}`}>
                                <span>{sub.name}</span>
                                <i className={`ti ${isSubOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{ fontSize: 10 }} />
                              </button>
                              {isSubOpen && items.map(item => {
                                const on = inGear(item.id)
                                return (
                                  <button key={item.id} onClick={() => toggleGear(item)}
                                    className={`w-full flex items-center gap-2 px-6 py-1.5 text-[11px] border-b border-gray-50 flex-row-reverse text-right transition-colors ${on ? 'bg-[#E1F5EE] text-[#085041]' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <i className={`ti ${on ? 'ti-circle-check' : 'ti-circle-plus'} flex-shrink-0`} style={{ fontSize: 13, color: on ? '#22c55e' : '#E0197D' }} />
                                    <span className="flex-1 truncate">{item.name}</span>
                                    {item.units && <span className="text-gray-400">×{item.units}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {/* selected spec */}
                <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl overflow-hidden self-start">
                  {gearDisplay.length === 0 ? (
                    <div className="text-center text-[13px] text-gray-400 py-10">
                      <div className="mb-1">אין פריטים</div>
                      <div className="text-[12px] text-gray-300">בחר פריטים מהקטלוג משמאל</div>
                    </div>
                  ) : gearByCat.map(({ cat, items }) => (
                    <div key={cat.id}>
                      <div className="px-4 py-2 bg-[#FCE4F3] text-[11px] font-semibold text-[#E0197D] text-right">{cat.name}</div>
                      {items.map(s => (
                        <div key={s.equipment_item_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                          <span className="flex-1 text-[13px] text-right text-gray-800">{s.item.name}</span>
                          {s.sub && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.sub.name}</span>}
                          <div className="flex flex-col items-center gap-0.5">
                            <input type="number" min="1" max={s.item.units ? parseInt(s.item.units) : undefined}
                              value={s.quantity || ''}
                              onChange={e => gearQtyLocal(s.equipment_item_id, e.target.value)}
                              onBlur={() => saveGear(gear)}
                              placeholder="כמות"
                              className={`w-16 text-[11px] px-2 py-1 border rounded-lg bg-white outline-none text-center ${s.item.units && parseInt(s.quantity) > parseInt(s.item.units) ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 focus:border-[#E0197D]'}`} />
                            {s.item.units && (
                              <span className={`text-[9px] ${parseInt(s.quantity) > parseInt(s.item.units) ? 'text-red-500 font-bold' : 'text-gray-400'}`}>מלאי: {s.item.units}</span>
                            )}
                          </div>
                          <button onClick={() => toggleGear(s.item)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {/* times window — rundown (like building a rundown in Rundowns area) */}
      {timesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setTimesFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <button onClick={() => setTimesFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">זמנים — {timesFor.name}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid gap-0 bg-[#E0197D] text-white text-[12px] font-semibold grid-cols-[100px_2fr_1.5fr_1fr_36px]">
                  <div className="px-3 py-2.5 text-right">שעה</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
                  <div className="px-2 py-2.5" />
                </div>
                {times.length === 0 && (
                  <div className="text-center text-[13px] text-gray-400 py-8">לחץ על "הוסף שורה" כדי להתחיל</div>
                )}
                {times.map((row, index) => (
                  <div key={row.id} className={`grid gap-0 border-b border-gray-50 group grid-cols-[100px_2fr_1.5fr_1fr_36px] ${index % 2 === 0 ? 'bg-white' : 'bg-[#FFF8F8]'}`}>
                    <textarea value={row.time || ''} onChange={e => updateTimeLocal(row.id, 'time', e.target.value)} onBlur={() => saveTimes(times)} wrap="off"
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono resize-none w-full leading-5 whitespace-nowrap" rows={1} />
                    <textarea value={row.what || ''} onChange={e => updateTimeLocal(row.id, 'what', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.what || '').length / 30))} />
                    <textarea value={row.who || ''} onChange={e => updateTimeLocal(row.id, 'who', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.who || '').length / 20))} />
                    <textarea value={row.notes || ''} onChange={e => updateTimeLocal(row.id, 'notes', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500 resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.notes || '').length / 20))} />
                    <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveTimeRow(index, -1)} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5"><i className="ti ti-chevron-up" style={{ fontSize: 11 }} /></button>
                      <button onClick={() => deleteTimeRow(row.id)} className="text-gray-300 hover:text-red-500 p-0.5"><i className="ti ti-trash" style={{ fontSize: 11 }} /></button>
                      <button onClick={() => moveTimeRow(index, 1)} disabled={index === times.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5"><i className="ti ti-chevron-down" style={{ fontSize: 11 }} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addTimeRow} className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                  <i className="ti ti-plus" style={{ fontSize: 13 }} /> הוסף שורה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* daily summary rows */}
      {/* edit production modal */}
      {editProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditProd(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-gray-900 mb-3">עריכת {KIND[editKind].label}</div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-3 text-[13px]">
              {['production', 'action'].map(kk => (
                <button key={kk} onClick={() => setEditKind(kk)}
                  className={`flex-1 py-1.5 ${editKind === kk ? (kk === 'action' ? 'bg-[#2563EB] text-white' : 'bg-[#E0197D] text-white') : 'bg-white text-gray-500'}`}>{KIND[kk].label}</button>
              ))}
            </div>
            <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus placeholder="כותרת *"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <input value={editArtist} onChange={e => setEditArtist(e.target.value)} placeholder="אמן / הרכב"
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <div className="flex gap-2 mb-3">
              <select value={editVenue} onChange={e => setEditVenue(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right">
                <option value="">אולם…</option>
                {venues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                className="w-28 text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={!editName.trim()} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">שמור</button>
              <button onClick={() => setEditProd(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* equipment conflicts for a day */}
      {conflictDay && (() => {
        const list = dayGearConflicts(conflictDay)
        const conflicts = list.filter(x => x.over).length
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConflictDay(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button onClick={() => setConflictDay(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">התנגשויות ציוד — {dayName(conflictDay)} {fmtCell(conflictDay)}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {list.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-[13px]">אין ציוד משובץ ליום זה</div>
                ) : (
                  <>
                    <div className={`text-[12px] mb-3 ${conflicts ? 'text-red-600 font-semibold' : 'text-green-700'}`}>
                      {conflicts ? `${conflicts} פריטים חורגים מהמלאי` : 'אין חריגות מלאי ✓'}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {list.map(row => (
                        <div key={row.item.id} className={`rounded-lg border px-3 py-2 ${row.over ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {row.over && <i className="ti ti-alert-triangle text-red-500" style={{ fontSize: 14 }} />}
                              <span className="text-[13px] font-medium text-gray-800">{row.item.name}</span>
                            </div>
                            <span className={`text-[12px] ${row.over ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                              סה״כ {row.total}{row.stock != null ? ` / מלאי ${row.stock}` : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1 text-right">{row.entries.map(e => `${e.name} (${e.qty})`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* crew of a day */}
      {crewDayFor && (() => {
        const cd = crewDayFor
        const def = CREW_MODES[cd.mode] || CREW_MODES.crew
        const byName = dayCrewByKey(cd.ds, def.key, def.rows)
        const names = Object.keys(byName).sort((a, b) => a.localeCompare(b, 'he'))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setCrewDayFor(null)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button onClick={() => setCrewDayFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">{def.label} — {dayName(cd.ds)} {fmtCell(cd.ds)} <span className="text-[12px] text-gray-400 font-normal">({names.length})</span></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {names.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-[13px]">אין צוות משובץ ליום זה</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {names.map(name => {
                      const roles = byName[name]
                      const multi = roles.length > 1
                      return (
                        <div key={name} className={`rounded-lg border px-3 py-2 ${multi ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                          <div className="text-[13px] font-medium text-gray-800 flex items-center gap-2">
                            {name}
                            {multi && <span className="text-[10px] bg-amber-200 text-amber-800 rounded-full px-1.5">×{roles.length}</span>}
                          </div>
                          {roles.map((r, i) => (
                            <div key={i} className="text-[11px] text-gray-500 mt-0.5">{r.role} · {r.prod}{(r.note || '').trim() ? ` — ${r.note}` : ''}</div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* general notes for a day */}
      {dayNoteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setDayNoteFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setDayNoteFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">הערות יום — {dayName(dayNoteFor)} {fmtCell(dayNoteFor)}</div>
            </div>
            <textarea value={dayNoteDraft} onChange={e => setDayNoteDraft(e.target.value)} rows={8} autoFocus placeholder="הערות כלליות ליום זה..."
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { saveDayNote(dayNoteFor, dayNoteDraft); setDayNoteFor(null) }} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A]">שמור</button>
              <button onClick={() => setDayNoteFor(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
