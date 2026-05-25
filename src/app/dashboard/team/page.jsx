'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEPTS = ['ניהול','תאורה','צליל','תפאורה','תלבושות']

export default function TeamPage() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email:'', password:'', full_name:'', role:'', dept:'ניהול', is_manager: false })
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
      setTeam(data || [])
      setLoading(false)
    })
  }, [])

  async function addMember(e) {
    e.preventDefault()
    setAdding(true); setMsg('')
    // Create auth user via admin — requires service role key (not available client-side)
    // Instead show instructions
    setMsg(`כדי להוסיף עובד: לך ל-Supabase → Authentication → Users → Add user\nאימייל: ${form.email} | סיסמה: ${form.password}\nאחרי הוספה, הרץ ב-SQL Editor:\ninsert into profiles (id, full_name, role, dept, is_manager)\nselect id, '${form.full_name}', '${form.role}', '${form.dept}', ${form.is_manager}\nfrom auth.users where email='${form.email}';`)
    setAdding(false)
  }

  const initials = name => name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'

  return (
    <div className="max-w-xl">
      {/* Add member form */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">הוסף עובד חדש</div>
        <form onSubmit={addMember} className="grid grid-cols-2 gap-2">
          <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="שם מלא *" className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="אימייל *" type="email" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="סיסמה *" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          <input value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} placeholder="תפקיד" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
          <select value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))} className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
            {DEPTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer flex-row-reverse justify-end">
            <input type="checkbox" checked={form.is_manager} onChange={e=>setForm(f=>({...f,is_manager:e.target.checked}))} style={{ accentColor:'#E0197D' }} />
            מנהל הפקה (גישה מלאה)
          </label>
          <button type="submit" disabled={adding} className="col-span-2 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] transition-colors">
            קבל הוראות הוספה
          </button>
        </form>
        {msg && (
          <pre className="mt-3 text-[11px] bg-gray-50 p-3 rounded-lg text-right leading-relaxed whitespace-pre-wrap text-gray-700 border border-gray-200">
            {msg}
          </pre>
        )}
      </div>

      {/* Team list */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">
          הצוות {team.length > 0 && <span className="text-gray-400">({team.length} עובדים)</span>}
        </div>
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        ) : team.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-[#FCE4F3] text-[#E0197D] text-[11px] font-medium flex items-center justify-center flex-shrink-0">
              {initials(m.full_name)}
            </div>
            <div className="flex-1 text-right">
              <div className="text-[13px] font-medium text-gray-800">{m.full_name}</div>
              <div className="text-[11px] text-gray-400">{m.role}</div>
            </div>
            <span className="text-[11px] bg-[#FCE4F3] text-[#A0106A] px-2 py-0.5 rounded-full">{m.dept}</span>
            {m.is_manager && <span className="text-[11px] bg-[#E3F0FF] text-[#1A4A8A] px-2 py-0.5 rounded-full">מנהל</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
