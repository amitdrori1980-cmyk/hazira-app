'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function EquipmentPage() {
  const [categories, setCategories] = useState([])
  const [openCat, setOpenCat]       = useState(null)
  const [openSub, setOpenSub]       = useState(null)
  const [subcats, setSubcats]       = useState({})   // catId -> subcats[]
  const [items, setItems]           = useState({})   // subId -> items[]
  const [loading, setLoading]       = useState(true)
  const [isManager, setIsManager]   = useState(false)
  const [search, setSearch]         = useState('')

  // Add item form
  const [addingTo, setAddingTo]     = useState(null) // subcat id
  const [newItem, setNewItem]       = useState({ name:'', units:'', details:'' })
  const [saving, setSaving]         = useState(false)

  // Edit
  const [editing, setEditing]       = useState(null)
  const [editVal, setEditVal]       = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)

    const { data: cats } = await supabase
      .from('equipment_categories')
      .select('*')
      .order('sort_order')
    setCategories(cats || [])
    setLoading(false)
  }

  async function loadSubcats(catId) {
    if (subcats[catId]) return
    const { data } = await supabase
      .from('equipment_subcategories')
      .select('*')
      .eq('category_id', catId)
      .order('sort_order')
    setSubcats(prev => ({ ...prev, [catId]: data || [] }))
  }

  async function loadItems(subId) {
    if (items[subId]) return
    const { data } = await supabase
      .from('equipment_items')
      .select('*')
      .eq('subcategory_id', subId)
      .order('name')
    setItems(prev => ({ ...prev, [subId]: data || [] }))
  }

  async function toggleCat(cat) {
    if (openCat === cat.id) { setOpenCat(null); setOpenSub(null); return }
    setOpenCat(cat.id)
    setOpenSub(null)
    await loadSubcats(cat.id)
  }

  async function toggleSub(sub) {
    if (openSub === sub.id) { setOpenSub(null); return }
    setOpenSub(sub.id)
    await loadItems(sub.id)
  }

  async function addItem(subId, paramType) {
    if (!newItem.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('equipment_items').insert({
      subcategory_id: subId,
      name:     newItem.name.trim(),
      units:    newItem.units.trim(),
      details:  newItem.details.trim(),

    }).select().single()
    if (!error) {
      setItems(prev => ({ ...prev, [subId]: [...(prev[subId]||[]), data].sort((a,b)=>a.name.localeCompare(b.name)) }))
    }
    setNewItem({ name:'', units:'', details:'' })
    setAddingTo(null)
    setSaving(false)
  }

  async function saveEdit(id, subId) {
    await supabase.from('equipment_items').update(editVal).eq('id', id)
    setItems(prev => ({ ...prev, [subId]: prev[subId].map(i => i.id === id ? { ...i, ...editVal } : i) }))
    setEditing(null)
  }

  async function deleteItem(id, subId) {
    await supabase.from('equipment_items').delete().eq('id', id)
    setItems(prev => ({ ...prev, [subId]: prev[subId].filter(i => i.id !== id) }))
  }

  // Search mode — load all
  async function doSearch(val) {
    setSearch(val)
    if (!val) return
    const { data } = await supabase
      .from('equipment_items')
      .select('*, subcategory:subcategory_id(name, category:category_id(name))')
      .ilike('name', `%${val}%`)
      .limit(50)
    setSearchResults(data || [])
  }
  const [searchResults, setSearchResults] = useState([])

  function ParamFields({ paramType, val, setVal, compact=false }) {
    const cls = `text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5] ${compact ? 'text-[12px]' : ''}`
    return (
      <div className="flex gap-2 flex-row-reverse flex-wrap">
        {(paramType === 'units' || paramType === 'both') && (
          <input value={val.units||''} onChange={e=>setVal(v=>({...v,units:e.target.value}))}
            placeholder="Units" className={cls} style={{width:70}}/>
        )}
        {(paramType === 'details' || paramType === 'both') && (
          <input value={val.details||''} onChange={e=>setVal(v=>({...v,details:e.target.value}))}
            placeholder="Details" className={cls} style={{flex:1,minWidth:80}}/>
        )}

      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4">
        <input value={search} onChange={e=>doSearch(e.target.value)}
          placeholder="Search equipment..."
          className="flex-1 text-sm bg-transparent outline-none text-left" dir="ltr"/>
        <i className="ti ti-search text-gray-400" style={{fontSize:14}}/>
      </div>

      {/* Search results */}
      {search && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">
            Results ({searchResults.length})
          </div>
          {searchResults.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-3">No results</div>
          ) : searchResults.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse">
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium">{item.name}</div>
                <div className="text-[11px] text-gray-400">
                  {item.subcategory?.category?.name} › {item.subcategory?.name}

                </div>
              </div>
              {item.units   && <span className="text-[11px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full">×{item.units}</span>}
              {item.details && <span className="text-[11px] text-gray-400">{item.details}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Categories */}
      {!search && (loading ? (
        <div className="text-center text-sm text-gray-400 py-8">Loading...</div>
      ) : (
        categories.map(cat => (
          <div key={cat.id} className="mb-3">
            {/* Category header */}
            <button onClick={() => toggleCat(cat)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all flex-row-reverse text-right ${
                openCat === cat.id
                  ? 'bg-[#FF3EB5] text-white border-[#FF3EB5]'
                  : 'bg-white border-gray-100 hover:border-[#FF3EB5] text-gray-800'
              }`}>
              <span className="flex-1 font-semibold text-[14px]">{cat.name}</span>
              <i className={`ti ${openCat === cat.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{fontSize:14}}/>
            </button>

            {/* Subcategories */}
            {openCat === cat.id && (
              <div className="mt-1 mr-3 border-r-2 border-[#FF3EB5] pr-3">
                {(subcats[cat.id] || []).map(sub => (
                  <div key={sub.id} className="mb-2">
                    {/* Subcategory header */}
                    <button onClick={() => toggleSub(sub)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all flex-row-reverse text-right ${
                        openSub === sub.id
                          ? 'bg-[#FFE6F5] border-[#FF3EB5] text-[#FF3EB5]'
                          : 'bg-gray-50 border-gray-100 hover:border-gray-300 text-gray-700'
                      }`}>
                      <span className="flex-1 text-[13px] font-medium">{sub.name}</span>
                      <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                        {sub.param_type === 'units' ? 'units' : sub.param_type === 'details' ? 'details' : 'units + details'}
                      </span>
                      <i className={`ti ${openSub === sub.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{fontSize:13}}/>
                    </button>

                    {/* Items */}
                    {openSub === sub.id && (
                      <div className="mt-1 bg-white border border-gray-100 rounded-lg overflow-hidden">
                        {/* Table header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-row-reverse text-[11px] font-medium text-gray-500">
                          <span className="flex-1 text-right">Name</span>
                          {(sub.param_type==='units'||sub.param_type==='both') && <span className="w-14 text-center">Units</span>}
                          {(sub.param_type==='details'||sub.param_type==='both') && <span className="w-32 text-right">Details</span>}
                          {isManager && <span className="w-12"/>}
                        </div>

                        {/* Items list */}
                        {(items[sub.id] || []).map(item => (
                          <div key={item.id} className="border-b border-gray-50 last:border-0">
                            {editing === item.id ? (
                              <div className="p-2 flex flex-col gap-1.5">
                                <input value={editVal.name} onChange={e=>setEditVal(v=>({...v,name:e.target.value}))}
                                  className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]" dir="ltr"/>
                                <ParamFields paramType={sub.param_type} val={editVal} setVal={setEditVal} compact/>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(item.id, sub.id)} className="flex-1 bg-[#FF3EB5] text-white text-xs py-1.5 rounded-lg">Save</button>
                                  <button onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded-lg">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 flex-row-reverse group hover:bg-gray-50">
                                <span className="flex-1 text-[13px] text-right text-gray-800" dir="ltr">{item.name}</span>
                                {(sub.param_type==='units'||sub.param_type==='both') && (
                                  <span className="w-14 text-center text-[12px] text-gray-500">{item.units||'—'}</span>
                                )}
                                {(sub.param_type==='details'||sub.param_type==='both') && (
                                  <span className="w-32 text-right text-[11px] text-gray-400 truncate">{item.details||'—'}</span>
                                )}
                                {isManager && (
                                  <div className="w-12 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => { setEditing(item.id); setEditVal({name:item.name,units:item.units||'',details:item.details||''}) }}
                                      className="text-gray-300 hover:text-[#FF3EB5]"><i className="ti ti-pencil" style={{fontSize:12}}/></button>
                                    <button onClick={() => deleteItem(item.id, sub.id)}
                                      className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:12}}/></button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add item */}
                        {isManager && (
                          addingTo === sub.id ? (
                            <div className="p-2 border-t border-gray-100 bg-[#FFE6F5] flex flex-col gap-1.5">
                              <input value={newItem.name} onChange={e=>setNewItem(v=>({...v,name:e.target.value}))}
                                placeholder="Item name" dir="ltr"
                                className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#FF3EB5]"/>
                              <ParamFields paramType={sub.param_type} val={newItem} setVal={setNewItem} compact/>
                              <div className="flex gap-2">
                                <button onClick={() => addItem(sub.id, sub.param_type)} disabled={saving}
                                  className="flex-1 bg-[#FF3EB5] text-white text-xs py-1.5 rounded-lg disabled:opacity-50">
                                  {saving ? 'Saving...' : 'Add'}
                                </button>
                                <button onClick={() => setAddingTo(null)}
                                  className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded-lg">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingTo(sub.id); setNewItem({name:'',units:'',details:''}) }}
                              className="w-full py-2 text-[12px] text-gray-400 hover:text-[#FF3EB5] hover:bg-[#FFE6F5] transition-colors border-t border-gray-50 flex items-center justify-center gap-1">
                              <i className="ti ti-plus" style={{fontSize:12}}/> Add item
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
        ))
      ))}
    </div>
  )
}
