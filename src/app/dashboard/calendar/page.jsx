'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DAYS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
const TYPE_COLOR = { rehearsal:'bg-[#FCE4F3] text-[#A0106A]', show:'bg-[#E1F5EE] text-[#085041]', crew:'bg-[#FAEEDA] text-[#633806]', technical:'bg-[#FAECE7] text-[#4A1B0C]', strike:'bg-[#FAECE7] text-[#4A1B0C]' }
const TYPE_LABEL = { rehearsal:'חזרה', show:'הצגה', crew:'צוות', technical:'טכני', strike:'פירוק' }

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState([])
  const [profile, setProfile] = useState(null)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState('all')
  const [editingEvent, setEditingEvent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [eventCrew, setEventCrew] = useState({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const q = supabase.from('events').select('*').order('date')
      // כולם רואים את כל האירועים
      const { data } = await q
      setEvents(data || [])
      const { data: vs } = await supabase.from('venues').select('name').order('sort_order')
      setVenues((vs||[]).map(v => v.name))
      // שיוך צוות לאירועים
      const { data: ecRows } = await supabase.from('event_crew').select('event_id, crew_member_id, note')
      const { data: cmRows } = await supabase.from('crew_members').select('id, full_name, role')
      const cmMap = {}
      ;(cmRows || []).forEach(c => { cmMap[c.id] = c })
      const grouped = {}
      ;(ecRows || []).forEach(r => {
        const m = cmMap[r.crew_member_id]
        if (!m) return
        if (!grouped[r.event_id]) grouped[r.event_id] = []
        grouped[r.event_id].push({ ...m, note: r.note })
      })
      setEventCrew(grouped)
    }
    load()
  }, [])

  const today = new Date()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const daysInPrev = new Date(calYear, calMonth, 0).getDate()

  function changeMonth(dir) {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setCalMonth(m); setCalYear(y); setSelectedDay(null)
  }

  function dateStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const filteredEvents = selectedVenue === 'all'
    ? events
    : events.filter(e => e.venue === selectedVenue)

  const selectedEvents = selectedDay
    ? filteredEvents
        .filter(e => e.date === selectedDay)
        .sort((a, b) => {
          // הצגות (ירוק) תמיד למעלה
          if (a.type === 'show' && b.type !== 'show') return -1
          if (a.type !== 'show' && b.type === 'show') return 1
          // אחר כך לפי שעה
          return (a.time || '').localeCompare(b.time || '')
        })
    : []

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const monthStr = String(calMonth + 1).padStart(2, '0')
    const prefix = `${calYear}-${monthStr}`
    const toExport = filteredEvents
      .filter(e => e.date?.startsWith(prefix))
      .sort((a, b) => a.date > b.date ? 1 : -1)
    const hStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, fill: { fgColor: { rgb: 'E0197D' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: { bottom: { style: 'thin', color: { rgb: 'CCCCCC' } } } }
    const cStyle = { alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2, wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const aStyle = { fill: { fgColor: { rgb: 'FCE4F3' } }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2, wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: 'EEEEEE' } } } }
    const wsData = [['תאריך', 'שעה', 'שם האירוע', 'סוג', 'אולם', 'תיאור'].map(h => ({ v: h, s: hStyle }))]
    toExport.forEach((e, i) => { const s = i % 2 === 0 ? cStyle : aStyle; wsData.push([{ v: e.date||'', s }, { v: e.time||'', s }, { v: e.title||'', s }, { v: e.type||'', s }, { v: e.venue||'', s }, { v: e.description||'', s }]) })
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 35 }]
    ws['!rows'] = [{ hpt: 22 }, ...toExport.map(() => ({ hpt: 18 }))]
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    XLSX.utils.book_append_sheet(wb, ws, 'יומן')
    const venueSuffix = selectedVenue === 'all' ? 'all' : selectedVenue
    XLSX.writeFile(wb, `calendar_${prefix}_${venueSuffix}.xlsx`)
  }

  async function saveEventEdit() {
    if (!editingEvent) return
    setSavingEdit(true)
    await supabase.from('events').update({
      title: editForm.title,
      date: editForm.date,
      end_date: editForm.end_date || null,
      time: editForm.time || null,
      type: editForm.type,
      venue: editForm.venue || null,
      description: editForm.description || null,
    }).eq('id', editingEvent)
    setEvents(prev => prev.map(e => e.id === editingEvent ? { ...e, ...editForm } : e))
    setEditingEvent(null)
    setSavingEdit(false)
  }

  return (
    <div className="w-full">
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">
            ‹ הקודם
          </button>
          <span className="text-base font-semibold text-[#E0197D]">
            {HE_MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={() => changeMonth(1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">
            הבא ›
          </button>
          <button onClick={exportExcel} className="text-sm text-gray-500 hover:text-green-600 px-3 py-1 border border-gray-200 rounded-lg flex items-center gap-1">
            <i className="ti ti-table-export" style={{fontSize:13}}/> ייצוא
          </button>
        </div>

        {/* Venue filter */}
        {venues.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end mb-4">
            <button onClick={()=>setSelectedVenue('all')}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${selectedVenue==='all'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
              כל האולמות
            </button>
            {venues.map(v => (
              <button key={v} onClick={()=>setSelectedVenue(v)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${selectedVenue===v?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                {v}
              </button>
            ))}
          </div>
        )}

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {HE_DAYS.map(d => (
            <div key={d} className="text-center text-[12px] text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Prev month padding */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={'p'+i} className="min-h-[52px] md:h-[104px] rounded-lg p-1 md:p-1.5 opacity-25">
              <div className="text-center text-[12px] text-gray-400">{daysInPrev - firstDay + i + 1}</div>
            </div>
          ))}

          {/* Current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const ds = dateStr(calYear, calMonth, d)
            const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d
            const isSelected = selectedDay === ds
            const dayEvs = filteredEvents.filter(e => {
              if (!e.end_date) return e.date === ds
              return ds >= e.date && ds <= e.end_date
            }).sort((a, b) => {
              // הצגות (ירוק) תמיד למעלה
              if (a.type === 'show' && b.type !== 'show') return -1
              if (a.type !== 'show' && b.type === 'show') return 1
              // אחר כך לפי שעה
              return (a.time || '').localeCompare(b.time || '')
            })
            const isMultiStart = (e) => e.end_date && e.date === ds
            const isMultiMid   = (e) => e.end_date && ds > e.date && ds < e.end_date
            const isMultiEnd   = (e) => e.end_date && e.end_date === ds

            return (
              <div
                key={d}
                onClick={() => setSelectedDay(ds)}
                className={`min-h-[52px] md:h-[104px] flex flex-col rounded-lg p-1 md:p-1.5 cursor-pointer border transition-all ${
                  isSelected ? 'border-[#E0197D] bg-[#FCE4F3]' :
                  isToday    ? 'bg-[#FCE4F3] border-transparent' :
                               'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className={`text-center text-[11px] md:text-[12px] font-medium mb-1 flex-shrink-0 ${isToday || isSelected ? 'text-[#E0197D]' : 'text-gray-700'}`}>{d}</div>
                {/* Mobile: dots only */}
                <div className="flex flex-wrap gap-0.5 md:hidden">
                  {dayEvs.slice(0,3).map(e => (
                    <span key={e.id} className={`w-2.5 h-2.5 rounded-full inline-block ${
                      e.type==='show' ? 'bg-[#22c55e]' :
                      e.type==='rehearsal' ? 'bg-[#E0197D]' :
                      e.type==='crew' ? 'bg-[#f59e0b]' : 'bg-[#f97316]'
                    }`}/>
                  ))}
                  {dayEvs.length > 3 && <span className="text-[8px] text-gray-400">+{dayEvs.length-3}</span>}
                </div>
                {/* Desktop: scrollable list — shows ~3, scroll for the rest */}
                <div className="hidden md:flex md:flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                  {dayEvs.map(e => (
                    <div key={e.id} className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 truncate ${TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'} ${
                      isMultiStart(e) ? 'rounded-r-full rounded-l-none pl-2' :
                      isMultiMid(e)   ? 'rounded-none px-2' :
                      isMultiEnd(e)   ? 'rounded-l-full rounded-r-none pr-2' :
                      'rounded'
                    }`}>
                      {isMultiStart(e) || !e.end_date ? <>{e.time?.slice(0,5)} {e.title}</> : ''}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-gray-800">
              {parseInt(selectedDay.split('-')[2])} {HE_MONTHS[parseInt(selectedDay.split('-')[1])-1]}
            </span>
            {profile?.is_manager && (
              <button
                onClick={() => router.push(`/dashboard/events?date=${selectedDay}`)}
                className="text-xs bg-[#E0197D] text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <i className="ti ti-plus" /> הוסף אירוע
              </button>
            )}
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">אין אירועים ביום זה</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedEvents.map(e => (
                <div key={e.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-r-2 border-[#E0197D] flex-row-reverse">
                  {profile?.is_manager && (
                    <button onClick={async()=>{if(window.confirm('למחוק את "'+e.title+'"?'))await supabase.from('events').delete().eq('id',e.id).then(()=>setEvents(prev=>prev.filter(ev=>ev.id!==e.id)))}}
                      className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  )}
                  {profile?.is_manager && (
                    <button onClick={() => { setEditingEvent(e.id); setEditForm({ title:e.title, date:e.date, end_date:e.end_date||'', time:e.time||'', type:e.type||'show', venue:e.venue||'', description:e.description||'' }) }}
                      className="text-gray-300 hover:text-[#E0197D] p-1 flex-shrink-0">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                  )}
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-right">{e.title}</div>
                    {e.description && <div className="text-[12px] text-gray-500 text-right mt-0.5">{e.description}</div>}
                    <div className="flex gap-2 justify-end mt-1 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABEL[e.type] || e.type}
                      </span>
                      {e.venue && <span className="text-[11px] text-gray-400">{e.venue}</span>}
                    </div>
                    {eventCrew[e.id]?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200/70">
                        <div className="flex items-center gap-1 justify-end mb-1 text-gray-400">
                          <span className="text-[10px]">צוות ({eventCrew[e.id].length})</span>
                          <i className="ti ti-users" style={{fontSize:11}} />
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {eventCrew[e.id].map(c => (
                            <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                              {c.full_name}{c.role ? ' · ' + c.role : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-gray-400 whitespace-nowrap mt-0.5 font-mono">{e.time?.slice(0,5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingEvent(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{fontSize:16}}/></button>
              <span className="text-[14px] font-semibold text-gray-800">עריכת אירוע</span>
            </div>
            <div className="flex flex-col gap-3">
              <input value={editForm.title||''} onChange={e=>setEditForm(p=>({...p,title:e.target.value}))}
                placeholder="שם האירוע" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={editForm.date||''} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
                <input type="date" value={editForm.end_date||''} onChange={e=>setEditForm(p=>({...p,end_date:e.target.value}))}
                  placeholder="תאריך סיום" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={editForm.time||''} onChange={e=>setEditForm(p=>({...p,time:e.target.value}))}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
                <select value={editForm.type||'show'} onChange={e=>setEditForm(p=>({...p,type:e.target.value}))}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
                  {Object.entries({show:'הצגה',rehearsal:'חזרה',crew:'צוות',technical:'טכני',strike:'פירוק'}).map(([v,l])=>(
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <select value={editForm.venue||''} onChange={e=>setEditForm(p=>({...p,venue:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right">
                <option value="">בחר אולם</option>
                {venues.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <textarea value={editForm.description||''} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))}
                placeholder="תיאור" rows={2}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-none"/>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEventEdit} disabled={savingEdit || !editForm.title?.trim()}
                className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
                {savingEdit ? 'שומר...' : 'שמור'}
              </button>
              <button onClick={() => setEditingEvent(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
