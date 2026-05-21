'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

const CATEGORIES = [
  { id:'events',    label:'אירועים',  icon:'ti-calendar-month' },
  { id:'crew',      label:'צוות',     icon:'ti-users' },
  { id:'equipment', label:'ציוד',     icon:'ti-tool' },
  { id:'tasks',     label:'משימות',   icon:'ti-checkbox' },
  { id:'storage',   label:'אכסון',    icon:'ti-map-pin' },
]

export default function SearchPage() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const router = useRouter()

  async function search(q) {
    if (!q.trim()) { setResults(null); return }
    setLoading(true)
    const term = q.trim().toLowerCase()

    const [
      { data: events },
      { data: crew },
      { data: equipment },
      { data: tasks },
      { data: storage },
    ] = await Promise.all([
      supabase.from('events').select('id,title,date,time,type,venue,depts').ilike('title', `%${term}%`).order('date').limit(20),
      supabase.from('crew_members').select('id,full_name,role,dept,phone').eq('active',true).or(`full_name.ilike.%${term}%,role.ilike.%${term}%,dept.ilike.%${term}%`).limit(20),
      supabase.from('equipment_items').select('id,name,units,location,subcategory_id').ilike('name', `%${term}%`).limit(20),
      supabase.from('tasks').select('id,title,priority,done,dept').ilike('title', `%${term}%`).limit(20),
      supabase.from('storage_items').select('id,name,location,notes').ilike('name', `%${term}%`).limit(20),
    ])

    setResults({ events: events||[], crew: crew||[], equipment: equipment||[], tasks: tasks||[], storage: storage||[] })
    setLoading(false)
  }

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(window._st)
    window._st = setTimeout(() => search(val), 300)
  }

  const total = results ? Object.values(results).flat().length : 0
  const tabs = [
    { id:'all', label:'הכל', count: total },
    ...CATEGORIES.map(c => ({ id: c.id, label: c.label, count: results?.[c.id]?.length || 0 }))
  ].filter(t => t.id === 'all' || t.count > 0)

  function ResultSection({ id, items, renderItem }) {
    if (!items?.length) return null
    if (activeTab !== 'all' && activeTab !== id) return null
    const cat = CATEGORIES.find(c => c.id === id)
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 flex-row-reverse justify-end">
          <i className={`ti ${cat.icon} text-[#CC1010]`} style={{fontSize:13}}/>
          <span className="text-[12px] font-semibold text-gray-500">{cat.label} ({items.length})</span>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {items.map(item => renderItem(item))}
        </div>
      </div>
    )
  }

  const PRI_COLOR = { 'דחוף':'bg-[#FAECE7] text-[#4A1B0C]', 'גבוהה':'bg-[#FAEEDA] text-[#633806]', 'רגיל':'bg-[#E3F0FF] text-[#1A4A8A]' }

  return (
    <div className="max-w-2xl">
      {/* Search box */}
      <div className="flex items-center gap-3 bg-white border-2 border-[#CC1010] rounded-xl px-4 py-3 mb-4">
        <i className="ti ti-search text-[#CC1010]" style={{fontSize:18}}/>
        <input
          value={query}
          onChange={handleInput}
          placeholder="חפש אירועים, צוות, ציוד, משימות..."
          autoFocus
          className="flex-1 text-[14px] bg-transparent outline-none text-right"
          dir="rtl"
        />
        {query && (
          <button onClick={()=>{setQuery('');setResults(null)}}
            className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x" style={{fontSize:14}}/>
          </button>
        )}
      </div>

      {/* Tabs */}
      {results && total > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap justify-end">
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${activeTab===t.id?'bg-[#CC1010] text-white border-[#CC1010]':'border-gray-200 text-gray-600 hover:border-[#CC1010]'}`}>
              {t.label} {t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-sm text-gray-400 py-8">מחפש...</div>
      )}

      {/* No results */}
      {!loading && results && total === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          לא נמצאו תוצאות עבור "{query}"
        </div>
      )}

      {/* Results */}
      {!loading && results && (
        <>
          <ResultSection id="events" items={results.events} renderItem={ev => (
            <div key={ev.id} onClick={()=>router.push('/dashboard/calendar')}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse cursor-pointer hover:bg-gray-50">
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium text-gray-800">{ev.title}</div>
                <div className="text-[11px] text-gray-400 flex gap-2 justify-end">
                  {ev.date && <span>{fmtDate(ev.date)}</span>}
                  {ev.time && <span>{ev.time.slice(0,5)}</span>}
                  {ev.venue && <span>{ev.venue}</span>}
                </div>
              </div>
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{ev.type}</span>
            </div>
          )}/>

          <ResultSection id="crew" items={results.crew} renderItem={c => (
            <div key={c.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse hover:bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-[#FDEAEA] text-[#CC1010] text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {c.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium text-gray-800">{c.full_name}</div>
                <div className="text-[11px] text-gray-400">{[c.role,c.dept].filter(Boolean).join(' · ')}</div>
              </div>
              {c.phone && <span className="text-[11px] text-gray-400">{c.phone}</span>}
            </div>
          )}/>

          <ResultSection id="equipment" items={results.equipment} renderItem={item => (
            <div key={item.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse hover:bg-gray-50">
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium text-gray-800" dir="ltr">{item.name}</div>
                {item.location && <div className="text-[11px] text-gray-400">{item.location}</div>}
              </div>
              {item.units && <span className="text-[12px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full">×{item.units}</span>}
            </div>
          )}/>

          <ResultSection id="tasks" items={results.tasks} renderItem={t => (
            <div key={t.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse hover:bg-gray-50 ${t.done?'opacity-50':''}`}>
              <div className="flex-1 text-right">
                <div className={`text-[13px] ${t.done?'line-through text-gray-400':'text-gray-800'}`}>{t.title}</div>
                {t.dept && <div className="text-[11px] text-gray-400">{t.dept}</div>}
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${PRI_COLOR[t.priority]||'bg-gray-100 text-gray-500'}`}>{t.priority}</span>
              {t.done && <i className="ti ti-check text-green-500" style={{fontSize:13}}/>}
            </div>
          )}/>

          <ResultSection id="storage" items={results.storage} renderItem={s => (
            <div key={s.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse hover:bg-gray-50">
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium text-gray-800">{s.name}</div>
                {s.location && <div className="text-[11px] text-gray-400 flex items-center gap-1 justify-end">
                  <span>{s.location}</span>
                  <i className="ti ti-map-pin text-[#CC1010]" style={{fontSize:10}}/>
                </div>}
              </div>
              {s.notes && <span className="text-[11px] text-gray-400">{s.notes}</span>}
            </div>
          )}/>
        </>
      )}

      {/* Empty state */}
      {!query && !results && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <i className="ti ti-search text-gray-200" style={{fontSize:40}}/>
          <div className="text-[13px] text-gray-400 mt-3">חפש בכל הנתונים של הזירה</div>
          <div className="text-[11px] text-gray-300 mt-1">אירועים · צוות · ציוד · משימות · אכסון</div>
        </div>
      )}
    </div>
  )
}
