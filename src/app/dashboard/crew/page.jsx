'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CrewPage() {
  const [crew, setCrew] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [form, setForm] = useState({ full_name:'', role:'', dept:'', phone:'', email:'', notes:'' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)
    const [{ data: c }, { data: d }] = await Promise.all([
      supabase.from('crew_members').select('*').eq('active', true).order('full_name'),
      supabase.from('departments').select('name').order('name'),
    ])
    setCrew(c || [])
    setDepts((d || []).map(d => d.name))
    setLoading(false)
  }

  async function addMember(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setAdding(true)
    const { data, error } = await supabase.from('crew_members').insert(form).select().single()
    if (!error) setCrew(prev => [...prev, data].sort((a,b) => a.full_name.localeCompare(b.full_name, 'he')))
    setForm({ full_name:'', role:'', dept:'', phone:'', email:'', notes:'' })
    setAdding(false)
  }

  async function saveEdit(id) {
    await supabase.from('crew_members').update(editVal).eq('id', id)
    setCrew(prev => prev.map(c => c.id === id ? { ...c, ...editVal } : c))
    setEditing(null)
  }

  async function deactivate(id) {
    await supabase.from('crew_members').update({ active: false }).eq('id', id)
    setCrew(prev => prev.filter(c => c.id !== id))
  }

  const filtered = crew.filter(c =>
    c.full_name?.includes(search) || c.role?.includes(search) || c.dept?.includes(search)
  )

  const initials = name => name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'

  return (
    <div className="max-w-xl">
      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="חפש שם, תפקיד, מחלקה..."
          className="flex-1 text-sm bg-transparent outline-none" />
        <i className="ti ti-search text-gray-400" style={{fontSize:14}}/>
      </div>

      {/* Add form */}
      {isManager && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">הוסף איש צוות</div>
          <form onSubmit={addMember} className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}
                placeholder="שם מלא *" required
                className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
              <input value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                placeholder="תפקיד"
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
              <select value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">מחלקה...</option>
                {depts.map(d => <option key={d}>{d}</option>)}
              </select>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                placeholder="טלפון"
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                placeholder="אימייל" type="email"
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            </div>
            <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              placeholder="הערות"
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <button type="submit" disabled={adding}
              className="bg-[#FF3EB5] text-white text-sm py-2 rounded-lg hover:bg-[#CC0090] transition-colors disabled:opacity-50">
              {adding ? 'מוסיף...' : 'הוסף לצוות'}
            </button>
          </form>
        </div>
      )}

      {/* Crew list */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-gray-800">אנשי הצוות</span>
          <span className="text-[11px] bg-[#FFE6F5] text-[#CC0090] px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">לא נמצאו אנשי צוות</div>
        ) : filtered.map(member => (
          <div key={member.id} className="border-b border-gray-50 last:border-0">
            {editing === member.id ? (
              <div className="py-3 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={editVal.full_name} onChange={e=>setEditVal(v=>({...v,full_name:e.target.value}))}
                    placeholder="שם מלא" className="col-span-2 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <input value={editVal.role||''} onChange={e=>setEditVal(v=>({...v,role:e.target.value}))}
                    placeholder="תפקיד" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <select value={editVal.dept||''} onChange={e=>setEditVal(v=>({...v,dept:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    <option value="">מחלקה...</option>
                    {depts.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <input value={editVal.phone||''} onChange={e=>setEditVal(v=>({...v,phone:e.target.value}))}
                    placeholder="טלפון" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <input value={editVal.email||''} onChange={e=>setEditVal(v=>({...v,email:e.target.value}))}
                    placeholder="אימייל" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                </div>
                <input value={editVal.notes||''} onChange={e=>setEditVal(v=>({...v,notes:e.target.value}))}
                  placeholder="הערות" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(member.id)} className="flex-1 bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg">שמור</button>
                  <button onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2.5 flex-row-reverse group">
                <div className="w-8 h-8 rounded-full bg-[#FFE6F5] text-[#FF3EB5] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                  {initials(member.full_name)}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <div className="text-[13px] font-medium text-gray-800">{member.full_name}</div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {[member.role, member.dept].filter(Boolean).join(' · ')}
                  </div>
                  {member.phone && <div className="text-[11px] text-gray-400">{member.phone}</div>}
                </div>
                {isManager && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditing(member.id); setEditVal({...member}) }}
                      className="text-gray-300 hover:text-[#FF3EB5]">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                    <button onClick={() => deactivate(member.id)}
                      className="text-gray-300 hover:text-red-500">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
