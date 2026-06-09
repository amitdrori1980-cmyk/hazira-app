'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StorageContent() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name:'', location:'', notes:'' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)
    const { data } = await supabase.from('storage_items').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  async function addItem(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setAdding(true)
    const { data } = await supabase.from('storage_items').insert(form).select().single()
    if (data) setItems(p => [...p, data])
    setForm({ name:'', location:'', notes:'' })
    setAdding(false)
  }

  async function saveEdit(id) {
    await supabase.from('storage_items').update(editVal).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, ...editVal } : i))
    setEditing(null)
  }

  async function deleteItem(id) {
    if (!confirm('למחוק?')) return
    await supabase.from('storage_items').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const hS = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, fill: { fgColor: { rgb: 'E0197D' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 } }
    const cS = { alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const aS = { fill: { fgColor: { rgb: 'FCE4F3' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const wsData = [['שם','מיקום','הערות'].map(h => ({ v: h, s: hS }))]
    filtered.forEach((it, i) => {
      const s = i % 2 === 0 ? cS : aS
      wsData.push([{ v: it.name||'', s }, { v: it.location||'', s }, { v: it.notes||'', s }])
    })
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 35 }]
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    XLSX.utils.book_append_sheet(wb, ws, 'אחסון')
    XLSX.writeFile(wb, 'storage.xlsx')
  }

  const filtered = search ? items.filter(i => i.name?.includes(search) || i.location?.includes(search)) : items

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">טוען...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-3 gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש..."
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        <button onClick={exportExcel} className="text-sm text-gray-500 hover:text-green-600 px-3 py-1 border border-gray-200 rounded-lg flex items-center gap-1">
          <i className="ti ti-table-export" style={{fontSize:13}}/> ייצוא
        </button>
      </div>
      {isManager && (
        <form onSubmit={addItem} className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex gap-2 flex-wrap">
          <input value={form.name} onChange={e => setForm(v=>({...v,name:e.target.value}))}
            placeholder="שם פריט" className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D]" />
          <input value={form.location} onChange={e => setForm(v=>({...v,location:e.target.value}))}
            placeholder="מיקום" className="w-32 text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none" />
          <input value={form.notes} onChange={e => setForm(v=>({...v,notes:e.target.value}))}
            placeholder="הערות" className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none" />
          <button type="submit" disabled={adding}
            className="text-sm bg-[#E0197D] text-white px-3 py-1.5 rounded-lg">הוסף</button>
        </form>
      )}
      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
            {editing === item.id ? (
              <div className="flex gap-2 flex-1 flex-wrap">
                <input value={editVal.name||''} onChange={e => setEditVal(v=>({...v,name:e.target.value}))}
                  className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded" />
                <input value={editVal.location||''} onChange={e => setEditVal(v=>({...v,location:e.target.value}))}
                  placeholder="מיקום" className="w-28 text-sm px-2 py-1 border border-gray-200 rounded" />
                <input value={editVal.notes||''} onChange={e => setEditVal(v=>({...v,notes:e.target.value}))}
                  placeholder="הערות" className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded" />
                <button onClick={() => saveEdit(item.id)} className="text-xs text-green-600 font-medium">שמור</button>
                <button onClick={() => setEditing(null)} className="text-xs text-gray-400">ביטול</button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[13px] font-medium text-gray-700">{item.name}</p>
                  {item.location && <p className="text-[11px] text-gray-400">{item.location}</p>}
                  {item.notes && <p className="text-[11px] text-gray-400">{item.notes}</p>}
                </div>
                {isManager && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(item.id); setEditVal({name:item.name,location:item.location||'',notes:item.notes||''}) }}
                      className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-edit" style={{fontSize:13}}/></button>
                    <button onClick={() => deleteItem(item.id)}
                      className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-4">אין פריטים</p>}
      </div>
    </div>
  )
}
