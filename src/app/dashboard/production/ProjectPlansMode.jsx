'use client'
// HAZIRA-PROJPLANS-V5
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function fmtDay(ds) {
  if (!ds) return 'ללא תאריך'
  const [y, m, d] = String(ds).split('-').map(Number)
  if (!y || !m || !d) return 'ללא תאריך'
  const dt = new Date(y, m - 1, d)
  return 'יום ' + HE_DAYS[dt.getDay()] + ' · ' + d + ' ' + HE_MONTHS[m - 1]
}

function fmtShort(ds) {
  if (!ds) return '—'
  const [y, m, d] = String(ds).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return d + '/' + m
}

function todayISO() {
  const t = new Date()
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')
}

const PLAN_STATUSES = [
  { value: 'draft',  label: 'טיוטה',  color: 'bg-gray-100 text-gray-600' },
  { value: 'active', label: 'פעיל',   color: 'bg-green-100 text-green-700' },
  { value: 'done',   label: 'הושלם',  color: 'bg-blue-100 text-blue-700' },
]
const getPlanStatus = v => PLAN_STATUSES.find(s => s.value === v) || PLAN_STATUSES[0]

// קטגוריית יום — צובעת את כותרת העמודה
const DAY_CATEGORIES = [
  { value: '',        label: '— יום —', head: '#B6CFD0', text: '#374151' },
  { value: 'prep',    label: 'הכנות',   head: '#FCE3B8', text: '#7A4A00' },
  { value: 'rehears', label: 'חזרות',   head: '#C9DEF5', text: '#1E3A5F' },
  { value: 'show',    label: 'מופע',    head: '#F7C9E0', text: '#7A1750' },
  { value: 'strike',  label: 'פירוק',   head: '#D8DBDF', text: '#3A3F45' },
]
const getDayCategory = v => DAY_CATEGORIES.find(c => c.value === (v || '')) || DAY_CATEGORIES[0]

// עמודות ממוינות כרונולוגית לפי תאריך (ריק — בסוף)
function sortColsByDate(arr) {
  return [...arr].sort((a, b) => String(a.date || '9999-12-31').localeCompare(String(b.date || '9999-12-31')))
}

// textarea שגדל לפי התוכן ועוטף שורות (במקום input שגולש)
function AutoTextarea({ value, onChange, onBlur, placeholder, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder}
      className={'resize-none overflow-hidden break-words leading-snug ' + (className || '')} />
  )
}

export default function ProjectPlansMode({ profile }) {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState(null)
  const [columns, setColumns] = useState({}) // { [planId]: Column[] }
  const [cells, setCells]     = useState({}) // { [columnId]: Cell[] }
  const [eventTypes, setEventTypes] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]   = useState(false)

  // import / sync
  const [importFor, setImportFor]       = useState(null) // planId whose import panel is open
  const [importEvents, setImportEvents] = useState([])   // candidate production_events (with _crew[])
  const [importSel, setImportSel]       = useState(new Set())
  const [importBusy, setImportBusy]     = useState(false)
  const [syncBusy, setSyncBusy]         = useState(null) // planId currently syncing

  useEffect(() => { load() }, [])

  const typeLabel = v => { const t = eventTypes.find(t => t.value === v); return t ? t.label : (v || '') }

  async function load() {
    setLoading(true)
    const [{ data }, { data: ts }] = await Promise.all([
      supabase.from('project_plans').select('*').order('created_at', { ascending: false }),
      supabase.from('event_types').select('*').order('sort_order'),
    ])
    setPlans(data || [])
    setEventTypes(ts || [])
    setLoading(false)
  }

  // returns board data WITHOUT touching state
  async function fetchBoard(planId) {
    const [{ data: cols }, { data: allCells }] = await Promise.all([
      supabase.from('project_plan_columns').select('*').eq('plan_id', planId).order('sort_order'),
      supabase.from('project_plan_cells').select('*').eq('plan_id', planId).order('sort_order'),
    ])
    const grouped = {}
    ;(cols || []).forEach(c => { grouped[c.id] = [] })
    ;(allCells || []).forEach(cell => {
      if (!grouped[cell.column_id]) grouped[cell.column_id] = []
      grouped[cell.column_id].push(cell)
    })
    return { cols: cols || [], allCells: allCells || [], grouped }
  }

  async function loadBoard(planId) {
    const { cols, grouped } = await fetchBoard(planId)
    setColumns(prev => ({ ...prev, [planId]: cols }))
    setCells(prev => ({ ...prev, ...grouped }))
  }

  function toggleOpen(id) {
    if (openId === id) { setOpenId(null); setImportFor(null); return }
    setOpenId(id)
    setImportFor(null)
    if (!columns[id]) loadBoard(id)
  }

  // ---- plans ----
  async function createPlan() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase.from('project_plans')
      .insert({ title: newTitle.trim(), status: 'draft', created_by: profile?.id || null })
      .select().single()
    if (data) {
      setPlans(prev => [data, ...prev])
      setColumns(prev => ({ ...prev, [data.id]: [] }))
      setOpenId(data.id)
      setNewTitle('')
      setShowNew(false)
    }
    setSaving(false)
  }

  async function updatePlan(id, field, value) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await supabase.from('project_plans').update({ [field]: value }).eq('id', id)
  }

  async function deletePlan(id) {
    await supabase.from('project_plans').delete().eq('id', id) // cascades columns + cells
    setPlans(prev => prev.filter(p => p.id !== id))
    if (openId === id) setOpenId(null)
  }

  async function duplicatePlan(plan) {
    const { cols, grouped } = await fetchBoard(plan.id)
    const { data: newPlan } = await supabase.from('project_plans')
      .insert({ title: plan.title + ' (עותק)', status: plan.status || 'draft', created_by: profile?.id || null })
      .select().single()
    if (!newPlan) return
    const newCols = []
    const newCellsByCol = {}
    for (let i = 0; i < cols.length; i++) {
      const src = cols[i]
      const { data: nc } = await supabase.from('project_plan_columns')
        .insert({ plan_id: newPlan.id, date: src.date, category: src.category || null, sort_order: i })
        .select().single()
      if (!nc) continue
      newCols.push(nc)
      const srcCells = grouped[src.id] || []
      if (srcCells.length) {
        const { data: ins } = await supabase.from('project_plan_cells')
          .insert(srcCells.map((cell, j) => ({
            plan_id: newPlan.id, column_id: nc.id,
            action: cell.action || '', crew: cell.crew || '', notes: cell.notes || '',
            source_event_id: cell.source_event_id || null, sort_order: j,
          })))
          .select()
        newCellsByCol[nc.id] = (ins || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      } else {
        newCellsByCol[nc.id] = []
      }
    }
    setPlans(prev => [newPlan, ...prev])
    setColumns(prev => ({ ...prev, [newPlan.id]: newCols }))
    setCells(prev => ({ ...prev, ...newCellsByCol }))
  }

  // ---- columns (days) ----
  async function persistColOrder(sorted) {
    await Promise.all(sorted.map((c, i) => supabase.from('project_plan_columns').update({ sort_order: i }).eq('id', c.id)))
  }

  async function addColumn(planId) {
    const curr = columns[planId] || []
    const { data } = await supabase.from('project_plan_columns')
      .insert({ plan_id: planId, date: todayISO(), sort_order: curr.length })
      .select().single()
    if (data) {
      const merged = sortColsByDate([...curr, data])
      setColumns(prev => ({ ...prev, [planId]: merged }))
      setCells(prev => ({ ...prev, [data.id]: [] }))
      await persistColOrder(merged)
    }
  }

  async function updateColumnDate(planId, colId, value) {
    setColumns(prev => ({ ...prev, [planId]: prev[planId].map(c => c.id === colId ? { ...c, date: value } : c) }))
    await supabase.from('project_plan_columns').update({ date: value || null }).eq('id', colId)
  }

  async function updateColumnCategory(planId, colId, value) {
    setColumns(prev => ({ ...prev, [planId]: prev[planId].map(c => c.id === colId ? { ...c, category: value } : c) }))
    await supabase.from('project_plan_columns').update({ category: value || null }).eq('id', colId)
  }

  async function deleteColumn(planId, colId) {
    await supabase.from('project_plan_columns').delete().eq('id', colId) // cascades cells
    setColumns(prev => ({ ...prev, [planId]: (prev[planId] || []).filter(c => c.id !== colId) }))
    setCells(prev => { const n = { ...prev }; delete n[colId]; return n })
  }

  async function moveColumn(planId, index, dir) {
    const curr = [...(columns[planId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setColumns(prev => ({ ...prev, [planId]: curr }))
    await Promise.all(curr.map((c, i) => supabase.from('project_plan_columns').update({ sort_order: i }).eq('id', c.id)))
  }

  // ---- cells ----
  async function addCell(planId, colId) {
    const curr = cells[colId] || []
    const { data } = await supabase.from('project_plan_cells')
      .insert({ plan_id: planId, column_id: colId, action: '', crew: '', notes: '', sort_order: curr.length })
      .select().single()
    if (data) setCells(prev => ({ ...prev, [colId]: [...(prev[colId] || []), data] }))
  }

  function setCellField(colId, cellId, field, value) {
    setCells(prev => ({ ...prev, [colId]: prev[colId].map(c => c.id === cellId ? { ...c, [field]: value } : c) }))
  }

  async function commitCell(cellId, field, value) {
    await supabase.from('project_plan_cells').update({ [field]: value }).eq('id', cellId)
  }

  async function deleteCell(colId, cellId) {
    await supabase.from('project_plan_cells').delete().eq('id', cellId)
    setCells(prev => ({ ...prev, [colId]: (prev[colId] || []).filter(c => c.id !== cellId) }))
  }

  async function moveCell(colId, index, dir) {
    const curr = [...(cells[colId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setCells(prev => ({ ...prev, [colId]: curr }))
    await Promise.all(curr.map((c, i) => supabase.from('project_plan_cells').update({ sort_order: i }).eq('id', c.id)))
  }

  // ---- import from technical production ----
  function cellSummary(ev) {
    return {
      action: ev.event_name || '',
      crew: (ev._crew || []).join(', '),
      notes: [ev.venue, typeLabel(ev.type)].filter(Boolean).join(' · '),
    }
  }

  async function openImportPicker(planId) {
    if (importFor === planId) { setImportFor(null); return }
    setImportFor(planId)
    setImportSel(new Set())
    setImportBusy(true)
    const { data: evs } = await supabase.from('production_events')
      .select('*').is('deleted_at', null).order('date', { ascending: true })
    const withDate = (evs || []).filter(e => e.date)
    const ids = withDate.map(e => e.id)
    const crewMap = {}
    if (ids.length) {
      const { data: ppl } = await supabase.from('production_people')
        .select('production_event_id,name,status').in('production_event_id', ids)
      ;(ppl || []).forEach(p => {
        if (p.status === 'yellow' && (p.name || '').trim()) {
          if (!crewMap[p.production_event_id]) crewMap[p.production_event_id] = []
          crewMap[p.production_event_id].push(p.name.trim())
        }
      })
    }
    setImportEvents(withDate.map(e => ({ ...e, _crew: crewMap[e.id] || [] })))
    setImportBusy(false)
  }

  function toggleImportSel(id) {
    setImportSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function runImport(planId) {
    const sel = importEvents.filter(e => importSel.has(e.id))
    if (!sel.length) return
    setImportBusy(true)
    const { cols, allCells } = await fetchBoard(planId)
    const colByDate = {}
    cols.forEach(c => { if (c.date) colByDate[c.date] = c })
    const linkedByEvent = {}
    allCells.forEach(c => { if (c.source_event_id) linkedByEvent[c.source_event_id] = c })
    const colCount = {}
    cols.forEach(c => { colCount[c.id] = allCells.filter(x => x.column_id === c.id).length })
    let nextColSort = cols.length

    for (const ev of sel) {
      let col = colByDate[ev.date]
      if (!col) {
        const { data: nc } = await supabase.from('project_plan_columns')
          .insert({ plan_id: planId, date: ev.date, sort_order: nextColSort++ }).select().single()
        if (!nc) continue
        col = nc; colByDate[ev.date] = nc; colCount[nc.id] = 0
      }
      const s = cellSummary(ev)
      const existing = linkedByEvent[ev.id]
      if (existing) {
        await supabase.from('project_plan_cells')
          .update({ action: s.action, crew: s.crew, notes: s.notes, column_id: col.id })
          .eq('id', existing.id)
      } else {
        await supabase.from('project_plan_cells').insert({
          plan_id: planId, column_id: col.id, source_event_id: ev.id,
          action: s.action, crew: s.crew, notes: s.notes, sort_order: colCount[col.id]++,
        })
      }
    }
    // מיון כרונולוגי של כל העמודות (כולל החדשות) לפי תאריך
    const sorted = sortColsByDate(Object.values(colByDate))
    await persistColOrder(sorted)
    await loadBoard(planId)
    setImportBusy(false)
    setImportFor(null)
    setImportSel(new Set())
  }

  // re-pull crew/notes/action for every linked card in the plan
  async function syncLinked(planId) {
    setSyncBusy(planId)
    const { allCells } = await fetchBoard(planId)
    const linked = allCells.filter(c => c.source_event_id)
    if (!linked.length) { setSyncBusy(null); return }
    const eventIds = [...new Set(linked.map(c => c.source_event_id))]
    const [{ data: evs }, { data: ppl }] = await Promise.all([
      supabase.from('production_events').select('*').in('id', eventIds),
      supabase.from('production_people').select('production_event_id,name,status').in('production_event_id', eventIds),
    ])
    const evMap = {}; (evs || []).forEach(e => { evMap[e.id] = e })
    const crewMap = {}
    ;(ppl || []).forEach(p => {
      if (p.status === 'yellow' && (p.name || '').trim()) {
        if (!crewMap[p.production_event_id]) crewMap[p.production_event_id] = []
        crewMap[p.production_event_id].push(p.name.trim())
      }
    })
    for (const cell of linked) {
      const ev = evMap[cell.source_event_id]
      if (!ev) continue // event hard-deleted → leave card as-is
      const s = cellSummary({ ...ev, _crew: crewMap[ev.id] || [] })
      await supabase.from('project_plan_cells')
        .update({ action: s.action, crew: s.crew, notes: s.notes }).eq('id', cell.id)
    }
    await loadBoard(planId)
    setSyncBusy(null)
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-full" dir="rtl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNew(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus" /> תוכנית חדשה
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 max-w-md">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createPlan() }}
            placeholder="שם התוכנית *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3" />
          <div className="flex gap-2">
            <button onClick={createPlan} disabled={saving || !newTitle.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {saving ? 'שומר...' : 'צור תוכנית'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
          </div>
        </div>
      )}

      {plans.length === 0 && !showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין תוכניות — לחץ על "תוכנית חדשה" להתחלה
        </div>
      )}

      {plans.map(plan => {
        const isOpen = openId === plan.id
        const planCols = columns[plan.id] || []
        const st = getPlanStatus(plan.status)
        const linkedEventIds = new Set()
        planCols.forEach(c => (cells[c.id] || []).forEach(cell => { if (cell.source_event_id) linkedEventIds.add(cell.source_event_id) }))
        const hasLinked = linkedEventIds.size > 0
        return (
          <div key={plan.id} id={`pp-${plan.id}`} className="bg-white border-2 border-[#B6CFD0] rounded-xl mb-3 overflow-hidden shadow-sm">
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => toggleOpen(plan.id)}>
              <div className="flex-1 text-right">
                <input
                  value={plan.title}
                  onChange={e => setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, title: e.target.value } : p))}
                  onBlur={e => updatePlan(plan.id, 'title', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="text-[13px] font-semibold text-gray-800 bg-transparent outline-none text-right w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <select value={plan.status || 'draft'} onClick={e => e.stopPropagation()}
                  onChange={e => updatePlan(plan.id, 'status', e.target.value)}
                  className={`text-[11px] px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${st.color}`}>
                  {PLAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={e => { e.stopPropagation(); duplicatePlan(plan) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="שכפל תוכנית">
                  <i className="ti ti-copy" style={{ fontSize: 13 }} />
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm('למחוק את התוכנית?')) deletePlan(plan.id) }}
                  className="text-gray-300 hover:text-red-500 p-1" title="מחק">
                  <i className="ti ti-trash" style={{ fontSize: 13 }} />
                </button>
                <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{ fontSize: 13 }} />
              </div>
            </div>

            {/* board */}
            {isOpen && (
              <div className="border-t border-gray-50 p-4">
                {/* project notes */}
                <div className="mb-3">
                  <label className="text-[11px] text-gray-400 mb-1 block text-right">הערות כלליות לפרויקט</label>
                  <textarea
                    value={plan.notes || ''}
                    onChange={e => setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, notes: e.target.value } : p))}
                    onBlur={e => updatePlan(plan.id, 'notes', e.target.value)}
                    placeholder="הערות, אנשי קשר, לינקים..."
                    rows={2}
                    className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y"
                  />
                </div>
                {/* toolbar */}
                <div className="flex justify-end gap-2 mb-3">
                  {hasLinked && (
                    <button onClick={() => syncLinked(plan.id)} disabled={syncBusy === plan.id}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#E0197D] hover:text-[#E0197D] flex items-center gap-1.5 disabled:opacity-50">
                      <i className={`ti ${syncBusy === plan.id ? 'ti-loader-2 animate-spin' : 'ti-refresh'}`} style={{ fontSize: 14 }} />
                      {syncBusy === plan.id ? 'מסנכרן...' : 'סנכרן מקושרים'}
                    </button>
                  )}
                  <button onClick={() => openImportPicker(plan.id)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center gap-1.5">
                    <i className="ti ti-download" style={{ fontSize: 14 }} /> ייבא מהפקה טכנית
                  </button>
                </div>

                {/* import picker */}
                {importFor === plan.id && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                    {importBusy ? (
                      <div className="text-center text-[12px] text-gray-400 py-4 flex items-center justify-center gap-2">
                        <i className="ti ti-loader-2 animate-spin" /> טוען אירועים...
                      </div>
                    ) : importEvents.length === 0 ? (
                      <div className="text-center text-[12px] text-gray-400 py-4">אין אירועים עם תאריך בהפקה הטכנית</div>
                    ) : (
                      <>
                        <div className="text-[11px] text-gray-400 mb-2 px-1">בחר אירועים — כל אירוע ייכנס ככרטיס ביום התואם. אירוע שכבר יובא יעודכן.</div>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {importEvents.map(ev => {
                            const already = linkedEventIds.has(ev.id)
                            const checked = importSel.has(ev.id)
                            return (
                              <label key={ev.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-right flex-row-reverse ${checked ? 'bg-[#FCE4F3]' : 'hover:bg-gray-50'}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleImportSel(ev.id)} className="accent-[#E0197D]" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] font-medium text-gray-800 truncate flex items-center gap-1.5 justify-end">
                                    {already && <span className="text-[9px] text-[#E0197D] border border-[#E0197D] rounded px-1 py-px">מקושר</span>}
                                    {ev.event_name}
                                  </div>
                                  <div className="text-[11px] text-gray-400 flex gap-2 justify-end flex-wrap">
                                    {ev._crew.length > 0 && <span>{ev._crew.length} אישרו</span>}
                                    {ev.venue && <span>{ev.venue}</span>}
                                    <span>{fmtShort(ev.date)}</span>
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => runImport(plan.id)} disabled={importSel.size === 0}
                            className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
                            ייבא {importSel.size > 0 ? `(${importSel.size})` : ''}
                          </button>
                          <button onClick={() => setImportFor(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* columns */}
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {planCols.map((col, ci) => {
                    const colCells = cells[col.id] || []
                    const cat = getDayCategory(col.category)
                    return (
                      <div key={col.id} className="w-64 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                        {/* column header */}
                        <div className="px-3 py-2 flex items-center gap-1" style={{ backgroundColor: cat.head }}>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold truncate" style={{ color: cat.text }}>{fmtDay(col.date)}</div>
                            <div className="flex gap-1 mt-1">
                              <input type="date" value={col.date || ''}
                                onChange={e => updateColumnDate(plan.id, col.id, e.target.value)}
                                className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded bg-white/70 border border-black/10 outline-none focus:border-[#E0197D]" />
                              <select value={col.category || ''}
                                onChange={e => updateColumnCategory(plan.id, col.id, e.target.value)}
                                title="קטגוריית יום"
                                className="text-[10px] px-1 py-0.5 rounded bg-white/70 border border-black/10 outline-none focus:border-[#E0197D] cursor-pointer">
                                {DAY_CATEGORIES.map(c => <option key={c.value || 'none'} value={c.value}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <button onClick={() => moveColumn(plan.id, ci, -1)} disabled={ci === 0}
                              className="text-gray-500 hover:text-[#E0197D] disabled:opacity-30 leading-none" title="הזז ימינה">
                              <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
                            </button>
                            <button onClick={() => moveColumn(plan.id, ci, 1)} disabled={ci === planCols.length - 1}
                              className="text-gray-500 hover:text-[#E0197D] disabled:opacity-30 leading-none" title="הזז שמאלה">
                              <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
                            </button>
                          </div>
                          <button onClick={() => { if (window.confirm('למחוק את היום וכל הפעולות שבו?')) deleteColumn(plan.id, col.id) }}
                            className="text-gray-500 hover:text-red-500" title="מחק יום">
                            <i className="ti ti-trash" style={{ fontSize: 13 }} />
                          </button>
                        </div>

                        {/* cells */}
                        <div className="p-2 space-y-2">
                          {colCells.map((cell, cj) => (
                            <div key={cell.id} className="bg-white rounded-lg border border-[#E0197D]/30 p-2 group">
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-start gap-1 justify-end">
                                    {cell.source_event_id && <i className="ti ti-link text-[#E0197D] mt-0.5 shrink-0" style={{ fontSize: 11 }} title="מקושר לאירוע בהפקה הטכנית — יתעדכן בסנכרון" />}
                                    <AutoTextarea value={cell.action || ''} placeholder="פעולה"
                                      onChange={e => setCellField(col.id, cell.id, 'action', e.target.value)}
                                      onBlur={e => commitCell(cell.id, 'action', e.target.value)}
                                      className="flex-1 min-w-0 text-[12px] font-medium text-gray-800 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  </div>
                                  <AutoTextarea value={cell.crew || ''} placeholder="צוות"
                                    onChange={e => setCellField(col.id, cell.id, 'crew', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'crew', e.target.value)}
                                    className="w-full text-[11px] text-gray-600 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  <AutoTextarea value={cell.notes || ''} placeholder="הערות"
                                    onChange={e => setCellField(col.id, cell.id, 'notes', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'notes', e.target.value)}
                                    className="w-full text-[11px] text-gray-400 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                </div>
                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => moveCell(col.id, cj, -1)} disabled={cj === 0}
                                    className="text-gray-300 hover:text-[#E0197D] disabled:opacity-20 leading-none" title="למעלה">
                                    <i className="ti ti-chevron-up" style={{ fontSize: 13 }} />
                                  </button>
                                  <button onClick={() => moveCell(col.id, cj, 1)} disabled={cj === colCells.length - 1}
                                    className="text-gray-300 hover:text-[#E0197D] disabled:opacity-20 leading-none" title="למטה">
                                    <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
                                  </button>
                                  <button onClick={() => deleteCell(col.id, cell.id)}
                                    className="text-gray-300 hover:text-red-500 leading-none" title="מחק">
                                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addCell(plan.id, col.id)}
                            className="w-full text-[12px] text-gray-400 hover:text-[#E0197D] border border-dashed border-gray-200 hover:border-[#E0197D] rounded-lg py-1.5 flex items-center justify-center gap-1">
                            <i className="ti ti-plus" style={{ fontSize: 13 }} /> פעולה
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* add day */}
                  <button onClick={() => addColumn(plan.id)}
                    className="w-40 flex-shrink-0 h-24 text-[13px] text-gray-400 hover:text-[#E0197D] border-2 border-dashed border-gray-200 hover:border-[#E0197D] rounded-xl flex flex-col items-center justify-center gap-1">
                    <i className="ti ti-calendar-plus" style={{ fontSize: 20 }} /> הוסף יום
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
