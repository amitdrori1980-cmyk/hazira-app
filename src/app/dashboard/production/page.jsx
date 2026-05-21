'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STATUSES = [
  { value: 'white',  label: 'לא נבדק',           bg: 'bg-white',       text: 'text-gray-600',   ring: 'ring-gray-300',   dot: '#e5e7eb' },
  { value: 'green',  label: 'מוכן לביצוע',        bg: 'bg-green-100',   text: 'text-green-900',  ring: 'ring-green-400',  dot: '#22c55e' },
  { value: 'teal',   label: 'נשלח, ממתין',        bg: 'bg-teal-100',    text: 'text-teal-900',   ring: 'ring-teal-400',   dot: '#14b8a6' },
  { value: 'yellow', label: 'אישר',               bg: 'bg-yellow-100',  text: 'text-yellow-900', ring: 'ring-yellow-400', dot: '#eab308' },
  { value: 'red',    label: 'לא יכול',            bg: 'bg-red-100',     text: 'text-red-900',    ring: 'ring-red-400',    dot: '#ef4444' },
  { value: 'purple', label: 'דורש בירור',         bg: 'bg-purple-100',  text: 'text-purple-900', ring: 'ring-purple-400', dot: '#a855f7' },
]

const getStatus = v => STATUSES.find(s => s.value === v) || STATUSES[0]

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

const DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const VENUES = ['אולם 1','אולם 2','אולם 3','אולם 4','אולם 5','תיאטרון הבית','דירה']
const SLOTS  = 10 // fixed number of slots per event

// Create empty slots array
function emptySlots() {
  return Array.from({length: SLOTS}, (_, i) => ({ slot: i, name: '', status: 'white' }))
}

export default function ProductionPage() {
  const [events, setEvents]       = useState([])
  const [slots, setSlots]         = useState({})   // eventId -> slots[10]
  const [openEvent, setOpenEvent] = useState(null)
  const [loading, setLoading]     = useState(true)

  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent, setNewEvent]         = useState({ event_name:'', date:'', day:'', venue:'' })
  const [savingEvent, setSavingEvent]   = useState(false)

  const [editingEvent, setEditingEvent] = useState(null)
  const [editEventVal, setEditEventVal] = useState({})

  const [savingSlot, setSavingSlot] = useState(null) // `${eventId}-${slot}`
  const [statusPicker, setStatusPicker] = useState(null) // `${eventId}-${slot}`

  useEffect(() => { load() }, [])

  async function load() {
    const { data: evs } = await supabase
      .from('production_events')
      .select('*')
      .order('date', { ascending: false })
    setEvents(evs || [])

    if (evs?.length) {
      const { data: ppl } = await supabase
        .from('production_people')
        .select('*')
        .order('sort_order')

      const map = {}
      evs.forEach(ev => {
        const evPpl = (ppl || []).filter(p => p.production_event_id === ev.id)
        const arr = emptySlots()
        evPpl.forEach(p => {
          if (p.sort_order >= 0 && p.sort_order < SLOTS) {
            arr[p.sort_order] = { slot: p.sort_order, name: p.name, status: p.status, id: p.id }
          }
        })
        map[ev.id] = arr
      })
      setSlots(map)
    }
    setLoading(false)
  }

  async function addEvent(e) {
    e.preventDefault()
    if (!newEvent.event_name.trim()) return
    setSavingEvent(true)
    const { data, error } = await supabase.from('production_events').insert(newEvent).select().single()
    if (!error) {
      setEvents(prev => [data, ...prev])
      setSlots(prev => ({ ...prev, [data.id]: emptySlots() }))
      setOpenEvent(data.id)
    }
    setNewEvent({ event_name:'', date:'', day:'', venue:'' })
    setShowNewEvent(false)
    setSavingEvent(false)
  }

  async function saveEvent(id) {
    await supabase.from('production_events').update(editEventVal).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...editEventVal } : e))
    setEditingEvent(null)
  }

  async function deleteEvent(id) {
    await supabase.from('production_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setSlots(prev => { const n={...prev}; delete n[id]; return n })
  }

  async function updateSlot(eventId, slotIdx, field, value) {
    const key = `${eventId}-${slotIdx}`
    setSavingSlot(key)

    const currentSlots = slots[eventId] || emptySlots()
    const slot = currentSlots[slotIdx]

    const newSlots = currentSlots.map((s, i) =>
      i === slotIdx ? { ...s, [field]: value } : s
    )
    setSlots(prev => ({ ...prev, [eventId]: newSlots }))

    const updatedSlot = newSlots[slotIdx]

    if (slot.id) {
      // Update existing
      await supabase.from('production_people')
        .update({ name: updatedSlot.name, status: updatedSlot.status })
        .eq('id', slot.id)
    } else if (updatedSlot.name.trim()) {
      // Insert new
      const { data } = await supabase.from('production_people').insert({
        production_event_id: eventId,
        name: updatedSlot.name,
        status: updatedSlot.status,
        sort_order: slotIdx,
      }).select().single()
      if (data) {
        setSlots(prev => ({
          ...prev,
          [eventId]: prev[eventId].map((s, i) => i === slotIdx ? { ...s, id: data.id } : s)
        }))
      }
    }
    setSavingSlot(null)
  }

  async function setSlotStatus(eventId, slotIdx, status) {
    setStatusPicker(null)
    await updateSlot(eventId, slotIdx, 'status', status)
  }

  return (
    <div className="max-w-2xl" onClick={() => setStatusPicker(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] font-semibold text-gray-800">הפקה טכנית</div>
        <button onClick={() => setShowNewEvent(!showNewEvent)}
          className="text-[12px] bg-[#CC1010] text-white px-4 py-2 rounded-lg hover:bg-[#a00c0c] flex items-center gap-1">
          <i className="ti ti-plus"/> אירוע חדש
        </button>
      </div>

      {/* New event form */}
      {showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">אירוע חדש</div>
          <form onSubmit={addEvent} className="flex flex-col gap-2">
            <input value={newEvent.event_name} onChange={e=>setNewEvent(n=>({...n,event_name:e.target.value}))}
              placeholder="שם האירוע *" required
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"/>
            <div className="grid grid-cols-3 gap-2">
              <input value={newEvent.date} onChange={e=>setNewEvent(n=>({...n,date:e.target.value}))} type="date"
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"/>
              <select value={newEvent.day} onChange={e=>setNewEvent(n=>({...n,day:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">יום...</option>
                {DAYS.map(d=><option key={d}>{d}</option>)}
              </select>
              <select value={newEvent.venue} onChange={e=>setNewEvent(n=>({...n,venue:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">מקום...</option>
                {VENUES.map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingEvent}
                className="flex-1 bg-[#CC1010] text-white text-sm py-2 rounded-lg hover:bg-[#a00c0c] disabled:opacity-50">
                {savingEvent ? 'שומר...' : 'הוסף'}
              </button>
              <button type="button" onClick={()=>setShowNewEvent(false)}
                className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg">ביטול</button>
            </div>
          </form>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-end">
          {STATUSES.map(s => (
            <div key={s.value} className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">{s.label}</span>
              <div className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{background: s.dot}}/>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">טוען...</div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין אירועים — לחץ "אירוע חדש"
        </div>
      ) : events.map(ev => {
        const isOpen   = openEvent === ev.id
        const evSlots  = slots[ev.id] || emptySlots()
        const filled   = evSlots.filter(s => s.name.trim())
        const statusSummary = STATUSES
          .map(s => ({ ...s, count: filled.filter(p => p.status === s.value).length }))
          .filter(s => s.count > 0)

        return (
          <div key={ev.id} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            {/* Event header */}
            {editingEvent === ev.id ? (
              <div className="p-4 flex flex-col gap-2">
                <input value={editEventVal.event_name} onChange={e=>setEditEventVal(v=>({...v,event_name:e.target.value}))}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"/>
                <div className="grid grid-cols-3 gap-2">
                  <input value={editEventVal.date||''} onChange={e=>setEditEventVal(v=>({...v,date:e.target.value}))} type="date"
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"/>
                  <select value={editEventVal.day||''} onChange={e=>setEditEventVal(v=>({...v,day:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    <option value="">יום...</option>
                    {DAYS.map(d=><option key={d}>{d}</option>)}
                  </select>
                  <select value={editEventVal.venue||''} onChange={e=>setEditEventVal(v=>({...v,venue:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    <option value="">מקום...</option>
                    {VENUES.map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>saveEvent(ev.id)} className="flex-1 bg-[#CC1010] text-white text-sm py-1.5 rounded-lg">שמור</button>
                  <button onClick={()=>setEditingEvent(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse group"
                onClick={()=>setOpenEvent(isOpen?null:ev.id)}>
                <div className="flex-1 text-right">
                  <div className="text-[14px] font-semibold text-gray-800">{ev.event_name}</div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2 justify-end mt-0.5">
                    {ev.date && <span>{fmtDate(ev.date)}</span>}
                    {ev.day  && <span>יום {ev.day}</span>}
                    {ev.venue && <span><i className="ti ti-map-pin text-[#CC1010]" style={{fontSize:10}}/> {ev.venue}</span>}
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  {statusSummary.map(s=>(
                    <div key={s.value} className="flex items-center gap-0.5">
                      <span className="text-[10px] text-gray-400">{s.count}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{background:s.dot}}/>
                    </div>
                  ))}
                  <span className="text-[11px] text-gray-400 mr-1">{filled.length}/{SLOTS}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{setEditingEvent(ev.id);setEditEventVal({event_name:ev.event_name,date:ev.date||'',day:ev.day||'',venue:ev.venue||''})}}
                    className="text-gray-300 hover:text-[#CC1010]"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                  <button onClick={()=>deleteEvent(ev.id)}
                    className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                </div>
                <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            )}

            {/* Slots grid */}
            {isOpen && (
              <div className="border-t border-gray-100 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {evSlots.map((slot, i) => {
                    const st  = getStatus(slot.status)
                    const key = `${ev.id}-${i}`
                    const isPickerOpen = statusPicker === key

                    return (
                      <div key={i} className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${st.bg} ${st.ring.replace('ring','border')}`}>
                        {/* Slot number */}
                        <span className="text-[10px] text-gray-400 flex-shrink-0 w-4 text-center">{i+1}</span>

                        {/* Name input */}
                        <input
                          value={slot.name}
                          onChange={e => {
                            const newSlots = (slots[ev.id]||emptySlots()).map((s,idx)=>idx===i?{...s,name:e.target.value}:s)
                            setSlots(prev=>({...prev,[ev.id]:newSlots}))
                          }}
                          onBlur={e => updateSlot(ev.id, i, 'name', e.target.value)}
                          placeholder={`תא ${i+1}`}
                          className={`flex-1 text-[13px] font-medium bg-transparent outline-none text-right ${st.text} placeholder-gray-300`}
                        />

                        {/* Color picker button */}
                        <button
                          onClick={e => { e.stopPropagation(); setStatusPicker(isPickerOpen ? null : key) }}
                          className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 transition-transform hover:scale-110"
                          style={{ background: st.dot }}
                        />

                        {/* Color picker dropdown */}
                        {isPickerOpen && (
                          <div className="absolute left-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[160px]"
                            onClick={e=>e.stopPropagation()}>
                            {STATUSES.map(s => (
                              <button key={s.value}
                                onClick={() => setSlotStatus(ev.id, i, s.value)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] hover:bg-gray-50 text-right ${slot.status===s.value?'font-semibold':''}`}>
                                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{background:s.dot}}/>
                                <span className="flex-1">{s.label}</span>
                                {slot.status===s.value && <i className="ti ti-check text-[#CC1010]" style={{fontSize:11}}/>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
