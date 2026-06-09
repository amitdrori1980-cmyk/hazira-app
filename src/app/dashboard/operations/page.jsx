'use client'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

export default function OperationsPage() {
  const [tab, setTab] = useState('team')
  const [crew, setCrew] = useState([])
  const [importingCrew, setImportingCrew] = useState(false)
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedCrew, setSelectedCrew] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [newMember, setNewMember] = useState({ first_name: '', last_name: '', role1: '', role2: '', role3: '', email: '', password: '' })
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
  const [shiftNotes, setShiftNotes] = useState({})
  const [savingShift, setSavingShift] = useState(false)
  const [openInq, setOpenInq] = useState(null)
  const [teamSubTab, setTeamSubTab] = useState('inquiry')
  const [boardRows, setBoardRows] = useState([])
  const [boardSlots, setBoardSlots] = useState([])
  const [showEvents, setShowEvents] = useState([])
  const [boardAddFor, setBoardAddFor] = useState(false)
  const [boardImportSearch, setBoardImportSearch] = useState('')
  const [boardManual, setBoardManual] = useState({ event_name: '', date: '' })
  const [boardRange, setBoardRange] = useState({ from: '', to: '' })
  const [colorMenu, setColorMenu] = useState(null)

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
    const { data: brows } = await supabase.from('operations_board_rows').select('*').is('deleted_at', null).order('date')
    const { data: bslots } = await supabase.from('operations_board_slots').select('*').order('position')
    const { data: showEv } = await supabase.from('events').select('id,title,date,time,type').eq('type', 'show').order('date')
    setBoardRows(brows || [])
    setBoardSlots(bslots || [])
    setShowEvents(showEv || [])
    const { data: sn } = await supabase.from('operations_shift_event_notes').select('*')
    const snMap = {}; (sn || []).forEach(r => { snMap[r.event_key] = r.notes })
    setShiftNotes(snMap)
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

  function memberFields(m) {
    const parts = (m.full_name || '').trim().split(' ')
    const roles = (m.role || '').split(',').map(s => s.trim())
    return { first: parts[0] || '', last: parts.slice(1).join(' '), r1: roles[0] || '', r2: roles[1] || '', r3: roles[2] || '' }
  }
  function composeMember(f) {
    return {
      full_name: [f.first, f.last].map(s => (s || '').trim()).filter(Boolean).join(' '),
      role: [f.r1, f.r2, f.r3].map(s => (s || '').trim()).filter(Boolean).join(', ')
    }
  }
  function editMember(id, key, value) {
    setCrew(prev => prev.map(m => {
      if (m.id !== id) return m
      const f = memberFields(m); f[key] = value
      return { ...m, ...composeMember(f) }
    }))
  }
  async function persistMember(m) {
    await supabase.from('operations_crew').update({ full_name: m.full_name, role: m.role }).eq('id', m.id)
  }

  async function addMember() {
    const full_name = [newMember.first_name, newMember.last_name].map(s => s.trim()).filter(Boolean).join(' ')
    const role = [newMember.role1, newMember.role2, newMember.role3].map(s => s.trim()).filter(Boolean).join(', ')
    if (!full_name || !newMember.email || !newMember.password) return alert('שם, מייל וסיסמה הם שדות חובה')
    setAdding(true)
    const res = await fetch('/api/create-crew-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, role, email: newMember.email, password: newMember.password })
    })
    const json = await res.json()
    if (json.error) { alert('שגיאה: ' + json.error) }
    else { setCrew(prev => [...prev, json.member]); setNewMember({ first_name: '', last_name: '', role1: '', role2: '', role3: '', email: '', password: '' }) }
    setAdding(false)
  }

  async function removeMember(id) {
    if (!confirm('להסיר מהרשימה?')) return
    await supabase.from('operations_crew').update({ active: false }).eq('id', id)
    setCrew(prev => prev.filter(c => c.id !== id))
  }

  async function importCrewExcel(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setImportingCrew(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).filter(r => r.some(c => String(c).trim() !== ''))
      if (rows.length < 2) { alert('הקובץ ריק או חסר נתונים'); setImportingCrew(false); return }
      const header = rows[0].map(h => String(h).trim())
      let ci = {
        first: header.findIndex(h => h.includes('שם') && !h.includes('משפחה')),
        last: header.findIndex(h => h.includes('משפחה')),
        r1: header.findIndex(h => h.includes('תפקיד 1') || h === 'תפקיד'),
        r2: header.findIndex(h => h.includes('תפקיד 2')),
        r3: header.findIndex(h => h.includes('תפקיד 3')),
        email: header.findIndex(h => h.includes('מייל') || h.includes('אימייל') || h.toLowerCase().includes('mail')),
        password: header.findIndex(h => h.includes('סיסמה') || h.toLowerCase().includes('pass'))
      }
      let dataRows
      if (ci.email === -1 || ci.first === -1) { ci = { first: 0, last: 1, r1: 2, r2: 3, r3: 4, email: 5, password: 6 }; dataRows = rows }
      else { dataRows = rows.slice(1) }
      const get = (r, i) => i >= 0 ? String(r[i] || '').trim() : ''
      const allEmails = dataRows.map(r => get(r, ci.email)).filter(Boolean)
      const { data: existingRows } = await supabase.from('operations_crew').select('*').in('email', allEmails)
      const byEmail = {}; (existingRows || []).forEach(m => { if (m.email) byEmail[m.email.toLowerCase()] = m })
      let ok = 0, reactivated = 0, skipped = 0
      const added = []
      const failed = []
      for (const r of dataRows) {
        const full_name = [get(r, ci.first), get(r, ci.last)].filter(Boolean).join(' ')
        const role = [get(r, ci.r1), get(r, ci.r2), get(r, ci.r3)].filter(Boolean).join(', ')
        const email = get(r, ci.email), password = get(r, ci.password)
        if (!full_name || !email || !password) { skipped++; continue }
        const ex = byEmail[email.toLowerCase()]
        if (ex) {
          const { data: upd, error: uerr } = await supabase.from('operations_crew').update({ active: true, full_name, role }).eq('id', ex.id).select().single()
          if (uerr) failed.push(full_name + ' — ' + uerr.message)
          else { added.push(upd); reactivated++ }
          continue
        }
        try {
          const res = await fetch('/api/create-crew-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name, role, email, password }) })
          const json = await res.json()
          if (json.error) failed.push(full_name + ' — ' + String(json.error))
          else { added.push(json.member); ok++ }
        } catch (err) { failed.push(full_name + ' — שגיאת רשת') }
      }
      if (added.length) setCrew(prev => { const map = {}; prev.forEach(m => map[m.id] = m); added.forEach(m => map[m.id] = m); return Object.values(map) })
      let summary = 'יובאו ' + ok + ' אנשי צוות חדשים.'
      if (reactivated) summary += ' ' + reactivated + ' קיימים עודכנו/הופעלו מחדש.'
      if (skipped) summary += ' דולגו ' + skipped + ' (שורות ללא שם/מייל/סיסמה).'
      if (failed.length) summary += '\n\nנכשלו ' + failed.length + ':\n' + failed.map(x => '• ' + x).join('\n')
      alert(summary)
    } catch (err) {
      alert('שגיאה בקריאת הקובץ: ' + err.message)
    }
    setImportingCrew(false)
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

  async function deleteShiftGroup(items) {
    if (!confirm('למחוק את כל העובדים של האירוע מהסידור?')) return
    const ids = items.map(s => s.id)
    await supabase.from('operations_shifts').delete().in('id', ids)
    setShifts(prev => prev.filter(s => !ids.includes(s.id)))
  }

  async function saveShiftNote(key, notes) {
    setShiftNotes(prev => ({ ...prev, [key]: notes }))
    await supabase.from('operations_shift_event_notes').upsert({ event_key: key, notes, updated_at: new Date().toISOString() }, { onConflict: 'event_key' })
  }

  async function transferToShifts(row) {
    const selectedSlots = boardSlots.filter(s => s.row_id === row.id && s.selected && s.member_id)
    if (!selectedSlots.length) { alert('לא נבחרו אנשי צוות. סמן "הוספה לסידור" במשבצות שתרצה להעביר.'); return }
    const sameEvent = s => row.event_id ? s.event_id === row.event_id : (s.event_title === row.event_name && s.event_date === row.date)
    const existing = shifts.filter(sameEvent)
    const stale = existing.filter(s => s.event_title !== row.event_name || s.event_date !== row.date)
    if (stale.length) {
      await supabase.from('operations_shifts').update({ event_title: row.event_name, event_date: row.date }).in('id', stale.map(s => s.id))
      setShifts(prev => prev.map(s => stale.some(x => x.id === s.id) ? { ...s, event_title: row.event_name, event_date: row.date } : s))
    }
    const existingMembers = new Set(existing.map(s => s.member_id))
    const roleLabel = cat => cat === 'bar' ? 'בר / קופה' : cat === 'evening' ? 'ניהול ערב' : 'אחר'
    const toInsert = selectedSlots.filter(s => !existingMembers.has(s.member_id)).map(s => ({
      event_id: row.event_id, event_title: row.event_name, event_date: row.date, member_id: s.member_id, role: roleLabel(s.category)
    }))
    if (!toInsert.length) { alert('כל הנבחרים כבר נמצאים בסידור העבודה לאירוע הזה.'); return }
    const { data, error } = await supabase.from('operations_shifts').insert(toInsert).select()
    if (error) { alert('שגיאה: ' + error.message); return }
    if (data) setShifts(prev => [...prev, ...data])
    alert('הועברו ' + toInsert.length + ' אנשי צוות לסידור העבודה.')
  }

  async function updateShiftRole(id, role) {
    await supabase.from('operations_shifts').update({ role }).eq('id', id)
    setShifts(prev => prev.map(s => s.id === id ? { ...s, role } : s))
  }

  async function updateShiftNotes(id, notes) {
    await supabase.from('operations_shifts').update({ notes }).eq('id', id)
    setShifts(prev => prev.map(s => s.id === id ? { ...s, notes } : s))
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

  const BOARD_CATS = [{ key: 'bar', label: 'בר / קופה', min: 5, w: 'w-full md:w-[420px]' }, { key: 'evening', label: 'ניהול ערב', min: 4, w: 'w-full md:w-[348px]' }, { key: 'other', label: 'אחר', min: 2, w: 'w-full md:w-[196px]' }]

  function catForRole(role) {
    const r = (role || '')
    if (r.includes('ניהול') || r.includes('ערב')) return 'evening'
    if (r.includes('קופ') || r.includes('בר')) return 'bar'
    return null
  }

  function roleSlotsFor(rowId) {
    const byCat = { bar: [], evening: [] }
    crew.forEach(c => { const cat = catForRole(c.role); if (cat) byCat[cat].push(c) })
    const slots = []
    Object.keys(byCat).forEach(cat => byCat[cat].forEach((c, i) => slots.push({ row_id: rowId, category: cat, position: i, member_id: c.id, status: 'none', selected: false })))
    return slots
  }

  async function autoFillRowSlots(rowIds) {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds]
    const slotRows = ids.flatMap(id => roleSlotsFor(id))
    if (!slotRows.length) return
    const { data } = await supabase.from('operations_board_slots').insert(slotRows).select()
    if (data) setBoardSlots(prev => [...prev, ...data])
  }

  async function fillRowsByRoles(rowIds) {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds]
    const toInsert = []
    ids.forEach(rowId => {
      const existing = boardSlots.filter(s => s.row_id === rowId)
      crew.forEach(c => {
        const cat = catForRole(c.role)
        if (!cat) return
        if (existing.some(s => s.category === cat && s.member_id === c.id)) return
        const pos = existing.filter(s => s.category === cat).length + toInsert.filter(s => s.row_id === rowId && s.category === cat).length
        toInsert.push({ row_id: rowId, category: cat, position: pos, member_id: c.id, status: 'none', selected: false })
      })
    })
    if (!toInsert.length) return 0
    const { data } = await supabase.from('operations_board_slots').insert(toInsert).select()
    if (data) setBoardSlots(prev => [...prev, ...data])
    return toInsert.length
  }

  async function fillAllByRoles() {
    if (!boardRows.length) return
    const n = await fillRowsByRoles(boardRows.map(r => r.id))
    if (!n) alert('כל הצוות כבר משובץ בקטגוריות לפי התפקידים')
  }

  async function addBoardRow({ event_id = null, event_name, date = null, time = '' }) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('operations_board_rows').insert({
      event_id, event_name, date, time, bar_open_time: '', created_by: user?.id
    }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return }
    if (data) { setBoardRows(prev => [...prev, data]); await autoFillRowSlots(data.id) }
    setBoardAddFor(false); setBoardImportSearch(''); setBoardManual({ event_name: '', date: '' })
  }

  async function addBoardRange() {
    const { from, to } = boardRange
    if (!from || !to) return
    const lo = from <= to ? from : to
    const hi = from <= to ? to : from
    const existingIds = new Set(boardRows.map(r => r.event_id).filter(Boolean))
    const toAdd = showEvents.filter(ev => ev.date && ev.date >= lo && ev.date <= hi && !existingIds.has(ev.id))
    if (toAdd.length === 0) { alert('אין מופעים חדשים בטווח'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const rows = toAdd.map(ev => ({ event_id: ev.id, event_name: ev.title, date: ev.date, time: ev.time || '', bar_open_time: '', created_by: user?.id }))
    const { data, error } = await supabase.from('operations_board_rows').insert(rows).select()
    if (error) { alert('שגיאה: ' + error.message); return }
    if (data) { setBoardRows(prev => [...prev, ...data]); await autoFillRowSlots(data.map(r => r.id)) }
    setBoardAddFor(false); setBoardRange({ from: '', to: '' })
  }

  async function updateBoardRow(id, field, value) {
    await supabase.from('operations_board_rows').update({ [field]: value }).eq('id', id)
    setBoardRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function deleteBoardRow(id) {
    if (!confirm('למחוק שורה זו?')) return
    await supabase.from('operations_board_rows').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setBoardRows(prev => prev.filter(r => r.id !== id))
  }

  async function sendRowToCrew(row) {
    const val = !row.sent_to_crew
    const ts = val ? new Date().toISOString() : null
    await supabase.from('operations_board_rows').update({ sent_to_crew: val, sent_at: ts }).eq('id', row.id)
    setBoardRows(prev => prev.map(r => r.id === row.id ? { ...r, sent_to_crew: val, sent_at: ts } : r))
  }

  async function addSlot(rowId, category) {
    const pos = boardSlots.filter(s => s.row_id === rowId && s.category === category).length
    const { data, error } = await supabase.from('operations_board_slots').insert({
      row_id: rowId, category, position: pos, member_id: null, status: 'none', selected: false
    }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return }
    if (data) setBoardSlots(prev => [...prev, data])
  }

  async function setSlotMember(slotId, memberId) {
    const mid = memberId || null
    await supabase.from('operations_board_slots').update({ member_id: mid, status: 'none', selected: false }).eq('id', slotId)
    setBoardSlots(prev => prev.map(s => s.id === slotId ? { ...s, member_id: mid, status: 'none', selected: false } : s))
  }

  async function removeSlot(slotId) {
    await supabase.from('operations_board_slots').delete().eq('id', slotId)
    setBoardSlots(prev => prev.filter(s => s.id !== slotId))
  }

  async function setSlotStatus(slotId, status) {
    await supabase.from('operations_board_slots').update({ status }).eq('id', slotId)
    setBoardSlots(prev => prev.map(s => s.id === slotId ? { ...s, status } : s))
  }

  async function toggleSelected(slot) {
    const val = !slot.selected
    await supabase.from('operations_board_slots').update({ selected: val }).eq('id', slot.id)
    setBoardSlots(prev => prev.map(s => s.id === slot.id ? { ...s, selected: val } : s))
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

        <button onClick={() => setTab('board')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'board' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          שיבוץ תפעול
        </button>
        <button onClick={() => setTab('summary')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'summary' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          סיכום ערב
        </button>
          <button onClick={() => setTab('shifts')}
            className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'shifts' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
            סידור עבודה
          </button>
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

      {tab === 'board' && (
        <div>
          {isManager && (
            <div className="mb-4">
              {!boardAddFor ? (
                <div className="flex items-center gap-2 flex-row-reverse">
                  <button onClick={() => setBoardAddFor(true)}
                    className="bg-[#E0197D] text-white text-[13px] px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
                    <i className="ti ti-plus" style={{fontSize:14}}/> הוסף שורה
                  </button>
                  {boardRows.length > 0 && (
                    <button onClick={fillAllByRoles}
                      className="text-[13px] px-4 py-2 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center gap-1">
                      <i className="ti ti-users" style={{fontSize:14}}/> מלא צוות לפי תפקידים
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl p-4 max-w-lg">
                  <div className="flex items-center justify-between mb-3 flex-row-reverse">
                    <div className="text-[13px] font-medium text-gray-700">הוסף שורה</div>
                    <button onClick={() => setBoardAddFor(false)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{fontSize:16}}/></button>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1 text-right">מתוך אירועי מופע</div>
                  <input value={boardImportSearch} onChange={e => setBoardImportSearch(e.target.value)}
                    placeholder="חיפוש מופע..." dir="rtl"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2"/>
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1 mb-4">
                    {showEvents.filter(ev => !boardImportSearch || (ev.title || '').includes(boardImportSearch)).map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg flex-row-reverse">
                        <div className="flex-1 text-right min-w-0">
                          <div className="text-[13px] text-gray-800 truncate">{ev.title}</div>
                          <div className="text-[11px] text-gray-400">{fmtDate(ev.date)}</div>
                        </div>
                        <button onClick={() => addBoardRow({ event_id: ev.id, event_name: ev.title, date: ev.date, time: ev.time || '' })}
                          className="text-[12px] bg-[#E0197D] text-white px-3 py-1.5 rounded-lg flex-shrink-0 hover:bg-[#A0106A]">הוסף</button>
                      </div>
                    ))}
                    {showEvents.length === 0 && <div className="text-center text-[12px] text-gray-400 py-3">אין אירועי מופע</div>}
                  </div>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1 text-right">או כל המופעים בטווח תאריכים</div>
                  <div className="flex items-center gap-2 mb-2 flex-row-reverse">
                    <span className="text-[11px] text-gray-400">מ-</span>
                    <input type="date" value={boardRange.from} onChange={e => setBoardRange(v => ({ ...v, from: e.target.value }))} className="flex-1 text-sm px-2 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D]"/>
                    <span className="text-[11px] text-gray-400">עד</span>
                    <input type="date" value={boardRange.to} onChange={e => setBoardRange(v => ({ ...v, to: e.target.value }))} className="flex-1 text-sm px-2 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D]"/>
                  </div>
                  <button onClick={addBoardRange} disabled={!boardRange.from || !boardRange.to}
                    className="w-full text-[13px] bg-[#E0197D] text-white py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50 mb-4">הוסף את כל המופעים בטווח</button>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1 text-right">או הוספה ידנית</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input value={boardManual.event_name} onChange={e => setBoardManual(v => ({ ...v, event_name: e.target.value }))} placeholder="שם אירוע" dir="rtl" className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] text-right"/>
                    <input type="date" value={boardManual.date} onChange={e => setBoardManual(v => ({ ...v, date: e.target.value }))} className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D]"/>
                  </div>
                  <button onClick={() => boardManual.event_name.trim() && addBoardRow({ event_name: boardManual.event_name.trim(), date: boardManual.date || null })}
                    className="w-full text-[13px] border border-[#E0197D] text-[#E0197D] py-2 rounded-lg hover:bg-[#FCE4F3]">הוסף ידנית</button>
                </div>
              )}
            </div>
          )}

          {(() => {
            const rows = isManager ? boardRows : boardRows.filter(r => r.sent_to_crew && boardSlots.some(s => s.row_id === r.id && s.member_id === myMember?.id))
            if (rows.length === 0) return <div className="text-center text-[13px] text-gray-400 py-8">{isManager ? 'אין שורות — לחץ "הוסף שורה"' : 'אין שיבוצים עבורך'}</div>
            return rows.map(row => (
              <div key={row.id} className="bg-white border border-black/20 rounded-xl overflow-x-auto mb-3">
                <div className="flex flex-col md:flex-row md:items-stretch w-full md:w-max md:min-w-full text-[12px]">
                  <div className="md:sticky md:right-0 z-10 bg-white px-4 py-2.5 border-b-2 md:border-b-0 md:border-l-2 border-gray-200 w-full md:w-auto md:min-w-[360px] flex items-center justify-between gap-2">
                    <div className="text-right min-w-0">
                      <div className="text-[14px] font-semibold text-gray-800 truncate">{row.event_name}</div>
                      <div className="text-[12px] text-gray-500 flex gap-2 justify-end items-center flex-wrap mt-0.5">
                        {row.date && <span className="whitespace-nowrap">{fmtDate(row.date)}</span>}
                        {isManager ? (
                          <input value={row.time || ''} onChange={e => updateBoardRow(row.id, 'time', e.target.value)} placeholder="שעה" dir="rtl"
                            className="w-12 text-center bg-gray-50 rounded outline-none focus:bg-gray-100 text-[12px]"/>
                        ) : (row.time && <span className="whitespace-nowrap">{row.time}</span>)}
                      </div>
                      {isManager && (
                        <div className="flex flex-col gap-1.5 mt-1.5 items-end">
                          <button onClick={() => sendRowToCrew(row)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 w-max ${row.sent_to_crew ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3]'}`}>
                            <i className={`ti ${row.sent_to_crew ? 'ti-check' : 'ti-send'}`} style={{fontSize:12}}/> {row.sent_to_crew ? 'נשלח לצוות' : 'שלח לצוות'}
                          </button>
                          <button onClick={() => transferToShifts(row)}
                            className="text-[11px] bg-[#E0197D] text-white px-2.5 py-1 rounded-lg hover:bg-[#A0106A] flex items-center gap-1 w-max">
                            <i className="ti ti-arrow-left" style={{fontSize:12}}/> העבר לסידור עבודה
                          </button>
                        </div>
                      )}
                    </div>
                    {isManager && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => fillRowsByRoles(row.id)} title="מלא צוות לפי תפקידים" className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-users-plus" style={{fontSize:14}}/></button>
                        <button onClick={() => deleteBoardRow(row.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button>
                      </div>
                    )}
                  </div>
                  {BOARD_CATS.map(cat => {
                    const allSlots = boardSlots.filter(s => s.row_id === row.id && s.category === cat.key).sort((a, b) => a.position - b.position)
                    const slots = isManager ? allSlots : allSlots.filter(s => myMember && s.member_id === myMember.id)
                    if (!isManager && slots.length === 0) return null
                    const pad = isManager ? Math.max(0, cat.min - allSlots.length) : 0
                    return (
                      <div key={cat.key} className={`px-4 py-2.5 border-b md:border-b-0 md:border-l-2 border-gray-200 md:flex-shrink-0 ${isManager ? cat.w : 'w-full md:w-auto'}`}>
                        <div className="text-[11px] font-semibold text-gray-400 text-right mb-1.5">{cat.label}</div>
                        <div className="flex flex-row-reverse flex-wrap gap-1.5 justify-start">
                          {slots.map(slot => {
                            const member = crew.find(c => c.id === slot.member_id)
                            const canOpen = isManager || (myMember && slot.member_id === myMember.id)
                            const bg = slot.status === 'approved' ? 'bg-yellow-200 text-yellow-900'
                              : slot.status === 'rejected' ? 'bg-red-200 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                            return (
                              <button key={slot.id} disabled={!canOpen} onClick={() => setColorMenu(slot)}
                                className={`w-[56px] md:w-[72px] text-center truncate px-1 py-1 rounded text-[14px] ${bg} ${slot.selected ? 'ring-2 ring-[#E0197D]' : ''} ${canOpen ? 'hover:opacity-80' : ''}`}>
                                {member ? member.full_name.split(' ')[0] : 'בחר'}
                              </button>
                            )
                          })}
                          {Array.from({ length: pad }).map((_, i) => (
                            <button key={'ph' + i} onClick={() => addSlot(row.id, cat.key)}
                              className="w-[56px] md:w-[72px] text-center px-1 py-1 rounded text-[14px] border border-dashed border-gray-300 text-gray-300 hover:border-[#E0197D] hover:text-[#E0197D]">+</button>
                          ))}
                          {isManager && pad === 0 && (
                            <button onClick={() => addSlot(row.id, cat.key)}
                              className="w-[56px] md:w-[72px] text-center px-1 py-1 rounded text-[14px] border border-dashed border-gray-300 text-gray-400 hover:border-[#E0197D] hover:text-[#E0197D]">+</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div className="px-4 py-2.5 w-full md:w-auto md:flex-1 md:min-w-[220px]">
                    <div className="text-[11px] font-semibold text-gray-400 text-right mb-1.5">הערות</div>
                    {isManager ? (
                      <textarea key={row.id + '-bnotes'} defaultValue={row.notes || ''} onBlur={e => updateBoardRow(row.id, 'notes', e.target.value)}
                        placeholder="הערות חופשי..." rows={2} dir="rtl"
                        className="w-full text-[13px] px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] resize-none bg-gray-50 text-right"/>
                    ) : (row.notes && <div className="text-[13px] text-gray-600 text-right whitespace-pre-wrap">{row.notes}</div>)}
                  </div>
                </div>
              </div>
            ))
          })()}

          {colorMenu && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setColorMenu(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()} dir="rtl">
                <div className="text-[13px] font-semibold text-gray-700 text-center mb-4">
                  {crew.find(c => c.id === colorMenu.member_id)?.full_name || 'משבצת ריקה'}
                </div>
                {isManager && (
                  <div className="mb-4">
                    <div className="text-[11px] text-gray-400 mb-1">שיוך אדם</div>
                    <select value={colorMenu.member_id || ''} onChange={e => { const v = e.target.value || null; setSlotMember(colorMenu.id, e.target.value); setColorMenu(m => ({ ...m, member_id: v, status: 'none', selected: false })) }}
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
                      <option value="">בחר...</option>
                      {crew.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                )}
                {(isManager || (myMember && colorMenu.member_id === myMember.id)) && (
                  <>
                    <div className="flex justify-center gap-5 mb-1">
                      <button onClick={() => { setSlotStatus(colorMenu.id, 'approved'); setColorMenu(null) }} title="יכולה"
                        className="w-12 h-12 rounded-full bg-yellow-400 border-2 border-yellow-500 hover:scale-110 transition-transform"/>
                      <button onClick={() => { setSlotStatus(colorMenu.id, 'rejected'); setColorMenu(null) }} title="לא יכולה"
                        className="w-12 h-12 rounded-full bg-red-500 border-2 border-red-600 hover:scale-110 transition-transform"/>
                      <button onClick={() => { setSlotStatus(colorMenu.id, 'none'); setColorMenu(null) }} title="נקה"
                        className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 hover:scale-110 transition-transform"/>
                    </div>
                    <div className="flex justify-center gap-5 text-[10px] text-gray-400">
                      <span className="w-12 text-center">יכולה</span>
                      <span className="w-12 text-center">לא יכולה</span>
                      <span className="w-12 text-center">נקה</span>
                    </div>
                  </>
                )}
                {isManager && (
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { toggleSelected(colorMenu); setColorMenu(m => ({ ...m, selected: !m.selected })) }}
                      className={`flex-1 text-[12px] py-2 rounded-lg border ${colorMenu.selected ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'text-gray-500 border-gray-300'}`}>
                      {colorMenu.selected ? '✓ נוסף לסידור' : 'הוספה לסידור'}
                    </button>
                  </div>
                )}
                <button onClick={() => setColorMenu(null)} className="w-full mt-3 text-[12px] text-gray-400 hover:text-gray-600">שמירה</button>
              </div>
            </div>
          )}
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
        </div>
      )}

      {tab === 'shifts' && (
        <div className="max-w-5xl">
          {(() => {
            const grouped = {}
            shifts.forEach(s => {
              const key = s.event_id || (s.event_title + '|' + s.event_date)
              if (!grouped[key]) grouped[key] = { key, event_title: s.event_title, event_date: s.event_date, items: [] }
              grouped[key].items.push(s)
            })
            const groups = Object.values(grouped).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            if (groups.length === 0) return <div className="text-center text-[13px] text-gray-400 py-8">אין סידור עבודה עדיין. בחר נבחרים בשיבוץ תפעול ולחץ "העבר לסידור עבודה"</div>
            return groups.map((g, gi) => (
              <div key={gi} className="bg-white border border-black/20 shadow-sm rounded-xl overflow-hidden mb-5">
                <div dir="rtl" className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <div className="text-right flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800">{g.event_title}</div>
                    <div className="text-[11px] text-gray-400">{(() => { if (!g.event_date) return ''; const [y,m,d] = g.event_date.split('-'); const HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']; return `${+d} ${HE[+m-1]} ${y}` })()}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-[11px] text-gray-400">{g.items.length} עובדים</div>
                    {isManager && (
                      <button onClick={() => { setSummary(v => ({ ...v, event_id: g.items[0]?.event_id || '', event_title: g.event_title, event_date: g.event_date })); setTab('summary') }}
                        className="text-[11px] border border-[#E0197D] text-[#E0197D] px-2.5 py-1 rounded-lg hover:bg-[#FCE4F3] flex items-center gap-1 whitespace-nowrap">
                        <i className="ti ti-clipboard-text" style={{fontSize:12}}/> סיכום אירוע
                      </button>
                    )}
                    {isManager && <button onClick={() => deleteShiftGroup(g.items)}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>}
                  </div>
                </div>
                {isManager ? (
                  <div className="px-3 pt-3">
                    <textarea key={g.key + '-evnotes'} defaultValue={shiftNotes[g.key] || ''} onBlur={e => saveShiftNote(g.key, e.target.value)}
                      placeholder="הערות כלליות לאירוע..." rows={2} dir="rtl"
                      className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] resize-none bg-gray-50 text-right"/>
                  </div>
                ) : (shiftNotes[g.key] && <div className="px-4 pt-3 text-[12px] text-gray-600 text-right whitespace-pre-wrap">{shiftNotes[g.key]}</div>)}
                <div className="overflow-x-auto">
                  <div dir="rtl" className="flex flex-wrap justify-start p-3 gap-3">
                    {g.items.map(s => (
                      <div key={s.id} className="flex flex-col items-stretch px-3 py-2.5 border border-black/15 shadow-sm rounded-xl w-[170px] relative">
                        {isManager && <button onClick={() => deleteShift(s.id)}
                          className="absolute top-1 left-1 text-gray-200 hover:text-red-500">
                          <i className="ti ti-x" style={{fontSize:11}}/>
                        </button>}
                        <div className="text-[12px] font-medium text-gray-700 text-right mb-2 mt-1 pl-4">
                          {crew.find(c=>c.id===s.member_id)?.full_name || '—'}
                        </div>
                        <select value={s.role || ''} onChange={e => updateShiftRole(s.id, e.target.value)}
                          className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] w-full text-right bg-gray-50" dir="rtl">
                          <option value="">תפקיד...</option>
                          <option value="בר">בר</option>
                          <option value="קופה">קופה</option>
                          <option value="ניהול ערב">ניהול ערב</option>
                        </select>
                        <textarea key={s.id + '-notes'} defaultValue={s.notes || ''} onBlur={e => updateShiftNotes(s.id, e.target.value)}
                          placeholder="הערות..." rows={2} dir="rtl"
                          className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg outline-none focus:border-[#E0197D] w-full resize-none mt-1 bg-gray-50"/>
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
        <div>
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-3 flex-row-reverse">
            <label className={`text-[13px] px-4 py-2 rounded-lg flex items-center gap-1.5 ${importingCrew ? 'bg-gray-200 text-gray-400' : 'bg-[#E0197D] text-white hover:bg-[#A0106A] cursor-pointer'}`}>
              <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> {importingCrew ? 'מייבא...' : 'ייבוא מאקסל'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importCrewExcel} disabled={importingCrew}/>
            </label>
            <div className="text-[12px] text-gray-400">{crew.length} אנשי צוות</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
            <table className="w-full text-[13px] text-right" dir="rtl">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[13px]">
                  <th className="px-3 py-2 font-semibold">שם</th>
                  <th className="px-3 py-2 font-semibold">שם משפחה</th>
                  <th className="px-3 py-2 font-semibold">תפקיד 1</th>
                  <th className="px-3 py-2 font-semibold">תפקיד 2</th>
                  <th className="px-3 py-2 font-semibold">תפקיד 3</th>
                  <th className="px-3 py-2 font-semibold">מייל</th>
                  <th className="px-3 py-2 font-semibold">סיסמה</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {crew.map(member => {
                  const f = memberFields(member)
                  return (
                    <tr key={member.id} className="border-t border-gray-100">
                      <td className="px-2 py-1"><input value={f.first} onChange={e => editMember(member.id, 'first', e.target.value)} onBlur={() => persistMember(member)} className="w-24 px-2 py-1 rounded outline-none focus:bg-gray-50 text-[13px]" dir="rtl"/></td>
                      <td className="px-2 py-1"><input value={f.last} onChange={e => editMember(member.id, 'last', e.target.value)} onBlur={() => persistMember(member)} className="w-24 px-2 py-1 rounded outline-none focus:bg-gray-50 text-[13px]" dir="rtl"/></td>
                      <td className="px-2 py-1"><input value={f.r1} onChange={e => editMember(member.id, 'r1', e.target.value)} onBlur={() => persistMember(member)} className="w-20 px-2 py-1 rounded outline-none focus:bg-gray-50 text-[13px]" dir="rtl"/></td>
                      <td className="px-2 py-1"><input value={f.r2} onChange={e => editMember(member.id, 'r2', e.target.value)} onBlur={() => persistMember(member)} className="w-20 px-2 py-1 rounded outline-none focus:bg-gray-50 text-[13px]" dir="rtl"/></td>
                      <td className="px-2 py-1"><input value={f.r3} onChange={e => editMember(member.id, 'r3', e.target.value)} onBlur={() => persistMember(member)} className="w-20 px-2 py-1 rounded outline-none focus:bg-gray-50 text-[13px]" dir="rtl"/></td>
                      <td className="px-3 py-1 text-gray-500 whitespace-nowrap">{member.email || '—'}</td>
                      <td className="px-3 py-1 text-gray-300">••••••</td>
                      <td className="px-2 py-1"><button onClick={() => removeMember(member.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{fontSize:13}}/></button></td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-2 py-1.5"><input value={newMember.first_name} onChange={e => setNewMember(v => ({ ...v, first_name: e.target.value }))} placeholder="שם" className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input value={newMember.last_name} onChange={e => setNewMember(v => ({ ...v, last_name: e.target.value }))} placeholder="שם משפחה" className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input value={newMember.role1} onChange={e => setNewMember(v => ({ ...v, role1: e.target.value }))} placeholder="תפקיד 1" className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input value={newMember.role2} onChange={e => setNewMember(v => ({ ...v, role2: e.target.value }))} placeholder="תפקיד 2" className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input value={newMember.role3} onChange={e => setNewMember(v => ({ ...v, role3: e.target.value }))} placeholder="תפקיד 3" className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input value={newMember.email} onChange={e => setNewMember(v => ({ ...v, email: e.target.value }))} placeholder="מייל *" className="w-40 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><input type="password" value={newMember.password} onChange={e => setNewMember(v => ({ ...v, password: e.target.value }))} placeholder="סיסמה *" className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-[#E0197D] text-[13px]" dir="rtl"/></td>
                  <td className="px-2 py-1.5"><button onClick={addMember} disabled={adding} className="text-[13px] bg-[#E0197D] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 whitespace-nowrap">{adding ? '...' : 'הוסף'}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 text-right">שם פרטי+משפחה והתפקידים נשמרים אוטומטית בעריכה. מייל וסיסמה נקבעים רק בהוספת איש צוות חדש.</div>
        </div>
        </div>
      )}
    </div>
  )
}
