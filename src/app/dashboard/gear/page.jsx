'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import EquipmentContent from '../equipment/EquipmentContent'
import StorageContent from '../storage/StorageContent'

export default function GearPage() {
  const [tab, setTab] = useState('equipment')
  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        <button onClick={() => setTab('equipment')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'equipment' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          ציוד
        </button>
        <button onClick={() => setTab('storage')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'storage' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          אכסון
        </button>
        <button onClick={() => setTab('japan')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'japan' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          יפן
        </button>
      </div>
      {tab === 'equipment' && <EquipmentContent />}
      {tab === 'storage' && <StorageContent />}
      {tab === 'japan' && <JapanContent />}
    </div>
  )
}

function JapanContent() {
  const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openCell, setOpenCell] = useState(null)
  const [cellMeta, setCellMeta] = useState({})
  const dirty = useRef(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('japan_rows').select('*').order('position', { ascending: true })
    if (error) alert('שגיאה בטעינה: ' + error.message)
    setRows(data || [])
    const { data: meta } = await supabase.from('japan_cells').select('*')
    const m = {}
    ;(meta || []).forEach(c => { m[c.cell] = c.updated_at })
    setCellMeta(m)
    setLoading(false)
  }

  function cellRows(cell) {
    return rows.filter(r => r.cell === cell)
  }

  async function addRow(cell) {
    const pos = cellRows(cell).reduce((m, r) => Math.max(m, r.position || 0), 0) + 1
    const { data, error } = await supabase.from('japan_rows').insert({ cell, content: '', position: pos }).select().single()
    if (error) { alert('שגיאה בהוספת שורה: ' + error.message); return }
    if (data) { setRows(prev => [...prev, data]); touchCell(cell) }
  }

  async function deleteRow(id) {
    const row = rows.find(r => r.id === id)
    await supabase.from('japan_rows').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
    if (row) touchCell(row.cell)
  }

  function changeRow(id, content) {
    dirty.current.add(id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, content } : r))
  }

  async function saveRow(id, content) {
    if (!dirty.current.has(id)) return
    dirty.current.delete(id)
    const row = rows.find(r => r.id === id)
    await supabase.from('japan_rows').update({ content }).eq('id', id)
    if (row) touchCell(row.cell)
  }

  async function touchCell(cell) {
    const now = new Date().toISOString()
    setCellMeta(prev => ({ ...prev, [cell]: now }))
    await supabase.from('japan_cells').upsert({ cell, updated_at: now }, { onConflict: 'cell' })
  }

  function fmtUpdated(ts) {
    const d = new Date(ts)
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  // ---- Cell view: editable row list ----
  if (openCell) {
    const list = cellRows(openCell)
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-4 flex-row-reverse">
          <button onClick={() => setOpenCell(null)}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#E0197D]">
            <i className="ti ti-chevron-right" style={{fontSize:16}}/> חזרה
          </button>
          <div className="text-[15px] font-semibold text-gray-800">יפן {openCell}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {list.length === 0 && (
            <div className="text-center text-[13px] text-gray-400 py-6">אין שורות עדיין</div>
          )}
          {list.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse">
              <span className="text-[12px] text-gray-300 w-5 text-center flex-shrink-0">{i + 1}</span>
              <input value={r.content || ''}
                onChange={e => changeRow(r.id, e.target.value)}
                onBlur={e => saveRow(r.id, e.target.value)}
                placeholder="טקסט חופשי..."
                className="flex-1 text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
              <button onClick={() => deleteRow(r.id)}
                className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                <i className="ti ti-trash" style={{fontSize:14}}/>
              </button>
            </div>
          ))}
          <button onClick={() => addRow(openCell)}
            className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
            <i className="ti ti-plus" style={{fontSize:14}}/> הוסף שורה
          </button>
        </div>
      </div>
    )
  }

  // ---- Grid view: 9 clickable tiles ----
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl">
      {CELLS.map(cell => {
        const count = cellRows(cell).length
        return (
          <button key={cell} onClick={() => setOpenCell(cell)}
            className="bg-white border-2 border-gray-200 rounded-2xl h-32 flex flex-col items-center justify-center hover:border-[#E0197D] hover:bg-gray-50 transition-colors">
            <div className="text-[16px] font-semibold text-gray-800">יפן {cell}</div>
            <div className="text-[11px] text-gray-400 mt-1">{count} שורות</div>
            {cellMeta[cell] && (
              <div className="text-[10px] text-gray-300 mt-1">תאריך עדכון: {fmtUpdated(cellMeta[cell])}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
