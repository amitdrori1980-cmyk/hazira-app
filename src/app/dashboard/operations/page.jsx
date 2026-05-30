'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function OperationsPage() {
  const [tab, setTab] = useState('inquiries')
  const [crew, setCrew] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedCrew, setSelectedCrew] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: crewData } = await supabase
      .from('crew_members')
      .select('*')
      .eq('is_operations', true)
      .order('full_name')
    setCrew(crewData || [])

    const { data: evData } = await supabase
      .from('events')
      .select('id, title, date')
      .order('date')
    setEvents(evData || [])
    setLoading(false)
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

  async function sendInquiries() {
    const event = events.find(e => e.id === selectedEvent)
    if (!event) return
    const targets = crew.filter(c => selectedCrew[c.id])
    if (!targets.length) return
    setSending(true)
    for (const member of targets) {
      if (!member.user_id) continue
      await supabase.from('messages').insert({
        to_user: member.user_id,
        subject: 'בדיקת פניה: ' + event.title,
        body: JSON.stringify({ type: 'inquiry', event_id: event.id, event_title: event.title, event_date: event.date }),
        read: false,
        created_at: new Date().toISOString()
      })
    }
    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
    setSelectedCrew({})
    setSelectedEvent('')
  }

  const selEv = events.find(e => e.id === selectedEvent)
  const anySelected = crew.some(c => selectedCrew[c.id])
  const selectedCount = crew.filter(c => selectedCrew[c.id]).length

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">טוען...</div>

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        <button onClick={() => setTab('inquiries')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'inquiries' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          בדיקת פניות
        </button>
      </div>

      {tab === 'inquiries' && (
        <div className="max-w-xl">
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
              <div className="text-center text-[13px] text-gray-400 py-6">
                אין אנשי צוות תפעול עדיין.<br/>
                <span className="text-[11px]">סמן is_operations=true בטבלת crew_members</span>
              </div>
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
        </div>
      )}
    </div>
  )
}
