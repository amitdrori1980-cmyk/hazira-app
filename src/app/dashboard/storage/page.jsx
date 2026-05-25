'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StoragePage() {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ name:'', location:'', notes:'' })
  const [adding, setAdding]       = useState(false)
  const [editing, setEditing]     = useState(null)
  const [editVal, setEditVal]     = useState({})

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
    const { data, error } = await supabase.from('storage_items').insert(form).select().single()
    if (!error) setItems(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
    setForm({ name:'', location:'', notes:'' })
    setAdding(false)
  }

  async function saveEdit(id) {
    await supabase.from('storage_items').update(editVal).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...editVal } : i))
    setEditing(null)
  }

  async function deleteItem(id) {
    await supabase.from('storage_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i =>
    !search ||
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.location?.toLowerCase().includes(search.toLowerCase()) ||
    i.notes?.includes(search)
  )

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="flex-1 text-sm bg-transparent outline-none" />
          <i className="ti ti-search text-gray-400" style={{fontSize:14}}/>
        </div>
      </div>

      {isManager && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">הוסף פריט</div>
          <form onSubmit={addItem} className="flex flex-col gap-2">
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              placeholder="פריט *" required
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}
              placeholder="מיקום"
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              placeholder="הערות"
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <button type="submit" disabled={adding}
              className="bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {adding ? 'מוסיף...' : 'הוסף'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500">
          <div className="col-span-4 text-right">פריט</div>
          <div className="col-span-4 text-right">מיקום</div>
          <div className="col-span-3 text-right">הערות</div>
          <div className="col-span-1"/>
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">
            {search ? 'לא נמצאו תוצאות' : 'אין פריטים עדיין'}
          </div>
        ) : filtered.map(item => (
          <div key={item.id} className="border-b border-gray-50 last:border-0">
            {editing === item.id ? (
              <div className="p-3 flex flex-col gap-2 bg-[#FCE4F3]">
                <input value={editVal.name} onChange={e=>setEditVal(v=>({...v,name:e.target.value}))}
                  placeholder="פריט"
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#E0197D]"/>
                <div className="grid grid-cols-2 gap-2">
                  <input value={editVal.location||''} onChange={e=>setEditVal(v=>({...v,location:e.target.value}))}
                    placeholder="מיקום"
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#E0197D]"/>
                  <input value={editVal.notes||''} onChange={e=>setEditVal(v=>({...v,notes:e.target.value}))}
                    placeholder="הערות"
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#E0197D]"/>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(item.id)} className="flex-1 bg-[#E0197D] text-white text-sm py-1.5 rounded-lg">שמור</button>
                  <button onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg bg-white">ביטול</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center group hover:bg-gray-50">
                <div className="col-span-4 text-[13px] font-medium text-gray-800 text-right">{item.name}</div>
                <div className="col-span-4 text-[12px] text-gray-500 text-right flex items-center gap-1 justify-end">
                  {item.location && <><i className="ti ti-map-pin text-[#E0197D]" style={{fontSize:10}}/>{item.location}</>}
                </div>
                <div className="col-span-3 text-[12px] text-gray-400 text-right truncate">{item.notes}</div>
                {isManager && (
                  <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                    <button onClick={() => { setEditing(item.id); setEditVal({name:item.name,location:item.location||'',notes:item.notes||''}) }}
                      className="text-gray-300 hover:text-[#E0197D]">
                      <i className="ti ti-pencil" style={{fontSize:12}}/>
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      className="text-gray-300 hover:text-red-500">
                      <i className="ti ti-trash" style={{fontSize:12}}/>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {filtered.length > 0 && (
        <div className="text-[11px] text-gray-400 text-center mt-2">{filtered.length} פריטים</div>
      )}
    </div>
  )
}
