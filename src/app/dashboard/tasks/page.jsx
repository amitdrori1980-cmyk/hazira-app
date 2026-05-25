'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PRIORITIES = ['דחוף','היום','מחר','השבוע','גבוהה','רגיל']
const PRI_COLOR = {
  'דחוף':   'bg-[#FAECE7] text-[#4A1B0C]',
  'גבוהה':  'bg-[#FAEEDA] text-[#633806]',
  'רגיל':   'bg-[#E3F0FF] text-[#1A4A8A]',
  'היום':   'bg-[#FAECE7] text-[#4A1B0C]',
  'מחר':    'bg-[#FCE4F3] text-[#A0106A]',
  'השבוע':  'bg-[#FAEEDA] text-[#633806]',
}

export default function TasksPage() {
  const [tasks, setTasks]       = useState([])
  const [crew, setCrew]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [newTask, setNewTask]   = useState('')
  const [newPri, setNewPri]     = useState('רגיל')
  const [newCrew, setNewCrew]   = useState('')
  const [adding, setAdding]     = useState(false)
  const [editing, setEditing]   = useState(null)
  const [editVal, setEditVal]   = useState({})
  const [uid, setUid]           = useState(null)
  const [dept, setDept]         = useState(null)
  const [isManager, setIsManager] = useState(false)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser()
    setUid(user.id)
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setDept(p?.dept)
    setIsManager(p?.is_manager || false)

    const q = supabase
      .from('tasks')
      .select('*, crew:crew_member_id(full_name)')
      .order('created_at', { ascending: false })
    if (!p?.is_manager) q.or(`assignee_id.eq.${user.id},dept.eq.${p?.dept}`)
    const { data } = await q
    setTasks(data || [])

    const { data: crewData } = await supabase
      .from('crew_members')
      .select('id, full_name, role')
      .eq('active', true)
      .order('full_name')
    setCrew(crewData || [])
    setLoading(false)
  }

  async function toggleDone(task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTask.trim()) return
    setAdding(true)
    const { data, error } = await supabase.from('tasks').insert({
      title: newTask.trim(),
      priority: newPri,
      done: false,
      assignee_id: uid,
      dept,
      crew_member_id: newCrew || null,
    }).select('*, crew:crew_member_id(full_name)').single()
    if (!error) setTasks(prev => [data, ...prev])
    setNewTask(''); setNewCrew(''); setAdding(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(task) {
    setEditing(task.id)
    setEditVal({ title: task.title, priority: task.priority, crew_member_id: task.crew_member_id || '' })
  }

  async function saveEdit(id) {
    const payload = { ...editVal, crew_member_id: editVal.crew_member_id || null }
    await supabase.from('tasks').update(payload).eq('id', id)
    const crewMember = crew.find(c => c.id === editVal.crew_member_id)
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, ...payload, crew: crewMember ? { full_name: crewMember.full_name } : null }
      : t
    ))
    setEditing(null)
  }

  const open = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <div className="max-w-xl">
      {/* Add */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <form onSubmit={addTask} className="flex flex-col gap-2">
          <input value={newTask} onChange={e => setNewTask(e.target.value)}
            placeholder="משימה חדשה..."
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
          <div className="flex gap-2 flex-row-reverse">
            <select value={newPri} onChange={e => setNewPri(e.target.value)}
              className="text-sm px-2 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={newCrew} onChange={e => setNewCrew(e.target.value)}
              className="flex-1 text-sm px-2 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
              <option value="">שייך לאיש צוות...</option>
              {crew.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}{c.role ? ` — ${c.role}` : ''}</option>
              ))}
            </select>
            <button type="submit" disabled={adding}
              className="bg-[#E0197D] hover:bg-[#A0106A] text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              <i className="ti ti-plus"/>
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">טוען...</div>
      ) : (
        <>
          {/* Open tasks */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-gray-800">משימות פתוחות</span>
              <span className="text-[11px] bg-[#FCE4F3] text-[#A0106A] px-2 py-0.5 rounded-full">{open.length}</span>
            </div>
            {open.length === 0 && <p className="text-[13px] text-gray-400 text-center py-3">כל המשימות הושלמו!</p>}
            {open.map(t => (
              <div key={t.id} className="border-b border-gray-50 last:border-0">
                {editing === t.id ? (
                  <div className="py-2 flex flex-col gap-2">
                    <input value={editVal.title} onChange={e => setEditVal(v=>({...v,title:e.target.value}))}
                      className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
                    <div className="flex gap-2">
                      <select value={editVal.priority} onChange={e => setEditVal(v=>({...v,priority:e.target.value}))}
                        className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                      <select value={editVal.crew_member_id} onChange={e => setEditVal(v=>({...v,crew_member_id:e.target.value}))}
                        className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                        <option value="">ללא שיוך</option>
                        {crew.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(t.id)} className="flex-1 bg-[#E0197D] text-white text-sm py-1.5 rounded-lg">שמור</button>
                      <button onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 py-2 flex-row-reverse group">
                    <input type="checkbox" checked={false} onChange={() => toggleDone(t)}
                      className="w-4 h-4 flex-shrink-0" style={{accentColor:'#E0197D'}}/>
                    <div className="flex-1 text-right min-w-0">
                      <div className="text-[13px]">{t.title}</div>
                      {t.crew?.full_name && (
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 justify-end">
                          <span>{t.crew.full_name}</span>
                          <i className="ti ti-user" style={{fontSize:10}}/>
                        </div>
                      )}
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRI_COLOR[t.priority]||'bg-gray-100 text-gray-600'}`}>
                      {t.priority}
                    </span>
                    <button onClick={() => startEdit(t)}
                      className="text-gray-200 hover:text-[#E0197D] opacity-0 group-hover:opacity-100 transition-all">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                    <button onClick={() => deleteTask(t.id)}
                      className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Done tasks */}
          {done.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[13px] font-medium text-gray-400 mb-3">הושלמו ({done.length})</div>
              {done.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 flex-row-reverse group">
                  <input type="checkbox" checked={true} onChange={() => toggleDone(t)}
                    className="w-4 h-4 flex-shrink-0" style={{accentColor:'#E0197D'}}/>
                  <div className="flex-1 text-right">
                    <div className="text-[13px] line-through text-gray-400">{t.title}</div>
                    {t.crew?.full_name && (
                      <div className="text-[11px] text-gray-300 flex items-center gap-1 justify-end">
                        <span>{t.crew.full_name}</span>
                        <i className="ti ti-user" style={{fontSize:10}}/>
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteTask(t.id)}
                    className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <i className="ti ti-trash" style={{fontSize:13}}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
