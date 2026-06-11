'use client'
import { useEffect, useState, useRef } from 'react'
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
  const [viewMode, setViewMode] = useState('month')
  const [weekAnchor, setWeekAnchor] = useState(null)
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState('all')
  const [editingEvent, setEditingEvent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [eventTypes, setEventTypes] = useState([])

  const getTypeStyle = v => { const t = eventTypes.find(t => t.value === v); return t ? t.color : 'bg-gray-100 text-gray-600' }
  const getTypeLabel = v => { const t = eventTypes.find(t => t.value === v); return t ? t.label : v }
  const getTypeColors = v => {
    const t = eventTypes.find(t => t.value === v)
    const c = (t && t.color) || ''
    const bg = (c.match(/bg-\[(#[0-9a-fA-F]+)\]/) || [])[1] || '#f3f4f6'
    const text = (c.match(/text-\[(#[0-9a-fA-F]+)\]/) || [])[1] || '#4b5563'
    return { bg, text }
  }

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
      const { data: ts } = await supabase.from('event_types').select('*').order('sort_order')
      setEventTypes(ts || [])
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

  function buildWeekCells(anchorDs) {
    const [ay, am, ad] = anchorDs.split('-').map(Number)
    const base = new Date(ay, am - 1, ad)
    base.setDate(base.getDate() - base.getDay())
    const wk = []
    for (let j = 0; j < 7; j++) {
      const dt = new Date(base); dt.setDate(base.getDate() + j)
      wk.push({ d: dt.getDate(), ds: dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate()), inMonth: true })
    }
    return wk
  }

  function navigate(dir) {
    if (viewMode === 'week') {
      const a = weekAnchor || selectedDay || todayDs
      const [ay, am, ad] = a.split('-').map(Number)
      const dt = new Date(ay, am - 1, ad); dt.setDate(dt.getDate() + dir * 7)
      setWeekAnchor(dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate()))
    } else {
      changeMonth(dir)
    }
  }

  // מעבר חודש בגלילה/החלקה מעל היומן
  const gridRef = useRef(null)
  const wheelAcc = useRef(0)
  const wheelTime = useRef(0)
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
        changeMonth(dx > 0 ? 1 : -1)
        setTimeout(() => { wheelLock.current = false }, 500)
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [calMonth, calYear])

  function dateStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const filteredEvents = selectedVenue === 'all'
    ? events
    : events.filter(e => e.venue === selectedVenue)

  // ---- בניית שבועות + פסים מתפרסים לאירועים מתמשכים ----
  const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const wkAnchor = weekAnchor || selectedDay || todayDs
  let weeks = []
  if (viewMode === 'week') {
    weeks = [buildWeekCells(wkAnchor)]
  } else {
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    for (let i = 0; i < totalCells; i += 7) {
      const wk = []
      for (let j = 0; j < 7; j++) {
        const dt = new Date(calYear, calMonth, (i + j) - firstDay + 1)
        wk.push({ d: dt.getDate(), ds: dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate()), inMonth: dt.getMonth() === calMonth && dt.getFullYear() === calYear })
      }
      weeks.push(wk)
    }
  }
  const weekLabel = weeks[0]
    ? `${weeks[0][0].d} ${HE_MONTHS[Number(weeks[0][0].ds.split('-')[1]) - 1]} – ${weeks[0][6].d} ${HE_MONTHS[Number(weeks[0][6].ds.split('-')[1]) - 1]}`
    : ''
  const weekData = weeks.map(week => {
    const wStart = week[0].ds, wEnd = week[6].ds
    const segs = filteredEvents
      .filter(e => { const en = (e.end_date && e.end_date >= e.date ? e.end_date : e.date); return e.date && e.date <= wEnd && en >= wStart })
      .map(e => {
        const s = e.date, en = (e.end_date && e.end_date >= e.date ? e.end_date : e.date)
        let sc = 0; while (sc < 7 && week[sc].ds < s) sc++
        let ec = 6; while (ec >= 0 && week[ec].ds > en) ec--
        return { event: e, startCol: sc, endCol: ec, isStart: s >= wStart, isEnd: en <= wEnd }
      })
      .filter(seg => seg.startCol <= seg.endCol)
    segs.sort((a, b) => {
      if ((a.event.type === 'show') !== (b.event.type === 'show')) return a.event.type === 'show' ? -1 : 1
      if (a.startCol !== b.startCol) return a.startCol - b.startCol
      return (b.endCol - b.startCol) - (a.endCol - a.startCol)
    })
    const lanes = []
    segs.forEach(seg => {
      let lane = 0
      while (true) {
        const occ = lanes[lane] || (lanes[lane] = [])
        if (occ.every(o => seg.endCol < o.startCol || seg.startCol > o.endCol)) { occ.push(seg); seg.lane = lane; break }
        lane++
      }
    })
    return { week, segs, laneCount: Math.max(lanes.length, 1) }
  })

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
      <div ref={gridRef} className="bg-white border border-gray-100 rounded-xl p-5 mb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <button onClick={exportExcel} className="text-sm text-gray-500 hover:text-green-600 px-3 py-1 border border-gray-200 rounded-lg flex items-center gap-1">
            <i className="ti ti-table-export" style={{fontSize:13}}/> ייצוא
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-[#E0197D] p-1 rounded-lg hover:bg-gray-50">
              <i className="ti ti-chevron-right" style={{fontSize:20}}/>
            </button>
            <span className="text-base font-semibold text-[#E0197D] text-center min-w-[130px]">
              {viewMode === 'week' ? weekLabel : `${HE_MONTHS[calMonth]} ${calYear}`}
            </span>
            <button onClick={() => navigate(1)} className="text-gray-400 hover:text-[#E0197D] p-1 rounded-lg hover:bg-gray-50">
              <i className="ti ti-chevron-left" style={{fontSize:20}}/>
            </button>
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('month')} className={`text-[12px] px-3 py-1 ${viewMode === 'month' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>חודשי</button>
            <button onClick={() => { setViewMode('week'); setWeekAnchor(selectedDay || todayDs) }} className={`text-[12px] px-3 py-1 ${viewMode === 'week' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>שבועי</button>
          </div>
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

        {/* Days grid — שבועות עם פסים מתפרסים */}
        <div className="flex flex-col gap-1.5">
          {weekData.map((wd, wi) => (
            <div key={wi}>
              <div className="grid grid-cols-7 gap-1.5">
                {wd.week.map((c, ci) => {
                  const isToday = c.ds === todayDs
                  const isSelected = selectedDay === c.ds
                  return (
                    <div key={ci} onClick={() => setSelectedDay(c.ds)}
                      className={`min-h-[26px] rounded-lg pt-1 pb-0.5 cursor-pointer border transition-all ${
                        isSelected ? 'border-[#E0197D] bg-[#FCE4F3]' :
                        isToday ? 'bg-[#FCE4F3] border-transparent' :
                        'border-transparent hover:bg-gray-50'
                      } ${c.inMonth ? '' : 'opacity-30'}`}>
                      <div className={`text-center ${viewMode === 'week' ? 'text-[11px] md:text-[20px]' : 'text-[12px] md:text-[14px]'} font-medium ${isToday || isSelected ? 'text-[#E0197D]' : 'text-gray-700'}`}>{c.d}</div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 gap-x-1.5 gap-y-0.5 mt-0.5" style={{ gridTemplateRows: `repeat(${wd.laneCount}, minmax(18px, auto))`, minHeight: viewMode === 'week' ? '6rem' : '3.4rem' }}>
                {wd.segs.map((seg, si) => (
                  <div key={seg.event.id + '-' + wi}
                    onClick={() => setSelectedDay(seg.event.date)}
                    style={{ gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`, gridRow: seg.lane + 1, backgroundColor: getTypeColors(seg.event.type).bg, color: getTypeColors(seg.event.type).text }}
                    className={`min-w-0 ${viewMode === 'week' ? 'min-h-[16px] md:min-h-[30px] text-[9px] md:text-[16px]' : 'min-h-[16px] text-[9px] md:text-[12px]'} leading-tight px-1.5 py-0.5 overflow-hidden whitespace-nowrap md:text-ellipsis cursor-pointer ${
                      seg.isStart && seg.isEnd ? 'rounded' :
                      seg.isStart ? 'rounded-r-md rounded-l-none' :
                      seg.isEnd ? 'rounded-l-md rounded-r-none' :
                      'rounded-none'
                    }`}>
                    {seg.isStart ? <><span className="md:hidden">{(seg.event.title || '').split(' ')[0]}</span><span className="hidden md:inline">{seg.event.time ? seg.event.time.slice(0,5) + ' ' : ''}{seg.event.title}</span></> : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}
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
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getTypeColors(e.type).bg, color: getTypeColors(e.type).text }}>
                        {getTypeLabel(e.type)}
                      </span>
                      {e.venue && <span className="text-[11px] text-gray-400">{e.venue}</span>}
                    </div>
                    {e.crew_notes && (
                      <div className="mt-2 pt-2 border-t border-gray-200/70 flex items-start gap-1.5 justify-end">
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-[#FCE4F3] text-[#A0106A] text-right leading-relaxed whitespace-pre-wrap">
                          {e.crew_notes}
                        </span>
                        <i className="ti ti-users text-[#A0106A] flex-shrink-0" style={{fontSize:13, marginTop:4}} />
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
                  {eventTypes.map(t=>(
                    <option key={t.value} value={t.value}>{t.label}</option>
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
