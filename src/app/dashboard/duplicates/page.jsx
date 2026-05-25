'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatDate(ds) {
  if (!ds) return '—'
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

export default function DuplicatesPage() {
  const [groups, setGroups]     = useState([])  // groups of duplicate events
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState({})  // { eventId: true } — marked for deletion
  const [deleting, setDeleting] = useState(false)
  const [result, setResult]     = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setResult(null)
    const { data: events } = await supabase
      .from('events')
      .select('id, title, date, time, type, venue')
      .order('date')
      .order('title')

    if (!events) { setLoading(false); return }

    // Group by title+date — find duplicates
    const map = {}
    events.forEach(ev => {
      const key = `${ev.title?.trim()}__${ev.date}`
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })

    // Keep only groups with more than 1
    const dups = Object.values(map).filter(g => g.length > 1)
    setGroups(dups)

    // Auto-select all but the first in each group
    const autoSel = {}
    dups.forEach(group => {
      group.slice(1).forEach(ev => { autoSel[ev.id] = true })
    })
    setSelected(autoSel)
    setLoading(false)
  }

  function toggle(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleGroup(group) {
    const allSelected = group.every(ev => selected[ev.id])
    const next = { ...selected }
    group.forEach(ev => { next[ev.id] = !allSelected })
    setSelected(next)
  }

  async function deleteSelected() {
    const ids = Object.entries(selected).filter(([,v])=>v).map(([k])=>k)
    if (!ids.length) return
    setDeleting(true)
    const { error } = await supabase.from('events').delete().in('id', ids)
    if (!error) {
      setResult({ deleted: ids.length })
      await load()
    }
    setDeleting(false)
  }

  const totalSelected = Object.values(selected).filter(Boolean).length

  return (
    <div className="max-w-xl">
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-gray-800">זיהוי אירועים כפולים</div>
            <div className="text-[12px] text-gray-400 mt-0.5">
              {loading ? 'טוען...' : groups.length === 0
                ? 'לא נמצאו כפולים ✅'
                : `נמצאו ${groups.length} קבוצות כפולות`}
            </div>
          </div>
          <button onClick={load} className="text-[12px] text-[#E0197D] border border-[#E0197D] px-3 py-1.5 rounded-lg hover:bg-[#FCE4F3]">
            <i className="ti ti-refresh"/> רענן
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-[#E1F5EE] border border-[#c0e8d5] rounded-xl p-3 mb-4 text-[13px] text-[#085041] text-right">
          ✅ נמחקו {result.deleted} אירועים כפולים בהצלחה
        </div>
      )}

      {!loading && groups.length > 0 && (
        <>
          {groups.map((group, gi) => (
            <div key={gi} className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3 flex-row-reverse">
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-gray-800">{group[0].title}</div>
                  <div className="text-[11px] text-gray-400">{formatDate(group[0].date)}</div>
                </div>
                <span className="text-[11px] bg-[#FCE4F3] text-[#E0197D] px-2 py-0.5 rounded-full font-medium">
                  {group.length} עותקים
                </span>
              </div>

              {group.map((ev, i) => (
                <div key={ev.id}
                  className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-row-reverse ${selected[ev.id] ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!selected[ev.id]}
                    onChange={() => toggle(ev.id)}
                    style={{ accentColor: '#E0197D' }}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 text-right">
                    <span className={`text-[12px] ${i === 0 ? 'text-[#085041] font-medium' : 'text-gray-500'}`}>
                      {i === 0 ? '✅ שמור (ראשון)' : `עותק ${i + 1}`}
                    </span>
                    <div className="text-[11px] text-gray-400">
                      {ev.time?.slice(0,5)} {ev.venue ? `· ${ev.venue}` : ''}
                    </div>
                  </div>
                  {selected[ev.id] && (
                    <span className="text-[10px] bg-[#FAECE7] text-[#4A1B0C] px-1.5 py-0.5 rounded-full">למחיקה</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={deleteSelected}
            disabled={deleting || totalSelected === 0}
            className="w-full bg-[#E0197D] text-white text-sm py-3 rounded-xl hover:bg-[#A0106A] disabled:opacity-50 font-medium flex items-center justify-center gap-2">
            {deleting
              ? <><i className="ti ti-loader-2 animate-spin"/> מוחק...</>
              : <><i className="ti ti-trash"/> מחק {totalSelected} אירועים מסומנים</>
            }
          </button>
        </>
      )}

      {!loading && groups.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-[14px] font-medium text-gray-700">אין כפולים</div>
          <div className="text-[12px] text-gray-400 mt-1">כל האירועים ביומן ייחודיים</div>
        </div>
      )}
    </div>
  )
}
