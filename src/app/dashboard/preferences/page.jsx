'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function areaOf(path) {
  if (path === '/dashboard') return 'dashboard'
  const seg = (path || '').replace('/dashboard/', '').split('/')[0]
  return seg || 'dashboard'
}

export default function PreferencesPage() {
  const [uid, setUid] = useState(null)
  const [areas, setAreas] = useState([])
  const [hidden, setHidden] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUid(user.id)

      const [{ data: p }, { data: nav }, { data: grants }, { data: prefs }] = await Promise.all([
        supabase.from('profiles').select('is_manager').eq('id', user.id).single(),
        supabase.from('nav_items').select('*').eq('enabled', true).order('sort_order'),
        supabase.from('user_area_access').select('area').eq('user_id', user.id),
        supabase.from('user_preferences').select('area, hidden').eq('user_id', user.id),
      ])

      const manager = !!p?.is_manager
      let items = nav || []
      if (!manager) {
        const allowed = new Set((grants || []).map(g => g.area))
        items = items.filter(n => !n.manager_only && allowed.has(areaOf(n.href)))
        if (allowed.has('operations') && !items.some(n => areaOf(n.href) === 'operations')) {
          items = [{ label: 'מחלקת תפעול', href: '/dashboard/operations', icon: 'ti-settings' }, ...items]
        }
      }

      const seen = new Set()
      const list = []
      for (const n of items) {
        const a = areaOf(n.href)
        if (seen.has(a)) continue
        seen.add(a)
        list.push({ area: a, label: n.label, icon: n.icon })
      }

      setAreas(list)
      setHidden(new Set((prefs || []).filter(x => x.hidden).map(x => x.area)))
      setLoading(false)
    })()
  }, [])

  async function toggle(area) {
    if (!uid || saving) return
    setSaving(area)
    const wasHidden = hidden.has(area)
    await supabase.from('user_preferences').delete().eq('user_id', uid).eq('area', area)
    const next = new Set(hidden)
    if (wasHidden) {
      next.delete(area)
    } else {
      await supabase.from('user_preferences').insert({ user_id: uid, area, hidden: true })
      next.add(area)
    }
    setHidden(next)
    window.dispatchEvent(new Event('hazira:prefs-changed'))
    setSaving(null)
  }

  return (
    <div className="max-w-md mx-auto" dir="rtl">
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold text-gray-800">התאמת התפריט שלי</h1>
        <p className="text-[13px] text-gray-400 mt-1">בחר אילו אזורים יופיעו לך בתפריט. ההסתרה משפיעה רק עליך, ותמיד אפשר להחזיר.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#E0197D] rounded-full animate-spin" />
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center text-[13px] text-gray-400 py-8">אין אזורים להצגה.</div>
        ) : (
          areas.map(a => {
            const isHidden = hidden.has(a.area)
            return (
              <div key={a.area} className="flex items-center gap-3 px-3 py-2.5 flex-row-reverse border-b border-gray-50 last:border-0">
                <i className={`ti ${a.icon || 'ti-circle'}`} style={{ fontSize: 16, color: isHidden ? '#cbd5e1' : '#E0197D' }} />
                <span className={`flex-1 text-[13px] text-right ${isHidden ? 'text-gray-400' : 'text-gray-800'}`}>{a.label}</span>
                <button
                  onClick={() => toggle(a.area)}
                  disabled={saving === a.area}
                  title={isHidden ? 'מוסתר' : 'מוצג'}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${isHidden ? 'bg-gray-200' : 'bg-[#E0197D]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isHidden ? 'left-0.5' : 'right-0.5'}`} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
