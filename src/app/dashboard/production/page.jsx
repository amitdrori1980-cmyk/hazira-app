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

const STATUSES = [
  { value: 'white',  label: 'לא נבדק',    bg: 'bg-white',       text: 'text-gray-600',   ring: 'ring-gray-300',   dot: '#e5e7eb' },
  { value: 'green',  label: 'מוכן לבדיקה', bg: 'bg-green-100',   text: 'text-green-900',  ring: 'ring-green-400',  dot: '#22c55e' },
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
  const [statusPicker, setStatusPicker] = useState(null)
  const [collapsedEvents, setCollapsedEvents] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: evs } = await supabase.from('production_events').select('*').order('date', { ascending: true })
    setEvents(evs || [])
    if (evs?.length) {
      const { data: ppl } = await supabase.from('production_people').select('*').in('production_event_id', evs.map(e => e.id))
      const map = {}
      evs.forEach(e => { map[e.id] = emptySlots() })
      ;(ppl || []).forEach(p => {
        if (map[p.production_event_id] && p.slot < SLOTS) {
          map[p.production_event_id][p.slot] = { slot: p.slot, name: p.name || '', status: p.status || 'white' }
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

  async function pushToCalendar(ev) {
    const evSlots = slots[ev.id] || emptySlots()
    const crewNames = evSlots.filter(s => s.name.trim()).map(s => s.name.trim())
    const crewList = crewNames.length ? 'צוות:\n' + crewNames.join('\n') : ''
    const dayStr = ev.day ? `יום ${ev.day}` : ''
    const description = [dayStr, crewList].filter(Boolean).join('\n')
    const { error } = await supabase.from('events').insert({
      title: ev.event_name,
      date: ev.date || null,
      time: null,
      type: 'show',
      venue: ev.venue || null,
      description: description || null,
    })
    if (!error) alert('האירוע נוסף ליומן!')
    else alert('שגיאה: ' + error.message)
  }

  async function saveEventEdit() {
    if (!editingEvent) return
    await supabase.from('production_events').update(editEventVal).eq('id', editingEvent)
    setEvents(prev => prev.map(e => e.id === editingEvent ? { ...e, ...editEventVal } : e))
    setEditingEvent(null)
  }

  async function deleteEvent(id) {
    await supabase.from('production_people').delete().eq('production_event_id', id)
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
      production_event_id: eventId, slot: slotIdx, name: slot.name, status: slot.status,
    }, { onConflict: 'production_event_id,slot' })
  }

  async function updateSlotStatus(eventId, slotIdx, status) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], status }
      return { ...prev, [eventId]: updated }
    })
    setStatusPicker(null)
    await supabase.from('production_people').upsert({
      production_event_id: eventId, slot: slotIdx,
      name: (slots[eventId]||emptySlots())[slotIdx].name, status,
    }, { onConflict: 'production_event_id,slot' })
  }


  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-3xl">
<div className="flex justify-end mb-4">
        <button onClick={() => setShowNewEvent(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus"/> אירוע חדש
        </button>
      </div>
      {showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-700 mb-3 text-right">הוסף אירוע חדש</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input value={newEvent.event_name} onChange={e=>setNewEvent(p=>({...p,event_name:e.target.value}))}
              placeholder="שם האירוע *" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right col-span-2"/>
            <input type="date" value={newEvent.date} onChange={e=>{
              const d=e.target.value
              const day=d?['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(d).getDay()]:''
              setNewEvent(p=>({...p,date:d,day}))
            }}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <select value={newEvent.day} onChange={e=>setNewEvent(p=>({...p,day:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
              <option value="">יום בשבוע</option>
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <input type="time" value={newEvent.time||''} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <select value={newEvent.venue} onChange={e=>setNewEvent(p=>({...p,venue:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] col-span-2">
              <option value="">בחר אולם</option>
              {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addEvent} disabled={savingEvent || !newEvent.event_name.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
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
                      className="text-sm font-medium px-2 py-1 border border-[#E0197D] rounded-lg outline-none text-right flex-1"/>
                    <input type="date" value={editEventVal.date||''} onChange={e=>setEditEventVal(p=>({...p,date:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none"/>
                    <select value={editEventVal.venue||''} onChange={e=>setEditEventVal(p=>({...p,venue:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none">
                      <option value="">אולם</option>
                      {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                    <button onClick={saveEventEdit} className="text-[#E0197D] text-sm font-medium">שמור</button>
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
                <button onClick={e=>{e.stopPropagation();setCollapsedEvents(p=>({...p,[ev.id]:!p[ev.id]}))}}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title={collapsedEvents[ev.id]?'הרחב':'כווץ'}>
                  <i className={`ti ${collapsedEvents[ev.id]?'ti-layout-list':'ti-layout-navbar-collapse'}`} style={{fontSize:13}}/></button>
                <button onClick={e=>{e.stopPropagation();pushToCalendar(ev)}}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="עדכן ביומן">
                  <i className="ti ti-calendar-plus" style={{fontSize:13}}/></button>
                <button onClick={e=>{e.stopPropagation();setEditingEvent(ev.id);setEditEventVal({event_name:ev.event_name,date:ev.date||'',day:ev.day||'',venue:ev.venue||''})}}
                  className="text-gray-300 hover:text-gray-600 p-1"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                <button onClick={e=>{e.stopPropagation();if(window.confirm('למחוק את האירוע?'))deleteEvent(ev.id)}}
                  className="text-gray-300 hover:text-red-500 p-1"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            </div>
            {isOpen && !collapsedEvents[ev.id] && (
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
                      <input value={slot.name} onChange={e => updateSlotName(ev.id, idx, e.target.value)}
                        onBlur={() => saveSlotName(ev.id, idx)} placeholder={`איש צוות ${idx+1}`}
                        className={`flex-1 text-[13px] bg-transparent outline-none text-right ${st.text} placeholder:text-gray-300`}/>
                      <div className="relative">
                        <button onClick={() => setStatusPicker(isPickerOpen ? null : pickerKey)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ring-2 ${st.ring} transition-all`}
                          style={{background: st.dot}}/>
                        {isPickerOpen && (
                          <div className="absolute right-0 z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-col gap-1 w-[150px]" style={{boxShadow:"0 8px 32px rgba(0,0,0,0.18)", top: idx < 3 ? "2rem" : "auto", bottom: idx >= 3 ? "2rem" : "auto"}}>
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

function LoadFromGeneralSchedules({ onLoad, onImportExcel }) {
  const [files, setFiles] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const FOLDER = 'schedules-general'

  const isExcel = name => /\.(xlsx|xls)$/i.test(name)

  async function loadFiles() {
    setLoading(true)
    const { data } = await supabase.storage.from('venues').list(FOLDER, { sortBy: { column: 'name', order: 'asc' } })
    setFiles((data || []).filter(f => f.name !== '.emptydir'))
    setLoading(false)
  }

  function handleOpen() {
    setOpen(v => !v)
    loadFiles()
  }

  function openFile(fileName) {
    const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${fileName}`)
    onLoad(data.publicUrl, fileName)
    setOpen(false)
  }

  async function importExcel(fileName) {
    const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${fileName}`)
    const res = await fetch(data.publicUrl)
    const buf = await res.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const rows = json
      .filter(r => r.some(c => String(c).trim()))
      .map(r => ({
        time: (() => { const v = r[0]; if (typeof v === 'number') { const t = Math.round(v*24*60); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0') } return String(v || '').trim() })(),
        what:  String(r[1] || '').trim(),
        who:   String(r[2] || '').trim(),
        notes: String(r[3] || '').trim(),
      }))
    onImportExcel(rows, fileName)
    setOpen(false)
  }

  return (
    <div className="mb-4 no-print">
      <button onClick={handleOpen}
        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors flex-row-reverse text-right text-[13px] ${open ? 'bg-[#FCE4F3] border-[#E0197D] text-[#E0197D]' : 'bg-white border-gray-100 text-gray-600 hover:border-[#E0197D]'}`}>
        <i className="ti ti-folder text-[#E0197D]" style={{fontSize:15}}/>
        <span className="flex-1 font-medium">טען לוז מ"לוזים כללי"</span>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{fontSize:13}}/>
      </button>
      {open && (
        <div className="mt-1 bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loading && <div className="text-center text-[13px] text-gray-400 py-4">טוען...</div>}
          {!loading && files.length === 0 && <div className="text-center text-[13px] text-gray-400 py-4">אין קבצים</div>}
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 flex-row-reverse group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isExcel(f.name) ? 'bg-green-50' : 'bg-[#FCE4F3]'}`}>
                <i className={`ti ${isExcel(f.name) ? 'ti-file-spreadsheet text-green-600' : 'ti-file-type-pdf text-[#E0197D]'}`} style={{fontSize:16}}/>
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="text-[13px] text-gray-800 truncate">{f.name}</div>
              </div>
              {isExcel(f.name) ? (
                <button onClick={() => importExcel(f.name)}
                  className="text-[12px] text-green-600 border border-green-600 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                  <i className="ti ti-table-import" style={{fontSize:12}}/> ייבא
                </button>
              ) : (
                <button onClick={() => openFile(f.name)}
                  className="text-[12px] text-[#E0197D] border border-[#E0197D] px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                  <i className="ti ti-eye" style={{fontSize:12}}/> פתח
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductionSchedule({ profile }) {
  const [events, setEvents] = useState([])
  const [crew, setCrew] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generalFileViewer, setGeneralFileViewer] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    supabase.from('events').select('id,title,date,venue').order('date').then(({ data }) => setEvents(data || []))
    supabase.from('crew_members').select('id,full_name,role').eq('active',true).order('full_name').then(({ data }) => setCrew(data || []))
  }, [])

  async function importFromExcel(excelRows, fileName) {
    if (!schedule) {
      alert('בחר אירוע וצור לוז תחילה')
      return
    }
    setImporting(true)
    const startOrder = rows.length
    const inserted = []
    for (let i = 0; i < excelRows.length; i++) {
      const r = excelRows[i]
      const { data } = await supabase.from('schedule_rows').insert({
        schedule_id: schedule.id,
        time: r.time, what: r.what, who: r.who, notes: r.notes,
        sort_order: startOrder + i,
      }).select().single()
      if (data) inserted.push(data)
    }
    setRows(prev => [...prev, ...inserted])
    setImporting(false)
    alert(`יובאו ${inserted.length} שורות מ-${fileName}`)
  }

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

  async function loadTemplate(tmpl) {
    if (!window.confirm('טעינת התבנית תחליף את הלוז הנוכחי. להמשיך?')) return
    await supabase.from('schedule_rows').delete().eq('schedule_id', schedule.id)
    const newRows = tmpl.rows.map((r, i) => ({ schedule_id: schedule.id, time: r.time, what: r.what, who: r.who, notes: r.notes, sort_order: i }))
    const { data } = await supabase.from('rundown_rows').insert(newRows).select()
    setRows(data || [])
    setShowTemplates(false)
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
    if (schedule.visible_to === 'specific') return (schedule.visible_to_users || []).includes(profile.uid)
    return false
  }

  async function exportExcel() {
    if (!schedule || !selEv) return
    setExporting(true)
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    const ws = {}
    const borderThin = { top:{style:'thin',color:{rgb:'999999'}}, bottom:{style:'thin',color:{rgb:'999999'}}, left:{style:'thin',color:{rgb:'999999'}}, right:{style:'thin',color:{rgb:'999999'}} }
    ws['A1'] = { v: `לוז: ${selEv.title}`, t:'s', s:{ font:{bold:true,sz:16,name:'Calibri',color:{rgb:'CC1010'}}, alignment:{horizontal:'right',readingOrder:2} } }
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
    ws['!rows'] = [{hpt:28},{hpt:18},{hpt:18},{hpt:10},{hpt:22},...rows.map(r=>({hpt:Math.max(20,Math.ceil(Math.max((r.what||'').length/35,(r.who||'').length/25,(r.notes||'').length/30))*18)}))]
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
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
            <option value="">בחר אירוע...</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
          </select>
        </div>

        {importing && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-[13px] text-green-700 flex items-center gap-2 flex-row-reverse no-print">
            <i className="ti ti-loader-2 animate-spin" style={{fontSize:15}}/>
            מייבא שורות מ-Excel...
          </div>
        )}
        {generalFileViewer && (
          <div className="fixed inset-0 z-50 bg-black/70 flex flex-col no-print">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-row-reverse">
              <button onClick={() => setGeneralFileViewer(null)} className="flex items-center gap-1.5 text-gray-600 text-[13px]">
                <i className="ti ti-x" style={{fontSize:16}}/> סגור
              </button>
              <span className="text-[13px] font-medium text-gray-800 truncate max-w-[45%]">{generalFileViewer.name}</span>
              <a href={generalFileViewer.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-[#E0197D] hover:underline">
                <i className="ti ti-external-link" style={{fontSize:14}}/> פתח בדפדפן
              </a>
            </div>
            <iframe src={generalFileViewer.url} className="flex-1 w-full hidden md:block" title={generalFileViewer.name} allow="fullscreen" style={{border:'none'}}/>
            <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gray-50 md:hidden px-6 text-center">
              <a href={generalFileViewer.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[14px] bg-[#E0197D] text-white px-6 py-3 rounded-xl font-medium">
                <i className="ti ti-external-link" style={{fontSize:15}}/> פתח קובץ
              </a>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-8">טוען...</div>}
        {selectedEvent && !loading && !schedule && isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center no-print">
            <div className="text-[14px] text-gray-500 mb-4">אין לוז לאירוע זה עדיין</div>
            <button onClick={createSchedule} className="bg-[#E0197D] text-white px-6 py-2.5 rounded-lg text-sm hover:bg-[#A0106A]">+ צור לוז חדש</button>
          </div>
        )}
        {selectedEvent && !loading && !schedule && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">אין לוז זמין לאירוע זה</div>
        )}

        {schedule && (canView() || isManager) && (
          <>
            {isManager && (
              <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex flex-col gap-2 no-print">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">סטטוס:</span>
                  <button onClick={() => updateSchedule('status', schedule.status==='draft'?'final':'draft')}
                    className={`text-[12px] px-3 py-1.5 rounded-full border font-medium transition-colors ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041] border-[#085041]':'bg-[#FAEEDA] text-[#633806] border-[#633806]'}`}>
                    {schedule.status==='final' ? 'סופי' : 'בעבודה'}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">גלוי ל:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => updateSchedule('visible_to', 'managers')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='managers'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      מנהלים בלבד
                    </button>
                    <button onClick={() => updateSchedule('visible_to', 'all')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='all'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      כולם
                    </button>
                    <button onClick={() => updateSchedule('visible_to', 'specific')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='specific'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      אנשים ספציפיים
                    </button>
                  </div>
                </div>
                {schedule.visible_to === 'specific' && (
                  <div className="w-full mt-1">
                    <div className="text-[11px] text-gray-400 mb-1.5">בחר אנשי צוות:</div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {crew.map(c => {
                        const selected = (schedule.visible_to_users||[]).includes(c.id)
                        return (
                          <button key={c.id}
                            onClick={async () => {
                              const current = schedule.visible_to_users || []
                              const updated = selected ? current.filter(id => id !== c.id) : [...current, c.id]
                              await supabase.from('schedules').update({ visible_to_users: updated }).eq('id', schedule.id)
                              setSchedule(prev => ({ ...prev, visible_to_users: updated }))
                            }}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${selected?'bg-[#E1F5EE] text-[#085041] border-[#085041]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                            {c.full_name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="flex-1"/>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 disabled:opacity-50">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> אקסל
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> PDF
                </button>
              </div>
            )}
            {!isManager && schedule.status==='final' && (
              <div className="flex gap-2 mb-4 justify-end no-print">
                <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 bg-white">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> ייצוא לאקסל
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 bg-white">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> ייצוא PDF
                </button>
              </div>
            )}
            <div id="schedule-print" className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="hidden print:flex justify-center py-3 border-b border-gray-200" style={{backgroundColor:'white'}}>
                <img src="/icon-192.png" style={{height:'55px'}} alt="הזירה"/>
              </div>
              <div className="px-6 py-5 border-b border-gray-100" style={{borderRight:'4px solid #E0197D'}}>
                <div className="flex items-start justify-between flex-row-reverse">
                  <div className="text-right">
                    <div className="text-[20px] font-bold text-gray-900">{selEv?.title}</div>
                    <div className="text-[13px] text-gray-500 mt-0.5">{fmtDate(selEv?.date)}{selEv?.venue?` · ${selEv.venue}`:''}</div>
                  </div>
                  <div className={`text-[11px] px-2.5 py-1 rounded-full font-medium no-print ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041]':'bg-[#FAEEDA] text-[#633806]'}`}>
                    {schedule.status==='final' ? 'סופי' : 'בעבודה'}
                  </div>
                </div>
                <div className="mt-3">
                  {isManager ? (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">משתתפים:</span>
                      <input value={schedule.participants||''} onChange={e => setSchedule(prev => ({...prev, participants: e.target.value}))}
                        onBlur={e => updateSchedule('participants', e.target.value)} placeholder="רשימת משתתפים..."
                        className="flex-1 text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right no-print"/>
                      <span className="hidden print:inline text-[13px] text-gray-700">{schedule.participants}</span>
                    </div>
                  ) : schedule.participants && (
                    <div className="text-[13px] text-gray-600 text-right">
                      <span className="text-[11px] text-gray-400 ml-1">משתתפים:</span>{schedule.participants}
                    </div>
                  )}
                </div>
              </div>
              <div className={`grid gap-0 bg-[#E0197D] text-white text-[12px] font-semibold no-print ${isManager?'grid-cols-[120px_2fr_1.5fr_1fr_40px]':'grid-cols-[120px_2fr_1.5fr_1fr]'}`}>
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
                  className={`grid gap-0 border-b border-gray-50 group ${isManager?'grid-cols-[120px_2fr_1.5fr_1fr_40px]':'grid-cols-[120px_2fr_1.5fr_1fr]'} ${index%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                  {isManager ? (
                    <>
                      <textarea value={row.time||''} onChange={e=>updateRow(row.id,'time',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono resize-none w-full leading-5" rows={1}/>
                      <textarea value={row.what||''} onChange={e=>updateRow(row.id,'what',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.what||'').length/30))}/>
                      <textarea value={row.who||''} onChange={e=>updateRow(row.id,'who',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.who||'').length/20))}/>
                      <textarea value={row.notes||''} onChange={e=>updateRow(row.id,'notes',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.notes||'').length/20))}/>
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
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 font-mono text-[#E0197D] font-medium">{row.time && row.time !== "00:00" ? row.time : ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 break-words">{row.what || ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 text-gray-600 break-words">{row.who || ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right text-gray-400 break-words">{row.notes || ""}</div>
                    </>
                  )}
                </div>
              ))}
              {isManager && (
                <div className="flex no-print">
                  <button onClick={addRow}
                    className="flex-1 py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                    <i className="ti ti-plus" style={{fontSize:13}}/> הוסף שורה
                  </button>
                </div>
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

function GeneralSchedulesMode() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [rows, setRows] = useState({})
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newVenue, setNewVenue] = useState('')
  const [saving, setSaving] = useState(false)
  const [importingId, setImportingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('general_schedules').select('*').order('title', { ascending: true })
    setSchedules(data || [])
    setLoading(false)
  }

  async function loadRows(scheduleId) {
    const { data } = await supabase.from('general_schedule_rows').select('*').eq('schedule_id', scheduleId).order('sort_order')
    setRows(prev => ({ ...prev, [scheduleId]: data || [] }))
  }

  async function createSchedule() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase.from('general_schedules').insert({ title: newTitle.trim(), venue: newVenue || null, participants: '' }).select().single()
    if (data) {
      setSchedules(prev => [data, ...prev])
      setRows(prev => ({ ...prev, [data.id]: [] }))
      setOpenId(data.id)
      setNewTitle('')
      setNewVenue('')
      setShowNew(false)
    }
    setSaving(false)
  }

  async function updateSchedule(id, field, value) {
    await supabase.from('general_schedules').update({ [field]: value }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function deleteSchedule(id) {
    await supabase.from('general_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  async function duplicateSchedule(sch) {
    const { data: newSch } = await supabase.from('general_schedules').insert({ title: sch.title + ' (עותק)', venue: sch.venue, participants: sch.participants || '' }).select().single()
    if (!newSch) return
    const { data: srcRows2 } = await supabase.from('general_schedule_rows').select('*').eq('schedule_id', sch.id).order('sort_order')
    const srcRows = srcRows2 || []
    if (srcRows.length > 0) {
      await supabase.from('general_schedule_rows').insert(srcRows.map((r,i) => ({ schedule_id: newSch.id, time: r.time, what: r.what, who: r.who, notes: r.notes, sort_order: i })))
    }
    setSchedules(prev => [newSch, ...prev])
    setRows(prev => ({ ...prev, [newSch.id]: srcRows.map((r,i) => ({ ...r, id: i, schedule_id: newSch.id })) }))
  }

  async function addRow(scheduleId) {
    const currentRows = rows[scheduleId] || []
    const { data } = await supabase.from('general_schedule_rows').insert({
      schedule_id: scheduleId, time: '', what: '', who: '', notes: '', sort_order: currentRows.length
    }).select().single()
    if (data) setRows(prev => ({ ...prev, [scheduleId]: [...(prev[scheduleId] || []), data] }))
  }

  async function updateRow(scheduleId, rowId, field, value) {
    setRows(prev => ({ ...prev, [scheduleId]: prev[scheduleId].map(r => r.id === rowId ? { ...r, [field]: value } : r) }))
    await supabase.from('general_schedule_rows').update({ [field]: value }).eq('id', rowId)
  }

  async function deleteRow(scheduleId, rowId) {
    await supabase.from('general_schedule_rows').delete().eq('id', rowId)
    setRows(prev => ({ ...prev, [scheduleId]: prev[scheduleId].filter(r => r.id !== rowId) }))
  }

  async function moveRow(scheduleId, index, dir) {
    const curr = [...(rows[scheduleId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setRows(prev => ({ ...prev, [scheduleId]: curr }))
    await Promise.all(curr.map((r, i) => supabase.from('general_schedule_rows').update({ sort_order: i }).eq('id', r.id)))
  }

  async function importExcel(scheduleId, file) {
    setImportingId(scheduleId)
    const XLSX = await import('xlsx-js-style')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const techRow = json[2] || []
    const castRow = json[3] || []
    const techNames = techRow.map(c => String(c||"").trim()).filter(c => c.length > 1)
    const castNames = castRow.map(c => String(c||"").trim()).filter(c => c.length > 1)
    const allParticipants = [...new Set([...techNames,...castNames])].join(", ")
    const SKIP = ['שעה','מה','מי','הערות','time']
    const excelRows = json
      .filter(r => r.some(c => String(c).trim()))
      .filter(r => !SKIP.includes(String(r[0] || '').trim()))
      .map(r => ({
        time: (() => { const v = r[0]; if (typeof v === 'number') { const t = Math.round(v*24*60); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0') } return String(v || '').trim() })(),
        what: String(r[1] || '').trim(),
        who:  String(r[2] || '').trim(),
        notes: String(r[3] || '').trim(),
      }))
    const currentRows = rows[scheduleId] || []
    const inserted = []
    for (let i = 0; i < excelRows.length; i++) {
      const { data } = await supabase.from('general_schedule_rows').insert({
        schedule_id: scheduleId, ...excelRows[i], sort_order: currentRows.length + i
      }).select().single()
      if (data) inserted.push(data)
    }
    setRows(prev => ({ ...prev, [scheduleId]: [...(prev[scheduleId] || []), ...inserted] }))
    if (allParticipants) {
      supabase.from("general_schedules").update({ participants: allParticipants }).eq("id", scheduleId)
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, participants: allParticipants } : s))
    }
    setImportingId(null)
  }

  function toggleOpen(id) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!rows[id]) loadRows(id)
  }

  async function exportXlsx(sch) {
    let schRows = rows[sch.id]
    if (!schRows) {
      const { data } = await supabase
        .from('general_schedule_rows')
        .select('*')
        .eq('schedule_id', sch.id)
        .order('sort_order')
      schRows = data || []
    }
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    const ws = {}
    const border = {
      top:    { style: 'thin', color: { rgb: '999999' } },
      bottom: { style: 'thin', color: { rgb: '999999' } },
      left:   { style: 'thin', color: { rgb: '999999' } },
      right:  { style: 'thin', color: { rgb: '999999' } },
    }
    ws['A1'] = { v: `לוז: ${sch.title}`, t: 's', s: { font: { bold: true, sz: 16, name: 'Calibri', color: { rgb: 'CC1010' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A2'] = { v: sch.venue || '', t: 's', s: { font: { sz: 12, name: 'Calibri', color: { rgb: '666666' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A3'] = { v: `משתתפים: ${sch.participants || ''}`, t: 's', s: { font: { sz: 12, name: 'Calibri', italic: true }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A4'] = { v: '', t: 's' }
    const headers = ['שעה', 'מה', 'מי', 'הערות']
    headers.forEach((h, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 4, c: ci })
      ws[ref] = { v: h, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'CC1010' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border } }
    })
    schRows.forEach((row, ri) => {
      const isOdd = ri % 2 !== 0
      const vals = [row.time || '', row.what || '', row.who || '', row.notes || '']
      vals.forEach((v, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 5, c: ci })
        ws[ref] = { v, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: isOdd ? 'FFF0F0' : 'FFFFFF' } }, font: { sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2, wrapText: true }, border } }
      })
    })
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: schRows.length + 5, c: 3 } })
    ws['!views'] = [{ rightToLeft: true }]
    ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 25 }, { wch: 30 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }]
    XLSX.utils.book_append_sheet(wb, ws, 'לוז')
    XLSX.writeFile(wb, `לוז_${sch.title}.xlsx`)
  }

  async function exportPdf(sch) {
    let schRows = rows[sch.id]
    if (!schRows) {
      const { data } = await supabase
        .from('general_schedule_rows')
        .select('*')
        .eq('schedule_id', sch.id)
        .order('sort_order')
      schRows = data || []
    }
    const win = window.open('', '_blank')
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>לוז: ${sch.title}</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; color: #111; }
          h2 { color: #CC1010; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #E0197D; color: white; padding: 8px 12px; text-align: right; }
          td { padding: 7px 12px; border-bottom: 1px solid #eee; text-align: right; }
          tr:nth-child(even) { background: #FFF8F8; }
        </style>
      </head>
      <body>
        <h2>${sch.title}</h2>
        <div class="meta">
          ${sch.venue ? `<span>${sch.venue}</span> · ` : ''}
          ${sch.participants ? `משתתפים: ${sch.participants}` : ''}
        </div>
        <table>
          <thead><tr><th>שעה</th><th>מה</th><th>מי</th><th>הערות</th></tr></thead>
          <tbody>
            ${schRows.map(r => `
              <tr>
                <td style="font-family:monospace;white-space:nowrap">${r.time || ''}</td>
                <td>${r.what || ''}</td>
                <td>${r.who || ''}</td>
                <td style="color:#888">${r.notes || ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNew(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus"/> לוז חדש
        </button>
      </div>
      {showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="שם הלוז *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2"/>
          <select value={newVenue} onChange={e => setNewVenue(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3">
            <option value="">בחר אולם</option>
            {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={createSchedule} disabled={saving || !newTitle.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {saving ? 'שומר...' : 'צור לוז'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
          </div>
        </div>
      )}
      {schedules.length === 0 && !showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין לוזים — לחץ על "לוז חדש" להתחלה
        </div>
      )}
      {schedules.map(sch => {
        const isOpen = openId === sch.id
        const schRows = rows[sch.id] || []
        return (
          <div key={sch.id} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => toggleOpen(sch.id)}>
              <div className="flex-1 text-right">
                <input
                  value={sch.title}
                  onChange={e => setSchedules(prev => prev.map(s => s.id === sch.id ? {...s, title: e.target.value} : s))}
                  onBlur={e => updateSchedule(sch.id, 'title', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="text-[13px] font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-[#E0197D] text-right w-full"
                />
                <div className="text-[11px] text-gray-400 mt-0.5 flex gap-2 justify-end flex-wrap">
                  {sch.venue && <span>{sch.venue}</span>}
                  {sch.participants && <span>{sch.participants}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input type="file" accept=".xlsx,.xls" className="hidden" id={`xl-${sch.id}`}
                  onChange={e => { if (e.target.files[0]) importExcel(sch.id, e.target.files[0]); e.target.value = '' }}/>
                <button onClick={e => { e.stopPropagation(); exportXlsx(sch) }}
                  className="text-gray-300 hover:text-green-600 p-1" title="ייצוא אקסל">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); exportPdf(sch) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="ייצוא PDF">
                  <i className="ti ti-file-type-pdf" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); document.getElementById(`xl-${sch.id}`).click() }}
                  className="text-gray-300 hover:text-green-600 p-1" title="ייבא מאקסל">
                  <i className="ti ti-table-import" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); if (!rows[sch.id]) loadRows(sch.id).then(()=>duplicateSchedule(sch)); else duplicateSchedule(sch) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="שכפל לוז">
                  <i className="ti ti-copy" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm('למחוק את הלוז?')) deleteSchedule(sch.id) }}
                  className="text-gray-300 hover:text-red-500 p-1">
                  <i className="ti ti-trash" style={{fontSize:13}}/>
                </button>
                <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            </div>
            {isOpen && (
              <div className="border-t border-gray-50">
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="flex gap-2 mb-2">
                    <select defaultValue={sch.venue||''} onBlur={e => updateSchedule(sch.id, 'venue', e.target.value)}
                      onChange={e => updateSchedule(sch.id, 'venue', e.target.value)}
                      className="text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right w-40">
                      <option value="">בחר אולם</option>
                      {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <input value={sch.participants || ''}
                    onChange={e => setSchedules(prev => prev.map(s => s.id === sch.id ? {...s, participants: e.target.value} : s))}
                    onBlur={e => updateSchedule(sch.id, 'participants', e.target.value)}
                    placeholder="משתתפים..."
                    className="w-full text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
                </div>
                {importingId === sch.id && (
                  <div className="px-4 py-2 text-[12px] text-green-600 flex items-center gap-1 flex-row-reverse">
                    <i className="ti ti-loader-2 animate-spin"/> מייבא שורות...
                  </div>
                )}
                <div className="overflow-x-auto"><table className="w-full border-collapse" style={{tableLayout:"auto"}}>
                  <colgroup>
                    <col style={{width:'110px',minWidth:'110px'}}/>
                    <col/>
                    <col/>
                    <col/>
                    <col style={{width:'36px'}}/>
                  </colgroup>
                  <thead>
                    <tr className="bg-[#E0197D] text-white text-[11px] font-semibold">
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{width:"90px"}}>שעה</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">מה</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">מי</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">הערות</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                {schRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-[12px] text-gray-400 py-6">אין שורות — הוסף שורה או ייבא מאקסל</td></tr>
                )}
                {schRows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-50 group ${idx%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                    <td className="border-l border-gray-100 px-3 py-2 whitespace-nowrap text-[12px] font-mono text-right" style={{width:'110px',minWidth:'110px'}}>
                      <input value={row.time||''} onChange={e => updateRow(sch.id, row.id, 'time', e.target.value)}
                        className="w-full bg-transparent outline-none text-right font-mono"/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'180px'}}>
                      <textarea value={row.what||''} onChange={e=>updateRow(sch.id,row.id,'what',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.what||'').length/25))}/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'130px'}}>
                      <textarea value={row.who||''} onChange={e=>updateRow(sch.id,row.id,'who',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.who||'').length/20))}/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'130px'}}>
                      <textarea value={row.notes||''} onChange={e=>updateRow(sch.id,row.id,'notes',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] text-gray-500 resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.notes||'').length/20))}/>
                    </td>
                    <td style={{width:"36px"}} className="align-middle">
                      <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveRow(sch.id, idx, -1)} disabled={idx===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-up" style={{fontSize:10}}/>
                        </button>
                        <button onClick={() => deleteRow(sch.id, row.id)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <i className="ti ti-trash" style={{fontSize:10}}/>
                        </button>
                        <button onClick={() => moveRow(sch.id, idx, 1)} disabled={idx===schRows.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-down" style={{fontSize:10}}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                  </tbody>
                </table></div>
                <button onClick={() => addRow(sch.id)}
                  className="w-full py-3 text-[12px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                  <i className="ti ti-plus" style={{fontSize:12}}/> הוסף שורה
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


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
          { id: 'inquiries', label: 'בדיקת פניות' },
          { id: 'files',     label: 'לוזים כללי' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors ${tab===t.id?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-600 hover:border-[#E0197D]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'inquiries' && <ProductionInquiries />}
      {tab === 'files'     && <GeneralSchedulesMode />}
    </div>
  )
}
