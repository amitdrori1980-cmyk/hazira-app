'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const COL_MAP = {
  title:       ['שם אירוע','כותרת','שם','title','event','אירוע'],
  date:        ['תאריך','date'],
  time:        ['שעה','time','hour'],
  type:        ['סוג','type','קטגוריה','category'],
  description: ['תיאור','description','פרטים','details'],
  crew_notes:  ['הערות','notes','הערות לצוות'],
  venue:       ['אולם','venue','מקום','hall'],
  depts:       ['מחלקות','depts','departments','מחלקה'],
  crew:        ['צוות','crew','אנשי צוות','staff'],
}

function findCol(headers, keys) {
  for (const h of headers) {
    for (const k of keys) {
      if (h?.toString().toLowerCase().trim() === k.toLowerCase()) return h
    }
  }
  return null
}

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  const s = val.toString().trim()
  const m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  }
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`
  return null
}

function parseTime(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60)
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }
  const s = val.toString().trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}`
  return null
}

export default function ImportPage() {
  const [rows, setRows]             = useState([])
  const [headers, setHeaders]       = useState([])
  const [colMapping, setColMapping] = useState({})
  const [preview, setPreview]       = useState([])
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState(null)
  const [fileName, setFileName]     = useState('')
  const [step, setStep]             = useState(1)
  const [eventTypes, setEventTypes] = useState([]) // from Supabase
  const [crewMembers, setCrewMembers] = useState([]) // for name matching
  const [typeMap, setTypeMap]       = useState({}) // label->value map

  useEffect(() => {
    // Load event types from Supabase
    supabase.from('crew_members').select('id,full_name').eq('active',true).then(({ data }) => { setCrewMembers(data||[]) })
    supabase.from('event_types').select('*').order('sort_order').then(({ data }) => {
      const types = data || []
      setEventTypes(types)
      // Build map: any variation of label -> value
      const map = {}
      types.forEach(t => {
        map[t.label.trim().toLowerCase()] = t.value
        map[t.value.trim().toLowerCase()] = t.value
      })
      setTypeMap(map)
    })
  }, [])

  function resolveType(raw) {
    if (!raw) return eventTypes[0]?.value || 'show'
    const key = raw.toString().trim().toLowerCase()
    return typeMap[key] || eventTypes[0]?.value || 'show'
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array', raw: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
      if (data.length < 2) return
      const hdrs = data[0].map(h => h?.toString() || '')
      setHeaders(hdrs)
      const mapping = {}
      for (const [field, keys] of Object.entries(COL_MAP)) {
        const col = findCol(hdrs, keys)
        if (col) mapping[field] = col
      }
      setColMapping(mapping)
      const dataRows = data.slice(1)
        .filter(r => r.some(c => c != null && c !== ''))
        .map(r => { const obj={}; hdrs.forEach((h,i)=>obj[h]=r[i]); return obj })
      setRows(dataRows)
      buildPreview(dataRows, mapping)
      setStep(2)
    }
    reader.readAsArrayBuffer(file)
  }

  function buildPreview(dataRows, mapping) {
    const parsed = dataRows.map(row => ({
      title:       row[mapping.title]?.toString().trim() || '',
      date:        parseDate(row[mapping.date]),
      time:        parseTime(row[mapping.time]),
      type:        resolveType(row[mapping.type]),
      type_raw:    row[mapping.type]?.toString().trim() || '',
      description: row[mapping.description]?.toString().trim() || '',
      crew_notes:  row[mapping.crew_notes]?.toString().trim() || '',
      venue:       row[mapping.venue]?.toString().trim() || '',
      depts:       row[mapping.depts]
        ? row[mapping.depts].toString().split(/[,،;]/).map(s=>s.trim()).filter(Boolean)
        : [],
      crew_names:  row[mapping.crew]
        ? row[mapping.crew].toString().split(/[,،;]/).map(s=>s.trim()).filter(Boolean)
        : [],
    })).filter(r => r.title && r.date)
    setPreview(parsed)
  }

  function updateMapping(field, col) {
    const newMapping = { ...colMapping, [field]: col }
    setColMapping(newMapping)
    buildPreview(rows, newMapping)
  }

  async function importEvents() {
    if (!preview.length) return
    setImporting(true)
    let success = 0, failed = 0
    // Load existing events for duplicate check
    const { data: existingEvents } = await supabase
      .from('events')
      .select('title, date')
    const existingSet = new Set(
      (existingEvents || []).map(e => `${e.title?.trim()}__${e.date}`)
    )

    let skipped = 0
    for (const ev of preview) {
      const key = `${ev.title?.trim()}__${ev.date}`
      if (existingSet.has(key)) {
        skipped++
        continue  // skip duplicate
      }
      const { data: newEv, error } = await supabase.from('events').insert({
        title:       ev.title,
        date:        ev.date,
        time:        ev.time,
        type:        ev.type,
        venue:       ev.venue || null,
        description: ev.description,
        crew_notes:  ev.crew_notes,
        depts:       ev.depts,
      }).select().single()
      if (error) { console.error(error); failed++ }
      else {
        success++
        existingSet.add(key)  // prevent same-file duplicates too
        if (ev.crew_names && ev.crew_names.length > 0 && newEv) {
          for (const name of ev.crew_names) {
            const member = crewMembers.find(c =>
              c.full_name.trim() === name.trim()
            )
            if (member) {
              await supabase.from('event_crew').insert({
                event_id: newEv.id,
                crew_member_id: member.id,
              })
            }
          }
        }
      }
    }
    setResult({ success, failed, skipped })

    setImporting(false)
    setStep(3)
  }

  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
  function formatDate(ds) {
    if (!ds) return '—'
    const [y,m,d] = ds.split('-').map(Number)
    return `${d} ${HE_MONTHS[m-1]} ${y}`
  }

  function getTypeLabel(value) {
    const t = eventTypes.find(t => t.value === value)
    return t ? t.label : value
  }
  function getTypeColor(value) {
    const t = eventTypes.find(t => t.value === value)
    return t ? t.color : 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-2xl">

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="text-[14px] font-semibold text-gray-800 mb-2">ייבוא אירועים מ-Excel</div>
          <div className="text-[12px] text-gray-400 mb-4 leading-relaxed">
            העלה קובץ Excel עם אירועים.<br/>
            עמודות נתמכות: <strong>שם אירוע, תאריך, שעה, סוג, תיאור, הערות, מחלקות</strong>
          </div>

          {/* Show recognized types */}
          {eventTypes.length > 0 && (
            <div className="bg-[#FDEAEA] rounded-lg p-3 mb-5 text-[12px] text-[#8B0000]">
              <strong>סוגי אירוע מוכרים:</strong>{' '}
              {eventTypes.map(t => t.label).join(' / ')}
            </div>
          )}

          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#CC1010] hover:bg-[#FDEAEA] transition-colors">
            <i className="ti ti-file-spreadsheet text-[#CC1010]" style={{fontSize:36}}/>
            <span className="text-[13px] text-gray-500 mt-2">לחץ לבחירת קובץ Excel</span>
            <span className="text-[11px] text-gray-400">.xlsx / .xls</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden"/>
          </label>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && (
        <>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold text-gray-800">
                📄 {fileName} — {preview.length} אירועים תקינים
              </div>
              <button onClick={()=>{setStep(1);setRows([]);setPreview([])}}
                className="text-[12px] text-gray-400 hover:text-[#CC1010]">
                החלף קובץ
              </button>
            </div>

            {/* Column mapping */}
            <div className="p-3 bg-gray-50 rounded-lg mb-3">
              <div className="text-[11px] font-semibold text-gray-500 mb-2">מיפוי עמודות</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(COL_MAP).map(([field]) => (
                  <div key={field} className="flex items-center gap-2 flex-row-reverse">
                    <span className="text-[11px] text-gray-500 w-20 text-right">
                      {{'title':'שם אירוע','date':'תאריך','time':'שעה','type':'סוג','description':'תיאור','crew_notes':'הערות','depts':'מחלקות'}[field]}
                    </span>
                    <select value={colMapping[field]||''} onChange={e=>updateMapping(field,e.target.value)}
                      className="flex-1 text-[11px] px-2 py-1 border border-gray-200 rounded-lg bg-white outline-none">
                      <option value="">— לא ממופה —</option>
                      {headers.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 overflow-x-auto">
            <div className="text-[13px] font-semibold text-gray-800 mb-3">תצוגה מקדימה</div>
            {preview.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4">לא נמצאו שורות תקינות</div>
            ) : (
              <table className="w-full text-right text-[12px]" dir="rtl">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 font-medium text-gray-500 pr-1">שם</th>
                    <th className="pb-2 font-medium text-gray-500">תאריך</th>
                    <th className="pb-2 font-medium text-gray-500">שעה</th>
                    <th className="pb-2 font-medium text-gray-500">סוג</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((ev, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 font-medium text-gray-800 pr-1">{ev.title}</td>
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">{formatDate(ev.date)}</td>
                      <td className="py-1.5 text-gray-500">{ev.time || '—'}</td>
                      <td className="py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getTypeColor(ev.type)}`}>
                          {getTypeLabel(ev.type)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button onClick={importEvents} disabled={importing || preview.length===0}
            className="w-full bg-[#CC1010] text-white text-sm py-3 rounded-xl hover:bg-[#a00c0c] disabled:opacity-50 font-medium flex items-center justify-center gap-2">
            {importing
              ? <><i className="ti ti-loader-2 animate-spin"/> מייבא...</>
              : <><i className="ti ti-database-import"/> ייבא {preview.length} אירועים ליומן</>
            }
          </button>
        </>
      )}

      {/* Step 3 — Result */}
      {step === 3 && result && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">{result.failed === 0 ? '🎉' : '⚠️'}</div>
          <div className="text-[15px] font-semibold text-gray-800 mb-2">
            {result.failed === 0 ? 'הייבוא הושלם בהצלחה!' : 'הייבוא הושלם עם שגיאות'}
          </div>
          <div className="text-[13px] text-gray-500 mb-6">
            {result.success > 0 && <div className="text-[#085041]">✅ {result.success} אירועים נוספו ליומן</div>}
            {result.skipped > 0 && <div className="text-[#633806]">⏭ {result.skipped} אירועים דולגו (כבר קיימים)</div>}
            {result.failed > 0  && <div className="text-[#CC1010]">❌ {result.failed} אירועים נכשלו</div>}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={()=>{setStep(1);setRows([]);setPreview([]);setResult(null)}}
              className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              ייבא קובץ נוסף
            </button>
            <a href="/dashboard/calendar"
              className="px-5 py-2 bg-[#CC1010] text-white rounded-lg text-sm hover:bg-[#a00c0c]">
              עבור ליומן
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
