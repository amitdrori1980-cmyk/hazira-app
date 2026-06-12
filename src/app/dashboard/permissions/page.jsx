'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const LEVELS = [
  { key: 'none', label: 'אין' },
  { key: 'view', label: 'צפייה' },
  { key: 'edit', label: 'עריכה' },
]

// סדר תצוגה מועדף לאזורים; אזורים שלא ברשימה יתווספו בסוף לפי א-ב
const AREA_ORDER = [
  'dashboard','calendar','events','tasks','messages','specs','production','productions',
  'operations','equipment','storage','notes','constraints','crew','team','departments',
  'venues','rundowns','duplicates','import','export','assistant','settings',
]

// תוויות עברית לאזורים שאין להם פריט תפריט תואם
const FALLBACK_LABELS = {
  dashboard:'ראשי', calendar:'יומן', events:'אירועים', tasks:'משימות', messages:'הודעות',
  specs:'מפרטים', production:'הפקה', productions:'הפקות', operations:'תפעול', equipment:'ציוד',
  storage:'אחסון', notes:'הערות', constraints:'אילוצים', crew:'כוח אדם', team:'צוות',
  departments:'מחלקות', venues:'אולמות', rundowns:'ראנדאונים', duplicates:'כפילויות',
  import:'ייבוא', export:'ייצוא', assistant:'עוזר', settings:'הגדרות',
}

export default function PermissionsPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(null)   // null=בודק, false=חסום, true=מנהל
  const [users, setUsers] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [grants, setGrants] = useState({})
  const [original, setOriginal] = useState({})
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // בדיקת הרשאת מנהל + טעינת משתמשים ואזורים
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: me } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
      if (!me?.is_manager) { setAllowed(false); return }
      setAllowed(true)

      const [{ data: profs }, { data: at }, { data: nav }, { data: opsCrew }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, dept, is_manager').order('full_name'),
        supabase.from('area_tables').select('area'),
        supabase.from('nav_items').select('href, label, icon'),
        supabase.from('operations_crew').select('user_id').eq('active', true),
      ])
      const opsCrewSet = new Set((opsCrew || []).map(r => r.user_id).filter(Boolean))
      setUsers((profs || []).filter(p => !opsCrewSet.has(p.id)))

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

  // טעינת ההרשאות הקיימות של המשתמש הנבחר
  async function selectUser(u) {
    setSelected(u); setSaveMsg('')
    if (u.is_manager) { setGrants({}); setOriginal({}); return }
    setLoadingGrants(true)
    const { data } = await supabase.from('user_area_access').select('area, level').eq('user_id', u.id)
    const map = {}
    ;(data || []).forEach(r => { map[r.area] = r.level })
    const full = {}
    areas.forEach(a => { full[a.key] = map[a.key] || 'none' })
    setGrants(full); setOriginal(full)
    setLoadingGrants(false)
  }

  const dirty = useMemo(
    () => Object.keys(grants).some(k => grants[k] !== original[k]),
    [grants, original]
  )

  function setLevel(areaKey, level) {
    setGrants(g => ({ ...g, [areaKey]: level }))
    setSaveMsg('')
  }

  function setAll(level) {
    const next = {}
    areas.forEach(a => { next[a.key] = level })
    setGrants(next); setSaveMsg('')
  }

  async function save() {
    if (!selected) return
    setSaving(true); setSaveMsg('')
    const toUpsert = []
    const toDelete = []
    areas.forEach(a => {
      const lvl = grants[a.key] || 'none'
      if (lvl === 'none') { if (original[a.key] && original[a.key] !== 'none') toDelete.push(a.key) }
      else toUpsert.push({ user_id: selected.id, area: a.key, level: lvl })
    })
    try {
      if (toDelete.length) {
        const { error } = await supabase.from('user_area_access')
          .delete().eq('user_id', selected.id).in('area', toDelete)
        if (error) throw error
      }
      if (toUpsert.length) {
        const { error } = await supabase.from('user_area_access')
          .upsert(toUpsert, { onConflict: 'user_id,area' })
        if (error) throw error
      }
      setOriginal({ ...grants })
      setSaveMsg('נשמר')
    } catch (e) {
      setSaveMsg('שגיאה בשמירה: ' + (e.message || 'נסה שוב'))
    }
    setSaving(false)
  }

  const initials = name => name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'
  const filtered = users.filter(u => (u.full_name || '').includes(query.trim()))

  if (allowed === null) return <div className="text-center text-sm text-gray-400 py-10">טוען...</div>
  if (allowed === false) return (
    <div className="max-w-xl">
      <div className="bg-white border border-gray-100 rounded-xl p-6 text-center">
        <div className="text-[13px] text-gray-600">העמוד הזה למנהלים בלבד.</div>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl">
      {/* בחירת משתמש */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">הרשאות משתמשים</div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם…"
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] mb-2"
        />
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען…</div>
        ) : (
          <div className="max-h-64 overflow-y-auto -mx-1 px-1">
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className={`w-full flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-gray-50 last:border-0 flex-row-reverse text-right transition-colors ${
                  selected?.id === u.id ? 'bg-[#FCE4F3]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#FCE4F3] text-[#E0197D] text-[11px] font-medium flex items-center justify-center flex-shrink-0">
                  {initials(u.full_name)}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-gray-800">{u.full_name}</div>
                  <div className="text-[11px] text-gray-400">{u.role}</div>
                </div>
                {u.dept && <span className="text-[11px] bg-[#FCE4F3] text-[#A0106A] px-2 py-0.5 rounded-full">{u.dept}</span>}
                {u.is_manager && <span className="text-[11px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full">מנהל</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* עריכת הרשאות למשתמש הנבחר */}
      {selected && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-800 mb-1">
            הרשאות עבור {selected.full_name}
          </div>

          {selected.is_manager ? (
            <div className="text-[12px] text-gray-500 bg-gray-50 rounded-lg p-3 mt-2">
              משתמש זה מוגדר כמנהל — יש לו גישה מלאה לכל האזורים, ואין צורך להגדיר לו הרשאות ידנית.
            </div>
          ) : loadingGrants ? (
            <div className="text-center text-sm text-gray-400 py-6">טוען הרשאות…</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 mt-1">
                <div className="text-[11px] text-gray-400">קבע לכל אזור: אין גישה, צפייה, או עריכה</div>
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
                        <button
                          key={l.key}
                          onClick={() => setLevel(a.key, l.key)}
                          className={`px-2.5 py-1 transition-colors ${
                            (grants[a.key] || 'none') === l.key
                              ? 'bg-[#E0197D] text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={save}
                  disabled={!dirty || saving}
                  className="bg-[#E0197D] text-white text-sm px-5 py-2 rounded-lg hover:bg-[#A0106A] transition-colors disabled:opacity-40 disabled:hover:bg-[#E0197D]"
                >
                  {saving ? 'שומר…' : 'שמור שינויים'}
                </button>
                {saveMsg && (
                  <span className={`text-[12px] ${saveMsg === 'נשמר' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMsg === 'נשמר' ? '✓ נשמר' : saveMsg}
                  </span>
                )}
                {dirty && !saving && !saveMsg && (
                  <span className="text-[11px] text-gray-400">יש שינויים שלא נשמרו</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
