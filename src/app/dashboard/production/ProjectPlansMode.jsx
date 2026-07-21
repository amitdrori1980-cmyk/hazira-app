'use client'
// HAZIRA-PROJPLANS-V1
import { useEffect, useState } from 'react'
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

export default function ProjectPlansMode({ profile }) {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState(null)
  const [columns, setColumns] = useState({}) // { [planId]: Column[] }
  const [cells, setCells]     = useState({}) // { [columnId]: Cell[] }
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('project_plans').select('*').order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  async function loadBoard(planId) {
    const [{ data: cols }, { data: allCells }] = await Promise.all([
      supabase.from('project_plan_columns').select('*').eq('plan_id', planId).order('sort_order'),
      supabase.from('project_plan_cells').select('*').eq('plan_id', planId).order('sort_order'),
    ])
    const grouped = {}
    ;(cols || []).forEach(c => { grouped[c.id] = [] })
    ;(allCells || []).forEach(cell => { (grouped[cell.column_id] || (grouped[cell.column_id] = [])).push(cell) })
    setColumns(prev => ({ ...prev, [planId]: cols || [] }))
    setCells(prev => ({ ...prev, ...grouped }))
  }

  function toggleOpen(id) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
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
    // make sure the board is loaded before copying
    let planCols = columns[plan.id]
    let planCells = cells
    if (!planCols) {
      const [{ data: c }, { data: allCells }] = await Promise.all([
        supabase.from('project_plan_columns').select('*').eq('plan_id', plan.id).order('sort_order'),
        supabase.from('project_plan_cells').select('*').eq('plan_id', plan.id).order('sort_order'),
      ])
      planCols = c || []
      const grouped = {}
      ;(allCells || []).forEach(cell => { (grouped[cell.column_id] || (grouped[cell.column_id] = [])).push(cell) })
      planCells = grouped
    }
    const { data: newPlan } = await supabase.from('project_plans')
      .insert({ title: plan.title + ' (עותק)', status: plan.status || 'draft', created_by: profile?.id || null })
      .select().single()
    if (!newPlan) return
    const newCols = []
    const newCellsByCol = {}
    for (let i = 0; i < planCols.length; i++) {
      const src = planCols[i]
      const { data: nc } = await supabase.from('project_plan_columns')
        .insert({ plan_id: newPlan.id, date: src.date, sort_order: i })
        .select().single()
      if (!nc) continue
      newCols.push(nc)
      const srcCells = planCells[src.id] || []
      if (srcCells.length) {
        const { data: ins } = await supabase.from('project_plan_cells')
          .insert(srcCells.map((cell, j) => ({
            plan_id: newPlan.id, column_id: nc.id,
            action: cell.action || '', crew: cell.crew || '', notes: cell.notes || '', sort_order: j,
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
  async function addColumn(planId) {
    const curr = columns[planId] || []
    const { data } = await supabase.from('project_plan_columns')
      .insert({ plan_id: planId, date: todayISO(), sort_order: curr.length })
      .select().single()
    if (data) {
      setColumns(prev => ({ ...prev, [planId]: [...(prev[planId] || []), data] }))
      setCells(prev => ({ ...prev, [data.id]: [] }))
    }
  }

  async function updateColumnDate(planId, colId, value) {
    setColumns(prev => ({ ...prev, [planId]: prev[planId].map(c => c.id === colId ? { ...c, date: value } : c) }))
    await supabase.from('project_plan_columns').update({ date: value || null }).eq('id', colId)
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
        return (
          <div key={plan.id} id={`pp-${plan.id}`} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
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
                <button onClick={e => { e.stopPropagation(); if (!columns[plan.id]) loadBoard(plan.id).then(() => duplicatePlan(plan)); else duplicatePlan(plan) }}
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
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {planCols.map((col, ci) => {
                    const colCells = cells[col.id] || []
                    return (
                      <div key={col.id} className="w-64 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                        {/* column header */}
                        <div className="bg-[#B6CFD0] px-3 py-2 flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold text-gray-800 truncate">{fmtDay(col.date)}</div>
                            <input type="date" value={col.date || ''}
                              onChange={e => updateColumnDate(plan.id, col.id, e.target.value)}
                              className="mt-1 text-[11px] px-1.5 py-0.5 rounded bg-white/70 border border-black/10 outline-none focus:border-[#E0197D] w-full" />
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
                            <div key={cell.id} className="bg-white rounded-lg border border-gray-100 p-2 group">
                              <div className="flex items-start gap-1">
                                <div className="flex-1 space-y-1">
                                  <input value={cell.action || ''} placeholder="פעולה"
                                    onChange={e => setCellField(col.id, cell.id, 'action', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'action', e.target.value)}
                                    className="w-full text-[12px] font-medium text-gray-800 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  <input value={cell.crew || ''} placeholder="צוות"
                                    onChange={e => setCellField(col.id, cell.id, 'crew', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'crew', e.target.value)}
                                    className="w-full text-[11px] text-gray-600 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  <input value={cell.notes || ''} placeholder="הערות"
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
