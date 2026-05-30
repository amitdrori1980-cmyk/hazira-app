'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function OperationsPage() {
  const [tab, setTab] = useState('team')
  const [crew, setCrew] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedCrew, setSelectedCrew] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [newMember, setNewMember] = useState({ full_name: '', role: '', phone: '', email: '' })
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [inquiries, setInquiries] = useState([])
  const [myMember, setMyMember] = useState(null)
  const [summary, setSummary] = useState({ notes: '', event_id: '', event_title: '', event_date: '' })
  const [summaryItems, setSummaryItems] = useState([])
  const [savingSummary, setSavingSummary] = useState(false)
  const [summarySaved, setSummarySaved] = useState(false)
  const [editingSummary, setEditingSummary] = useState(null)
  const [summaries, setSummaries] = useState([])
  const [shifts, setShifts] = useState([])
  const [savingShift, setSavingShift] = useState(false)
  const [openInq, setOpenInq] = useState(null)
  const [teamSubTab, setTeamSubTab] = useState('inquiry')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)

    const { data: crewData } = await supabase
      .from('operations_crew')
      .select('*')
      .eq('active', true)
      .order('full_name')
    setCrew(crewData || [])

    const me = (crewData || []).find(c => c.user_id === user.id)
    setMyMember(me || null)

    const { data: evData } = await supabase
      .from('events')
      .select('id, title, date')
      .order('date')
    setEvents(evData || [])

    await loadInquiries(user.id, p?.is_manager, me)
    const { data: shiftData } = await supabase.from('operations_shifts').select('*').order('event_date')
    const { data: summaryData } = await supabase.from('operations_summaries').select('*, items:operations_summary_items(*)').order('created_at', { ascending: false })
    setSummaries(summaryData || [])
    setShifts(shiftData || [])
    setLoading(false)
  }

  async function loadInquiries(uid, isMan, me) {
    let q = supabase.from('operations_inquiries').select('*, member:to_member_id(full_name, role)').order('created_at', { ascending: false })
    if (!isMan && me) q = q.eq('to_member_id', me.id)
    const { data } = await q
    setInquiries(data || [])
  }

  function toggleCrew(id) {
    setSelectedCrew(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function fmtDate(ds) {
    if (!ds) return ''
    const [y, m, d] = ds.split('-')
    const HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    return `${+d} ${HE[+m-1]} ${y}`
  }

  function fmtTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  async function addMember() {
    if (!newMember.full_name.trim()) return
    setAdding(true)
    const { data } = await supabase.from('operations_crew').insert(newMember).select().single()
    if (data) setCrew(prev => [...prev, data])
    setNewMember({ full_name: '', role: '', phone: '', email: '' })
    setShowAdd(false)
    setAdding(false)
  }

  async function removeMember(id) {
    if (!confirm('להסיר מהרשימה?')) return
    await supabase.from('operations_crew').update({ active: false }).eq('id', id)
    setCrew(prev => prev.filter(c => c.id !== id))
  }

  async function toggleShift(inq) {
    const existing = shifts.find(s => s.event_id === inq.event_id && s.member_id === inq.to_member_id)
    if (existing) {
      await supabase.from('operations_shifts').delete().eq('id', existing.id)
      setShifts(prev => prev.filter(s => s.id !== existing.id))
    } else {
      const { data } = await supabase.from('operations_shifts').insert({
        event_id: inq.event_id, event_title: inq.event_title, event_date: inq.event_date,
        member_id: inq.to_member_id, role: ''
      }).select().single()
      if (data) setShifts(prev => [...prev, data])
    }
  }

  async function deleteShift(id) {
    if (!confirm('למחוק עובד זה מהסידור?')) return
    await supabase.from('operations_shifts').delete().eq('id', id)
    setShifts(prev => prev.filter(s => s.id !== id))
  }

  async function deleteEventShifts(eventId) {
    if (!confirm('למחוק את כל הסידור לאירוע זה?')) return
    await supabase.from('operations_shifts').delete().eq('event_id', eventId)
    setShifts(prev => prev.filter(s => s.event_id !== eventId))
  }

  async function updateShiftRole(id, role) {
    await supabase.from('operations_shifts').update({ role }).eq('id', id)
    setShifts(prev => prev.map(s => s.id === id ? { ...s, role } : s))
  }

  function addSummaryItem() {
    setSummaryItems(prev => [...prev, { id: Date.now(), item_name: '', missing_qty: '', notes: '' }])
  }

  function updateSummaryItem(id, field, val) {
    setSummaryItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))
  }

  function removeSummaryItem(id) {
    setSummaryItems(prev => prev.filter(i => i.id !== id))
  }

  async function saveSummary() {
    if (!summary.event_id) return
    setSavingSummary(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: s } = await supabase.from('operations_summaries').insert({
      event_id: summary.event_id,
      event_title: summary.event_title,
      event_date: summary.event_date,
      notes: summary.notes,
      created_by: user.id
    }).select().single()
    if (s && summaryItems.length > 0) {
      await supabase.from('operations_summary_items').insert(
        summaryItems.filter(i => i.item_name).map((i, idx) => ({
          summary_id: s.id, item_name: i.item_name, missing_qty: i.missing_qty, notes: i.notes, sort_order: idx
        }))
      )
    }
    const { data: refreshed } = await supabase.from('operations_summaries').select('*, items:operations_summary_items(*)').order('created_at', { ascending: false })
    setSummaries(refreshed || [])
    setSummary({ notes: '', event_id: '', event_title: '', event_date: '' })
    setSummaryItems([])
    setSavingSummary(false)
    setSummarySaved(true)
    setTimeout(() => setSummarySaved(false), 3000)
  }

  async function deleteSummary(id) {
    if (!confirm('למחוק סיכום זה לצמיתות?')) return
    await supabase.from('operations_summaries').delete().eq('id', id)
    setSummaries(prev => prev.filter(s => s.id !== id))
  }

  async function updateSummary() {
    if (!editingSummary) return
    setSavingSummary(true)
    await supabase.from('operations_summaries').update({ notes: editingSummary.notes }).eq('id', editingSummary.id)
    await supabase.from('operations_summary_items').delete().eq('summary_id', editingSummary.id)
    if (editingSummary.items?.length > 0) {
      await supabase.from('operations_summary_items').insert(
        editingSummary.items.filter(i => i.item_name).map((i, idx) => ({
          summary_id: editingSummary.id, item_name: i.item_name, missing_qty: i.missing_qty, notes: i.notes, sort_order: idx
        }))
      )
    }
    const { data: refreshed } = await supabase.from('operations_summaries').select('*, items:operations_summary_items(*)').order('created_at', { ascending: false })
    setSummaries(refreshed || [])
    setEditingSummary(null)
    setSavingSummary(false)
  }

  async function sendInquiries() {
    const event = events.find(e => e.id === selectedEvent)
    if (!event) return
    const targets = crew.filter(c => selectedCrew[c.id])
    if (!targets.length) return
    setSending(true)
    for (const member of targets) {
      await supabase.from('operations_inquiries').insert({
        event_id: event.id,
        event_title: event.title,
        event_date: event.date,
        to_member_id: member.id,
        status: 'pending'
      })
    }
    setSending(false)
    setSent(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    await loadInquiries(user.id, p?.is_manager, myMember)
    setTimeout(() => setSent(false), 3000)
    setSelectedCrew({})
    setSelectedEvent('')
  }

  async function respond(id, status) {
    await supabase.from('operations_inquiries').update({ status }).eq('id', id)
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const selEv = events.find(e => e.id === selectedEvent)
  const anySelected = crew.some(c => selectedCrew[c.id])
  const selectedCount = crew.filter(c => selectedCrew[c.id]).length

  const statusLabel = { pending: 'ממתין', approved: 'אישר', rejected: '✗' }
  const statusColor = { pending: 'text-green-600 bg-green-50', approved: 'text-yellow-600 bg-yellow-50', rejected: 'text-red-600 bg-red-50' }

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">טוען...</div>

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">

        <button onClick={() => setTab('messages')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'messages' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          פניות {inquiries.filter(i=>i.status==='pending').length > 0 && <span className="mr-1 bg-white text-[#E0197D] rounded-full px-1.5 text-[10px] font-bold">{inquiries.filter(i=>i.status==='pending').length}</span>}
        </button>
        <button onClick={() => setTab('summary')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'summary' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          סיכום ערב
        </button>
        {isManager && (
          <button onClick={() => setTab('shifts')}
            className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'shifts' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
            סידור עבודה
          </button>
        )}
        {isManager && (
          <button onClick={() => setTab('team')}
            className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'team' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
            ניהול צוות
          </button>
        )}
      </div>



      {openInq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpenInq(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-[13px] text-gray-700 leading-relaxed text-right mb-4" dir="rtl">
              היי {crew.find(c=>c.id===openInq.to_member_id)?.full_name || openInq.member?.full_name || 'שלום'},<br/><br/>
              האם את/ה פנוי/ה לעבוד ב<span className="font-semibold">{openInq.event_title}</span> בתאריך <span className="font-semibold">{fmtDate(openInq.event_date)}</span>?
            </div>
            {(openInq.status === 'pending' || openInq.status === undefined) && (
              <div className="flex gap-2">
                <button onClick={() => { respond(openInq.id, 'rejected'); setOpenInq(null) }}
                  className="flex-1 text-sm bg-red-50 text-red-500 py-2 rounded-lg hover:bg-red-100">
                  ✗ לא פנוי/ה
                </button>
                <button onClick={() => { respond(openInq.id, 'approved'); setOpenInq(null) }}
                  className="flex-1 text-sm bg-green-50 text-green-600 py-2 rounded-lg hover:bg-green-100 font-medium">
                  ✓ אני פנוי/ה
                </button>
              </div>
            )}
            {openInq.status !== 'pending' && (
              <div className={`text-center text-sm py-2 rounded-lg font-medium ${statusColor[openInq.status]}`}>
                {statusLabel[openInq.status]}
              </div>
            )}
            <button onClick={() => setOpenInq(null)} className="w-full mt-3 text-[12px] text-gray-400 hover:text-gray-600">סגור</button>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="max-w-xl">
          {isManager ? (
            /* מנהל - טבלה לפי אירוע */
            (() => {
              const grouped = {}
              inquiries.forEach(inq => {
                const key = inq.event_id
                if (!grouped[key]) grouped[key] = { event_title: inq.event_title, event_date: inq.event_date, sent_at: inq.created_at, items: [] }
                const exists = grouped[key].items.find(i => i.to_member_id === inq.to_member_id)
                if (!exists) grouped[key].items.push(inq)
                else if (inq.status !== 'pending') exists.status = inq.status
              })
              const groups = Object.values(grouped)
              if (groups.length === 0) return <div className="text-center text-[13px] text-gray-400 py-8">אין פניות עדיין</div>
              return groups.map((g, gi) => (
                <div key={gi} className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-row-reverse">
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-gray-800">{g.event_title}</div>
                      <div className="text-[11px] text-gray-400">{fmtDate(g.event_date)}</div>
                    </div>
                    <div className="text-[10px] text-gray-400">נשלח {fmtTime(g.sent_at)}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="flex flex-row-reverse p-3 gap-2 min-w-max">
                      {g.items.map(inq => (
                        <div key={inq.id} className="flex flex-col items-center px-3 py-2.5 border border-gray-100 rounded-xl min-w-[80px] cursor-pointer hover:bg-gray-50"
                          onClick={() => setOpenInq(inq)}>
                          <div className="text-[12px] font-medium text-gray-700 text-center mb-2">
                            {(crew.find(c=>c.id===inq.to_member_id)?.full_name || '—').split(' ')[0]}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[inq.status]}`}>
                            {statusLabel[inq.status]}
                          </span>
                          {inq.status === 'approved' && (
                            <button onClick={e => { e.stopPropagation(); toggleShift(inq) }}
                              className={`text-[9px] px-1.5 py-0.5 rounded border mt-1 ${shifts.find(s=>s.event_id===inq.event_id&&s.member_id===inq.to_member_id) ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'text-gray-400 border-gray-200 hover:border-[#E0197D] hover:text-[#E0197D]'}`}>
                              {shifts.find(s=>s.event_id===inq.event_id&&s.member_id===inq.to_member_id) ? '✓ בסידור' : '+ סידור'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            })()
          ) : (
            /* איש צוות - רשימה פשוטה */
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="text-[11px] text-gray-400">{inquiries.length} פניות</div>
                <div className="text-[12px] font-semibold text-gray-700">פניות שלי</div>
              </div>
              {inquiries.length === 0 && (
                <div className="text-center text-[13px] text-gray-400 py-8">אין פניות עדיין</div>
              )}
              {inquiries.map(inq => (
                <div key={inq.id} className="px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpenInq(inq)}>
                  <div className="flex items-start justify-between flex-row-reverse mb-1">
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-gray-800">{inq.event_title}</div>
                      <div className="text-[11px] text-gray-400">{fmtDate(inq.event_date)}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[inq.status]}`}>
                      {statusLabel[inq.status]}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-300 text-left">{fmtTime(inq.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingSummary(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-[13px] font-semibold text-gray-700 text-right mb-3">עריכת סיכום — {editingSummary.event_title}</div>
            <textarea value={editingSummary.notes || ''} onChange={e => setEditingSummary(v => ({ ...v, notes: e.target.value }))}
              placeholder="הערות כלליות..." rows={3} dir="rtl"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] resize-none mb-3"/>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setEditingSummary(v => ({ ...v, items: [...(v.items||[]), { id: Date.now(), item_name:'', missing_qty:'', notes:'' }] }))}
                  className="text-[11px] text-[#E0197D] flex items-center gap-1">
                  <i className="ti ti-plus" style={{fontSize:11}}/> הוסף פריט
                </button>
                <div className="text-[11px] font-medium text-gray-500">מלאי חסר</div>
              </div>
              {(editingSummary.items||[]).length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_2fr_auto] bg-gray-50 border-b border-gray-100">
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right">פריט</div>
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right border-r border-gray-100">כמות</div>
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right border-r border-gray-100">הערות</div>
                    <div className="w-6"/>
                  </div>
                  {(editingSummary.items||[]).map(item => (
                    <div key={item.id} className="grid grid-cols-[2fr_1fr_2fr_auto] border-b border-gray-50 last:border-0">
                      <input value={item.item_name||''} onChange={e => setEditingSummary(v => ({ ...v, items: v.items.map(i => i.id===item.id ? {...i, item_name: e.target.value} : i) }))}
                        placeholder="פריט" dir="rtl" className="text-[11px] px-2 py-1.5 outline-none border-r border-gray-50"/>
                      <input value={item.missing_qty||''} onChange={e => setEditingSummary(v => ({ ...v, items: v.items.map(i => i.id===item.id ? {...i, missing_qty: e.target.value} : i) }))}
                        placeholder="כמות" dir="rtl" className="text-[11px] px-2 py-1.5 outline-none border-r border-gray-50"/>
                      <input value={item.notes||''} onChange={e => setEditingSummary(v => ({ ...v, items: v.items.map(i => i.id===item.id ? {...i, notes: e.target.value} : i) }))}
                        placeholder="הערות" dir="rtl" className="text-[11px] px-2 py-1.5 outline-none"/>
                      <button onClick={() => setEditingSummary(v => ({ ...v, items: v.items.filter(i => i.id !== item.id) }))}
                        className="px-1 text-gray-300 hover:text-red-500">
                        <i className="ti ti-x" style={{fontSize:10}}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingSummary(null)} className="flex-1 text-sm py-2 border border-gray-200 rounded-lg text-gray-500">ביטול</button>
              <button onClick={updateSummary} disabled={savingSummary}
                className="flex-1 text-sm py-2 bg-[#E0197D] text-white rounded-lg font-medium hover:bg-[#A0106A] disabled:opacity-50">
                {savingSummary ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="max-w-xl">
          {/* טופס הוספת סיכום */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="text-[12px] font-semibold text-gray-700 text-right mb-3">סיכום ערב חדש</div>
            <select value={summary.event_id} onChange={e => {
              const ev = events.find(ev => ev.id === e.target.value)
              setSummary(v => ({ ...v, event_id: e.target.value, event_title: ev?.title || '', event_date: ev?.date || '' }))
            }} className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] mb-3" dir="rtl">
              <option value="">בחר אירוע...</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
            </select>
            <textarea value={summary.notes} onChange={e => setSummary(v => ({ ...v, notes: e.target.value }))}
              placeholder="הערות כלליות לסיכום הערב..."
              rows={3} dir="rtl"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] resize-none mb-3"/>
            {/* שורות מלאי */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={addSummaryItem} className="text-[11px] text-[#E0197D] flex items-center gap-1">
                  <i className="ti ti-plus" style={{fontSize:11}}/> הוסף פריט
                </button>
                <div className="text-[11px] font-medium text-gray-500">מלאי חסר</div>
              </div>
              {summaryItems.length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-2">
                  <div className="grid grid-cols-[2fr_1fr_2fr_auto] bg-gray-50 border-b border-gray-100">
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right">פריט</div>
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right border-r border-gray-100">כמות חסרה</div>
                    <div className="text-[10px] text-gray-500 px-2 py-1.5 text-right border-r border-gray-100">הערות</div>
                    <div className="w-6"/>
                  </div>
                  {summaryItems.map(item => (
                    <div key={item.id} className="grid grid-cols-[2fr_1fr_2fr_auto] border-b border-gray-50 last:border-0">
                      <input value={item.item_name} onChange={e => updateSummaryItem(item.id, 'item_name', e.target.value)}
                        placeholder="שם פריט" dir="rtl"
                        className="text-[11px] px-2 py-1.5 outline-none border-r border-gray-50"/>
                      <input value={item.missing_qty} onChange={e => updateSummaryItem(item.id, 'missing_qty', e.target.value)}
                        placeholder="כמות" dir="rtl"
                        className="text-[11px] px-2 py-1.5 outline-none border-r border-gray-50"/>
                      <input value={item.notes} onChange={e => updateSummaryItem(item.id, 'notes', e.target.value)}
                        placeholder="הערות" dir="rtl"
                        className="text-[11px] px-2 py-1.5 outline-none"/>
                      <button onClick={() => removeSummaryItem(item.id)} className="px-1 text-gray-300 hover:text-red-500">
                        <i className="ti ti-x" style={{fontSize:10}}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={saveSummary} disabled={savingSummary || !summary.event_id}
              className="w-full bg-[#E0197D] text-white text-sm py-2 rounded-lg font-medium hover:bg-[#A0106A] disabled:opacity-50">
              {savingSummary ? 'שומר...' : 'שמור סיכום'}
            </button>
            {summarySaved && <div className="text-center text-green-600 text-[12px] mt-2">✓ נשמר בהצלחה</div>}
          </div>
          {/* רשימת סיכומים קודמים */}
          {summaries.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-gray-500 text-right">סיכומים קודמים</div>
              {summaries.map(s => (
                <div key={s.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-row-reverse">
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-gray-800">{s.event_title}</div>
                      <div className="text-[11px] text-gray-400">{fmtDate(s.event_date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] text-gray-400">{fmtTime(s.created_at)}</div>
                      <button onClick={() => setEditingSummary({ ...s, items: s.items || [] })}
                        className="text-gray-300 hover:text-[#E0197D] p-0.5">
                        <i className="ti ti-pencil" style={{fontSize:12}}/>
                      </button>
                      <button onClick={() => deleteSummary(s.id)}
                        className="text-gray-300 hover:text-red-500 p-0.5">
                        <i className="ti ti-trash" style={{fontSize:12}}/>
                      </button>
                    </div>
                  </div>
                  {s.notes && <div className="px-4 py-3 text-[12px] text-gray-600 text-right border-b border-gray-50">{s.notes}</div>}
                  {s.items && s.items.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-[2fr_1fr_2fr] bg-gray-50 border-b border-gray-100 min-w-[300px]">
                        <div className="text-[10px] text-gray-500 px-3 py-1.5 text-right">פריט</div>
                        <div className="text-[10px] text-gray-500 px-3 py-1.5 text-right border-r border-gray-100">כמות חסרה</div>
                        <div className="text-[10px] text-gray-500 px-3 py-1.5 text-right border-r border-gray-100">הערות</div>
                      </div>
                      {s.items.sort((a,b)=>a.sort_order-b.sort_order).map((item, i) => (
                        <div key={item.id} className={`grid grid-cols-[2fr_1fr_2fr] border-b border-gray-50 last:border-0 min-w-[300px] ${i%2===0?'bg-white':'bg-[#FFF8FC]'}`}>
                          <div className="text-[11px] text-gray-700 px-3 py-2 text-right">{item.item_name}</div>
                          <div className="text-[11px] text-gray-600 px-3 py-2 text-right border-r border-gray-50">{item.missing_qty}</div>
                          <div className="text-[11px] text-gray-500 px-3 py-2 text-right border-r border-gray-50">{item.notes}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          )}
        </div>
      )}

      {tab === 'shifts' && isManager && (
        <div className="max-w-2xl">
          {(() => {
            const grouped = {}
            shifts.forEach(s => {
              const key = s.event_id
              if (!grouped[key]) grouped[key] = { event_title: s.event_title, event_date: s.event_date, items: [] }
              grouped[key].items.push(s)
            })
            const groups = Object.values(grouped)
            if (groups.length === 0) return <div className="text-center text-[13px] text-gray-400 py-8">אין סידור עבודה עדיין. בחר עובדים מטאב הפניות</div>
            return groups.map((g, gi) => (
              <div key={gi} className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-row-reverse">
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-gray-800">{g.event_title}</div>
                    <div className="text-[11px] text-gray-400">{(() => { if (!g.event_date) return ''; const [y,m,d] = g.event_date.split('-'); const HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']; return `${+d} ${HE[+m-1]} ${y}` })()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] text-gray-400">{g.items.length} עובדים</div>
                    <button onClick={() => deleteEventShifts(g.items[0]?.event_id)}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex flex-row-reverse p-3 gap-3 min-w-max">
                    {g.items.map(s => (
                      <div key={s.id} className="flex flex-col items-center px-3 py-2.5 border border-gray-100 rounded-xl min-w-[100px] relative">
                        <button onClick={() => deleteShift(s.id)}
                          className="absolute top-1 left-1 text-gray-200 hover:text-red-500">
                          <i className="ti ti-x" style={{fontSize:11}}/>
                        </button>
                        <div className="text-[12px] font-medium text-gray-700 text-center mb-2 mt-1">
                          {crew.find(c=>c.id===s.member_id)?.full_name || '—'}
                        </div>
                        <select value={s.role || ''} onChange={e => updateShiftRole(s.id, e.target.value)}
                          className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] w-full text-center bg-gray-50" dir="rtl">
                          <option value="">תפקיד...</option>
                          <option value="בר">בר</option>
                          <option value="קופה">קופה</option>
                          <option value="ניהול ערב">ניהול ערב</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {tab === 'team' && isManager && (
        <div className="max-w-xl">
          {/* sub-tabs */}
          <div className="flex flex-row-reverse gap-1 mb-4 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTeamSubTab('inquiry')}
              className={`flex-1 text-[12px] py-1.5 rounded-lg font-medium transition-colors ${teamSubTab === 'inquiry' ? 'bg-white text-[#E0197D] shadow-sm' : 'text-gray-500'}`}>
              בדיקת פניות
            </button>
            <button onClick={() => setTeamSubTab('crew')}
              className={`flex-1 text-[12px] py-1.5 rounded-lg font-medium transition-colors ${teamSubTab === 'crew' ? 'bg-white text-[#E0197D] shadow-sm' : 'text-gray-500'}`}>
              צוות
            </button>
          </div>
          {teamSubTab === 'inquiry' && (
            <div className="max-w-xl">        <div className="max-w-xl">
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="text-[11px] font-semibold text-gray-500 mb-2 text-right">בחר אירוע</div>
            <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" dir="rtl">
              <option value="">בחר אירוע...</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="text-[11px] text-gray-400">{crew.length} אנשים</div>
              <div className="text-[12px] font-semibold text-gray-700">צוות תפעול</div>
            </div>
            {crew.length === 0 && (
              <div className="text-center text-[13px] text-gray-400 py-6">אין אנשי צוות תפעול עדיין</div>
            )}
            {crew.map(member => (
              <label key={member.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer flex-row-reverse">
                <div className="text-right">
                  <div className="text-[13px] font-medium text-gray-700">{member.full_name}</div>
                  {member.role && <div className="text-[11px] text-gray-400">{member.role}</div>}
                </div>
                <input type="checkbox" checked={!!selectedCrew[member.id]} onChange={() => toggleCrew(member.id)}
                  className="w-4 h-4 accent-[#E0197D]" />
              </label>
            ))}
          </div>

          {selEv && anySelected && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[12px] text-gray-500 text-right mb-3">
                שליחת פניה ל-{selectedCount} אנשים עבור <span className="font-semibold text-gray-700">{selEv.title}</span> — {fmtDate(selEv.date)}
              </div>
              <button onClick={sendInquiries} disabled={sending}
                className="w-full bg-[#E0197D] text-white text-sm py-2.5 rounded-lg font-medium hover:bg-[#A0106A] disabled:opacity-50 transition-colors">
                {sending ? 'שולח...' : 'שלח פניה (' + selectedCount + ')'}
              </button>
              {sent && <div className="text-center text-green-600 text-[12px] mt-2">✓ הפניות נשלחו בהצלחה</div>}
            </div>
          )}
          {teamSubTab === 'crew' && (
        <div className="max-w-xl">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <button onClick={() => setShowAdd(!showAdd)}
                className="text-[12px] text-[#E0197D] flex items-center gap-1">
                <i className="ti ti-plus" style={{fontSize:13}}/> הוסף
              </button>
              <div className="text-[12px] font-semibold text-gray-700">צוות תפעול</div>
            </div>
            {showAdd && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                <input value={newMember.full_name} onChange={e => setNewMember(v=>({...v,full_name:e.target.value}))}
                  placeholder="שם מלא *" className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D]" dir="rtl"/>
                <input value={newMember.role} onChange={e => setNewMember(v=>({...v,role:e.target.value}))}
                  placeholder="תפקיד" className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none" dir="rtl"/>
                <input value={newMember.phone} onChange={e => setNewMember(v=>({...v,phone:e.target.value}))}
                  placeholder="טלפון" className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none" dir="rtl"/>
                <input value={newMember.email} onChange={e => setNewMember(v=>({...v,email:e.target.value}))}
                  placeholder="אימייל" className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none" dir="rtl"/>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAdd(false)} className="text-sm text-gray-400 px-3 py-1.5">ביטול</button>
                  <button onClick={addMember} disabled={adding}
                    className="text-sm bg-[#E0197D] text-white px-4 py-1.5 rounded-lg">הוסף</button>
                </div>
              </div>
            )}
            {crew.length === 0 && !showAdd && (
              <div className="text-center text-[13px] text-gray-400 py-6">אין אנשי צוות עדיין</div>
            )}
            {crew.map(member => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse">
                <div className="text-right">
                  <div className="text-[13px] font-medium text-gray-700">{member.full_name}</div>
                  {member.role && <div className="text-[11px] text-gray-400">{member.role}</div>}
                  {member.phone && <div className="text-[11px] text-gray-400">{member.phone}</div>}
                </div>
                <button onClick={() => removeMember(member.id)} className="text-gray-300 hover:text-red-500">
                  <i className="ti ti-trash" style={{fontSize:13}}/>
                </button>
              </div>
            ))}
          </div>
        </div>
          )}
        </div>
      )}
    </div>
  )
}
