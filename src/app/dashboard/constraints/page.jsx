'use client'
import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']

// כינויים לתצוגה בתפריט (גובר על השם הפרטי האוטומטי)
const NAME_OVERRIDES = {
  'דניאל גמליאלי': 'דונדו',
  'דניאל ק': 'דניאל ק',
}

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
  const [viewMode, setViewMode] = useState('month')
  const [weekAnchor, setWeekAnchor] = useState(null)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const [showAdd, setShowAdd] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [hiddenCrew, setHiddenCrew] = useState(new Set())
  const [showCrewFilter, setShowCrewFilter] = useState(false)
  const [form, setForm]       = useState({ crew_name:'', date:'', available:false, notes:'' })
  const [adding, setAdding]   = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [editItem, setEditItem] = useState(null) // constraint being edited
  const [editForm, setEditForm] = useState({ crew_name:'', date:'', available:false, notes:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: e }, { data: profs }, { data: cm }, { data: ops }] = await Promise.all([
      supabase.from('crew_constraints').select('*').order('date'),
      supabase.from('events').select('id,title,date,time,type').order('date'),
      supabase.from('profiles').select('id,full_name,dept').order('full_name'),
      supabase.from('crew_members').select('id,full_name').order('full_name'),
      supabase.from('user_area_access').select('user_id').eq('area','operations'),
    ])
    // מקור העובדים: כל בעלי החשבונות חוץ מתפעול, ועוד חסרי-החשבון מרשימת הצוות
    const opsSet = new Set((ops || []).map(o => o.user_id))
    const merged = []
    const seen = new Set()
    ;(profs || []).forEach(p => {
      if (!p.full_name) return
      if (opsSet.has(p.id)) return
      if ((p.dept || '').trim() === 'תפעול') return
      const key = p.full_name.trim()
      if (seen.has(key)) return
      seen.add(key); merged.push({ id: p.id, full_name: p.full_name })
    })
    ;(cm || []).forEach(m => {
      if (!m.full_name) return
      const key = m.full_name.trim()
      if (seen.has(key)) return
      seen.add(key); merged.push({ id: m.id, full_name: m.full_name })
    })
    merged.sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))
    // שמות לתצוגה: שם פרטי בלבד; אם כמה חולקים שם פרטי, מוסיפים אות מהשם השני לבידול
    const firstCount = {}
    merged.forEach(m => { const f = m.full_name.trim().split(/\s+/)[0]; firstCount[f] = (firstCount[f] || 0) + 1 })
    merged.forEach(m => {
      const key = m.full_name.trim()
      if (NAME_OVERRIDES[key]) { m.display = NAME_OVERRIDES[key]; return }
      const parts = key.split(/\s+/)
      m.display = (firstCount[parts[0]] > 1 && parts[1]) ? parts[0] + ' ' + parts[1][0] : parts[0]
    })
    setConstraints(c || [])
    setEvents(e || [])
    setCrew(merged)
    setLoading(false)
  }

  function changeMonth(dir) {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setCalMonth(m); setCalYear(y); setSelectedDay(null)
  }

  // מעבר חודש בהחלקה (מובייל) — בדסקטופ עוברים עם הכפתורים, בדיוק כמו ביומן
  const gridRef = useRef(null)
  const wheelLock = useRef(false)
  const touchStart = useRef(null)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    function onTouchStart(e) {
      touchStart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
    }
    function onTouchEnd(e) {
      const st = touchStart.current
      touchStart.current = null
      if (!st || wheelLock.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - st.x, dy = t.clientY - st.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        wheelLock.current = true
        navigate(dx > 0 ? 1 : -1)
        setTimeout(() => { wheelLock.current = false }, 500)
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [calMonth, calYear, viewMode, weekAnchor])

  function dateStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate())

  function buildWeekCells(anchorDs) {
    const [ay, am, ad] = anchorDs.split('-').map(Number)
    const base = new Date(ay, am - 1, ad)
    base.setDate(base.getDate() - base.getDay())
    const wk = []
    for (let j = 0; j < 7; j++) {
      const dt = new Date(base); dt.setDate(base.getDate() + j)
      wk.push({ d: dt.getDate(), ds: dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate()) })
    }
    return wk
  }

  function navigate(dir) {
    if (viewMode === 'week') {
      const a = weekAnchor || selectedDay || todayDs
      const [ay, am, ad] = a.split('-').map(Number)
      const dt = new Date(ay, am - 1, ad); dt.setDate(dt.getDate() + dir * 7)
      setWeekAnchor(dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate())); setSelectedDay(null)
    } else {
      changeMonth(dir)
    }
  }

  const wkAnchor = weekAnchor || selectedDay || todayDs
  const weekCells = buildWeekCells(wkAnchor)
  const weekLabel = `${weekCells[0].d} ${HE_MONTHS[Number(weekCells[0].ds.split('-')[1]) - 1]} – ${weekCells[6].d} ${HE_MONTHS[Number(weekCells[6].ds.split('-')[1]) - 1]}`

  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate()

  function getDayData(ds) {
    const dayEvents = showEvents ? events.filter(e => e.date === ds).sort((a, b) => {
      // הצגות (מופעים) תמיד למעלה, אחר כך לפי שעה
      if (a.type === 'show' && b.type !== 'show') return -1
      if (a.type !== 'show' && b.type === 'show') return 1
      return (a.time || '').localeCompare(b.time || '')
    }) : []
    const dayConstraints = showConstraints ? constraints.filter(c => !hiddenCrew.has(c.crew_name) && (c.date === ds || (c.date_to && ds >= c.date && ds <= c.date_to))) : []
    return { dayEvents, dayConstraints }
  }

  const selectedData = selectedDay ? getDayData(selectedDay) : null

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const monthStr = String(calMonth + 1).padStart(2, '0')
    const prefix = `${calYear}-${monthStr}`
    const filtered = constraints.filter(c =>
      !hiddenCrew.has(c.crew_name) &&
      (c.date?.startsWith(prefix) || (c.date_to && c.date_to >= prefix + '-01' && c.date <= prefix + '-31'))
    ).sort((a, b) => a.date > b.date ? 1 : -1)
    const rows = [['תאריך', 'שם', 'שעות', 'הערות']]
    filtered.forEach(c => rows.push([c.date, c.crew_name, c.hours || '', c.notes || '']))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'אילוצים')
    XLSX.writeFile(wb, `constraints_${prefix}.xlsx`)
  }

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
        const rawHours = hoursIdx >= 0 ? row[hoursIdx] : ''
        const hours = typeof rawHours === 'number' ? (() => { const t = Math.round(rawHours * 24 * 60); const h = Math.floor(t/60); const m = t%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0') })() : (rawHours?.toString().trim() || '')
        const notes = notesIdx >= 0 ? row[notesIdx]?.toString().trim() || '' : ''
        const existing = await supabase.from('crew_constraints').select('id').eq('crew_name', name).eq('date', lastDate).maybeSingle()
        if (existing.data) { success++; continue }
        const { error } = await supabase.from('crew_constraints').insert({
          crew_member_id: null,
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
    await supabase.from('crew_constraints').insert({
      crew_member_id: null,
      crew_name: form.crew_name.trim(),
      date: form.date,
      available: form.available,
      notes: form.notes,
    })
    setForm({ crew_name:'', date:'', available:false, notes:'' })
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

  async function toggleStatus(c) {
    await supabase.from('crew_constraints').update({ available: !c.available }).eq('id', c.id)
    setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, available: !c.available } : x))
  }

  function openEdit(c) {
    setEditItem(c)
    setEditForm({ crew_name: c.crew_name, date: c.date, available: !!c.available, notes: c.notes || '' })
  }

  async function saveEdit() {
    if (!editItem) return
    setSaving(true)
    await supabase.from('crew_constraints').update({
      crew_member_id: null,
      crew_name: editForm.crew_name.trim(),
      date: editForm.date,
      available: editForm.available,
      notes: editForm.notes,
    }).eq('id', editItem.id)
    setConstraints(prev => prev.map(c => c.id === editItem.id ? { ...c, ...editForm } : c))
    setEditItem(null)
    setSaving(false)
    await load()
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
                style={{accentColor:'#ca8a04'}} className="w-4 h-4"/>
              <span className="flex gap-0.5">
                <span className="w-3 h-3 rounded-sm bg-[#ca8a04] inline-block"/>
                <span className="w-3 h-3 rounded-sm bg-[#dc2626] inline-block"/>
              </span>
              הצג אילוצים
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
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 w-[200px] max-w-[calc(100vw-2rem)]">
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
              {importing ? 'מייבא...' : <><i className="ti ti-file-spreadsheet"/> ייבוא</>}
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={importing}/>
            </label>
            <button onClick={exportExcel}
              className="text-[12px] border border-green-600 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 flex items-center gap-1">
              <i className="ti ti-table-export" style={{fontSize:13}}/>
              ייצוא
            </button>
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
                {crewOpen && crew.filter(c=>!form.crew_name||c.display.includes(form.crew_name)||c.full_name.includes(form.crew_name)).length>0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {crew.filter(c=>!form.crew_name||c.display.includes(form.crew_name)||c.full_name.includes(form.crew_name)).map(c=>(
                      <div key={c.id} onMouseDown={()=>setForm(f=>({...f,crew_name:c.display}))}
                        className="px-3 py-2 text-[13px] text-right hover:bg-[#FCE4F3] cursor-pointer">
                        {c.display}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 col-span-2">
                <span className="text-[11px] text-gray-400 flex-shrink-0">תאריך</span>
                <input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                  type="date" required className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <div className="col-span-2 flex rounded-lg overflow-hidden border border-gray-200">
                <button type="button" onClick={()=>setForm(f=>({...f,available:true}))}
                  className={`flex-1 text-[13px] py-2 transition-colors ${form.available ? 'bg-[#ca8a04] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  נמצא
                </button>
                <button type="button" onClick={()=>setForm(f=>({...f,available:false}))}
                  className={`flex-1 text-[13px] py-2 transition-colors ${!form.available ? 'bg-[#dc2626] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  לא נמצא
                </button>
              </div>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                placeholder="הערה" className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
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
      <div ref={gridRef} className={`bg-white border border-gray-100 rounded-xl p-5 mb-3 ${selectedDay ? 'hidden' : ''}`}>
        <div className="grid grid-cols-3 items-center mb-4 gap-2">
          <div></div>
          <div className="flex items-center justify-center gap-1">
            <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-[#E0197D] p-1 rounded-lg hover:bg-gray-50">
              <i className="ti ti-chevron-right" style={{fontSize:20}}/>
            </button>
            <span className="text-base font-semibold text-[#E0197D] text-center min-w-[130px]">
              {viewMode==='week' ? weekLabel : `${HE_MONTHS[calMonth]} ${calYear}`}
            </span>
            <button onClick={()=>navigate(1)} className="text-gray-400 hover:text-[#E0197D] p-1 rounded-lg hover:bg-gray-50">
              <i className="ti ti-chevron-left" style={{fontSize:20}}/>
            </button>
          </div>
          <div className="flex justify-end">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={()=>setViewMode('month')} className={`text-[12px] px-3 py-1 ${viewMode==='month'?'bg-[#E0197D] text-white':'text-gray-500 hover:text-[#E0197D]'}`}>חודשי</button>
              <button onClick={()=>{ setViewMode('week'); setWeekAnchor(selectedDay || todayDs) }} className={`text-[12px] px-3 py-1 ${viewMode==='week'?'bg-[#E0197D] text-white':'text-gray-500 hover:text-[#E0197D]'}`}>שבועי</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {HE_DAYS.map(d=><div key={d} className="text-center text-[12px] text-gray-400 font-medium py-1">{d}</div>)}
        </div>

        {viewMode === 'month' ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({length:firstDay}).map((_,i)=>(
            <div key={'p'+i} className="min-h-[72px] md:min-h-[150px] rounded-lg p-1 opacity-25">
              <div className="text-center text-[11px] text-gray-400">{daysInPrev-firstDay+i+1}</div>
            </div>
          ))}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const d  = i+1
            const ds = dateStr(calYear,calMonth,d)
            const isToday    = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d
            const isSelected = selectedDay===ds
            const { dayEvents, dayConstraints } = getDayData(ds)
            const present = dayConstraints.filter(c => c.available)
            const absent  = dayConstraints.filter(c => !c.available)
            const hasData = dayEvents.length > 0 || dayConstraints.length > 0

            return (
              <div key={d} onClick={()=>setSelectedDay(ds)}
                className={`min-h-[72px] md:min-h-[150px] rounded-lg p-1.5 cursor-pointer border transition-all ${
                  isSelected ? 'border-[#E0197D] bg-[#FCE4F3]' :
                  isToday    ? 'bg-[#FCE4F3] border-transparent' :
                  hasData    ? 'border-gray-100 bg-gray-50' :
                               'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}>
                <div className={`text-center text-[12px] md:text-[14px] font-medium mb-1 ${isToday||isSelected?'text-[#E0197D]':'text-gray-700'}`}>{d}</div>
                {/* Mobile: dots */}
                <div className="flex flex-wrap gap-0.5 md:hidden">
                  {dayEvents.slice(0,2).map(e=>(
                    <span key={e.id} className="w-2.5 h-2.5 rounded-full bg-[#E0197D] inline-block"/>
                  ))}
                  {present.length>0 && <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#ca8a04]"/>}
                  {absent.length>0 && <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#dc2626]"/>}
                </div>
                {/* Desktop: text */}
                {dayEvents.slice(0,3).map(e=>(
                  <div key={e.id} className="hidden md:block text-[12px] px-1 py-0.5 rounded mb-0.5 truncate bg-[#FCE4F3] text-[#A0106A]">
                    {e.time?.slice(0,5)} {e.title}
                  </div>
                ))}
                {present.length>0 && (
                  <div className="hidden md:block text-[12px] px-1 py-0.5 rounded mb-0.5 truncate bg-[#FEF9C3] text-[#854d0e]">
                    {present.map(c=>c.crew_name).join(', ')}
                  </div>
                )}
                {absent.length>0 && (
                  <div className="hidden md:block text-[12px] px-1 py-0.5 rounded mb-0.5 truncate bg-[#FEE2E2] text-[#b91c1c]">
                    {absent.map(c=>c.crew_name).join(', ')}
                  </div>
                )}
                {dayEvents.length>3 && (
                  <div className="hidden md:block text-[12px] text-gray-400 text-center">+{dayEvents.length-3} אירועים</div>
                )}
              </div>
            )
          })}
        </div>
        ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekCells.map((c, ci) => {
            const isToday = c.ds === todayDs
            const isSelected = selectedDay === c.ds
            const { dayEvents, dayConstraints } = getDayData(c.ds)
            const present = dayConstraints.filter(x => x.available)
            const absent  = dayConstraints.filter(x => !x.available)
            return (
              <div key={ci} onClick={()=>setSelectedDay(c.ds)}
                className={`min-h-[120px] md:min-h-[420px] rounded-lg p-1.5 md:p-2 cursor-pointer border transition-all ${
                  isSelected ? 'border-[#E0197D] bg-[#FCE4F3]' :
                  isToday    ? 'bg-[#FCE4F3] border-transparent' :
                               'border-gray-100 bg-gray-50 hover:bg-gray-100'
                }`}>
                <div className={`text-center text-[14px] md:text-[20px] font-medium mb-1.5 ${isToday||isSelected?'text-[#E0197D]':'text-gray-700'}`}>{c.d}</div>
                {dayEvents.map(e=>(
                  <div key={e.id} className="text-[10px] md:text-[13px] px-1.5 py-1 rounded mb-1 truncate bg-[#FCE4F3] text-[#A0106A]">
                    {e.time?.slice(0,5)} {e.title}
                  </div>
                ))}
                {present.length>0 && (
                  <div className="text-[10px] md:text-[13px] px-1.5 py-1 rounded mb-1 bg-[#FEF9C3] text-[#854d0e] leading-snug">
                    {present.map(x=>x.crew_name).join(', ')}
                  </div>
                )}
                {absent.length>0 && (
                  <div className="text-[10px] md:text-[13px] px-1.5 py-1 rounded mb-1 bg-[#FEE2E2] text-[#b91c1c] leading-snug">
                    {absent.map(x=>x.crew_name).join(', ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>

      {/* Selected day panel */}
      {selectedDay && selectedData && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>setSelectedDay(null)}
              className="flex items-center gap-1 text-[13px] text-gray-600 hover:text-[#E0197D] border border-gray-200 hover:border-[#E0197D] rounded-lg px-3 py-1.5 transition-colors">
              <i className="ti ti-arrow-right" style={{fontSize:15}}/>
              חזרה ליומן
            </button>
            <div className="text-[16px] font-semibold text-gray-900">
              {parseInt(selectedDay.split('-')[2])} {HE_MONTHS[parseInt(selectedDay.split('-')[1])-1]}
            </div>
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

          {selectedData.dayConstraints.length > 0 && (() => {
            const present = selectedData.dayConstraints.filter(c => c.available)
            const absent  = selectedData.dayConstraints.filter(c => !c.available)
            const withNotes = selectedData.dayConstraints.filter(c => c.notes && c.notes.trim())
            const Chip = ({ c, tone }) => (
              <span className={`inline-flex items-center rounded-full text-[12px] ${tone}`}>
                <button onClick={()=>toggleStatus(c)} title="לחץ כדי להפוך נמצא/לא נמצא"
                  className="pr-2.5 pl-1 py-1 hover:opacity-70">{c.crew_name}</button>
                <button onClick={()=>openEdit(c)} title="עריכה והערה"
                  className="px-1 py-1 opacity-50 hover:opacity-100">
                  <i className="ti ti-pencil" style={{fontSize:11}}/>
                </button>
                <button onClick={()=>deleteConstraint(c.id)} title="מחיקה"
                  className="pl-2 py-1 opacity-50 hover:opacity-100">
                  <i className="ti ti-x" style={{fontSize:11}}/>
                </button>
              </span>
            )
            return (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold text-[#854d0e] mb-2">נמצאים ({present.length})</div>
                  {present.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {present.map(c => <Chip key={c.id} c={c} tone="bg-[#FEF9C3] text-[#854d0e]" />)}
                    </div>
                  ) : <div className="text-[12px] text-gray-400">—</div>}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#b91c1c] mb-2">לא נמצאים ({absent.length})</div>
                  {absent.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {absent.map(c => <Chip key={c.id} c={c} tone="bg-[#FEE2E2] text-[#b91c1c]" />)}
                    </div>
                  ) : <div className="text-[12px] text-gray-400">—</div>}
                </div>
                {withNotes.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-gray-700 mb-2">הערות</div>
                    <div className="space-y-1">
                      {withNotes.map(c => (
                        <div key={c.id} className="text-[12px] text-gray-700 text-right">
                          <span className="font-medium">{c.crew_name}:</span> {c.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

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
                {editForm.crew_name && !crew.some(m=>m.display===editForm.crew_name) && (
                  <option value={editForm.crew_name}>{editForm.crew_name}</option>
                )}
                {crew.map(m=><option key={m.id} value={m.display}>{m.display}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400 flex-shrink-0">תאריך</span>
                <input value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                  type="date" required className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#6366f1]"/>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                <button type="button" onClick={()=>setEditForm(f=>({...f,available:true}))}
                  className={`flex-1 text-[13px] py-2.5 transition-colors ${editForm.available ? 'bg-[#ca8a04] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  נמצא
                </button>
                <button type="button" onClick={()=>setEditForm(f=>({...f,available:false}))}
                  className={`flex-1 text-[13px] py-2.5 transition-colors ${!editForm.available ? 'bg-[#dc2626] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  לא נמצא
                </button>
              </div>
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
