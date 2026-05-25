'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DAYS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
const TYPE_COLOR = { rehearsal:'bg-[#FFE6F5] text-[#CC0090]', show:'bg-[#E1F5EE] text-[#085041]', crew:'bg-[#FAEEDA] text-[#633806]', technical:'bg-[#FAECE7] text-[#4A1B0C]', strike:'bg-[#FAECE7] text-[#4A1B0C]' }
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
    ? filteredEvents.filter(e => e.date === selectedDay)
    : []

  return (
    <div className="w-full">
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">
            ‹ הקודם
          </button>
          <span className="text-base font-semibold text-[#FF3EB5]">
            {HE_MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={() => changeMonth(1)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-lg">
            הבא ›
          </button>
        </div>

        {/* Venue filter */}
        {venues.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end mb-4">
            <button onClick={()=>setSelectedVenue('all')}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${selectedVenue==='all'?'bg-[#FF3EB5] text-white border-[#FF3EB5]':'border-gray-200 text-gray-500 hover:border-[#FF3EB5]'}`}>
              כל האולמות
            </button>
            {venues.map(v => (
              <button key={v} onClick={()=>setSelectedVenue(v)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${selectedVenue===v?'bg-[#FF3EB5] text-white border-[#FF3EB5]':'border-gray-200 text-gray-500 hover:border-[#FF3EB5]'}`}>
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
            <div key={'p'+i} className="min-h-[52px] md:min-h-[80px] rounded-lg p-1 md:p-1.5 opacity-25">
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
            })
            const isMultiStart = (e) => e.end_date && e.date === ds
            const isMultiMid   = (e) => e.end_date && ds > e.date && ds < e.end_date
            const isMultiEnd   = (e) => e.end_date && e.end_date === ds

            return (
              <div
                key={d}
                onClick={() => setSelectedDay(ds)}
                className={`min-h-[52px] md:min-h-[80px] rounded-lg p-1 md:p-1.5 cursor-pointer border transition-all ${
                  isSelected ? 'border-[#FF3EB5] bg-[#FFE6F5]' :
                  isToday    ? 'bg-[#FFE6F5] border-transparent' :
                               'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className={`text-center text-[11px] md:text-[12px] font-medium mb-1 ${isToday || isSelected ? 'text-[#FF3EB5]' : 'text-gray-700'}`}>{d}</div>
                {/* Mobile: dots only */}
                <div className="flex flex-wrap gap-0.5 md:hidden">
                  {dayEvs.slice(0,3).map(e => (
                    <span key={e.id} className={`w-2.5 h-2.5 rounded-full inline-block ${
                      e.type==='show' ? 'bg-[#22c55e]' :
                      e.type==='rehearsal' ? 'bg-[#FF3EB5]' :
                      e.type==='crew' ? 'bg-[#f59e0b]' : 'bg-[#f97316]'
                    }`}/>
                  ))}
                  {dayEvs.length > 3 && <span className="text-[8px] text-gray-400">+{dayEvs.length-3}</span>}
                </div>
                {/* Desktop: text */}
                {dayEvs.slice(0,2).map(e => (
                  <div key={e.id} className={`hidden md:block text-[10px] px-1.5 py-0.5 mb-0.5 truncate ${TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'} ${
                    isMultiStart(e) ? 'rounded-r-full rounded-l-none pl-2' :
                    isMultiMid(e)   ? 'rounded-none -mx-1 px-2' :
                    isMultiEnd(e)   ? 'rounded-l-full rounded-r-none pr-2' :
                    'rounded'
                  }`}>
                    {isMultiStart(e) || !e.end_date ? <>{e.time?.slice(0,5)} {e.title}</> : ''}
                  </div>
                ))}
                {dayEvs.length > 2 && (
                  <div className="hidden md:block text-[9px] text-gray-400 text-center">+{dayEvs.length-2}</div>
                )}
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
            <button
              onClick={() => router.push(`/dashboard/events?date=${selectedDay}`)}
              className="text-xs bg-[#FF3EB5] text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <i className="ti ti-plus" /> הוסף אירוע
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">אין אירועים ביום זה</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedEvents.map(e => (
                <div key={e.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-r-2 border-[#FF3EB5] flex-row-reverse">
                  <button onClick={() => router.push(`/dashboard/events?edit=${e.id}`)}
                    className="text-gray-300 hover:text-[#FF3EB5] p-1 flex-shrink-0">
                    <i className="ti ti-pencil" style={{fontSize:13}}/>
                  </button>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-right">{e.title}</div>
                    {e.description && <div className="text-[12px] text-gray-500 text-right mt-0.5">{e.description}</div>}
                    <div className="flex gap-2 justify-end mt-1 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABEL[e.type] || e.type}
                      </span>
                      {e.venue && <span className="text-[11px] text-gray-400">{e.venue}</span>}
                    </div>
                  </div>
                  <div className="text-[12px] text-gray-400 whitespace-nowrap mt-0.5 font-mono">{e.time?.slice(0,5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
