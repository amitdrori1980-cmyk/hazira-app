'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function RundownsPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('rundown_templates').select('*').order('created_at')
    setTemplates(data || [])
    setLoading(false)
  }

  function startNew() {
    setEditing({ id: 'new', name: '', rows: [{ time:'', what:'', who:'', notes:'' }] })
  }

  async function save() {
    if (!editing.name.trim()) return
    setSaving(true)
    if (editing.id === 'new') {
      const { data } = await supabase.from('rundown_templates').insert({ name: editing.name, rows: editing.rows }).select().single()
      if (data) setTemplates(prev => [...prev, data])
    } else {
      await supabase.from('rundown_templates').update({ name: editing.name, rows: editing.rows }).eq('id', editing.id)
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, name: editing.name, rows: editing.rows } : t))
    }
    setSaving(false)
    setEditing(null)
  }

  async function deleteTemplate(id) {
    if (!window.confirm('למחוק תבנית זו?')) return
    await supabase.from('rundown_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  function importXlsx(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const wb = XLSX.read(evt.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const headerIdx = allRows.findIndex(r => String(r[0]).includes('שעה'))
      const dataRows = headerIdx >= 0 ? allRows.slice(headerIdx + 1) : allRows.slice(4)
      const parsed = dataRows
        .filter(r => r.some(c => String(c).trim() !== ''))
        .map(r => {
          let time = r[0]
          if (typeof time === 'number') {
            const totalMins = Math.round(time * 24 * 60)
            const h = Math.floor(totalMins / 60) % 24
            const m = totalMins % 60
            time = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0')
          } else { time = String(time || '') }
          return { time, what: String(r[1]||''), who: String(r[2]||''), notes: String(r[3]||'') }
        })
      setEditing(prev => ({ ...prev, rows: parsed }))
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  function updateRow(idx, field, val) {
    setEditing(prev => ({ ...prev, rows: prev.rows.map((r,i) => i===idx ? {...r,[field]:val} : r) }))
  }
  function addRow() {
    setEditing(prev => ({ ...prev, rows: [...prev.rows, { time:'', what:'', who:'', notes:'' }] }))
  }
  function deleteRow(idx) {
    setEditing(prev => ({ ...prev, rows: prev.rows.filter((_,i) => i!==idx) }))
  }

  if (loading) return <div className="text-center text-gray-400 py-8 text-sm">טוען...</div>

  if (editing) return (
    <div className="max-w-4xl" dir="rtl">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))}
          placeholder="שם התבנית *"
          className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#E0197D] text-right min-w-[200px]"/>
        <button onClick={()=>fileInputRef.current.click()}
          className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:border-[#E0197D] flex items-center gap-1">
          <i className="ti ti-upload" style={{fontSize:13}}/> ייבא אקסל
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importXlsx}/>
        <button onClick={save} disabled={saving||!editing.name.trim()}
          className="bg-[#E0197D] text-white text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 font-medium">
          {saving ? 'שומר...' : 'שמור'}
        </button>
        <button onClick={()=>setEditing(null)} className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500">ביטול</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[120px_2fr_1.5fr_1fr_40px] bg-[#E0197D] text-white text-[12px] font-semibold">
          <div className="px-3 py-2.5 text-right">שעה</div>
          <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
          <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
          <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
          <div/>
        </div>
        {editing.rows.map((row, idx) => (
          <div key={idx} className={`grid grid-cols-[120px_2fr_1.5fr_1fr_40px] border-b border-gray-50 ${idx%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
            <input value={row.time} onChange={e=>updateRow(idx,'time',e.target.value)}
              className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono placeholder-transparent"/>
            <input value={row.what} onChange={e=>updateRow(idx,'what',e.target.value)}
              className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 placeholder-transparent"/>
            <input value={row.who} onChange={e=>updateRow(idx,'who',e.target.value)}
              className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 placeholder-transparent"/>
            <input value={row.notes} onChange={e=>updateRow(idx,'notes',e.target.value)}
              className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500 placeholder-transparent"/>
            <div className="flex items-center justify-center">
              <button onClick={()=>deleteRow(idx)} className="text-gray-300 hover:text-red-500 p-1">
                <i className="ti ti-trash" style={{fontSize:11}}/>
              </button>
            </div>
          </div>
        ))}
        <button onClick={addRow} className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
          <i className="ti ti-plus" style={{fontSize:13}}/> הוסף שורה
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-semibold text-gray-800">תבניות לוז</div>
        <button onClick={startNew} className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-xl flex items-center gap-1">
          <i className="ti ti-plus"/> תבנית חדשה
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">אין תבניות עדיין</div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-gray-800">{t.name}</div>
                <div className="text-[12px] text-gray-400 mt-0.5">{t.rows?.length || 0} שורות</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>setEditing({...t})} className="text-gray-400 hover:text-[#E0197D] p-1.5 border border-gray-200 rounded-lg">
                  <i className="ti ti-pencil" style={{fontSize:13}}/>
                </button>
                <button onClick={()=>deleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 p-1.5 border border-gray-200 rounded-lg">
                  <i className="ti ti-trash" style={{fontSize:13}}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
