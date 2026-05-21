'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

function buildStyledSheet(headers, rows) {
  const wb = XLSX.utils.book_new()
  const numCols = headers.length
  const numRows = rows.length

  // Build worksheet manually so every cell exists (including empty ones)
  const ws = {}

  const borderThin = {
    top:    { style: 'thin', color: { rgb: '999999' } },
    bottom: { style: 'thin', color: { rgb: '999999' } },
    left:   { style: 'thin', color: { rgb: '999999' } },
    right:  { style: 'thin', color: { rgb: '999999' } },
  }
  const borderHeader = {
    top:    { style: 'thin', color: { rgb: 'AA0000' } },
    bottom: { style: 'thin', color: { rgb: 'AA0000' } },
    left:   { style: 'thin', color: { rgb: 'AA0000' } },
    right:  { style: 'thin', color: { rgb: 'AA0000' } },
  }

  // Header row
  headers.forEach((h, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    ws[ref] = {
      v: h, t: 's',
      s: {
        fill: { patternType: 'solid', fgColor: { rgb: 'CC1010' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
        alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 },
        border: borderHeader,
      }
    }
  })

  // Data rows — write ALL cells including empty ones
  rows.forEach((row, ri) => {
    const isOdd = ri % 2 !== 0
    for (let ci = 0; ci < numCols; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      const val = row[ci] ?? ''
      ws[ref] = {
        v: val, t: typeof val === 'number' ? 'n' : 's',
        s: {
          fill: { patternType: 'solid', fgColor: { rgb: isOdd ? 'FFF0F0' : 'FFFFFF' } },
          font: { sz: 12, name: 'Calibri' },
          alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 },
          border: borderThin,
        }
      }
    }
  })

  // Sheet range
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows, c: numCols - 1 } })

  // RTL
  ws['!views'] = [{ rightToLeft: true }]

  // Column widths
  ws['!cols'] = headers.map((h, ci) => {
    const maxLen = Math.max(h.length * 2, ...rows.map(r => String(r[ci] ?? '').length))
    return { wch: Math.min(Math.max(maxLen, 10), 55) }
  })

  // Row heights
  ws['!rows'] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 18 }))]

  return { wb, ws }
}

function download(wb, ws, sheetName, fileName) {
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

const EXPORTS = [
  { id:'events',    label:'יומן אירועים',  icon:'ti-calendar-month' },
  { id:'tasks',     label:'משימות',         icon:'ti-checkbox' },
  { id:'crew',      label:'צוות',           icon:'ti-users' },
  { id:'equipment', label:'ציוד',           icon:'ti-tool' },
  { id:'storage',   label:'אכסון',          icon:'ti-map-pin' },
  { id:'messages',  label:'הודעות',         icon:'ti-bell' },
]

export default function ExportPage() {
  const [loading, setLoading] = useState(null)
  const [done, setDone]       = useState(null)

  async function exportData(type) {
    setLoading(type); setDone(null)

    let headers = [], rows = [], sheetName = '', fileName = ''

    if (type === 'events') {
      const { data } = await supabase.from('events').select('*').order('date')
      headers = ['שם אירוע','תאריך','שעה','סוג','אולם','תיאור','הערות לצוות','מחלקות']
      rows = (data||[]).map(e => [
        e.title,
        fmtDate(e.date),
        e.time?.slice(0,5) || '',
        e.type,
        e.venue || '',
        e.description || '',
        e.crew_notes || '',
        (e.depts||[]).join(', '),
      ])
      sheetName = 'אירועים'; fileName = 'hazira_events'
    }

    else if (type === 'tasks') {
      const { data } = await supabase
        .from('tasks')
        .select('*, crew:crew_member_id(full_name)')
        .order('done').order('created_at', { ascending: false })
      headers = ['משימה','עדיפות','סטטוס','משויך ל','מחלקה','תאריך יצירה']
      rows = (data||[]).map(t => [
        t.title,
        t.priority,
        t.done ? 'הושלם ✓' : 'פתוח',
        t.crew?.full_name || '',
        t.dept || '',
        fmtDate(t.created_at?.slice(0,10)),
      ])
      sheetName = 'משימות'; fileName = 'hazira_tasks'
    }

    else if (type === 'crew') {
      const { data } = await supabase
        .from('crew_members').select('*').eq('active', true).order('full_name')
      headers = ['שם מלא','תפקיד','מחלקה','טלפון','אימייל','הערות']
      rows = (data||[]).map(c => [
        c.full_name, c.role||'', c.dept||'', c.phone||'', c.email||'', c.notes||''
      ])
      sheetName = 'צוות'; fileName = 'hazira_crew'
    }

    else if (type === 'equipment') {
      const { data } = await supabase
        .from('equipment_items')
        .select('*, sub:subcategory_id(name, cat:category_id(name))')
        .order('name')
      headers = ['קטגוריה','קטגוריית משנה','פריט','כמות','פרטים','מיקום']
      rows = (data||[]).map(i => [
        i.sub?.cat?.name||'', i.sub?.name||'', i.name,
        i.units||'', i.details||'', i.location||''
      ])
      sheetName = 'ציוד'; fileName = 'hazira_equipment'
    }

    else if (type === 'storage') {
      const { data } = await supabase.from('storage_items').select('*').order('name')
      headers = ['פריט','מיקום','הערות']
      rows = (data||[]).map(s => [s.name, s.location||'', s.notes||''])
      sheetName = 'אכסון'; fileName = 'hazira_storage'
    }

    else if (type === 'messages') {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:sender_id(full_name)')
        .order('created_at', { ascending: false })
      headers = ['הודעה','שולח','עדיפות','נמען','תאריך']
      rows = (data||[]).map(m => [
        m.body,
        m.sender?.full_name||'',
        m.priority||'',
        m.to_dept === 'all' ? 'כולם' : m.to_dept||'',
        fmtDate(m.created_at?.slice(0,10)),
      ])
      sheetName = 'הודעות'; fileName = 'hazira_messages'
    }

    const { wb, ws } = buildStyledSheet(headers, rows)
    download(wb, ws, sheetName, fileName)

    setLoading(null); setDone(type)
    setTimeout(() => setDone(null), 3000)
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="text-[14px] font-semibold text-gray-800 mb-1">ייצוא לאקסל</div>
        <div className="text-[12px] text-gray-400">
          כל קובץ מיוצא עם כותרת מעוצבת, שורות מסורגות, עמודות מותאמות ו-RTL
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {EXPORTS.map(exp => (
          <button key={exp.id}
            onClick={() => exportData(exp.id)}
            disabled={!!loading}
            className={`bg-white border rounded-xl p-4 flex flex-col items-center gap-3 transition-all hover:border-[#CC1010] hover:shadow-sm disabled:cursor-not-allowed ${
              done === exp.id
                ? 'border-[#085041] bg-[#E1F5EE]'
                : loading === exp.id
                ? 'border-[#CC1010] bg-[#FDEAEA]'
                : 'border-gray-100'
            }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              done === exp.id ? 'bg-[#E1F5EE]' :
              loading === exp.id ? 'bg-[#FDEAEA]' : 'bg-[#FDEAEA]'
            }`}>
              {loading === exp.id ? (
                <i className="ti ti-loader-2 animate-spin text-[#CC1010]" style={{fontSize:22}}/>
              ) : done === exp.id ? (
                <i className="ti ti-circle-check text-[#085041]" style={{fontSize:22}}/>
              ) : (
                <i className={`ti ${exp.icon} text-[#CC1010]`} style={{fontSize:22}}/>
              )}
            </div>
            <div className="text-center">
              <div className="text-[13px] font-medium text-gray-800">{exp.label}</div>
              <div className={`text-[11px] mt-0.5 ${done===exp.id?'text-[#085041]':loading===exp.id?'text-[#CC1010]':'text-gray-400'}`}>
                {loading === exp.id ? 'מייצא...' : done === exp.id ? '✅ הורד בהצלחה' : 'לחץ לייצוא'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
