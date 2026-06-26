'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
// HAZIRA-TASKS-REBUILD-V7

const TEAM = ['עמית','לאה','עינת','מרקו','ניב','דונדו','איתן','נועה']
const TEAM_TOKEN = { 'דונדו': 'דניאל', 'נועה': 'גמליאל' }
function teamOptions(crew, people) {
  const all = []
  ;(crew || []).forEach(c => { if (c.user_id) all.push({ user_id: c.user_id, full_name: c.full_name }) })
  ;(people || []).forEach(p => { if (p.id) all.push({ user_id: p.id, full_name: p.full_name }) })
  const byName = {}
  all.forEach(r => { const words = (r.full_name || '').trim().split(' ').filter(Boolean); const k = TEAM.find(t => words.includes(TEAM_TOKEN[t] || t)); if (k && !byName[k]) byName[k] = { ...r, teamKey: k } })
  return TEAM.map(n => byName[n]).filter(Boolean)
}
function fmtDT(s) {
  if (!s) return ''
  const d = new Date(s)
  const p = n => String(n).padStart(2, '0')
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState(null)
  const [me, setMe] = useState('')
  const [isManager, setIsManager] = useState(false)
  const [people, setPeople] = useState([])
  const [crew, setCrew] = useState([])
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({ title: '', body: '', visible_to: [] })
  const [comments, setComments] = useState({})
  const [commentText, setCommentText] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUid(user.id)
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setMe(p?.full_name || '')
    setIsManager(p?.is_manager || false)
    const { data: ppl } = await supabase.from('profiles').select('id, full_name')
    setPeople(ppl || [])
    const { data: crewData } = await supabase.from('crew_members').select('id, full_name, role').eq('active', true).order('full_name')
    setCrew(crewData || [])
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    const ids = (data || []).map(t => t.id)
    if (ids.length) {
      const { data: cs } = await supabase.from('task_comments').select('*').in('task_id', ids).order('created_at')
      const cmap = {}
      ;(cs || []).forEach(c => { (cmap[c.task_id] = cmap[c.task_id] || []).push(c) })
      setComments(cmap)
    }
    setLoading(false)
  }

  async function addTask() {
    const { data, error } = await supabase.from('tasks').insert({
      title: '', body: '', done: false, visible_to: [],
      priority: 'רגיל', assignee_id: uid,
      created_by: uid, created_by_name: me,
    }).select('*').single()
    if (error) { alert('שגיאה: ' + error.message); return }
    setTasks(prev => [data, ...prev])
    startEdit(data)
  }

  function startEdit(t) {
    setEditId(t.id)
    const vis = Array.isArray(t.visible_to) ? t.visible_to : []
    setDraft({ title: t.title || '', body: t.body || '', visible_to: vis })
  }

  async function saveEdit(t) {
    setBusy(true)
    const vis = draft.visible_to || []
    const payload = { title: draft.title, body: draft.body, visible_to: vis }
    const { error } = await supabase.from('tasks').update(payload).eq('id', t.id)
    setBusy(false)
    if (error) { alert('שגיאה: ' + error.message); return }
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...payload } : x))
    setEditId(null)
  }

  async function deleteTask(t) {
    await supabase.from('tasks').delete().eq('id', t.id)
    setTasks(prev => prev.filter(x => x.id !== t.id))
    if (editId === t.id) setEditId(null)
  }

  async function toggleDone(t, val) {
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: val } : x))
    const { error } = await supabase.from('tasks').update({ done: val }).eq('id', t.id)
    if (error) setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !val } : x))
  }

  async function toggleWord(t, idx) {
    const cur = Array.isArray(t.done_words) ? t.done_words : []
    const next = cur.includes(idx) ? cur.filter(x => x !== idx) : [...cur, idx]
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done_words: next } : x))
    const { error } = await supabase.from('tasks').update({ done_words: next }).eq('id', t.id)
    if (error) setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done_words: cur } : x))
  }
  function renderBody(t) {
    const done = new Set(Array.isArray(t.done_words) ? t.done_words : [])
    let wi = -1
    return (t.body || '').split(/(\s+)/).map((part, i) => {
      if (part === '' || /^\s+$/.test(part)) return <span key={i}>{part}</span>
      wi += 1
      const idx = wi
      const isDone = done.has(idx)
      return (
        <span key={i} onClick={() => toggleWord(t, idx)}
          className={`cursor-pointer rounded px-0.5 transition-colors ${isDone ? 'bg-[#FCE4F3] line-through text-[#A0106A]' : 'hover:bg-gray-100'}`}>
          {part}
        </span>
      )
    })
  }

  async function addComment(taskId) {
    const text = (commentText[taskId] || '').trim()
    if (!text) return
    const { data } = await supabase.from('task_comments').insert({
      task_id: taskId, user_id: uid, author_name: me || 'משתמש', content: text
    }).select().single()
    if (data) {
      setComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), data] }))
      setCommentText(prev => ({ ...prev, [taskId]: '' }))
    }
  }

  function audienceLabel(t) {
    const aud = Array.isArray(t.visible_to) ? t.visible_to : []
    if (aud.length === 0) return 'כולם'
    const names = aud.map(id => (people.find(p => p.id === id)?.full_name || '')).filter(Boolean)
    return names.length ? names.join(', ') : (aud.length + ' אנשים')
  }

  const teamOpts = teamOptions(crew, people).filter(r => r.user_id !== uid)
  const visibleTasks = tasks.filter(t => {
    if (t.created_by === uid) return true
    const aud = Array.isArray(t.visible_to) ? t.visible_to : []
    if (aud.length === 0) return true
    return aud.includes(uid)
  })
  const sortedTasks = [...visibleTasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-gray-500">{visibleTasks.length} משימות</span>
        <button onClick={addTask} className="bg-[#E0197D] hover:bg-[#A0106A] text-white text-[13px] px-4 py-2 rounded-lg flex items-center gap-1.5">
          <i className="ti ti-plus" style={{ fontSize: 15 }} /> הוסף משימה
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">טוען...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">אין משימות עדיין</div>
      ) : (
        sortedTasks.map(t => (
          <div key={t.id} className={`border border-gray-100 rounded-xl p-3.5 bg-white mb-2 shadow-sm hover:shadow-md transition-all ${t.done ? 'opacity-60' : ''}`}>
            {editId === t.id ? (
              <div className="flex flex-col gap-2">
                <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="כותרת נושא"
                  className="text-[14px] font-medium px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} placeholder="טקסט חופשי..." rows={4}
                  className="text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
                <div className="flex flex-col gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50">
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="text-[12px] text-gray-500 flex-shrink-0">מי רואה:</span>
                    <select value="" onChange={e => { const id = e.target.value; if (id) setDraft(d => ({ ...d, visible_to: (d.visible_to || []).includes(id) ? d.visible_to : [...(d.visible_to || []), id] })) }}
                      className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#E0197D] text-right">
                      <option value="">בחר איש צוות...</option>
                      {teamOpts.map(r => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
                    </select>
                  </div>
                  {(draft.visible_to || []).length === 0 ? (
                    <span className="text-[11px] text-gray-400 text-right">לא נבחר אף אחד — כולם רואים את המשימה</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {(draft.visible_to || []).map(id => {
                        const nm = people.find(p => p.id === id)?.full_name || (teamOpts.find(r => r.user_id === id) || {}).full_name || ''
                        return (
                          <span key={id} className="text-[12px] px-2.5 py-1 rounded-full border bg-[#FCE4F3] text-[#A0106A] border-[#E0197D] inline-flex items-center gap-1">
                            {nm}
                            <button onClick={() => setDraft(d => ({ ...d, visible_to: (d.visible_to || []).filter(x => x !== id) }))} className="hover:text-red-500"><i className="ti ti-x" style={{ fontSize: 11 }} /></button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t)} disabled={busy} className="bg-[#E0197D] text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">{busy ? 'שומר...' : 'שמור'}</button>
                  <button onClick={() => { setEditId(null); if (!t.title && !t.body) deleteTask(t) }} className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">ביטול</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={!!t.done} onChange={e => toggleDone(t, e.target.checked)}
                    className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0" style={{ accentColor: '#E0197D' }} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-bold ${t.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.title || '(ללא נושא)'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{t.created_by_name ? `מאת ${t.created_by_name} · ` : ''}{fmtDT(t.created_at)}</div>
                    {t.body && <div className="text-[13px] text-gray-600 whitespace-pre-wrap mt-1.5 leading-7">{renderBody(t)}</div>}
                    <div className="mt-1.5">
                      <span className="text-[11px] text-gray-400 inline-flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                        <i className="ti ti-eye" style={{ fontSize: 11 }} /> {audienceLabel(t)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(t)} className="text-black hover:text-[#E0197D] p-1"><i className="ti ti-pencil" style={{ fontSize: 13 }} /></button>
                    {(isManager || t.created_by === uid) && (
                      <button onClick={() => { if (window.confirm('למחוק משימה זו?')) deleteTask(t) }} className="text-black hover:text-red-500 p-1"><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  {(comments[t.id] || []).length > 0 && (
                    <div className="mb-2">
                      {(comments[t.id] || []).map(c => (
                        <div key={c.id} className="text-[12px] text-gray-600 mb-1"><span className="font-medium text-gray-800">{c.author_name}: </span>{c.content}</div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input value={commentText[t.id] || ''} onChange={e => setCommentText(prev => ({ ...prev, [t.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addComment(t.id)}
                      placeholder="הוסף תגובה..." className="flex-1 text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 outline-none focus:border-[#E0197D] text-right" />
                    <button onClick={() => addComment(t.id)} className="text-[13px] px-4 py-2 bg-[#E0197D] text-white rounded-lg hover:bg-[#A0106A]">שלח</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
