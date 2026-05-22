'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx-js-style'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

// ─── בדיקת פניות ───────────────────────────────────────────────
const STATUSES = [
  { value: 'white',  label: 'לא נבדק',    bg: 'bg-white',       text: 'text-gray-600',   ring: 'ring-gray-300',   dot: '#e5e7eb' },
  { value: 'green',  label: 'מוכן לביצוע', bg: 'bg-green-100',   text: 'text-green-900',  ring: 'ring-green-400',  dot: '#22c55e' },
  { value: 'teal',   label: 'נשלח, ממתין', bg: 'bg-teal-100',    text: 'text-teal-900',   ring: 'ring-teal-400',   dot: '#14b8a6' },
  { value: 'yellow', label: 'אישר',        bg: 'bg-yellow-100',  text: 'text-yellow-900', ring: 'ring-yellow-400', dot: '#eab308' },
  { value: 'red',    label: 'לא יכול',     bg: 'bg-red-100',     text: 'text-red-900',    ring: 'ring-red-400',    dot: '#ef4444' },
  { value: 'purple', label: 'דורש בירור',  bg: 'bg-purple-100',  text: 'text-purple-900', ring: 'ring-purple-400', dot: '#a855f7' },
]
const getStatus = v => STATUSES.find(s => s.value === v) || STATUSES[0]
const DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const VENUES = ['אולם 1','אולם 2','אולם 3','אולם 4','אולם 5','תיאטרון הבית','דירה']
const SLOTS  = 10
function emptySlots() {
  return Array.from({length: SLOTS}, (_, i) => ({ slot: i, name: '', status: 'white' }))
}

function ProductionInquiries() {
  const [events, setEvents]       = useState([])
  const [slots, setSlots]         = useState({})
  const [openEvent, setOpenEvent] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent, setNewEvent]         = useState({ event_name:'', date:'', day:'', venue:'' })
  const [savingEvent, setSavingEvent]   = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [editEventVal, setEditEventVal] = useState({})
  const [savingSlot, setSavingSlot] = useState(null)
  const [statusPicker, setStatusPicker] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: evs } = await supabase.from('production_events').select('*').order('date', { ascending: true })
    setEvents(evs || [])
    if (evs?.length) {
      const { data: ppl } = await supabase.from('production_people').select('*').in('event_id', evs.map(e => e.id))
      const map = {}
      evs.forEach(e => { map[e.id] = emptySlots() })
      ;(ppl || []).forEach(p => {
        if (map[p.event_id] && p.slot < SLOTS) {
          map[p.event_id][p.slot] = { slot: p.slot, name: p.name || '', status: p.status || 'white' }
        }
      })
      setSlots(map)
    }
    setLoading(false)
  }

  async function addEvent() {
    if (!newEvent.event_name.trim()) return
    setSavingEvent(true)
    const { data } = await supabase.from('production_events').insert({
      event_name: newEvent.event_name.trim(), date: newEvent.date || null,
      day: newEvent.day || null, venue: newEvent.venue || null,
    }).select().single()
    if (data) {
      setEvents(prev => [...prev, data].sort((a,b) => (a.date||'').localeCompare(b.date||'')))
      setSlots(prev => ({ ...prev, [data.id]: emptySlots() }))
      setNewEvent({ event_name:'', date:'', day:'', venue:'' })
      setShowNewEvent(false)
      setOpenEvent(data.id)
    }
    setSavingEvent(false)
  }

  async function saveEventEdit() {
    if (!editingEvent) return
    await supabase.from('production_events').update(editEventVal).eq('id', editingEvent)
    setEvents(prev => prev.map(e => e.id === editingEvent ? { ...e, ...editEventVal } : e))
    setEditingEvent(null)
  }

  async function deleteEvent(id) {
    await supabase.from('production_people').delete().eq('event_id', id)
    await supabase.from('production_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setSlots(prev => { const n = {...prev}; delete n[id]; return n })
    if (openEvent === id) setOpenEvent(null)
  }

  async function updateSlotName(eventId, slotIdx, name) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], name }
      return { ...prev, [eventId]: updated }
    })
  }

  async function saveSlotName(eventId, slotIdx) {
    const slot = (slots[eventId] || emptySlots())[slotIdx]
    await supabase.from('production_people').upsert({
      event_id: eventId, slot: slotIdx, name: slot.name, status: slot.status,
    }, { onConflict: 'event_id,slot' })
  }

  async function updateSlotStatus(eventId, slotIdx, status) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], status }
      return { ...prev, [eventId]: updated }
    })
    setStatusPicker(null)
    await supabase.from('production_people').upsert({
      event_id: eventId, slot: slotIdx,
      name: (slots[eventId]||emptySlots())[slotIdx].name, status,
    }, { onConflict: 'event_id,slot' })
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-3xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNewEvent(v => !v)}
          className="bg-[#CC1010] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#a00c0c] flex items-center gap-1">
          <i className="ti ti-plus"/> אירוע חדש
        </button>
      </div>

      {showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-700 mb-3 text-right">הוסף אירוע חדש</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input value={newEvent.event_name} onChange={e=>setNewEvent(p=>({...p,event_name:e.target.value}))}
              placeholder="שם האירוע *" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] text-right col-span-2"/>
            <input type="date" value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"/>
            <select value={newEvent.day} onChange={e=>setNewEvent(p=>({...p,day:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
              <option value="">יום בשבוע</option>
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={newEvent.venue} onChange={e=>setNewEvent(p=>({...p,venue:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] col-span-2">
              <option value="">בחר אולם</option>
              {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addEvent} disabled={savingEvent || !newEvent.event_name.trim()}
              className="flex-1 bg-[#CC1010] text-white text-sm py-2 rounded-lg hover:bg-[#a00c0c] disabled:opacity-50">
              {savingEvent ? 'שומר...' : 'הוסף'}
            </button>
            <button onClick={()=>setShowNewEvent(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">ביטול</button>
          </div>
        </div>
      )}

      {events.length === 0 && !showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין אירועים — לחץ על "אירוע חדש" להתחלה
        </div>
      )}

      {events.map(ev => {
        const evSlots = slots[ev.id] || emptySlots()
        const isOpen = openEvent === ev.id
        const filledCount = evSlots.filter(s => s.name.trim()).length
        const statCounts = STATUSES.slice(1).map(s => ({
          ...s, count: evSlots.filter(x => x.status === s.value && x.name.trim()).length
        })).filter(s => s.count > 0)

        return (
          <div key={ev.id} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => setOpenEvent(isOpen ? null : ev.id)}>
              <div className="flex-1 text-right">
                {editingEvent === ev.id ? (
                  <div className="flex gap-2 flex-row-reverse" onClick={e=>e.stopPropagation()}>
                    <input value={editEventVal.event_name||''} onChange={e=>setEditEventVal(p=>({...p,event_name:e.target.value}))}
                      className="text-sm font-medium px-2 py-1 border border-[#CC1010] rounded-lg outline-none text-right flex-1"/>
                    <input type="date" value={editEventVal.date||''} onChange={e=>setEditEventVal(p=>({...p,date:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none"/>
                    <select value={editEventVal.venue||''} onChange={e=>setEditEventVal(p=>({...p,venue:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none">
                      <option value="">אולם</option>
                      {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                    <button onClick={saveEventEdit} className="text-[#CC1010] text-sm font-medium">שמור</button>
                    <button onClick={()=>setEditingEvent(null)} className="text-gray-400 text-sm">ביטול</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[13px] font-semibold text-gray-800">{ev.event_name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex gap-2 justify-end flex-wrap">
                      {ev.date && <span>{fmtDate(ev.date)}</span>}
                      {ev.day && <span>יום {ev.day}</span>}
                      {ev.venue && <span>{ev.venue}</span>}
                      <span className="text-gray-300">·</span>
                      <span>{filledCount}/{SLOTS} אנשים</span>
                    </div>
                    {statCounts.length > 0 && (
                      <div className="flex gap-1.5 justify-end mt-1 flex-wrap">
                        {statCounts.map(s => (
                          <span key={s.value} className={`text-[10px] px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                            {s.label} {s.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={e=>{e.stopPropagation();setEditingEvent(ev.id);setEditEventVal({event_name:ev.event_name,date:ev.date||'',day:ev.day||'',venue:ev.venue||''})}}
                  className="text-gray-300 hover:text-gray-600 p-1"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                <button onClick={e=>{e.stopPropagation();if(window.confirm('למחוק את האירוע?'))deleteEvent(ev.id)}}
                  className="text-gray-300 hover:text-red-500 p-1"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-50">
                <div className="px-3 py-2 bg-gray-50 flex gap-2 flex-wrap justify-end">
                  {STATUSES.map(s => (
                    <span key={s.value} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <span className="w-2 h-2 rounded-full inline-block" style={{background:s.dot}}/>
                      {s.label}
                    </span>
                  ))}
                </div>
                {evSlots.map((slot, idx) => {
                  const st = getStatus(slot.status)
                  const pickerKey = `${ev.id}-${idx}`
                  const isPickerOpen = statusPicker === pickerKey
                  return (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse ${st.bg} transition-colors`}>
                      <span className="text-[11px] text-gray-400 w-5 text-center">{idx+1}</span>
                      <input
                        value={slot.name}
                        onChange={e => updateSlotName(ev.id, idx, e.target.value)}
                        onBlur={() => saveSlotName(ev.id, idx)}
                        placeholder={`איש צוות ${idx+1}`}
                        className={`flex-1 text-[13px] bg-transparent outline-none text-right ${st.text} placeholder:text-gray-300`}
                      />
                      <div className="relative">
                        <button onClick={() => setStatusPicker(isPickerOpen ? null : pickerKey)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ring-2 ${st.ring} transition-all`}
                          style={{background: st.dot}}>
                        </button>
                        {isPickerOpen && (
                          <div className="absolute left-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[140px]">
                            {STATUSES.map(s => (
                              <button key={s.value} onClick={() => updateSlotStatus(ev.id, idx, s.value)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] ${s.bg} ${s.text} hover:opacity-80 text-right`}>
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{background:s.dot}}/>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── לוז הפקה ──────────────────────────────────────────────────
const VISIBLE_OPTIONS = [
  { value: 'managers', label: 'מנהלים בלבד' },
  { value: 'all',      label: 'כולם' },
  { value: 'dept_tech', label: 'מחלקה טכנית' },
  { value: 'dept_prod', label: 'מחלקת הפקה' },
]

function ProductionSchedule({ profile }) {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.from('events').select('id,title,date,venue').order('date').then(({ data }) => setEvents(data || []))
  }, [])

  async function selectEvent(eventId) {
    setSelectedEvent(eventId)
    setSchedule(null); setRows([])
    if (!eventId) return
    setLoading(true)
    const { data: sch } = await supabase.from('schedules').select('*').eq('event_id', eventId).single()
    if (sch) {
      setSchedule(sch)
      const { data: r } = await supabase.from('schedule_rows').select('*').eq('schedule_id', sch.id).order('sort_order')
      setRows(r || [])
    }
    setLoading(false)
  }

  async function createSchedule() {
    if (!selectedEvent) return
    const { data } = await supabase.from('schedules').insert({
      event_id: selectedEvent, status: 'draft', participants: '', visible_to: 'managers',
    }).select().single()
    setSchedule(data); setRows([])
  }

  async function updateSchedule(field, value) {
    if (!schedule) return
    await supabase.from('schedules').update({ [field]: value }).eq('id', schedule.id)
    setSchedule(prev => ({ ...prev, [field]: value }))
  }

  async function addRow() {
    if (!schedule) return
    const { data } = await supabase.from('schedule_rows').insert({
      schedule_id: schedule.id, time: '', what: '', who: '', notes: '', sort_order: rows.length,
    }).select().single()
    if (data) setRows(prev => [...prev, data])
  }

  async function updateRow(rowId, field, value) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
    await supabase.from('schedule_rows').update({ [field]: value }).eq('id', rowId)
  }

  async function deleteRow(rowId) {
    await supabase.from('schedule_rows').delete().eq('id', rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  async function moveRow(index, dir) {
    const newRows = [...rows]
    const target = index + dir
    if (target < 0 || target >= newRows.length) return
    ;[newRows[index], newRows[target]] = [newRows[target], newRows[index]]
    setRows(newRows)
    await Promise.all(newRows.map((r, i) =>
      supabase.from('schedule_rows').update({ sort_order: i }).eq('id', r.id)
    ))
  }

  function canView() {
    if (!schedule || !profile) return false
    if (profile.is_manager) return true
    if (schedule.status === 'final') return true
    if (schedule.visible_to === 'all') return true
    return false
  }

  async function exportExcel() {
    if (!schedule || !selEv) return
    setExporting(true)
    const wb = XLSX.utils.book_new()
    const ws = {}
    const borderThin = { top:{style:'thin',color:{rgb:'999999'}}, bottom:{style:'thin',color:{rgb:'999999'}}, left:{style:'thin',color:{rgb:'999999'}}, right:{style:'thin',color:{rgb:'999999'}} }
    ws['A1'] = { v: `לו"ז: ${selEv.title}`, t:'s', s:{ font:{bold:true,sz:16,name:'Calibri',color:{rgb:'CC1010'}}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A2'] = { v: `תאריך: ${fmtDate(selEv.date)}${selEv.venue?` | ${selEv.venue}`:''}`, t:'s', s:{ font:{sz:12,name:'Calibri',color:{rgb:'666666'}}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A3'] = { v: `משתתפים: ${schedule.participants||''}`, t:'s', s:{ font:{sz:12,name:'Calibri',italic:true}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A4'] = { v:'', t:'s' }
    const headers = ['שעה','מה','מי','הערות']
    headers.forEach((h,ci) => {
      const ref = XLSX.utils.encode_cell({r:4,c:ci})
      ws[ref] = { v:h, t:'s', s:{ fill:{patternType:'solid',fgColor:{rgb:'CC1010'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:12,name:'Calibri'}, alignment:{horizontal:'right',vertical:'center',readingOrder:2}, border:borderThin } }
    })
    rows.forEach((row,ri) => {
      const isOdd = ri%2!==0
      const vals = [row.time||'',row.what||'',row.who||'',row.notes||'']
      vals.forEach((v,ci) => {
        const ref = XLSX.utils.encode_cell({r:ri+5,c:ci})
        ws[ref] = { v, t:'s', s:{ fill:{patternType:'solid',fgColor:{rgb:isOdd?'FFF0F0':'FFFFFF'}}, font:{sz:12,name:'Calibri'}, alignment:{horizontal:'right',vertical:'center',readingOrder:2,wrapText:true}, border:borderThin } }
      })
    })
    ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length+5,c:3}})
    ws['!views'] = [{rightToLeft:true}]
    ws['!cols'] = [{wch:10},{wch:35},{wch:25},{wch:30}]
    ws['!rows'] = [{hpt:28},{hpt:18},{hpt:18},{hpt:10},{hpt:22},...rows.map(()=>({hpt:20}))]
    ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}},{s:{r:2,c:0},e:{r:2,c:3}}]
    XLSX.utils.book_append_sheet(wb, ws, 'לוז')
    XLSX.writeFile(wb, `לוז_${selEv.title}_${selEv.date}.xlsx`)
    setExporting(false)
  }

  const selEv = events.find(e => e.id === selectedEvent)
  const isManager = profile?.is_manager

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #schedule-print, #schedule-print * { visibility: visible; } #schedule-print { position: fixed; top: 0; left: 0; width: 100%; direction: rtl; } .no-print { display: none !important; } }`}</style>
      <div className="max-w-4xl">
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 no-print">
          <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע</div>
          <select value={selectedEvent} onChange={e => selectEvent(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
            <option value="">בחר אירוע...</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
          </select>
        </div>

        {loading && <div className="text-center text-gray-400 py-8">טוען...</div>}

        {selectedEvent && !loading && !schedule && isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center no-print">
            <div className="text-[14px] text-gray-500 mb-4">אין לוז לאירוע זה עדיין</div>
            <button onClick={createSchedule} className="bg-[#CC1010] text-white px-6 py-2.5 rounded-lg text-sm hover:bg-[#a00c0c]">+ צור לוז חדש</button>
          </div>
        )}

        {selectedEvent && !loading && !schedule && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">אין לוז זמין לאירוע זה</div>
        )}

        {schedule && (canView() || isManager) && (
          <>
            {isManager && (
              <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap no-print">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">סטטוס:</span>
                  <button onClick={() => updateSchedule('status', schedule.status==='draft'?'final':'draft')}
                    className={`text-[12px] px-3 py-1.5 rounded-full border font-medium transition-colors ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041] border-[#085041]':'bg-[#FAEEDA] text-[#633806] border-[#633806]'}`}>
                    {schedule.status==='final' ? '✅ סופי' : '✏️ בעבודה'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">גלוי ל:</span>
                  <select value={schedule.visible_to} onChange={e => updateSchedule('visible_to', e.target.value)}
                    className="text-[12px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
                    {VISIBLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex-1"/>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 disabled:opacity-50">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> אקסל
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> PDF
                </button>
              </div>
            )}

            {!isManager && schedule.status==='final' && (
              <div className="flex gap-2 mb-4 justify-end no-print">
                <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 bg-white">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> ייצוא לאקסל
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 bg-white">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> ייצוא PDF
                </button>
              </div>
            )}

            <div id="schedule-print" className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100" style={{borderRight:'4px solid #CC1010'}}>
                <div className="flex items-start justify-between flex-row-reverse">
                  <div className="text-right">
                    <div className="text-[20px] font-bold text-gray-900">{selEv?.title}</div>
                    <div className="text-[13px] text-gray-500 mt-0.5">{fmtDate(selEv?.date)}{selEv?.venue?` · ${selEv.venue}`:''}</div>
                  </div>
                  <div className={`text-[11px] px-2.5 py-1 rounded-full font-medium no-print ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041]':'bg-[#FAEEDA] text-[#633806]'}`}>
                    {schedule.status==='final' ? '✅ סופי' : '✏️ בעבודה'}
                  </div>
                </div>
                <div className="mt-3">
                  {isManager ? (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">משתתפים:</span>
                      <input value={schedule.participants||''}
                        onChange={e => setSchedule(prev => ({...prev, participants: e.target.value}))}
                        onBlur={e => updateSchedule('participants', e.target.value)}
                        placeholder="רשימת משתתפים..."
                        className="flex-1 text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] text-right no-print"/>
                    </div>
                  ) : schedule.participants && (
                    <div className="text-[13px] text-gray-600 text-right">
                      <span className="text-[11px] text-gray-400 ml-1">משתתפים:</span>{schedule.participants}
                    </div>
                  )}
                </div>
              </div>

              <div className={`grid gap-0 bg-[#CC1010] text-white text-[12px] font-semibold no-print ${isManager?'grid-cols-[80px_1fr_1fr_1fr_40px]':'grid-cols-[80px_1fr_1fr_1fr]'}`}>
                <div className="px-3 py-2.5 text-right">שעה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
                {isManager && <div className="px-2 py-2.5"/>}
              </div>

              {rows.length === 0 && (
                <div className="text-center text-[13px] text-gray-400 py-8 no-print">
                  {isManager ? 'לחץ על "הוסף שורה" כדי להתחיל' : 'הלוז ריק'}
                </div>
              )}

              {rows.map((row, index) => (
                <div key={row.id}
                  className={`grid gap-0 border-b border-gray-50 group ${isManager?'grid-cols-[80px_1fr_1fr_1fr_40px]':'grid-cols-[80px_1fr_1fr_1fr]'} ${index%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                  {isManager ? (
                    <>
                      <input value={row.time||''} onChange={e=>updateRow(row.id,'time',e.target.value)} placeholder="00:00"
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono"/>
                      <input value={row.what||''} onChange={e=>updateRow(row.id,'what',e.target.value)} placeholder="תיאור..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100"/>
                      <input value={row.who||''} onChange={e=>updateRow(row.id,'who',e.target.value)} placeholder="שם / תפקיד..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100"/>
                      <input value={row.notes||''} onChange={e=>updateRow(row.id,'notes',e.target.value)} placeholder="הערות..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500"/>
                      <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveRow(index,-1)} disabled={index===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-up" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => deleteRow(row.id)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <i className="ti ti-trash" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => moveRow(index,1)} disabled={index===rows.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-down" style={{fontSize:11}}/>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 font-mono text-[#CC1010] font-medium">{row.time}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100">{row.what}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 text-gray-600">{row.who}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right text-gray-400">{row.notes}</div>
                    </>
                  )}
                </div>
              ))}

              {isManager && (
                <button onClick={addRow}
                  className="w-full py-3 text-[13px] text-gray-400 hover:text-[#CC1010] hover:bg-[#FDEAEA] transition-colors flex items-center justify-center gap-1 no-print">
                  <i className="ti ti-plus" style={{fontSize:13}}/> הוסף שורה
                </button>
              )}
            </div>
          </>
        )}

        {schedule && !canView() && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">הלוז עדיין לא זמין לצפייה</div>
        )}
      </div>
    </>
  )
}

// ─── דף ראשי עם טאבים ──────────────────────────────────────────
export default function ProductionPage() {
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('inquiries')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
    })
  }, [])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[
          { id: 'inquiries', label: '👥 בדיקת פניות' },
          { id: 'schedule',  label: '📋 לוז הפקה' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors ${tab===t.id?'bg-[#CC1010] text-white border-[#CC1010]':'border-gray-200 text-gray-600 hover:border-[#CC1010]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inquiries' && <ProductionInquiries />}
      {tab === 'schedule'  && <ProductionSchedule profile={profile} />}
    </div>
  )
}
