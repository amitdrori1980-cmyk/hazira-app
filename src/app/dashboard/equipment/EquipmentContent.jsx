'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function EquipmentContent() {
  const [categories, setCategories] = useState([])
  const [openCat, setOpenCat] = useState(null)
  const [openSub, setOpenSub] = useState(null)
  const [subcats, setSubcats] = useState({})
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [search, setSearch] = useState('')
  const [addingTo, setAddingTo] = useState(null)
  const [newItem, setNewItem] = useState({ name:'', units:'', details:'' })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)
    const { data: cats } = await supabase.from('equipment_categories').select('*').order('name')
    setCategories(cats || [])
    setLoading(false)
  }

  async function loadSubs(catId) {
    if (subcats[catId]) return
    const { data } = await supabase.from('equipment_subcategories').select('*').eq('category_id', catId).order('name')
    setSubcats(p => ({ ...p, [catId]: data || [] }))
  }

  async function loadItems(subId) {
    if (items[subId]) return
    const { data } = await supabase.from('equipment_items').select('*').eq('subcategory_id', subId).order('name')
    setItems(p => ({ ...p, [subId]: data || [] }))
  }

  async function toggleCat(id) {
    const next = openCat === id ? null : id
    setOpenCat(next)
    setOpenSub(null)
    if (next) loadSubs(next)
  }

  async function toggleSub(id) {
    const next = openSub === id ? null : id
    setOpenSub(next)
    if (next) loadItems(next)
  }

  async function addItem(subId) {
    if (!newItem.name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('equipment_items').insert({ ...newItem, subcategory_id: subId }).select().single()
    if (data) setItems(p => ({ ...p, [subId]: [...(p[subId]||[]), data] }))
    setNewItem({ name:'', units:'', details:'' })
    setAddingTo(null)
    setSaving(false)
  }

  async function saveEdit(id, subId) {
    await supabase.from('equipment_items').update(editVal).eq('id', id)
    setItems(p => ({ ...p, [subId]: p[subId].map(i => i.id === id ? { ...i, ...editVal } : i) }))
    setEditing(null)
  }

  async function deleteItem(id, subId) {
    if (!confirm('למחוק?')) return
    await supabase.from('equipment_items').delete().eq('id', id)
    setItems(p => ({ ...p, [subId]: p[subId].filter(i => i.id !== id) }))
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const { data: allCats } = await supabase.from('equipment_categories').select('*').order('name')
    const { data: allSubs } = await supabase.from('equipment_subcategories').select('*').order('name')
    const { data: allItems } = await supabase.from('equipment_items').select('*').order('name')
    const catMap = {}
    allCats?.forEach(c => { catMap[c.id] = c.name })
    const subMap = {}
    allSubs?.forEach(s => { subMap[s.id] = { name: s.name, catId: s.category_id } })
    const hS = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, fill: { fgColor: { rgb: 'E0197D' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 } }
    const cS = { alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const aS = { fill: { fgColor: { rgb: 'FCE4F3' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const wsData = [['קטגוריה','תת-קטגוריה','פריט','יחידות','פרטים'].map(h => ({ v: h, s: hS }))]
    allItems?.forEach((it, i) => {
      const s = i % 2 === 0 ? cS : aS
      wsData.push([
        { v: catMap[subMap[it.subcategory_id]?.catId]||'', s },
        { v: subMap[it.subcategory_id]?.name||'', s },
        { v: it.name||'', s },
        { v: it.units||'', s },
        { v: it.details||'', s }
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    XLSX.utils.book_append_sheet(wb, ws, 'ציוד')
    XLSX.writeFile(wb, 'equipment.xlsx')
  }

  const filtered = search ? categories.filter(c =>
    c.name?.includes(search) ||
    Object.values(subcats).flat().some(s => s.name?.includes(search)) ||
    Object.values(items).flat().some(i => i.name?.includes(search))
  ) : categories

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">טוען...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-3 gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="...Search equipment"
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        <button onClick={exportExcel} className="text-sm text-gray-500 hover:text-green-600 px-3 py-1 border border-gray-200 rounded-lg flex items-center gap-1">
          <i className="ti ti-table-export" style={{fontSize:13}}/> ייצוא
        </button>
      </div>
      {filtered.map(cat => (
        <div key={cat.id} className="mb-2 border border-gray-100 rounded-xl overflow-hidden">
          <button onClick={() => toggleCat(cat.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
            <span className="text-[13px] font-medium text-gray-700">{cat.name}</span>
            <i className={`ti ${openCat === cat.id ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{fontSize:13}}/>
          </button>
          {openCat === cat.id && (
            <div className="border-t border-gray-50">
              {(subcats[cat.id] || []).map(sub => (
                <div key={sub.id} className="border-b border-gray-50 last:border-0">
                  <button onClick={() => toggleSub(sub.id)}
                    className="w-full flex items-center justify-between px-6 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <span className="text-[12px] font-medium text-gray-600">{sub.name}</span>
                    <i className={`ti ${openSub === sub.id ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{fontSize:12}}/>
                  </button>
                  {openSub === sub.id && (
                    <div className="px-6 py-2 bg-white">
                      {(items[sub.id] || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          {editing === item.id ? (
                            <div className="flex gap-2 flex-1">
                              <input value={editVal.name||''} onChange={e => setEditVal(v=>({...v,name:e.target.value}))}
                                className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded" />
                              <input value={editVal.units||''} onChange={e => setEditVal(v=>({...v,units:e.target.value}))}
                                className="w-20 text-xs px-2 py-1 border border-gray-200 rounded" placeholder="יחידות" />
                              <button onClick={() => saveEdit(item.id, sub.id)} className="text-xs text-green-600">שמור</button>
                              <button onClick={() => setEditing(null)} className="text-xs text-gray-400">ביטול</button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="text-[12px] text-gray-700">{item.name}</span>
                                {item.units && <span className="text-[11px] text-gray-400 mr-2">({item.units})</span>}
                                {item.details && <span className="text-[11px] text-gray-400 block">{item.details}</span>}
                              </div>
                              {isManager && (
                                <div className="flex gap-2">
                                  <button onClick={() => { setEditing(item.id); setEditVal({name:item.name,units:item.units||'',details:item.details||''}) }}
                                    className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-edit" style={{fontSize:12}}/></button>
                                  <button onClick={() => deleteItem(item.id, sub.id)}
                                    className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:12}}/></button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      {isManager && (
                        addingTo === sub.id ? (
                          <div className="flex gap-2 mt-2">
                            <input value={newItem.name} onChange={e => setNewItem(v=>({...v,name:e.target.value}))}
                              placeholder="שם פריט" className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded" />
                            <input value={newItem.units} onChange={e => setNewItem(v=>({...v,units:e.target.value}))}
                              placeholder="יחידות" className="w-20 text-xs px-2 py-1 border border-gray-200 rounded" />
                            <button onClick={() => addItem(sub.id)} disabled={saving}
                              className="text-xs text-green-600 font-medium">הוסף</button>
                            <button onClick={() => setAddingTo(null)} className="text-xs text-gray-400">ביטול</button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingTo(sub.id)}
                            className="mt-2 text-[11px] text-[#E0197D] hover:underline flex items-center gap-1">
                            <i className="ti ti-plus" style={{fontSize:11}}/> הוסף פריט
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
