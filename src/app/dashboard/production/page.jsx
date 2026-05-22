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
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #schedule-print, #schedule-print * { visibility: visible; }
          #schedule-print { position: fixed; top: 0; left: 0; width: 100%; direction: rtl; }
          .no-print { display: none !important; }
          #print-logo { display: block !important; }
        }
      `}</style>
      <div id="print-logo" style={{display:'none', textAlign:'center', padding:'12px 0 8px', borderBottom:'2px solid #CC1010', marginBottom:'8px'}}>
        <img src="data:image/png;base64,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" style={{height:'60px', margin:'0 auto'}} alt="הזירה"/>
      </div>
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
