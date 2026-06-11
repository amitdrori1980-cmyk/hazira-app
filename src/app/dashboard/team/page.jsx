'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEPTS_GENERAL = ['ניהול', 'טק פואטרי', 'הפקה', 'פרסום ושיווק']
const OPS_ROLES = ['קופה ובר', 'ניהול ערב', 'אחר']

function areaOf(href) {
  if (href === '/dashboard') return 'dashboard'
  return (href || '').replace('/dashboard/', '').split('/')[0] || 'dashboard'
}

function sortTeam(arr) {
  return [...arr].sort((a, b) => {
    // מנהלים קודם
    if (!!a.is_manager !== !!b.is_manager) return a.is_manager ? -1 : 1
    // ואז לפי שיוך
    const da = a.dept || '\uffff'   // ללא שיוך — בסוף
    const db = b.dept || '\uffff'
    if (da !== db) return da.localeCompare(db, 'he')
    // ובתוך זה לפי א-ב
    return (a.full_name || '').localeCompare(b.full_name || '', 'he')
  })
}

export default function TeamPage() {
  const [team, setTeam] = useState([])
  const [areasList, setAreasList] = useState([])
  const [opsSet, setOpsSet] = useState(new Set())
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ full_name:'', email:'', password:'', dept:'', is_manager:false })
  const [selectedAreas, setSelectedAreas] = useState(new Set())
  const [addToOps, setAddToOps] = useState(false)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profs }, { data: nav }, { data: me }, { data: opsRows }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('nav_items').select('label, href, manager_only').eq('enabled', true).order('sort_order'),
        user ? supabase.from('profiles').select('is_manager').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('user_area_access').select('user_id').eq('area', 'operations'),
      ])
      setOpsSet(new Set((opsRows || []).map(r => r.user_id).filter(Boolean)))
      setTeam(sortTeam(profs || []))
      setIsManager(!!me?.is_manager)
      const seen = new Set()
      const list = []
      for (const n of (nav || [])) {
        if (n.manager_only) continue
        const a = areaOf(n.href)
        if (seen.has(a)) continue
        seen.add(a); list.push({ area: a, label: n.label })
      }
      if (!seen.has('operations')) list.push({ area: 'operations', label: 'מחלקת תפעול' })
      setAreasList(list)
      setLoading(false)
    })()
  }, [])

  function toggleArea(area) {
    setSelectedAreas(prev => {
      const next = new Set(prev)
      next.has(area) ? next.delete(area) : next.add(area)
      return next
    })
  }

  function toggleOps(checked) {
    setAddToOps(checked)
    setForm(f => ({ ...f, dept: '' })) // הרשימה מתחלפת, אז מאפסים בחירה
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
        add_to_operations: addToOps,
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'אירעה שגיאה ביצירת המשתמש' })
      setAdding(false)
      return
    }
    setMsg({ type: 'ok', text: `${form.full_name} נוצר/ה בהצלחה. בכניסה הראשונה תתבקש/י להחליף סיסמה.` })
    const { data: profs } = await supabase.from('profiles').select('*').order('full_name')
    setTeam(sortTeam(profs || []))
    setForm({ full_name:'', email:'', password:'', dept:'', is_manager:false })
    setSelectedAreas(new Set())
    setAddToOps(false)
    setAdding(false)
  }

  const initials = name => name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'
  const deptOptions = addToOps ? OPS_ROLES : DEPTS_GENERAL

  return (
    <div className="max-w-xl" dir="rtl">
      {isManager && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">הוסף עובד חדש</div>
          <form onSubmit={addMember} className="grid grid-cols-2 gap-2">
            <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="שם מלא *" required className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
            <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="אימייל *" type="email" required className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
            <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="סיסמה ראשונית *" required className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />

            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end mt-1">
              <input type="checkbox" checked={form.is_manager} onChange={e=>setForm(f=>({...f,is_manager:e.target.checked}))} style={{ accentColor:'#E0197D' }} />
              מנהל הפקה (גישה מלאה לכל האזורים)
            </label>

            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end">
              <input type="checkbox" checked={addToOps} onChange={e=>toggleOps(e.target.checked)} style={{ accentColor:'#E0197D' }} />
              חבר/ת צוות תפעול
            </label>

            <select value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))} className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none text-right">
              <option value="">{addToOps ? 'תפקיד בתפעול...' : 'מחלקה...'}</option>
              {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {!form.is_manager && (
              <div className="col-span-2 border border-gray-100 rounded-lg p-3 mt-1">
                <div className="text-[12px] font-medium text-gray-500 mb-2 text-right">אזורים מורשים</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {areasList.map(a => (
                    <label key={a.area} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer w-full">
                      <input type="checkbox" checked={selectedAreas.has(a.area)} onChange={()=>toggleArea(a.area)} style={{ accentColor:'#E0197D' }} className="flex-shrink-0" />
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
          {msg && (
            <div className={`mt-3 text-[12px] p-3 rounded-lg text-right border ${msg.type==='ok' ? 'bg-[#E1F5EE] text-[#085041] border-[#bfe8dc]' : 'bg-[#FCE4F3] text-[#A0106A] border-[#f3c6e0]'}`}>
              {msg.text}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">
          הצוות {team.length > 0 && <span className="text-gray-400">({team.length} עובדים)</span>}
        </div>
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        ) : team.map(m => (
          <div key={m.id} className="flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0" dir="rtl">
            <div className="flex-1 text-right">
              <div className="text-[13px] font-medium text-gray-800">{m.full_name}</div>
              <div className="text-[11px] text-gray-400">{m.role}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {m.is_manager && <span className="text-[11px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full">מנהל</span>}
              {!m.is_manager && opsSet.has(m.id) && <span className="text-[11px] bg-[#E1F5EE] text-[#0a7a5f] px-2 py-0.5 rounded-full">צוות תפעול</span>}
              {m.dept && m.dept !== 'תפעול' && <span className="text-[11px] bg-[#FCE4F3] text-[#A0106A] px-2 py-0.5 rounded-full">{m.dept}</span>}
            </div>
            <div className="w-8 h-8 rounded-full bg-[#FCE4F3] text-[#E0197D] text-[11px] font-medium flex items-center justify-center flex-shrink-0">
              {initials(m.full_name)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
