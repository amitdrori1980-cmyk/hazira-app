'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

function CompareMode({ events, allItems, selectedEvent, selectEvent, specItems }) {
  const [sameDay, setSameDay] = useState([])         // events on same day
  const [allSpecs, setAllSpecs] = useState({})        // eventId -> spec items
  const [loading, setLoading] = useState(false)

  const selEv = events.find(e => e.id === selectedEvent)

  useEffect(() => {
    if (!selectedEvent || !selEv?.date) { setSameDay([]); setAllSpecs({}); return }
    // Find all events on same date (excluding selected)
    const same = events.filter(e => e.date === selEv.date && e.id !== selectedEvent)
    setSameDay(same)
    if (!same.length) { setAllSpecs({}); return }
    // Load specs for all same-day events
    setLoading(true)
    Promise.all(same.map(e =>
      supabase.from('spec_items').select('*').eq('event_id', e.id)
        .then(({ data }) => ({ id: e.id, items: data || [] }))
    )).then(results => {
      const map = {}
      results.forEach(r => { map[r.id] = r.items })
      setAllSpecs(map)
      setLoading(false)
    })
  }, [selectedEvent, selEv?.date])

  // Build conflict map: itemId -> { totalQty, events[] }
  const conflictMap = {}
  // Add selected event items
  specItems.forEach(s => {
    if (!conflictMap[s.equipment_item_id]) conflictMap[s.equipment_item_id] = { qty: 0, evs: [] }
    conflictMap[s.equipment_item_id].qty += parseInt(s.quantity || 0)
    conflictMap[s.equipment_item_id].evs.push({ eventId: selectedEvent, qty: parseInt(s.quantity || 0) })
  })
  // Add same-day events
  Object.entries(allSpecs).forEach(([evId, items]) => {
    items.forEach(s => {
      if (!conflictMap[s.equipment_item_id]) conflictMap[s.equipment_item_id] = { qty: 0, evs: [] }
      conflictMap[s.equipment_item_id].qty += parseInt(s.quantity || 0)
      conflictMap[s.equipment_item_id].evs.push({ eventId: evId, qty: parseInt(s.quantity || 0) })
    })
  })

  // Items with actual conflicts (qty > stock or appearing in multiple events)
  const conflicts = Object.entries(conflictMap)
    .filter(([itemId, data]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : Infinity
      return data.evs.length > 1 || data.qty > stock
    })
    .map(([itemId, data]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : null
      return { item, data, stock, overStock: stock && data.qty > stock }
    })
    .filter(c => c.item)

  return (
    <div>
      {/* Event selector */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
        <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע לבדיקה</div>
        <select value={selectedEvent} onChange={e=>selectEvent(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
          <option value="">בחר אירוע...</option>
          {events.map(e=><option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
        </select>
      </div>

      {!selectedEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          בחר אירוע לבדיקת התנגשויות
        </div>
      )}

      {selectedEvent && selEv && (
        <>
          {/* Same day events */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="text-[13px] font-semibold text-gray-800 text-right mb-2">
              אירועים ביום {fmtDate(selEv.date)}
            </div>
            {sameDay.length === 0 ? (
              <div className="text-[12px] text-gray-400 text-right">אין אירועים נוספים ביום זה</div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                {[selEv, ...sameDay].map(e => (
                  <span key={e.id} className={`text-[12px] px-3 py-1.5 rounded-full border ${e.id===selectedEvent?'bg-[#CC1010] text-white border-[#CC1010]':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {e.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Conflicts */}
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-4">טוען...</div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between flex-row-reverse ${conflicts.length>0?'bg-[#FAECE7]':'bg-[#E1F5EE]'}`}>
                <div className={`text-[13px] font-semibold ${conflicts.length>0?'text-[#CC1010]':'text-[#085041]'}`}>
                  {conflicts.length>0 ? `⚠️ ${conflicts.length} התנגשויות ציוד` : '✅ אין התנגשויות'}
                </div>
                <div className="text-[11px] text-gray-500">{specItems.length} פריטים במפרט</div>
              </div>

              {conflicts.map(({ item, data, stock, overStock }) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse">
                  <div className="flex-1 text-right">
                    <div className="text-[13px] font-medium text-gray-800">{item.name}</div>
                    <div className="flex gap-2 justify-end mt-1 flex-wrap">
                      {data.evs.map((ev, i) => {
                        const evObj = events.find(e => e.id === ev.eventId)
                        return (
                          <span key={i} className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {evObj?.title}: ×{ev.qty}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className={`text-[13px] font-bold ${overStock?'text-red-600':'text-[#CC1010]'}`}>
                      {data.qty}/{stock || '∞'}
                    </div>
                    <div className="text-[10px] text-gray-400">סה״כ / מלאי</div>
                    {overStock && <div className="text-[10px] text-red-500 font-bold">חסר {data.qty - stock}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SpecsPage() {
  const [events, setEvents]         = useState([])
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats]       = useState([])
  const [allItems, setAllItems]     = useState([])
  const [specItems, setSpecItems]   = useState([]) // spec_items rows for selected event
  const [selectedEvent, setSelectedEvent] = useState('')
  const [openCat, setOpenCat]   = useState(null)
  const [openSub, setOpenSub]   = useState(null)
  const [compareEvent, setCompareEvent] = useState('')
  const [compareItems, setCompareItems] = useState([])
  const [loading, setLoading]   = useState(true)
  const [mode, setMode]         = useState('spec')

  useEffect(() => {
    async function load() {
      const [{ data: evs }, { data: cats }, { data: subs }, { data: items }] = await Promise.all([
        supabase.from('events').select('id,title,date,venue').order('date'),
        supabase.from('equipment_categories').select('*').order('sort_order'),
        supabase.from('equipment_subcategories').select('*').order('sort_order'),
        supabase.from('equipment_items').select('*').order('name'),
      ])
      setEvents(evs || [])
      setCategories(cats || [])
      setSubcats(subs || [])
      setAllItems(items || [])
      setLoading(false)
    }
    load()
  }, [])

  async function selectEvent(eventId) {
    setSelectedEvent(eventId)
    setOpenCat(null); setOpenSub(null)
    if (!eventId) { setSpecItems([]); return }
    const { data } = await supabase
      .from('spec_items')
      .select('*')
      .eq('event_id', eventId)
    setSpecItems(data || [])
  }

  function isInSpec(itemId) {
    return specItems.some(s => s.equipment_item_id === itemId)
  }

  async function toggleItem(item) {
    if (!selectedEvent) return
    const existing = specItems.find(s => s.equipment_item_id === item.id)
    if (existing) {
      await supabase.from('spec_items').delete().eq('id', existing.id)
      setSpecItems(prev => prev.filter(s => s.id !== existing.id))
    } else {
      // Default quantity = 1 (or max stock if stock is 1)
      const defaultQty = item.units ? '1' : ''
      const { data, error } = await supabase.from('spec_items').insert({
        event_id: selectedEvent,
        equipment_item_id: item.id,
        quantity: defaultQty,
      }).select().single()
      if (!error && data) setSpecItems(prev => [...prev, data])
    }
  }

  async function updateQty(specId, qty) {
    await supabase.from('spec_items').update({ quantity: qty }).eq('id', specId)
    setSpecItems(prev => prev.map(s => s.id === specId ? { ...s, quantity: qty } : s))
  }

  // Build spec display
  const specDisplay = specItems.map(s => {
    const item = allItems.find(i => i.id === s.equipment_item_id)
    const sub  = subcats.find(sub => sub.id === item?.subcategory_id)
    const cat  = categories.find(c => c.id === sub?.category_id)
    return item ? { ...s, item, sub, cat } : null
  }).filter(Boolean)

  const specByCategory = categories.map(cat => ({
    cat,
    items: specDisplay.filter(s => s.cat?.id === cat.id)
  })).filter(g => g.items.length > 0)

  // Conflicts
  const conflicts = specItems.filter(s =>
    compareItems.some(c => c.equipment_item_id === s.equipment_item_id)
  ).map(s => allItems.find(i => i.id === s.equipment_item_id)).filter(Boolean)

  const selEv = events.find(e => e.id === selectedEvent)
  const cmpEv = events.find(e => e.id === compareEvent)

  return (
    <div className="max-w-4xl">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {[{id:'spec',label:'📋 מפרט ציוד'},{id:'compare',label:'⚡ השוואת התנגשויות'}].map(tab=>(
          <button key={tab.id} onClick={()=>setMode(tab.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors ${mode===tab.id?'bg-[#CC1010] text-white border-[#CC1010]':'border-gray-200 text-gray-600 hover:border-[#CC1010]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* SPEC MODE */}
      {mode === 'spec' && (
        <div className="flex gap-4">
          {/* Left: browser */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע</div>
              <select value={selectedEvent} onChange={e=>selectEvent(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
                <option value="">בחר אירוע...</option>
                {events.map(e=><option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
              </select>
            </div>

            {selectedEvent && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                  לקט ציוד
                </div>
                {categories.map(cat => {
                  const catSubs = subcats.filter(s => s.category_id === cat.id)
                  const isOpen  = openCat === cat.id
                  return (
                    <div key={cat.id}>
                      <button onClick={()=>setOpenCat(isOpen?null:cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium border-b border-gray-50 flex-row-reverse ${isOpen?'text-[#CC1010] bg-[#FDEAEA]':'text-gray-700 hover:bg-gray-50'}`}>
                        <span>{cat.name}</span>
                        <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-400`} style={{fontSize:11}}/>
                      </button>
                      {isOpen && catSubs.map(sub => {
                        const items = allItems.filter(i => i.subcategory_id === sub.id)
                        const isSubOpen = openSub === sub.id
                        return (
                          <div key={sub.id}>
                            <button onClick={()=>setOpenSub(isSubOpen?null:sub.id)}
                              className={`w-full flex items-center justify-between px-5 py-2 text-[11px] border-b border-gray-50 flex-row-reverse ${isSubOpen?'text-[#CC1010]':'text-gray-500 hover:bg-gray-50'}`}>
                              <span>{sub.name}</span>
                              <i className={`ti ${isSubOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:10}}/>
                            </button>
                            {isSubOpen && items.map(item => {
                              const inSpec = isInSpec(item.id)
                              return (
                                <button key={item.id} onClick={()=>toggleItem(item)}
                                  className={`w-full flex items-center gap-2 px-6 py-1.5 text-[11px] border-b border-gray-50 flex-row-reverse text-right transition-colors ${inSpec?'bg-[#E1F5EE] text-[#085041]':'text-gray-600 hover:bg-gray-50'}`}>
                                  <i className={`ti ${inSpec?'ti-circle-check':'ti-circle-plus'} flex-shrink-0`}
                                    style={{fontSize:13,color:inSpec?'#22c55e':'#CC1010'}}/>
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
            )}
          </div>

          {/* Right: spec table */}
          <div className="flex-1 min-w-0">
            {!selectedEvent ? (
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
                בחר אירוע להתחלה
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="text-[11px] text-gray-400">{specItems.length} פריטים</div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-gray-800">{selEv?.title}</div>
                    <div className="text-[11px] text-gray-400">{fmtDate(selEv?.date)}{selEv?.venue?` · ${selEv.venue}`:''}</div>
                  </div>
                </div>
                {specDisplay.length === 0 ? (
                  <div className="text-center text-[13px] text-gray-400 py-8">לחץ על פריטים בצד שמאל להוספה</div>
                ) : specByCategory.map(({cat, items}) => (
                  <div key={cat.id}>
                    <div className="px-4 py-2 bg-[#FDEAEA] text-[11px] font-semibold text-[#CC1010] text-right">{cat.name}</div>
                    {items.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                        <span className="flex-1 text-[13px] text-right text-gray-800">{s.item.name}</span>
                        {s.sub && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.sub.name}</span>}
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="number"
                            min="1"
                            max={s.item.units ? parseInt(s.item.units) : undefined}
                            value={s.quantity||''} 
                            onChange={e=>setSpecItems(prev=>prev.map(x=>x.id===s.id?{...x,quantity:e.target.value}:x))}
                            onBlur={e=>updateQty(s.id, e.target.value)}
                            placeholder="כמות"
                            className={`w-16 text-[11px] px-2 py-1 border rounded-lg bg-white outline-none text-center ${
                              s.item.units && parseInt(s.quantity) > parseInt(s.item.units)
                                ? 'border-red-400 bg-red-50 text-red-600'
                                : 'border-gray-200 focus:border-[#CC1010]'
                            }`}
                          />
                          {s.item.units && (
                            <span className={`text-[9px] ${parseInt(s.quantity) > parseInt(s.item.units) ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                              מלאי: {s.item.units}
                            </span>
                          )}
                        </div>
                        <button onClick={()=>toggleItem(s.item)}
                          className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <i className="ti ti-x" style={{fontSize:12}}/>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPARE MODE */}
      {mode === 'compare' && (
        <CompareMode
          events={events}
          allItems={allItems}
          selectedEvent={selectedEvent}
          selectEvent={selectEvent}
          specItems={specItems}
        />
      )}
    </div>
  )
}
