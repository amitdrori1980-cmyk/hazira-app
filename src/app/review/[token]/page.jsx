'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
// HAZIRA-REVIEW-PUBLIC-V4

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-').map(Number)
  return d + ' ' + HE_MONTHS[m - 1]
}

export default function ReviewPage() {
  const params = useParams()
  const token = params?.token
  const [link, setLink] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [savingIdx, setSavingIdx] = useState(null)

  useEffect(() => {
    async function load() {
      if (!token) return
      const { data: l } = await supabase.from('review_links').select('*').eq('token', token).maybeSingle()
      if (!l) { setNotFound(true); setLoading(false); return }
      setLink(l)
      const { data: rs } = await supabase.from('review_responses').select('*').eq('token', token)
      const map = {}
      const its = l.items || []
      ;(rs || []).forEach(r => {
        let idx = -1
        if (r.item_key) idx = its.findIndex(x => (x.eid + ':' + x.slot) === r.item_key)
        if (idx < 0 && r.item_index != null) idx = r.item_index
        if (idx >= 0) map[idx] = { decision: r.decision || '', note: r.note || '', updated_at: r.updated_at || null }
      })
      setResponses(map)
      setLoading(false)
    }
    load()
  }, [token])

  function itemKey(idx) {
    const it = (link?.items || [])[idx]
    return it ? (it.eid + ':' + it.slot) : ('idx:' + idx)
  }

  async function setDecision(idx, decision) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    const next = { ...cur, decision, updated_at: nowIso }
    setResponses(prev => ({ ...prev, [idx]: next }))
    setSavingIdx(idx)
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision, note: next.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' }
    )
    setSavingIdx(null)
    if (error) alert('שגיאה בשמירה: ' + error.message)
  }

  async function clearDecision(idx) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    setResponses(prev => ({ ...prev, [idx]: { ...cur, decision: '', updated_at: nowIso } }))
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision: '', note: cur.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' }
    )
    if (error) alert('שגיאה: ' + error.message)
  }

  async function saveNote(idx) {
    const cur = responses[idx] || { decision: '', note: '' }
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('review_responses').upsert(
      { token, item_key: itemKey(idx), decision: cur.decision || '', note: cur.note || '', updated_at: nowIso },
      { onConflict: 'token,item_key' }
    )
    setResponses(prev => ({ ...prev, [idx]: { ...(prev[idx] || { decision: '' }), updated_at: nowIso } }))
    if (error) alert('שגיאה בשמירת ההערה: ' + error.message)
  }

  if (loading) return <div style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>
  if (notFound) return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <div className="text-[#E0197D] text-2xl font-bold mb-2">הזירה</div>
        <div className="text-gray-500 text-[14px]">הלינק לא נמצא או שפג תוקפו.</div>
      </div>
    </div>
  )

  const items = link.items || []
  const doneCount = Object.values(responses).filter(r => r.decision).length

  return (
    <div dir="rtl" style={{ fontFamily: 'Calibri, sans-serif' }} className="min-h-screen bg-[#FCE4F3]/40 py-6 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-5">
          <div className="text-[#E0197D] text-2xl font-bold">הזירה</div>
          <div className="text-gray-600 text-[14px] mt-1">בדיקת פעולות — {link.person_name}</div>
          <div className="text-gray-400 text-[12px] mt-0.5">סמנו לכל פעולה: אישור / לא יכול, והוסיפו הערה במידת הצורך</div>
          <div className="text-gray-400 text-[12px] mt-1">{doneCount}/{items.length} סומנו</div>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it, idx) => {
            const r = responses[idx] || { decision: '', note: '' }
            return (
              <div key={idx} className="bg-white border border-[#F3C9E2] rounded-2xl p-4 shadow-sm">
                <div className="text-[15px] font-bold text-gray-800 text-right mb-0.5">{it.event_name}</div>
                <div className="text-[12px] text-gray-500 text-right mb-3">
                  {it.date ? fmtDate(it.date) : ''}{it.venue ? ` · ${it.venue}` : ''}
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setDecision(idx, 'approve')}
                    className={`flex-1 text-[14px] py-2.5 rounded-xl border font-medium transition-colors ${r.decision === 'approve' ? 'bg-yellow-400 border-yellow-400 text-yellow-950' : 'bg-white border-gray-200 text-gray-500 hover:border-yellow-400'}`}>
                    <i className="ti ti-check"/> מאשר
                  </button>
                  <button onClick={() => setDecision(idx, 'reject')}
                    className={`flex-1 text-[14px] py-2.5 rounded-xl border font-medium transition-colors ${r.decision === 'reject' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-red-400'}`}>
                    <i className="ti ti-x"/> לא יכול
                  </button>
                </div>
                {r.decision && (
                  <button onClick={() => clearDecision(idx)} className="text-[12px] text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
                    <i className="ti ti-eraser" style={{fontSize:13}}/> נקה בחירה
                  </button>
                )}
                <textarea
                  value={r.note}
                  onChange={e => setResponses(prev => ({ ...prev, [idx]: { ...(prev[idx] || { decision: '' }), note: e.target.value } }))}
                  onBlur={() => saveNote(idx)}
                  placeholder="הערה (לא חובה)..."
                  rows={2}
                  className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y"
                />
                {savingIdx === idx && <div className="text-[11px] text-gray-400 mt-1 text-left">נשמר…</div>}
                {r.updated_at && (
                  <div className="text-[11px] text-gray-400 mt-1 text-left">עודכן: {new Date(r.updated_at).toLocaleString('he-IL', {day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="text-center text-[12px] text-gray-400 mt-6">התגובות נשמרות אוטומטית. אפשר לסגור את הדף ולחזור אליו מאוחר יותר.</div>
      </div>
    </div>
  )
}
