'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx-js-style'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

const VISIBLE_OPTIONS = [
  { value: 'managers', label: 'מנהלים בלבד' },
  { value: 'all', label: 'כולם' },
  { value: 'dept_tech', label: 'מחלקה טכנית' },
  { value: 'dept_prod', label: 'מחלקת הפקה' },
]

export default function ProductionSchedulePage() {
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const printRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile({ ...p, uid: user.id })
      const { data: evs } = await supabase.from('events').select('id,title,date,venue').order('date')
      setEvents(evs || [])
    }
    load()
  }, [])

  async function selectEvent(eventId) {
    setSelectedEvent(eventId)
    setSchedule(null)
    setRows([])
    if (!eventId) return
    setLoading(true)
    const { data: sch } = await supabase.from('schedules').select('*').eq('event_id', eventId).single()
    if (sch) {
      setSchedule(sch)
      const { data: r } = await supabase.from('schedule_rows').select('*').eq('schedule_id', sch.id).order('sort_order')
      setRows(r || [])
    } else {
      setSchedule(null)
      setRows([])
    }
    setLoading(false)
  }

  async function createSchedule() {
    if (!selectedEvent) return
    const { data } = await supabase.from('schedules').insert({
      event_id: selectedEvent,
      status: 'draft',
      participants: '',
      visible_to: 'managers',
    }).select().single()
    setSchedule(data)
    setRows([])
  }

  async function updateSchedule(field, value) {
    if (!schedule) return
    await supabase.from('schedules').update({ [field]: value }).eq('id', schedule.id)
    setSchedule(prev => ({ ...prev, [field]: value }))
  }

  async function addRow() {
    if (!schedule) return
    const newOrder = rows.length
    const { data } = await supabase.from('schedule_rows').insert({
      schedule_id: schedule.id,
      time: '',
      what: '',
      who: '',
      notes: '',
      sort_order: newOrder,
    }).select().single()
    if (data) setRows(prev => [...prev, data])
  }

  async function updateRow(rowId, field, value) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
    await supabase.from('schedule_rows').update({ [field]: value }).eq('id', rowId)
  }

  async function deleteRow(rowId) {
    await supabase.from('schedule_rows').delete().eq('id', rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  async function moveRow(index, dir) {
    const newRows = [...rows]
    const target = index + dir
    if (target < 0 || target >= newRows.length) return
    ;[newRows[index], newRows[target]] = [newRows[target], newRows[index]]
    setRows(newRows)
    await Promise.all(newRows.map((r, i) =>
      supabase.from('schedule_rows').update({ sort_order: i }).eq('id', r.id)
    ))
  }

  function canView() {
    if (!schedule || !profile) return false
    if (profile.is_manager) return true
    if (schedule.status === 'final') return true
    if (schedule.visible_to === 'all') return true
    if (schedule.visible_to === 'managers') return false
    return false
  }

  function canEdit() {
    return profile?.is_manager
  }

  async function exportExcel() {
    if (!schedule || !selEv) return
    setExporting(true)
    const wb = XLSX.utils.book_new()
    const ws = {}
    const borderThin = { top:{style:'thin',color:{rgb:'999999'}}, bottom:{style:'thin',color:{rgb:'999999'}}, left:{style:'thin',color:{rgb:'999999'}}, right:{style:'thin',color:{rgb:'999999'}} }

    // Title row
    ws['A1'] = { v: `לו"ז אירוע: ${selEv.title}`, t: 's', s: { font: { bold: true, sz: 16, name: 'Calibri', color: { rgb: 'CC1010' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A2'] = { v: `תאריך: ${fmtDate(selEv.date)}${selEv.venue ? ` | אולם: ${selEv.venue}` : ''}`, t: 's', s: { font: { sz: 12, name: 'Calibri', color: { rgb: '666666' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A3'] = { v: `משתתפים: ${schedule.participants || ''}`, t: 's', s: { font: { sz: 12, name: 'Calibri', italic: true }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A4'] = { v: '', t: 's' }

    // Headers
    const headers = ['שעה', 'מה', 'מי', 'הערות']
    headers.forEach((h, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 4, c: ci })
      ws[ref] = { v: h, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'CC1010' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border: borderThin } }
    })

    // Data rows
    rows.forEach((row, ri) => {
      const isOdd = ri % 2 !== 0
      const vals = [row.time || '', row.what || '', row.who || '', row.notes || '']
      vals.forEach((v, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 5, c: ci })
        ws[ref] = { v, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: isOdd ? 'FFF0F0' : 'FFFFFF' } }, font: { sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2, wrapText: true }, border: borderThin } }
      })
    })

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 5, c: 3 } })
    ws['!views'] = [{ rightToLeft: true }]
    ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 25 }, { wch: 30 }]
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 18 }, { hpt: 10 }, { hpt: 22 }, ...rows.map(() => ({ hpt: 20 }))]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'לוז')
    XLSX.writeFile(wb, `לוז_${selEv.title}_${selEv.date}.xlsx`)
    setExporting(false)
  }

  function exportPDF() {
    window.print()
  }

  const selEv = events.find(e => e.id === selectedEvent)
  const isManager = profile?.is_manager

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #schedule-print, #schedule-print * { visibility: visible; }
          #schedule-print { position: fixed; top: 0; left: 0; width: 100%; direction: rtl; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl">
        {/* Event selector */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 no-print">
          <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע</div>
          <select value={selectedEvent} onChange={e => selectEvent(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
            <option value="">בחר אירוע...</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
          </select>
        </div>

        {loading && <div className="text-center text-gray-400 py-8">טוען...</div>}

        {selectedEvent && !loading && !schedule && isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center no-print">
            <div className="text-[14px] text-gray-500 mb-4">אין לוז לאירוע זה עדיין</div>
            <button onClick={createSchedule}
              className="bg-[#CC1010] text-white px-6 py-2.5 rounded-lg text-sm hover:bg-[#a00c0c]">
              + צור לוז חדש
            </button>
          </div>
        )}

        {selectedEvent && !loading && !schedule && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">
            אין לוז זמין לאירוע זה
          </div>
        )}

        {schedule && (canView() || isManager) && (
          <>
            {/* Controls bar */}
            {isManager && (
              <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap no-print">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">סטטוס:</span>
                  <button onClick={() => updateSchedule('status', schedule.status === 'draft' ? 'final' : 'draft')}
                    className={`text-[12px] px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      schedule.status === 'final'
                        ? 'bg-[#E1F5EE] text-[#085041] border-[#085041]'
                        : 'bg-[#FAEEDA] text-[#633806] border-[#633806]'
                    }`}>
                    {schedule.status === 'final' ? '✅ סופי' : '✏️ בעבודה'}
                  </button>
                </div>

                {/* Visible to */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">גלוי ל:</span>
                  <select value={schedule.visible_to} onChange={e => updateSchedule('visible_to', e.target.value)}
                    className="text-[12px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010]">
                    {VISIBLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="flex-1"/>

                {/* Export buttons */}
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 disabled:opacity-50">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> אקסל
                </button>
                <button onClick={exportPDF}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> PDF
                </button>
              </div>
            )}

            {/* Non-manager export */}
            {!isManager && schedule.status === 'final' && (
              <div className="flex gap-2 mb-4 justify-end no-print">
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 bg-white">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> ייצוא לאקסל
                </button>
                <button onClick={exportPDF}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#CC1010] text-gray-600 bg-white">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> ייצוא PDF
                </button>
              </div>
            )}

            {/* Schedule document */}
            <div id="schedule-print" className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100" style={{ borderRight: '4px solid #CC1010' }}>
                <div className="flex items-start justify-between flex-row-reverse">
                  <div className="text-right">
                    <div className="text-[20px] font-bold text-gray-900">{selEv?.title}</div>
                    <div className="text-[13px] text-gray-500 mt-0.5">
                      {fmtDate(selEv?.date)}
                      {selEv?.venue ? ` · ${selEv.venue}` : ''}
                    </div>
                  </div>
                  <div className={`text-[11px] px-2.5 py-1 rounded-full font-medium no-print ${
                    schedule.status === 'final' ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-[#FAEEDA] text-[#633806]'
                  }`}>
                    {schedule.status === 'final' ? '✅ סופי' : '✏️ בעבודה'}
                  </div>
                </div>

                {/* Participants */}
                <div className="mt-3">
                  {isManager ? (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">משתתפים:</span>
                      <input
                        value={schedule.participants || ''}
                        onChange={e => setSchedule(prev => ({ ...prev, participants: e.target.value }))}
                        onBlur={e => updateSchedule('participants', e.target.value)}
                        placeholder="רשימת משתתפים..."
                        className="flex-1 text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] text-right no-print"
                      />
                      <span className="text-[13px] text-gray-600 hidden print:block">{schedule.participants}</span>
                    </div>
                  ) : (
                    schedule.participants && (
                      <div className="text-[13px] text-gray-600 text-right">
                        <span className="text-[11px] text-gray-400 ml-1">משתתפים:</span>
                        {schedule.participants}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_40px] gap-0 bg-[#CC1010] text-white text-[12px] font-semibold no-print">
                <div className="px-3 py-2.5 text-right">שעה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
                {isManager && <div className="px-2 py-2.5"/>}
              </div>

              {/* Print table header */}
              <div className="hidden print:grid grid-cols-[80px_1fr_1fr_1fr] gap-0 bg-[#CC1010] text-white text-[12px] font-semibold">
                <div className="px-3 py-2.5 text-right">שעה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
              </div>

              {/* Rows */}
              {rows.length === 0 && (
                <div className="text-center text-[13px] text-gray-400 py-8 no-print">
                  {isManager ? 'לחץ על "הוסף שורה" כדי להתחיל' : 'הלוז ריק'}
                </div>
              )}

              {rows.map((row, index) => (
                <div key={row.id}
                  className={`grid gap-0 border-b border-gray-50 group ${isManager ? 'grid-cols-[80px_1fr_1fr_1fr_40px]' : 'grid-cols-[80px_1fr_1fr_1fr]'} ${index % 2 === 0 ? 'bg-white' : 'bg-[#FFF8F8]'}`}>
                  {isManager ? (
                    <>
                      <input value={row.time||''} onChange={e=>updateRow(row.id,'time',e.target.value)}
                        placeholder="00:00"
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono"/>
                      <input value={row.what||''} onChange={e=>updateRow(row.id,'what',e.target.value)}
                        placeholder="תיאור..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100"/>
                      <input value={row.who||''} onChange={e=>updateRow(row.id,'who',e.target.value)}
                        placeholder="שם / תפקיד..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100"/>
                      <input value={row.notes||''} onChange={e=>updateRow(row.id,'notes',e.target.value)}
                        placeholder="הערות..."
                        className="px-3 py-2.5 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500"/>
                      <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveRow(index, -1)} disabled={index===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-up" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => deleteRow(row.id)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <i className="ti ti-trash" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => moveRow(index, 1)} disabled={index===rows.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-down" style={{fontSize:11}}/>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 font-mono text-[#CC1010] font-medium">{row.time}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100">{row.what}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 text-gray-600">{row.who}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right text-gray-400">{row.notes}</div>
                    </>
                  )}
                </div>
              ))}

              {/* Add row button */}
              {isManager && (
                <button onClick={addRow}
                  className="w-full py-3 text-[13px] text-gray-400 hover:text-[#CC1010] hover:bg-[#FDEAEA] transition-colors flex items-center justify-center gap-1 no-print">
                  <i className="ti ti-plus" style={{fontSize:13}}/> הוסף שורה
                </button>
              )}
            </div>
          </>
        )}

        {schedule && !canView() && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">
            הלוז עדיין לא זמין לצפייה
          </div>
        )}
      </div>
    </>
  )
}
