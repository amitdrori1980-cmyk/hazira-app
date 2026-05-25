'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const NAV_ICONS = [
  'ti-layout-dashboard','ti-calendar-month','ti-checkbox','ti-tool',
  'ti-bell','ti-users','ti-calendar-plus','ti-building','ti-star',
  'ti-file-text','ti-music','ti-map-pin','ti-chart-bar','ti-settings',
  'ti-ticket','ti-microphone','ti-shirt','ti-bulb','ti-box','ti-database-import',
  'ti-copy','ti-trash'
]

const TYPE_COLORS = [
  { label: 'אדום', value: 'bg-[#FFE6F5] text-[#CC0090]' },
  { label: 'ירוק',  value: 'bg-[#E1F5EE] text-[#085041]' },
  { label: 'כתום',  value: 'bg-[#FAEEDA] text-[#633806]' },
  { label: 'סגול',  value: 'bg-[#F0EEFF] text-[#3C3489]' },
  { label: 'כחול',  value: 'bg-[#E3F0FF] text-[#1A4A8A]' },
  { label: 'ורוד',  value: 'bg-[#FAECE7] text-[#4A1B0C]' },
]

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
      <div className="text-[13px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">{title}</div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [navItems, setNavItems]     = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [venues, setVenues]         = useState([])
  const [loadingNav, setLoadingNav] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Nav state
  const [editingNav, setEditingNav] = useState(null)
  const [editNavVal, setEditNavVal] = useState({})
  const [savingNav, setSavingNav]   = useState(null)
  const [newNav, setNewNav]         = useState({ label:'', href:'', icon:'ti-star', manager_only: false })
  const [addingNav, setAddingNav]   = useState(false)

  // Event types state
  const [editingType, setEditingType] = useState(null)
  const [editTypeVal, setEditTypeVal] = useState({})
  const [newType, setNewType]         = useState({ value:'', label:'', color: TYPE_COLORS[0].value })
  const [addingType, setAddingType]   = useState(false)

  // Venues state
  const [newVenue, setNewVenue]       = useState('')
  const [addingVenue, setAddingVenue] = useState(false)

  // Departments state
  const [departments, setDepartments] = useState([])
  const [newDept, setNewDept]         = useState('')
  const [addingDept, setAddingDept]   = useState(false)

  // Crew state
  const [crew, setCrew]               = useState([])
  const [newCrew, setNewCrew]         = useState({ full_name:'', role:'', dept:'', phone:'' })
  const [addingCrew, setAddingCrew]   = useState(false)
  const [editingCrew, setEditingCrew] = useState(null)
  const [editCrewVal, setEditCrewVal] = useState({})

  useEffect(() => {
    supabase.from('nav_items').select('*').order('sort_order').then(({ data }) => {
      setNavItems(data || []); setLoadingNav(false)
    })
    supabase.from('event_types').select('*').order('sort_order').then(({ data }) => {
      setEventTypes(data || []); setLoadingTypes(false)
    })
    supabase.from('venues').select('*').order('sort_order').then(({ data }) => {
      setVenues(data || [])
    })
  }, [])

  // ── NAV ──
  async function toggleNavEnabled(item) {
    setSavingNav(item.id)
    await supabase.from('nav_items').update({ enabled: !item.enabled }).eq('id', item.id)
    setNavItems(prev => prev.map(n => n.id === item.id ? { ...n, enabled: !n.enabled } : n))
    setSavingNav(null)
  }
  async function deleteNav(id) {
    await supabase.from('nav_items').delete().eq('id', id)
    setNavItems(prev => prev.filter(n => n.id !== id))
  }
  async function saveNav(id) {
    await supabase.from('nav_items').update(editNavVal).eq('id', id)
    setNavItems(prev => prev.map(n => n.id === id ? { ...n, ...editNavVal } : n))
    setEditingNav(null)
  }
  async function addNav(e) {
    e.preventDefault()
    if (!newNav.label || !newNav.href) return
    setAddingNav(true)
    const sort_order = Math.max(...navItems.map(n => n.sort_order), 0) + 1
    const href = newNav.href.startsWith('/') ? newNav.href : '/dashboard/' + newNav.href
    const { data, error } = await supabase.from('nav_items').insert({ ...newNav, href, sort_order, enabled: true }).select().single()
    if (!error) setNavItems(prev => [...prev, data])
    setNewNav({ label:'', href:'', icon:'ti-star', manager_only: false })
    setAddingNav(false)
  }
  async function moveNav(id, dir) {
    const idx = navItems.findIndex(n => n.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= navItems.length) return
    const a = navItems[idx], b = navItems[swapIdx]
    await supabase.from('nav_items').update({ sort_order: b.sort_order }).eq('id', a.id)
    await supabase.from('nav_items').update({ sort_order: a.sort_order }).eq('id', b.id)
    const { data } = await supabase.from('nav_items').select('*').order('sort_order')
    setNavItems(data || [])
  }

  // ── EVENT TYPES ──
  async function saveType(id) {
    await supabase.from('event_types').update(editTypeVal).eq('id', id)
    setEventTypes(prev => prev.map(t => t.id === id ? { ...t, ...editTypeVal } : t))
    setEditingType(null)
  }
  async function deleteType(id) {
    await supabase.from('event_types').delete().eq('id', id)
    setEventTypes(prev => prev.filter(t => t.id !== id))
  }
  async function addType(e) {
    e.preventDefault()
    if (!newType.value || !newType.label) return
    setAddingType(true)
    const sort_order = Math.max(...eventTypes.map(t => t.sort_order), 0) + 1
    const { data, error } = await supabase.from('event_types').insert({ ...newType, sort_order }).select().single()
    if (!error) setEventTypes(prev => [...prev, data])
    setNewType({ value:'', label:'', color: TYPE_COLORS[0].value })
    setAddingType(false)
  }

  // ── VENUES ──
  async function deleteVenue(id) {
    await supabase.from('venues').delete().eq('id', id)
    setVenues(prev => prev.filter(v => v.id !== id))
  }
  async function addVenue(e) {
    e.preventDefault()
    if (!newVenue.trim()) return
    setAddingVenue(true)
    const so = Math.max(...venues.map(v => v.sort_order || 0), 0) + 1
    const { data, error } = await supabase.from('venues').insert({ name: newVenue.trim(), sort_order: so }).select().single()
    if (!error) setVenues(prev => [...prev, data])
    setNewVenue('')
    setAddingVenue(false)
  }

  // ── DEPARTMENTS ──
  async function addDept(e) {
    e.preventDefault()
    if (!newDept.trim()) return
    setAddingDept(true)
    const { data, error } = await supabase.from('departments').insert({ name: newDept.trim() }).select().single()
    if (!error) setDepartments(prev => [...prev, data].sort((a,b)=>a.name.localeCompare(b.name,'he')))
    setNewDept('')
    setAddingDept(false)
  }
  async function deleteDept(id) {
    await supabase.from('departments').delete().eq('id', id)
    setDepartments(prev => prev.filter(d => d.id !== id))
  }

  // ── CREW ──
  async function addCrew(e) {
    e.preventDefault()
    if (!newCrew.full_name.trim()) return
    setAddingCrew(true)
    const { data, error } = await supabase.from('crew_members').insert({ ...newCrew, active: true }).select().single()
    if (!error) setCrew(prev => [...prev, data].sort((a,b)=>a.full_name.localeCompare(b.full_name,'he')))
    setNewCrew({ full_name:'', role:'', dept:'', phone:'' })
    setAddingCrew(false)
  }
  async function saveCrew(id) {
    await supabase.from('crew_members').update(editCrewVal).eq('id', id)
    setCrew(prev => prev.map(c => c.id === id ? { ...c, ...editCrewVal } : c))
    setEditingCrew(null)
  }
  async function deleteCrew(id) {
    await supabase.from('crew_members').update({ active: false }).eq('id', id)
    setCrew(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="max-w-lg">

      {/* NAV */}
      <Section title="ניהול תפריט">
        {loadingNav ? <div className="text-sm text-gray-400 text-center py-4">טוען...</div> : (
          navItems.map((item, idx) => (
            <div key={item.id} className={`mb-2 rounded-lg border ${item.enabled ? 'border-gray-100' : 'border-dashed border-gray-200 bg-gray-50'}`}>
              {editingNav === item.id ? (
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input value={editNavVal.label} onChange={e => setEditNavVal(v=>({...v,label:e.target.value}))}
                      placeholder="שם" className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]" />
                    <select value={editNavVal.icon} onChange={e => setEditNavVal(v=>({...v,icon:e.target.value}))}
                      className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                      {NAV_ICONS.map(ic => <option key={ic} value={ic}>{ic.replace('ti-','')}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end">
                    <input type="checkbox" checked={editNavVal.manager_only} onChange={e => setEditNavVal(v=>({...v,manager_only:e.target.checked}))} style={{accentColor:'#FF3EB5'}} />
                    מנהלים בלבד
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => saveNav(item.id)} className="flex-1 bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg">שמור</button>
                    <button onClick={() => setEditingNav(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 flex-row-reverse">
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={() => moveNav(item.id,-1)} disabled={idx===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"><i className="ti ti-chevron-up" style={{fontSize:11}}/></button>
                    <button onClick={() => moveNav(item.id,1)} disabled={idx===navItems.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"><i className="ti ti-chevron-down" style={{fontSize:11}}/></button>
                  </div>
                  <i className={`ti ${item.icon} text-[#FF3EB5]`} style={{fontSize:15}}/>
                  <span className={`flex-1 text-[13px] text-right ${item.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{item.label}</span>
                  {item.manager_only && <span className="text-[10px] bg-[#E3F0FF] text-[#1A4A8A] px-1.5 py-0.5 rounded-full">מנהל</span>}
                  <button onClick={() => { setEditingNav(item.id); setEditNavVal({label:item.label,icon:item.icon,manager_only:item.manager_only}) }} className="text-gray-300 hover:text-[#FF3EB5]"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                  <button onClick={() => toggleNavEnabled(item)} disabled={savingNav===item.id} className={item.enabled ? 'text-[#FF3EB5]' : 'text-gray-300'} title={item.enabled?'הסתר':'הצג'}><i className={`ti ${item.enabled?'ti-eye':'ti-eye-off'}`} style={{fontSize:13}}/></button>
                  <button onClick={() => deleteNav(item.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                </div>
              )}
            </div>
          ))
        )}
        <form onSubmit={addNav} className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="text-[12px] font-medium text-gray-500">הוסף פריט חדש</div>
          <div className="flex gap-2">
            <input value={newNav.label} onChange={e=>setNewNav(n=>({...n,label:e.target.value}))} placeholder="שם" required className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <input value={newNav.href} onChange={e=>setNewNav(n=>({...n,href:e.target.value}))} placeholder="כתובת" required className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <select value={newNav.icon} onChange={e=>setNewNav(n=>({...n,icon:e.target.value}))} className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
              {NAV_ICONS.map(ic=><option key={ic} value={ic}>{ic.replace('ti-','')}</option>)}
            </select>
          </div>
          <button type="submit" disabled={addingNav} className="bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">הוסף לתפריט</button>
        </form>
      </Section>

      {/* EVENT TYPES */}
      <Section title="סוגי אירועים">
        {loadingTypes ? <div className="text-sm text-gray-400 text-center py-4">טוען...</div> : (
          eventTypes.map(t => (
            <div key={t.id} className="mb-2 rounded-lg border border-gray-100">
              {editingType === t.id ? (
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input value={editTypeVal.label} onChange={e=>setEditTypeVal(v=>({...v,label:e.target.value}))} placeholder="שם לתצוגה" className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                    <input value={editTypeVal.value} onChange={e=>setEditTypeVal(v=>({...v,value:e.target.value}))} placeholder="מזהה (אנגלית)" className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  </div>
                  <select value={editTypeVal.color} onChange={e=>setEditTypeVal(v=>({...v,color:e.target.value}))} className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    {TYPE_COLORS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => saveType(t.id)} className="flex-1 bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg">שמור</button>
                    <button onClick={() => setEditingType(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 flex-row-reverse">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${t.color}`}>{t.label}</span>
                  <span className="flex-1 text-[12px] text-gray-400 text-right">{t.value}</span>
                  <button onClick={() => { setEditingType(t.id); setEditTypeVal({label:t.label,value:t.value,color:t.color}) }} className="text-gray-300 hover:text-[#FF3EB5]"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                  <button onClick={() => deleteType(t.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                </div>
              )}
            </div>
          ))
        )}
        <form onSubmit={addType} className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="text-[12px] font-medium text-gray-500">הוסף סוג אירוע</div>
          <div className="flex gap-2">
            <input value={newType.label} onChange={e=>setNewType(n=>({...n,label:e.target.value}))} placeholder="שם (עברית)" required className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <input value={newType.value} onChange={e=>setNewType(n=>({...n,value:e.target.value}))} placeholder="מזהה (אנגלית)" required className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          </div>
          <select value={newType.color} onChange={e=>setNewType(n=>({...n,color:e.target.value}))} className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
            {TYPE_COLORS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="submit" disabled={addingType} className="bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">הוסף סוג אירוע</button>
        </form>
      </Section>

      {/* DEPARTMENTS */}
      <Section title="מחלקות">
        {departments.map(d => (
          <div key={d.id} className="flex items-center gap-2 px-3 py-2.5 flex-row-reverse border-b border-gray-50 last:border-0 group">
            <i className="ti ti-building text-[#FF3EB5]" style={{fontSize:14}}/>
            <span className="flex-1 text-[13px] text-right text-gray-800">{d.name}</span>
            <button onClick={() => deleteDept(d.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
              <i className="ti ti-trash" style={{fontSize:13}}/>
            </button>
          </div>
        ))}
        <form onSubmit={addDept} className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="שם מחלקה חדשה" required
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          <button type="submit" disabled={addingDept}
            className="bg-[#FF3EB5] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">
            הוסף
          </button>
        </form>
      </Section>

      {/* CREW */}
      <Section title="אנשי צוות">
        {crew.map(c => (
          <div key={c.id} className="border-b border-gray-50 last:border-0">
            {editingCrew === c.id ? (
              <div className="py-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={editCrewVal.full_name||''} onChange={e=>setEditCrewVal(v=>({...v,full_name:e.target.value}))}
                    placeholder="שם מלא" className="col-span-2 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <input value={editCrewVal.role||''} onChange={e=>setEditCrewVal(v=>({...v,role:e.target.value}))}
                    placeholder="תפקיד" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <select value={editCrewVal.dept||''} onChange={e=>setEditCrewVal(v=>({...v,dept:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    <option value="">מחלקה...</option>
                    {departments.map(d=><option key={d.id}>{d.name}</option>)}
                  </select>
                  <input value={editCrewVal.phone||''} onChange={e=>setEditCrewVal(v=>({...v,phone:e.target.value}))}
                    placeholder="טלפון" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveCrew(c.id)} className="flex-1 bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg">שמור</button>
                  <button onClick={() => setEditingCrew(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 flex-row-reverse group">
                <div className="w-7 h-7 rounded-full bg-[#FFE6F5] text-[#FF3EB5] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                  {c.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 text-right">
                  <div className="text-[13px] text-gray-800">{c.full_name}</div>
                  <div className="text-[11px] text-gray-400">{[c.role,c.dept].filter(Boolean).join(' · ')}</div>
                </div>
                {c.phone && <span className="text-[11px] text-gray-400">{c.phone}</span>}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => { setEditingCrew(c.id); setEditCrewVal({full_name:c.full_name,role:c.role||'',dept:c.dept||'',phone:c.phone||''}) }}
                    className="text-gray-300 hover:text-[#FF3EB5]"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                  <button onClick={() => deleteCrew(c.id)}
                    className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                </div>
              </div>
            )}
          </div>
        ))}
        <form onSubmit={addCrew} className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="text-[12px] font-medium text-gray-500">הוסף איש צוות</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={newCrew.full_name} onChange={e=>setNewCrew(n=>({...n,full_name:e.target.value}))}
              placeholder="שם מלא *" required className="col-span-2 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <input value={newCrew.role} onChange={e=>setNewCrew(n=>({...n,role:e.target.value}))}
              placeholder="תפקיד" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <select value={newCrew.dept} onChange={e=>setNewCrew(n=>({...n,dept:e.target.value}))}
              className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
              <option value="">מחלקה...</option>
              {departments.map(d=><option key={d.id}>{d.name}</option>)}
            </select>
            <input value={newCrew.phone} onChange={e=>setNewCrew(n=>({...n,phone:e.target.value}))}
              placeholder="טלפון" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          </div>
          <button type="submit" disabled={addingCrew}
            className="bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">
            הוסף לצוות
          </button>
        </form>
      </Section>

      {/* VENUES */}
      <Section title="אולמות ומקומות">
        {venues.map(v => (
          <div key={v.id} className="flex items-center gap-2 px-3 py-2.5 flex-row-reverse border-b border-gray-50 last:border-0 group">
            <i className="ti ti-map-pin text-[#FF3EB5]" style={{fontSize:14}}/>
            <span className="flex-1 text-[13px] text-right text-gray-800">{v.name}</span>
            <button onClick={() => deleteVenue(v.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
              <i className="ti ti-trash" style={{fontSize:13}}/>
            </button>
          </div>
        ))}
        <form onSubmit={addVenue} className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <input value={newVenue} onChange={e=>setNewVenue(e.target.value)} placeholder="שם אולם חדש" required
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          <button type="submit" disabled={addingVenue}
            className="bg-[#FF3EB5] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">
            הוסף
          </button>
        </form>
      </Section>

    </div>
  )
}
