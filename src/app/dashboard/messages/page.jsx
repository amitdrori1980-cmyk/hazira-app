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
  const [showDateCheck, setShowDateCheck] = useState(false)
  const [dateCheckForm, setDateCheckForm] = useState({ to_crew_id:'', event_id:'', notes:'' })
  const [events, setEvents] = useState([])
  const [sendingDateCheck, setSendingDateCheck] = useState(false)
  const [openReplies, setOpenReplies] = useState({})
  const [replies, setReplies]         = useState({})
  const [replyText, setReplyText]     = useState({})
  const [sendingReply, setSendingReply] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

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
      q.or(`to_user.eq.${user.id},to_dept.eq.${p?.dept},to_dept.eq.all,sender_id.eq.${user.id}`)
    }
    const { data: msgs } = await q
    setMessages(msgs || [])
    const today = new Date().toISOString().slice(0,10)
    const { data: evs } = await supabase.from('events').select('id,title,date,time').gte('date', today).order('date').limit(50)
    setEvents(evs || [])
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
      const member = crew.find(c => c.id === form.to_crew_id)
      if (member?.user_id) payload.to_user = member.user_id
    }
    await supabase.from('messages').insert(payload)
    setForm({ body:'', target_type:'all', to_dept:'', to_crew_id:'', priority:'רגיל' })
    await load()
    setSending(false)
  }

  async function deleteMessage(msgId) {
    await supabase.from('messages').delete().eq('id', msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setConfirmDelete(null)
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

  async function sendDateCheck(e) {
    e.preventDefault()
    if (!dateCheckForm.to_crew_id || !dateCheckForm.event_id) return
    setSendingDateCheck(true)
    const member = crew.find(c => c.id === dateCheckForm.to_crew_id)
    const event = events.find(ev => ev.id === dateCheckForm.event_id)
    await supabase.from('messages').insert({
      sender_id: profile.uid,
      to_crew_id: dateCheckForm.to_crew_id,
      to_user: member?.user_id || null,
      body: `בדיקת תאריך: ${event?.title} — ${event?.date}`,
      topic: 'date_check',
      event_data: { event_id: event?.id, event_title: event?.title, event_date: event?.date, event_time: event?.time, notes: dateCheckForm.notes },
      read: false,
      priority: 'רגיל',
    })
    setDateCheckForm({ to_crew_id:'', event_id:'', notes:'' })
    setShowDateCheck(false)
    setSendingDateCheck(false)
    await load()
  }

  async function confirmDateCheck(msg) {
    const { data: { user } } = await supabase.auth.getUser()
    const member = crew.find(c => c.user_id === user.id)
    await supabase.from('crew_constraints').insert({
      crew_member_id: member?.id || null,
      crew_name: member?.full_name || '',
      date: msg.event_data?.event_date,
      notes: `אישור בדיקת תאריך: ${msg.event_data?.event_title}`,
      available: true,
    })
    await supabase.from('messages').delete().eq('id', msg.id)
    setMessages(prev => prev.filter(m => m.id !== msg.id))
  }

  function canDelete(msg) {
    if (!profile) return false
    return msg.sender_id === profile.uid || msg.to_user === profile.uid || profile.is_manager
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
      {/* אישור מחיקה */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="text-[14px] font-medium text-gray-800 mb-2 text-right">מחיקת הודעה</div>
            <div className="text-[13px] text-gray-500 mb-4 text-right">האם למחוק את ההודעה? פעולה זו אינה ניתנת לביטול.</div>
            <div className="flex gap-2">
              <button onClick={() => deleteMessage(confirmDelete)}
                className="flex-1 bg-[#CC1010] text-white text-sm py-2 rounded-lg hover:bg-[#a00c0c]">
                מחק
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* בדיקת תאריך */}
      {profile?.is_manager && showDateCheck && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" dir="rtl">
            <div className="text-[14px] font-semibold text-gray-800 mb-4">בדיקת תאריך</div>
            <form onSubmit={sendDateCheck} className="flex flex-col gap-3">
              <select value={dateCheckForm.to_crew_id} onChange={e=>setDateCheckForm(p=>({...p,to_crew_id:e.target.value}))}
                required className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#CC1010]">
                <option value="">בחר עובד...</option>
                {crew.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select value={dateCheckForm.event_id} onChange={e=>setDateCheckForm(p=>({...p,event_id:e.target.value}))}
                required className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#CC1010]">
                <option value="">בחר אירוע...</option>
                {events.map(ev=><option key={ev.id} value={ev.id}>{ev.date} — {ev.title}</option>)}
              </select>
              <textarea value={dateCheckForm.notes} onChange={e=>setDateCheckForm(p=>({...p,notes:e.target.value}))}
                placeholder="הערות (אופציונלי)" rows={3}
                className="text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#CC1010] resize-none"/>
              <div className="flex gap-2">
                <button type="submit" disabled={sendingDateCheck}
                  className="flex-1 bg-[#CC1010] text-white text-sm py-2.5 rounded-xl font-medium disabled:opacity-50">
                  {sendingDateCheck ? 'שולח...' : 'שלח בדיקת תאריך'}
                </button>
                <button type="button" onClick={()=>setShowDateCheck(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* שליחת הודעה — מנהלים בלבד */}
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
              <button type="button" onClick={()=>setShowDateCheck(true)}
                className="border border-[#6366f1] text-[#6366f1] text-sm px-3 py-2 rounded-lg hover:bg-[#EEF2FF] flex items-center gap-1">
                <i className="ti ti-calendar-check"/> בדיקת תאריך
              </button>
              <button type="submit" disabled={sending}
                className="flex-1 bg-[#CC1010] hover:bg-[#a00c0c] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                <i className="ti ti-send"/> שלח
              </button>
            </div>
          </form>
        </div>
      )}

      {/* רשימת הודעות */}
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
            {m.topic === 'date_check' ? (
              <div className="p-4 bg-[#EEF2FF] rounded-xl border-r-2 border-[#6366f1]" dir="rtl">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ti ti-calendar-check text-[#6366f1]" style={{fontSize:15}}/>
                  <span className="text-[13px] font-semibold text-[#4338ca]">בדיקת תאריך</span>
                  <span className="text-[11px] text-gray-400 mr-auto">{m.sender?.full_name || 'מנהל'}</span>
                </div>
                <div className="bg-white rounded-lg p-3 mb-3">
                  <div className="text-[13px] font-medium text-gray-800">{m.event_data?.event_title}</div>
                  <div className="text-[12px] text-gray-600">{m.event_data?.event_date} {m.event_data?.event_time?.slice(0,5)}</div>
                  {m.event_data?.notes && <div className="text-[12px] text-gray-600 mt-1">{m.event_data.notes}</div>}
                </div>
                {(
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" onChange={e=>{if(e.target.checked && window.confirm('לאשר נוכחות ולרשום כאילוץ?'))confirmDateCheck(m)}}
                      style={{accentColor:'#6366f1'}} className="w-4 h-4"/>
                    <span className="text-[13px] text-[#4338ca] font-medium">אני מאשר/ת נוכחות</span>
                  </label>
                )}
                {profile?.is_manager && (
                  <button onClick={()=>setConfirmDelete(m.id)} className="text-gray-300 hover:text-red-500">
                    <i className="ti ti-trash" style={{fontSize:13}}/>
                  </button>
                )}
              </div>
            ) : (
            <div className="p-3 bg-gray-50 rounded-lg border-r-2 border-[#CC1010]">
              <div className="flex items-center justify-between mb-1 flex-row-reverse">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{m.sender?.full_name || 'מנהל'}</span>
                  {canDelete(m) && (
                    <button onClick={() => setConfirmDelete(m.id)}
                      className="text-gray-300 hover:text-[#CC1010] transition-colors">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  )}
                </div>
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
            )}

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
