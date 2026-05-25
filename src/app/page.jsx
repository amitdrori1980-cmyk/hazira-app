'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const TYPE_LABEL = { rehearsal:'חזרה', show:'הצגה', crew:'צוות', technical:'טכני' }
const TYPE_COLOR = { rehearsal:'bg-[#FFE6F5] text-[#CC0090]', show:'bg-[#E1F5EE] text-[#085041]', crew:'bg-[#FAEEDA] text-[#633806]', technical:'bg-[#FAECE7] text-[#4A1B0C]' }
const PRI_COLOR  = { 'דחוף':'bg-[#FAECE7] text-[#4A1B0C]', 'גבוהה':'bg-[#FAEEDA] text-[#633806]', 'רגיל':'bg-[#E3F0FF] text-[#1A4A8A]', 'היום':'bg-[#FAECE7] text-[#4A1B0C]', 'מחר':'bg-[#FFE6F5] text-[#CC0090]', 'השבוע':'bg-[#FAEEDA] text-[#633806]' }

function Badge({ text, color }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${color}`}>{text}</span>
}

function Card({ title, icon, href, children }) {
  const router = useRouter()
  return (
    <div onClick={() => href && router.push(href)}
      className={`bg-white border border-gray-100 rounded-xl p-4 mb-3 transition-all ${href ? 'cursor-pointer hover:border-[#FF3EB5] hover:shadow-sm' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className={`ti ${icon} text-[#FF3EB5]`} style={{ fontSize: 15 }}/>
          <span className="text-[13px] font-medium text-gray-800">{title}</span>
        </div>
        {href && <i className="ti ti-chevron-left text-gray-300" style={{ fontSize: 13 }}/>}
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile]   = useState(null)
  const [tasks, setTasks]       = useState([])
  const [events, setEvents]     = useState([])
  const [messages, setMessages] = useState([])
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading]   = useState(true)

  const [query, setQuery]           = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const tq = supabase.from('tasks').select('*').eq('done', false).order('created_at')
      if (!p?.is_manager) tq.or(`assignee_id.eq.${user.id},dept.eq.${p?.dept}`)
      const { data: t } = await tq
      setTasks(t || [])

      const today = new Date().toISOString().slice(0, 10)
      const { data: e } = await supabase.from('events').select('*').gte('date', today).order('date').limit(5)
      setEvents(e || [])

      const mq = supabase.from('messages').select('*, sender:sender_id(full_name)').order('created_at', { ascending: false }).limit(3)
      if (!p?.is_manager) mq.or(`to_user.eq.${user.id},to_dept.eq.${p?.dept},to_dept.eq.all`)
      const { data: m } = await mq
      setMessages(m || [])

      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const ws = weekStart.toISOString().slice(0,10)
      const we = weekEnd.toISOString().slice(0,10)
      const { data: con } = await supabase
        .from('crew_constraints')
        .select('*')
        .gte('date', ws)
        .lte('date', we)
        .order('date')
      setConstraints(con || [])

      setLoading(false)
    }
    load()
  }, [])

  async function doSearch(q) {
    if (!q.trim()) { setSearchResults(null); return }
    setSearching(true)
    const words = q.trim().split(/\s+/).filter(Boolean)

    function matchesAllWords(str) {
      if (!str) return false
      const s = str.toLowerCase()
      return words.every(w => s.includes(w.toLowerCase()))
    }

    const [
      { data: evs },
      { data: crew },
      { data: equip },
      { data: tsks },
      { data: stor },
    ] = await Promise.all([
      supabase.from('events').select('id,title,date,time,venue').order('date').limit(200),
      supabase.from('crew_members').select('id,full_name,role,dept').eq('active',true).limit(200),
      supabase.from('equipment_items').select('id,name,units').limit(300),
      supabase.from('tasks').select('id,title,priority,done').limit(100),
      supabase.from('storage_items').select('id,name,location,notes').limit(100),
    ])

    setSearchResults({
      events:    (evs||[]).filter(e => matchesAllWords(e.title)),
      crew:      (crew||[]).filter(c => matchesAllWords(c.full_name) || matchesAllWords(c.role) || matchesAllWords(c.dept)),
      equipment: (equip||[]).filter(i => matchesAllWords(i.name)),
      tasks:     (tsks||[]).filter(t => matchesAllWords(t.title)),
      storage:   (stor||[]).filter(s => matchesAllWords(s.name) || matchesAllWords(s.location) || matchesAllWords(s.notes)),
    })
    setSearching(false)
  }

  function handleSearch(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(window._dst)
    window._dst = setTimeout(() => doSearch(val), 300)
  }

  function fmtDate(ds) {
    if (!ds) return ''
    const [y,m,d] = ds.split('-').map(Number)
    return `${d} ${HE_MONTHS[m-1]}`
  }

  const urgent = tasks.filter(t => t.priority === 'דחוף' || t.priority === 'היום')
  const totalResults = searchResults ? Object.values(searchResults).flat().length : 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 mb-4 focus-within:border-[#FF3EB5] transition-colors">
        <i className="ti ti-search text-gray-400" style={{fontSize:16}}/>
        <input
          value={query}
          onChange={handleSearch}
          placeholder="חפש אירועים, צוות, ציוד, משימות..."
          className="flex-1 text-[13px] bg-transparent outline-none text-right"
          dir="rtl"
        />
        {query && (
          <button onClick={()=>{setQuery('');setSearchResults(null)}} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x" style={{fontSize:13}}/>
          </button>
        )}
      </div>

      {query && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          {searching ? (
            <div className="text-center text-sm text-gray-400 py-2">מחפש...</div>
          ) : totalResults === 0 ? (
            <div className="text-center text-[13px] text-gray-400 py-2">לא נמצאו תוצאות</div>
          ) : (
            <>
              {searchResults.events?.map(ev => (
                <div key={ev.id} onClick={()=>router.push('/dashboard/calendar')}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse cursor-pointer hover:bg-gray-50 rounded-lg px-2">
                  <i className="ti ti-calendar-month text-[#FF3EB5]" style={{fontSize:13}}/>
                  <span className="flex-1 text-[13px] text-right text-gray-800">{ev.title}</span>
                  <span className="text-[11px] text-gray-400">{fmtDate(ev.date)}</span>
                </div>
              ))}
              {searchResults.crew?.map(c => (
                <div key={c.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse px-2">
                  <i className="ti ti-user text-[#FF3EB5]" style={{fontSize:13}}/>
                  <span className="flex-1 text-[13px] text-right">{c.full_name}</span>
                  <span className="text-[11px] text-gray-400">{c.role}</span>
                </div>
              ))}
              {searchResults.equipment?.map(item => (
                <div key={item.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse px-2">
                  <i className="ti ti-tool text-[#FF3EB5]" style={{fontSize:13}}/>
                  <span className="flex-1 text-[13px] text-right" dir="ltr">{item.name}</span>
                  {item.units && <span className="text-[11px] text-gray-400">×{item.units}</span>}
                </div>
              ))}
              {searchResults.tasks?.map(t => (
                <div key={t.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse px-2">
                  <i className="ti ti-checkbox text-[#FF3EB5]" style={{fontSize:13}}/>
                  <span className={`flex-1 text-[13px] text-right ${t.done?'line-through text-gray-400':''}`}>{t.title}</span>
                  <Badge text={t.priority} color={PRI_COLOR[t.priority]||'bg-gray-100 text-gray-500'}/>
                </div>
              ))}
              {searchResults.storage?.map(s => (
                <div key={s.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse px-2">
                  <i className="ti ti-map-pin text-[#FF3EB5]" style={{fontSize:13}}/>
                  <span className="flex-1 text-[13px] text-right">{s.name}</span>
                  {s.location && <span className="text-[11px] text-gray-400">{s.location}</span>}
                </div>
              ))}
              <button onClick={()=>router.push('/dashboard/assistant')}
                className="w-full text-center text-[11px] text-[#FF3EB5] mt-2 hover:underline">
                חיפוש מורחב →
              </button>
            </>
          )}
        </div>
      )}

      {!query && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'משימות פתוחות', value: tasks.length,    href: '/dashboard/tasks' },
              { label: 'אירועים קרובים', value: events.length,  href: '/dashboard/calendar' },
              { label: 'הודעות',         value: messages.length, href: '/dashboard/messages' },
            ].map(s => (
              <div key={s.label} onClick={() => router.push(s.href)}
                className="bg-white border border-gray-100 rounded-xl p-3 cursor-pointer hover:border-[#FF3EB5] hover:shadow-sm transition-all"
                style={{ borderTop: '2px solid #FF3EB5' }}>
                <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
                <div className="text-xl font-medium text-[#FF3EB5]">{s.value}</div>
              </div>
            ))}
          </div>

          {urgent.length > 0 && (
            <Card title="דורש טיפול עכשיו" icon="ti-alert-triangle" href="/dashboard/tasks">
              {urgent.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0 flex-row-reverse">
                  <span className="flex-1 text-[13px] text-right">{t.title}</span>
                  <Badge text={t.priority} color={PRI_COLOR[t.priority] || 'bg-gray-100 text-gray-600'} />
                </div>
              ))}
            </Card>
          )}

          {events.length > 0 && (
            <Card title="האירועים הקרובים" icon="ti-calendar-event" href="/dashboard/calendar">
              {events.map(e => {
                const [y,m,d] = e.date.split('-').map(Number)
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse">
                    <span className="text-[12px] text-gray-400 w-24 text-right">{d} {HE_MONTHS[m-1]}, {e.time?.slice(0,5)}</span>
                    <span className="flex-1 text-[13px] text-right">{e.title}</span>
                    <Badge text={TYPE_LABEL[e.type] || e.type} color={TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'} />
                  </div>
                )
              })}
            </Card>
          )}

          {messages.length > 0 && (
            <Card title="הודעות אחרונות" icon="ti-message" href="/dashboard/messages">
              {messages.map(m => (
                <div key={m.id} className="p-2.5 bg-gray-50 rounded-lg mb-2 last:mb-0 border-r-2 border-[#FF3EB5]">
                  <div className="text-[11px] text-gray-400 mb-1">{m.sender?.full_name || 'מנהל הפקה'}</div>
                  <div className="text-[13px] text-gray-800 text-right">{m.body}</div>
                </div>
              ))}
            </Card>
          )}

          {constraints.length > 0 && (
            <Card title="אילוצים השבוע" icon="ti-ban" href="/dashboard/constraints">
              {constraints.map(c => {
                const HE_DAYS_FULL = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
                const dayName = c.date ? HE_DAYS_FULL[new Date(c.date).getDay()] : ''
                return (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse group">
                    <span className="flex-1 text-[13px] text-right font-medium">{c.crew_name}</span>
                    <span className="text-[11px] text-gray-400">{dayName} {c.date?.slice(5).replace('-','/')}</span>
                    {c.hours && <span className="text-[11px] text-gray-400">{c.hours}</span>}
                    <button onClick={e=>{e.stopPropagation();router.push('/dashboard/constraints')}}
                      className="text-gray-300 hover:text-[#6366f1] p-1 md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
