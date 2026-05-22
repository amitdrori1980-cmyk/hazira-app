'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PRI_COLOR = {
  'דחוף': 'bg-[#FAECE7] text-[#4A1B0C]',
  'גבוהה': 'bg-[#FAEEDA] text-[#633806]',
  'רגיל':  'bg-[#E3F0FF] text-[#1A4A8A]',
}

export default function MessagesPage() {
  const [messages, setMessages] = useState([])
  const [profile, setProfile]   = useState(null)
  const [depts, setDepts]       = useState([])
  const [crew, setCrew]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [form, setForm] = useState({ body:'', target_type:'all', to_dept:'', to_crew_id:'', priority:'רגיל' })
  const [openReplies, setOpenReplies] = useState({})
  const [replies, setReplies]         = useState({})
  const [replyText, setReplyText]     = useState({})
  const [sendingReply, setSendingReply] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile({ ...p, uid: user.id })

    const [{ data: ds }, { data: cr }] = await Promise.all([
      supabase.from('departments').select('name').order('name'),
      supabase.from('crew_members').select('id,full_name,role,dept,user_id').eq('active',true).order('full_name'),
    ])
    setDepts((ds||[]).map(d=>d.name))
    setCrew(cr||[])

    const q = supabase
      .from('messages')
      .select('*, sender:sender_id(full_name)')
      .order('created_at', { ascending: false })
    if (!p?.is_manager) {
      q.or(`to_user.eq.${user.id},to_dept.eq.${p?.dept},to_dept.eq.all`)
    }
    const { data: msgs } = await q
    setMessages(msgs || [])
    setLoading(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!form.body.trim()) return
    setSending(true)
    const payload = {
      body: form.body.trim(),
      sender_id: profile.uid,
      priority: form.priority,
      read: false,
    }
    if (form.target_type === 'all') {
      payload.to_dept = 'all'
    } else if (form.target_type === 'dept') {
      payload.to_dept = form.to_dept || depts[0]
    } else if (form.target_type === 'person') {
      payload.to_crew_id = form.to_crew_id
      // קשר ל-user_id של איש הצוות
      const member = crew.find(c => c.id === form.to_crew_id)
      if (member?.user_id) payload.to_user = member.user_id
    }
    await supabase.from('messages').insert(payload)
    setForm({ body:'', target_type:'all', to_dept:'', to_crew_id:'', priority:'רגיל' })
    await load()
    setSending(false)
  }

  async function toggleReplies(msgId) {
    const isOpen = openReplies[msgId]
    setOpenReplies(prev => ({ ...prev, [msgId]: !isOpen }))
    if (!isOpen && !replies[msgId]) {
      const { data } = await supabase
        .from('message_replies')
        .select('*, sender:sender_id(full_name)')
        .eq('message_id', msgId)
        .order('created_at')
      setReplies(prev => ({ ...prev, [msgId]: data || [] }))
    }
  }

  async function sendReply(msgId) {
    const text = replyText[msgId]?.trim()
    if (!text) return
    setSendingReply(msgId)
    const { data, error } = await supabase
      .from('message_replies')
      .insert({ message_id: msgId, sender_id: profile.uid, body: text })
      .select('*, sender:sender_id(full_name)')
      .single()
    if (!error) {
      setReplies(prev => ({ ...prev, [msgId]: [...(prev[msgId]||[]), data] }))
      setReplyText(prev => ({ ...prev, [msgId]: '' }))
    }
    setSendingReply(null)
  }

  function getTargetLabel(msg) {
    if (msg.to_dept === 'all') return '🌐 כולם'
    if (msg.to_dept) return `📂 ${msg.to_dept}`
    if (msg.to_crew_id) {
      const member = crew.find(c => c.id === msg.to_crew_id)
      return `👤 ${member?.full_name || 'אדם ספציפי'}`
    }
    return ''
  }

  return (
    <div className="max-w-xl">
      {/* Send — manager only */}
      {profile?.is_manager && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-800 mb-3">שלח הודעה</div>
          <form onSubmit={sendMessage} className="flex flex-col gap-2">
            <textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
              placeholder="תוכן ההודעה..." rows={2}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] resize-none"/>
            <div className="flex gap-1.5 flex-wrap">
              {[{val:'all',label:'🌐 כולם'},{val:'dept',label:'📂 מחלקה'},{val:'person',label:'👤 אדם ספציפי'}].map(opt=>(
                <button key={opt.val} type="button"
                  onClick={()=>setForm(f=>({...f,target_type:opt.val}))}
                  className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${form.target_type===opt.val?'bg-[#CC1010] text-white border-[#CC1010]':'border-gray-200 text-gray-500 hover:border-[#CC1010]'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {form.target_type === 'dept' && (
              <select value={form.to_dept||depts[0]} onChange={e=>setForm(f=>({...f,to_dept:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                {depts.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {form.target_type === 'person' && (
              <select value={form.to_crew_id} onChange={e=>setForm(f=>({...f,to_crew_id:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option value="">בחר איש צוות...</option>
                {crew.map(c=><option key={c.id} value={c.id}>{c.full_name}{c.role?` — ${c.role}`:''}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                <option>רגיל</option><option>גבוהה</option><option>דחוף</option>
              </select>
              <button type="submit" disabled={sending}
                className="flex-1 bg-[#CC1010] hover:bg-[#a00c0c] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                <i className="ti ti-send"/> שלח
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Messages */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">
          הודעות {messages.length > 0 && <span className="text-gray-400">({messages.length})</span>}
        </div>
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">אין הודעות</div>
        ) : messages.map(m => (
          <div key={m.id} className="mb-3 last:mb-0">
            <div className="p-3 bg-gray-50 rounded-lg border-r-2 border-[#CC1010]">
              <div className="flex items-center justify-between mb-1 flex-row-reverse">
                <span className="text-[11px] text-gray-400">{m.sender?.full_name || 'מנהל'}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRI_COLOR[m.priority]||'bg-gray-100 text-gray-500'}`}>
                    {m.priority}
                  </span>
                  <span className="text-[11px] text-gray-400">{getTargetLabel(m)}</span>
                </div>
              </div>
              <div className="text-[13px] text-gray-800 text-right mb-2">{m.body}</div>
              <div className="flex items-center justify-between">
                <button onClick={() => toggleReplies(m.id)}
                  className="text-[11px] text-gray-400 hover:text-[#CC1010] flex items-center gap-1 transition-colors">
                  <i className="ti ti-message-2" style={{fontSize:12}}/>
                  {openReplies[m.id] ? 'סגור תגובות' : `תגובות${replies[m.id]?.length ? ` (${replies[m.id].length})` : ''}`}
                </button>
                <span className="text-[10px] text-gray-300">
                  {new Date(m.created_at).toLocaleDateString('he-IL', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
                </span>
              </div>
            </div>

            {openReplies[m.id] && (
              <div className="mr-4 mt-1 border-r border-gray-200 pr-3">
                {(replies[m.id] || []).map(r => (
                  <div key={r.id} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between flex-row-reverse mb-0.5">
                      <span className="text-[11px] font-medium text-gray-600">{r.sender?.full_name || 'משתמש'}</span>
                      <span className="text-[10px] text-gray-300">
                        {new Date(r.created_at).toLocaleDateString('he-IL', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="text-[12px] text-gray-700 text-right">{r.body}</div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2 flex-row-reverse">
                  <input
                    value={replyText[m.id]||''}
                    onChange={e => setReplyText(prev=>({...prev,[m.id]:e.target.value}))}
                    onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendReply(m.id)}
                    placeholder="כתוב תגובה..."
                    className="flex-1 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]"
                  />
                  <button
                    onClick={() => sendReply(m.id)}
                    disabled={sendingReply === m.id || !replyText[m.id]?.trim()}
                    className="bg-[#CC1010] text-white text-[11px] px-3 py-1.5 rounded-lg hover:bg-[#a00c0c] disabled:opacity-40 flex items-center gap-1">
                    <i className="ti ti-send" style={{fontSize:11}}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
