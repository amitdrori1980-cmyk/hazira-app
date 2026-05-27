'use client'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  const s = val.toString().trim()
  const m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  }
  return null
}

export default function ConstraintsPage() {
  const [constraints, setConstraints] = useState([])
  const [events, setEvents]           = useState([])
  const [crew, setCrew]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [showConstraints, setShowConstraints] = useState(true)
  const [showEvents, setShowEvents]           = useState(true)

  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const [showAdd, setShowAdd] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [hiddenCrew, setHiddenCrew] = useState(new Set())
  const [showCrewFilter, setShowCrewFilter] = useState(false)
  const [form, setForm]       = useState({ crew_name:'', date:'', date_to:'', time_from:'', time_to:'', hours:'', notes:'' })
  const [adding, setAdding]   = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [editItem, setEditItem] = useState(null) // constraint being edited
  const [editForm, setEditForm] = useState({ crew_name:'', date:'', date_to:'', time_from:'', time_to:'', hours:'', notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: e }, { data: cr }] = await Promise.all([
      supabase.from('crew_constraints').select('*').order('date'),
      supabase.from('events').select('id,title,date,time,type').order('date'),
      supabase.from('crew_members').select('id,full_name').eq('active',true).order('full_name'),
    ])
    setConstraints(c || [])
    setEvents(e || [])
    setCrew(cr || [])
    setLoading(false)
  }

  function changeMonth(dir) {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setCalMonth(m); setCalYear(y); setSelectedDay(null)
  }

  function dateStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate()

  function getDayData(ds) {
    const dayEvents      = showEvents      ? events.filter(e => e.date === ds) : []
    const dayConstraints = showConstraints ? constraints.filter(c => !hiddenCrew.has(c.crew_name) && (c.date === ds || (c.date_to && ds >= c.date && ds <= c.date_to))) : []
    return { dayEvents, dayConstraints }
  }

  const selectedData = selectedDay ? getDayData(selectedDay) : null

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array', raw: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const merges = ws['!merges'] || []
      const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
      if (!ref) { setImporting(false); return }
      const matrix = []
      for (let r = 0; r <= ref.e.r; r++) {
        matrix[r] = []
        for (let c = 0; c <= ref.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({r, c})]
          matrix[r][c] = cell ? cell.v : null
        }
      }
      for (const m of merges) {
        const val = matrix[m.s.r][m.s.c]
        for (let r = m.s.r; r <= m.e.r; r++)
          for (let c = m.s.c; c <= m.e.c; c++)
            matrix[r][c] = val
      }
      if (matrix.length < 2) { setImporting(false); return }
      const headers = matrix[0].map(h => h?.toString().toLowerCase().trim())
      const dateIdx = headers.findIndex(h => ['תאריך','date'].includes(h))
      const nameIdx = headers.findIndex(h => ['שם','name','full_name'].includes(h))
      const hoursIdx = headers.findIndex(h => ['שעות','hours','זמינות'].includes(h))
      const notesIdx = headers.findIndex(h => ['הערה','הערות','notes'].includes(h))
      const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש']
      let success = 0, failed = 0, lastDate = null
      for (const row of matrix.slice(1)) {
        const rawDate = dateIdx >= 0 ? row[dateIdx] : null
        const parsed = parseDate(rawDate)
        if (parsed) lastDate = parsed
        const name = nameIdx >= 0 ? row[nameIdx]?.toString().trim() : null
        if (!name || DAYS_HE.includes(name)) continue
        if (!lastDate) { failed++; continue }
        const hours = hoursIdx >= 0 ? row[hoursIdx]?.toString().trim() || '' : ''
        const notes = notesIdx >= 0 ? row[notesIdx]?.toString().trim() || '' : ''
        const member = crew.find(c => c.full_name.trim() === name)
        const existing = await supabase.from('crew_constraints').select('id').eq('crew_name', name).eq('date', lastDate).maybeSingle()
        if (existing.data) { success++; continue }
        const { error } = await supabase.from('crew_constraints').insert({
          crew_member_id: member?.id || null,
          crew_name: name,
          date: lastDate, hours, notes, available: false,
        })
        if (error) failed++; else success++
      }
      setImportResult({ success, failed })
      await load()
      setImporting(false)
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

    async function addConstraint(ev) {
    ev.preventDefault()
    if (!form.crew_name || !form.date) return
    setAdding(true)
    const member = crew.find(c => c.full_name.trim() === form.crew_name.trim())
    await supabase.from('crew_constraints').insert({
      crew_member_id: member?.id || null,
      crew_name: form.crew_name,
      date: form.date,
      date_to: form.date_to || null,
      time_from: form.time_from || null,
      time_to: form.time_to || null,
      hours: form.hours,
      notes: form.notes,
      available: false,
    })
    setForm({ crew_name:'', date:'', date_to:'', time_from:'', time_to:'', hours:'', notes:'' })
    setShowAdd(false)
    setAdding(false)
    await load()
  }

  async function deleteConstraint(id) {
    setConfirmId(id)
  }

  async function confirmDelete() {
    await supabase.from('crew_constraints').delete().eq('id', confirmId)
    setConstraints(prev => prev.filter(c => c.id !== confirmId))
    setConfirmId(null)
  }

  function openEdit(c) {
    setEditItem(c)
    setEditForm({ crew_name: c.crew_name, date: c.date, date_to: c.date_to || '', time_from: c.time_from || '', time_to: c.time_to || '', hours: c.hours || '', notes: c.notes || '' })
  }

  async function saveEdit() {
    if (!editItem) return
    setSaving(true)
    const member = crew.find(m => m.full_name.trim() === editForm.crew_name.trim())
    await supabase.from('crew_constraints').update({
      crew_member_id: member?.id || null,
      crew_name: editForm.crew_name,
      date: editForm.date,
      date_to: editForm.date_to || null,
      time_from: editForm.time_from || null,
      time_to: editForm.time_to || null,
      hours: editForm.hours,
      notes: editForm.notes,
    }).eq('id', editItem.id)
    setConstraints(prev => prev.map(c => c.id === editItem.id ? { ...c, ...editForm } : c))
    setEditItem(null)
    setSaving(false)
  }

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-700">
              <input type="checkbox" checked={showEvents} onChange={e=>setShowEvents(e.target.checked)}
                style={{accentColor:'#E0197D'}} className="w-4 h-4"/>
              <span className="w-3 h-3 rounded-sm bg-[#FCE4F3] inline-block"/>
              הצג אירועים
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-700">
              <input type="checkbox" checked={showConstraints} onChange={e=>setShowConstraints(e.target.checked)}
                style={{accentColor:'#6366f1'}} className="w-4 h-4"/>
              <span className="w-3 h-3 rounded-sm bg-[#EEF2FF] inline-block"/>
              הצג אילוצי צוות
            </label>
            {showConstraints && (
              <div className="relative">
                <button onClick={()=>setShowCrewFilter(p=>!p)}
                  className="text-[12px] text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#6366f1] flex items-center gap-1">
                  <i className="ti ti-users" style={{fontSize:13}}/>
                  סינון עובדים
                  {hiddenCrew.size > 0 && <span className="bg-[#6366f1] text-white text-[10px] px-1.5 rounded-full">{hiddenCrew.size}</span>}
                </button>
                {showCrewFilter && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 min-w-[180px]">
                    <div className="flex justify-between items-center mb-2">
                      <button onClick={()=>setHiddenCrew(new Set())} className="text-[11px] text-[#6366f1]">הצג הכל</button>
                      <button onClick={()=>setHiddenCrew(new Set([...new Set(constraints.map(c=>c.crew_name))]))} className="text-[11px] text-gray-400">הסתר הכל</button>
                    </div>
                    {[...new Set(constraints.map(c=>c.crew_name))].sort().map(name=>(
                      <label key={name} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" checked={!hiddenCrew.has(name)}
                          onChange={()=>setHiddenCrew(prev=>{const n=new Set(prev);n.has(name)?n.delete(name):n.add(name);return n})}
                          style={{accentColor:'#6366f1'}} className="w-3.5 h-3.5"/>
                        <span className="text-[13px] text-gray-700">{name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(!showAdd)}
              className="text-[12px] border border-[#E0197D] text-[#E0197D] px-3 py-1.5 rounded-lg hover:bg-[#FCE4F3]">
              <i className="ti ti-plus"/> הוסף ידנית
            </button>
            <label className={`text-[12px] border px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${importing ? 'border-gray-200 text-gray-400' : 'border-[#6366f1] text-[#6366f1] hover:bg-[#EEF2FF]'}`}>
              {importing ? 'מייבא...' : <><i className="ti ti-file-spreadsheet"/> ייבא Excel</>}
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={importing}/>
            </label>
          </div>
        </div>

        {importResult && (
          <div className="mt-3 text-[12px] text-right">
            {importResult.success > 0 && <span className="text-[#085041]">✅ {importResult.success} אילוצים יובאו  </span>}
            {importResult.failed > 0  && <span className="text-[#E0197D]">❌ {importResult.failed} נכשלו</span>}
          </div>
        )}

        {showAdd && (
          <form onSubmit={addConstraint} className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 relative">
                <input value={form.crew_name} onChange={e=>{setForm(f=>({...f,crew_name:e.target.value}));setCrewOpen(true)}}
                  onFocus={()=>setCrewOpen(true)}
                  onBlur={()=>setTimeout(()=>setCrewOpen(false),150)}
                  placeholder="בחר איש צוות..." required autoComplete="off"
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
                {crewOpen && crew.filter(c=>!form.crew_name||c.full_name.includes(form.crew_name)).length>0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {crew.filter(c=>!form.crew_name||c.full_name.includes(form.crew_name)).map(c=>(
                      <div key={c.id} onMouseDown={()=>setForm(f=>({...f,crew_name:c.full_name}))}
                        className="px-3 py-2 text-[13px] text-right hover:bg-[#FCE4F3] cursor-pointer">
                        {c.full_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">מתאריך</span>
                <input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                  type="date" required className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">עד תאריך</span>
                <input value={form.date_to} onChange={e=>setForm(f=>({...f,date_to:e.target.value}))}
                  type="date" className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">משעה</span>
                <input value={form.time_from} onChange={e=>setForm(f=>({...f,time_from:e.target.value}))}
                  type="time" className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">עד שעה</span>
                <input value={form.time_to} onChange={e=>setForm(f=>({...f,time_to:e.target.value}))}
                  type="time" className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                placeholder="הערה" className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={adding}
                className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg">הוסף</button>
              <button type="button" onClick={()=>setShowAdd(false)}
                className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg">ביטול</button>
            </div>
          </form>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-3">
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>changeMonth(-1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">‹ הקודם</button>
          <span className="text-base font-semibold text-[#E0197D]">{HE_MONTHS[calMonth]} {calYear}</span>
          <button onClick={()=>changeMonth(1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">הבא ›</button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {HE_DAYS.map(d=><div key={d} className="text-center text-[12px] text-gray-400 font-medium py-1">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({length:firstDay}).map((_,i)=>(
            <div key={'p'+i} className="min-h-[70px] md:min-h-[90px] rounded-lg p-1 opacity-25">
              <div className="text-center text-[11px] text-gray-400">{daysInPrev-firstDay+i+1}</div>
            </div>
          ))}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const d  = i+1
            const ds = dateStr(calYear,calMonth,d)
            const isToday    = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d
            const isSelected = selectedDay===ds
            const { dayEvents, dayConstraints } = getDayData(ds)
            const hasData = dayEvents.length > 0 || dayConstraints.length > 0

            return (
              <div key={d} onClick={()=>setSelectedDay(ds)}
                className={`min-h-[70px] md:min-h-[90px] rounded-lg p-1.5 cursor-pointer border transition-all ${
                  isSelected ? 'border-[#E0197D] bg-[#FCE4F3]' :
                  isToday    ? 'bg-[#FCE4F3] border-transparent' :
                  hasData    ? 'border-gray-100 bg-gray-50' :
                               'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}>
                <div className={`text-center text-[12px] font-medium mb-1 ${isToday||isSelected?'text-[#E0197D]':'text-gray-700'}`}>{d}</div>
                {/* Mobile: dots */}
                <div className="flex flex-wrap gap-0.5 md:hidden">
                  {dayEvents.slice(0,2).map(e=>(
                    <span key={e.id} className="w-2.5 h-2.5 rounded-full bg-[#E0197D] inline-block"/>
                  ))}
                  {dayConstraints.slice(0,3).map(c=>(
                    <span key={c.id} className="w-2.5 h-2.5 rounded-full bg-[#6366f1] inline-block"/>
                  ))}
                </div>
                {/* Desktop: text */}
                {dayEvents.slice(0,1).map(e=>(
                  <div key={e.id} className="hidden md:block text-[9px] px-1 py-0.5 rounded mb-0.5 truncate bg-[#FCE4F3] text-[#A0106A]">
                    {e.time?.slice(0,5)} {e.title}
                  </div>
                ))}
                {dayConstraints.slice(0,2).map(c=>(
                  <div key={c.id} className="hidden md:block text-[9px] px-1 py-0.5 rounded mb-0.5 truncate bg-[#EEF2FF] text-[#4338ca]">
                    {c.crew_name?.split(' ')[0]}
                  </div>
                ))}
                {(dayEvents.length + dayConstraints.length) > 3 && (
                  <div className="hidden md:block text-[9px] text-gray-400 text-center">+{dayEvents.length+dayConstraints.length-3}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && selectedData && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[14px] font-medium text-gray-800 mb-3">
            {parseInt(selectedDay.split('-')[2])} {HE_MONTHS[parseInt(selectedDay.split('-')[1])-1]}
          </div>

          {selectedData.dayEvents.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-gray-700 mb-2">אירועים</div>
              {selectedData.dayEvents.map(e=>(
                <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 flex-row-reverse">
                  <span className="flex-1 text-[13px] text-right">{e.title}</span>
                  <span className="text-[11px] text-gray-700">{e.time?.slice(0,5)}</span>
                </div>
              ))}
            </div>
          )}

          {selectedData.dayConstraints.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-700 mb-2">אילוצי צוות</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedData.dayConstraints.map(c=>(
                  <div key={c.id} className="flex items-center gap-2 py-2 bg-[#EEF2FF] rounded-lg px-3 flex-row-reverse group">
                    <div className="flex-1 text-right">
                      <div className="text-[13px] font-medium text-[#4338ca]">{c.crew_name}</div>
                      {c.hours && <div className="text-[11px] text-[#6366f1]">🕐 {c.hours}</div>}
                      {(c.time_from || c.time_to) && <div className="text-[11px] text-[#6366f1]">🕐 {c.time_from?.slice(0,5)}{c.time_to ? ` - ${c.time_to.slice(0,5)}` : ''}</div>}
                      {c.date_to && <div className="text-[11px] text-gray-800">עד {c.date_to}</div>}
                      {c.notes && <div className="text-[11px] text-gray-800">{c.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all">
                      <button onClick={()=>openEdit(c)}
                        className="text-gray-300 hover:text-[#6366f1] p-1">
                        <i className="ti ti-pencil" style={{fontSize:14}}/>
                      </button>
                      <button onClick={()=>deleteConstraint(c.id)}
                        className="text-gray-300 hover:text-red-500 p-1">
                        <i className="ti ti-trash" style={{fontSize:14}}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedData.dayEvents.length===0 && selectedData.dayConstraints.length===0 && (
            <div className="text-[13px] text-gray-600 text-center py-4">אין נתונים ליום זה</div>
          )}
        </div>
      )}
      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0"
          style={{background:'rgba(0,0,0,0.4)'}}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <i className="ti ti-x" style={{fontSize:18}}/>
              </button>
              <div className="text-[16px] font-semibold text-gray-900">עריכת אילוץ</div>
              <div style={{width:26}}/>
            </div>
            <div className="flex flex-col gap-3">
              <select value={editForm.crew_name} onChange={e=>setEditForm(f=>({...f,crew_name:e.target.value}))} size="1"
                className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1] text-right">
                <option value="">בחר איש צוות...</option>
                {crew.map(m=><option key={m.id} value={m.full_name}>{m.full_name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">מתאריך</span>
                <input value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                  type="date" required className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">עד תאריך</span>
                <input value={editForm.date_to} onChange={e=>setEditForm(f=>({...f,date_to:e.target.value}))}
                  type="date" className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">משעה</span>
                <input value={editForm.time_from} onChange={e=>setEditForm(f=>({...f,time_from:e.target.value}))}
                  type="time" className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1]"/>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">עד שעה</span>
                <input value={editForm.time_to} onChange={e=>setEditForm(f=>({...f,time_to:e.target.value}))}
                  type="time" className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1]"/>
              </div>
              <input value={editForm.hours} onChange={e=>setEditForm(f=>({...f,hours:e.target.value}))}
                placeholder="שעות (09:00-13:00)" className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1] text-right"/>
              <input value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}
                placeholder="הערה" className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1] text-right"/>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600 hover:bg-gray-50">
                ביטול
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#6366f1] text-white text-[14px] hover:bg-[#4f52d8] disabled:opacity-60">
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0"
          style={{background:'rgba(0,0,0,0.4)'}}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto mb-3">
              <i className="ti ti-trash text-[#E0197D]" style={{fontSize:22}}/>
            </div>
            <div className="text-center mb-4">
              <div className="text-[16px] font-semibold text-gray-900 mb-1">מחיקת אילוץ</div>
              <div className="text-[13px] text-gray-800">האם למחוק את האילוץ? לא ניתן לבטל פעולה זו.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600 hover:bg-gray-50">
                ביטול
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-[#E0197D] text-white text-[14px] hover:bg-[#A0106A]">
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
