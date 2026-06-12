'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const DEPTS_GENERAL = ['ניהול', 'טק פואטרי', 'הפקה', 'פרסום ושיווק']

const LEVELS = [
  { key: 'none', label: 'אין' },
  { key: 'view', label: 'צפייה' },
  { key: 'edit', label: 'עריכה' },
]

const AREA_ORDER = [
  'dashboard','calendar','events','tasks','messages','specs','production','productions',
  'operations','equipment','storage','notes','constraints','crew','team','departments',
  'venues','rundowns','duplicates','import','export','assistant','settings',
]

const FALLBACK_LABELS = {
  dashboard:'ראשי', calendar:'יומן', events:'אירועים', tasks:'משימות', messages:'הודעות',
  specs:'מפרטים', production:'הפקה', productions:'הפקות', operations:'תפעול', equipment:'ציוד',
  storage:'אחסון', notes:'הערות', constraints:'אילוצים', crew:'כוח אדם', team:'צוות',
  departments:'מחלקות', venues:'אולמות', rundowns:'ראנדאונים', duplicates:'כפילויות',
  import:'ייבוא', export:'ייצוא', assistant:'עוזר', settings:'הגדרות',
}

function sortTeam(arr) {
  return [...arr].sort((a, b) => {
    if (!!a.is_manager !== !!b.is_manager) return a.is_manager ? -1 : 1
    const da = a.dept || '\uffff'
    const db = b.dept || '\uffff'
    if (da !== db) return da.localeCompare(db, 'he')
    return (a.full_name || '').localeCompare(b.full_name || '', 'he')
  })
}

export default function TeamAndPermissionsPage() {
  const [team, setTeam] = useState([])
  const [areas, setAreas] = useState([])
  const [opsSet, setOpsSet] = useState(new Set())
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // טופס הוספה
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ full_name:'', email:'', password:'', dept:'', is_manager:false })
  const [selectedAreas, setSelectedAreas] = useState(new Set())
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)

  // פאנל עריכה
  const [selected, setSelected] = useState(null)
  const [editMgr, setEditMgr] = useState(false)
  const [editDept, setEditDept] = useState('')
  const [grants, setGrants] = useState({})
  const [original, setOriginal] = useState({})
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profs }, { data: at }, { data: nav }, { data: opsCrew }, { data: me }, { data: opsRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, dept, is_manager').order('full_name'),
        supabase.from('area_tables').select('area'),
        supabase.from('nav_items').select('href, label, icon'),
        supabase.from('operations_crew').select('user_id').eq('active', true),
        user ? supabase.from('profiles').select('is_manager').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('user_area_access').select('user_id').eq('area', 'operations'),
      ])
      const opsCrewSet = new Set((opsCrew || []).map(r => r.user_id).filter(Boolean))
      setTeam(sortTeam((profs || []).filter(p => !opsCrewSet.has(p.id))))
      setOpsSet(new Set((opsRows || []).map(r => r.user_id).filter(Boolean)))
      setIsManager(!!me?.is_manager)

      const navMap = {}
      ;(nav || []).forEach(n => {
        const key = n.href === '/dashboard' ? 'dashboard' : (n.href || '').replace('/dashboard/', '')
        if (key) navMap[key] = { label: n.label, icon: n.icon }
      })
      const uniqueAreas = [...new Set((at || []).map(r => r.area))]
      uniqueAreas.sort((a, b) => {
        const ia = AREA_ORDER.indexOf(a), ib = AREA_ORDER.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      setAreas(uniqueAreas.map(key => ({
        key,
        label: navMap[key]?.label || FALLBACK_LABELS[key] || key,
        icon: navMap[key]?.icon || 'ti-square-rounded',
      })))
      setLoading(false)
    })()
  }, [])

  async function reloadTeam() {
    const [{ data: profs }, { data: opsCrew }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, dept, is_manager').order('full_name'),
      supabase.from('operations_crew').select('user_id').eq('active', true),
    ])
    const opsCrewSet = new Set((opsCrew || []).map(r => r.user_id).filter(Boolean))
    setTeam(sortTeam((profs || []).filter(p => !opsCrewSet.has(p.id))))
  }

  function toggleArea(area) {
    setSelectedAreas(prev => {
      const next = new Set(prev)
      next.has(area) ? next.delete(area) : next.add(area)
      return next
    })
  }

  async function addMember(e) {
    e.preventDefault()
    setAdding(true); setMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/create-crew-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        dept: form.dept,
        is_manager: form.is_manager,
        areas: Array.from(selectedAreas),
        add_to_operations: false,
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ type: 'err', text: data.error || 'אירעה שגיאה ביצירת המשתמש' }); setAdding(false); return }
    setMsg({ type: 'ok', text: `${form.full_name} נוצר/ה בהצלחה. בכניסה הראשונה תתבקש/י להחליף סיסמה.` })
    await reloadTeam()
    setForm({ full_name:'', email:'', password:'', dept:'', is_manager:false })
    setSelectedAreas(new Set())
    setAdding(false)
  }

  async function selectUser(u) {
    if (!isManager) return
    setSelected(u); setSaveMsg('')
    setEditMgr(!!u.is_manager); setEditDept(u.dept || '')
    setLoadingGrants(true)
    const { data } = await supabase.from('user_area_access').select('area, level').eq('user_id', u.id)
    const map = {}
    ;(data || []).forEach(r => { map[r.area] = r.level })
    const full = {}
    areas.forEach(a => { full[a.key] = map[a.key] || 'none' })
    setGrants(full); setOriginal(full)
    setLoadingGrants(false)
  }

  const permsDirty = useMemo(
    () => Object.keys(grants).some(k => grants[k] !== original[k]),
    [grants, original]
  )
  const profileDirty = selected ? (editMgr !== !!selected.is_manager || editDept !== (selected.dept || '')) : false
  const dirty = profileDirty || permsDirty

  function setLevel(areaKey, level) { setGrants(g => ({ ...g, [areaKey]: level })); setSaveMsg('') }
  function setAll(level) { const next = {}; areas.forEach(a => { next[a.key] = level }); setGrants(next); setSaveMsg('') }

  async function save() {
    if (!selected) return
    setSaving(true); setSaveMsg('')
    try {
      if (editMgr !== !!selected.is_manager || editDept !== (selected.dept || '')) {
        const { error } = await supabase.from('profiles').update({ is_manager: editMgr, dept: editDept || null }).eq('id', selected.id)
        if (error) throw error
      }
      if (!editMgr) {
        const toUpsert = []
        const toDelete = []
        areas.forEach(a => {
          const lvl = grants[a.key] || 'none'
          if (lvl === 'none') { if (original[a.key] && original[a.key] !== 'none') toDelete.push(a.key) }
          else toUpsert.push({ user_id: selected.id, area: a.key, level: lvl })
        })
        if (toDelete.length) {
          const { error } = await supabase.from('user_area_access').delete().eq('user_id', selected.id).in('area', toDelete)
          if (error) throw error
        }
        if (toUpsert.length) {
          const { error } = await supabase.from('user_area_access').upsert(toUpsert, { onConflict: 'user_id,area' })
          if (error) throw error
        }
      }
      setOriginal({ ...grants })
      const updatedSel = { ...selected, is_manager: editMgr, dept: editDept || null }
      setSelected(updatedSel)
      setTeam(prev => sortTeam(prev.map(m => m.id === selected.id ? updatedSel : m)))
      setSaveMsg('נשמר')
    } catch (e) {
      setSaveMsg('שגיאה בשמירה: ' + (e.message || 'נסה שוב'))
    }
    setSaving(false)
  }

  const initials = name => name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'
  const filtered = team.filter(u => (u.full_name || '').includes(query.trim()))
  const deptOptions = [...new Set([...DEPTS_GENERAL, editDept].filter(Boolean))]

  return (
    <div className="max-w-xl" dir="rtl">
      {/* טופס הוספה (מנהלים) */}
      {isManager && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <button onClick={() => setShowAdd(s => !s)} className="w-full flex items-center justify-between text-[13px] font-medium text-gray-800">
            <span>הוספת עובד חדש</span>
            <i className={`ti ${showAdd ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{ fontSize: 16 }} />
          </button>
          {showAdd && (
            <form onSubmit={addMember} className="grid grid-cols-2 gap-2 mt-3">
              <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="שם מלא *" required className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="אימייל *" type="email" required className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
              <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="סיסמה ראשונית *" required className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />

              <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end mt-1">
                <input type="checkbox" checked={form.is_manager} onChange={e=>setForm(f=>({...f,is_manager:e.target.checked}))} style={{ accentColor:'#E0197D' }} />
                מנהל הפקה (גישה מלאה לכל האזורים)
              </label>

              <select value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))} className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none text-right">
                <option value="">מחלקה...</option>
                {DEPTS_GENERAL.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {!form.is_manager && (
                <div className="col-span-2 border border-gray-100 rounded-lg p-3 mt-1">
                  <div className="text-[12px] font-medium text-gray-500 mb-2 text-right">אזורים מורשים</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {areas.map(a => (
                      <label key={a.key} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer w-full">
                        <input type="checkbox" checked={selectedAreas.has(a.key)} onChange={()=>toggleArea(a.key)} style={{ accentColor:'#E0197D' }} className="flex-shrink-0" />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={adding} className="col-span-2 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] transition-colors disabled:opacity-50 mt-1">
                {adding ? 'יוצר...' : 'הוסף עובד'}
              </button>
            </form>
          )}
          {msg && (
            <div className={`mt-3 text-[12px] p-3 rounded-lg text-right border ${msg.type==='ok' ? 'bg-[#E1F5EE] text-[#085041] border-[#bfe8dc]' : 'bg-[#FCE4F3] text-[#A0106A] border-[#f3c6e0]'}`}>
              {msg.text}
            </div>
          )}
        </div>
      )}

      {/* רשימת הצוות */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">
          הצוות {team.length > 0 && <span className="text-gray-400">({team.length})</span>}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם…"
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] mb-2"
        />
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען…</div>
        ) : (
          <div className="max-h-72 overflow-y-auto -mx-1 px-1">
            {filtered.map(m => {
              const row = (
                <>
                  <div className="w-8 h-8 rounded-full bg-[#FCE4F3] text-[#E0197D] text-[11px] font-medium flex items-center justify-center flex-shrink-0">
                    {initials(m.full_name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-gray-800">{m.full_name}</div>
                    <div className="text-[11px] text-gray-400">{m.role}</div>
                  </div>
                  {m.is_manager && <span className="text-[11px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full flex-shrink-0">מנהל</span>}
                  {!m.is_manager && opsSet.has(m.id) && <span className="text-[11px] bg-[#E1F5EE] text-[#0a7a5f] px-2 py-0.5 rounded-full flex-shrink-0">תפעול</span>}
                  {m.dept && m.dept !== 'תפעול' && <span className="text-[11px] bg-[#FCE4F3] text-[#A0106A] px-2 py-0.5 rounded-full flex-shrink-0">{m.dept}</span>}
                </>
              )
              return isManager ? (
                <button key={m.id} onClick={() => selectUser(m)} className={`w-full flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-gray-50 last:border-0 flex-row-reverse text-right transition-colors ${selected?.id === m.id ? 'bg-[#FCE4F3]' : 'hover:bg-gray-50'}`}>
                  {row}
                </button>
              ) : (
                <div key={m.id} className="w-full flex items-center gap-3 py-2.5 px-2 border-b border-gray-50 last:border-0 flex-row-reverse text-right">
                  {row}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* פאנל פרטים + הרשאות */}
      {isManager && selected && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mt-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">
            פרטים והרשאות — {selected.full_name}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end">
              <input type="checkbox" checked={editMgr} onChange={e => { setEditMgr(e.target.checked); setSaveMsg('') }} style={{ accentColor:'#E0197D' }} />
              מנהל הפקה (גישה מלאה לכל האזורים)
            </label>
            <select value={editDept} onChange={e => { setEditDept(e.target.value); setSaveMsg('') }} className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none text-right">
              <option value="">ללא מחלקה</option>
              {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {editMgr ? (
            <div className="text-[12px] text-gray-500 bg-gray-50 rounded-lg p-3">
              משתמש זה מוגדר כמנהל — יש לו גישה מלאה לכל האזורים, ואין צורך להגדיר לו הרשאות ידנית.
            </div>
          ) : loadingGrants ? (
            <div className="text-center text-sm text-gray-400 py-6">טוען הרשאות…</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-gray-400">לכל אזור: אין גישה, צפייה, או עריכה</div>
                <div className="flex gap-2">
                  <button onClick={() => setAll('none')} className="text-[11px] text-gray-500 hover:text-[#E0197D]">נקה הכל</button>
                  <span className="text-gray-200">|</span>
                  <button onClick={() => setAll('view')} className="text-[11px] text-gray-500 hover:text-[#E0197D]">הכל לצפייה</button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {areas.map(a => (
                  <div key={a.key} className="flex items-center justify-between py-2 flex-row-reverse">
                    <div className="flex items-center gap-2 flex-row-reverse text-right">
                      <i className={`ti ${a.icon} text-gray-400`} style={{ fontSize: 15 }} aria-hidden />
                      <span className="text-[13px] text-gray-700">{a.label}</span>
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[12px] flex-shrink-0">
                      {LEVELS.map(l => (
                        <button key={l.key} onClick={() => setLevel(a.key, l.key)} className={`px-2.5 py-1 transition-colors ${(grants[a.key] || 'none') === l.key ? 'bg-[#E0197D] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button onClick={save} disabled={!dirty || saving} className="bg-[#E0197D] text-white text-sm px-5 py-2 rounded-lg hover:bg-[#A0106A] transition-colors disabled:opacity-40 disabled:hover:bg-[#E0197D]">
              {saving ? 'שומר…' : 'שמור שינויים'}
            </button>
            {saveMsg && (
              <span className={`text-[12px] ${saveMsg === 'נשמר' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMsg === 'נשמר' ? '✓ נשמר' : saveMsg}
              </span>
            )}
            {dirty && !saving && !saveMsg && <span className="text-[11px] text-gray-400">יש שינויים שלא נשמרו</span>}
          </div>
        </div>
      )}
    </div>
  )
}
