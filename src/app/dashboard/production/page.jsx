'use client'
import { useEffect, useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import HaziraLogo from '@/components/HaziraLogo'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx-js-style'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

const STATUSES = [
  { value: 'white',  label: 'לא נבדק',    bg: 'bg-white',       text: 'text-gray-600',   ring: 'ring-gray-300',   dot: '#e5e7eb' },
  { value: 'green',  label: 'מוכן לבדיקה', bg: 'bg-green-100',   text: 'text-green-900',  ring: 'ring-green-400',  dot: '#22c55e' },
  { value: 'teal',   label: 'נשלח, ממתין', bg: 'bg-teal-100',    text: 'text-teal-900',   ring: 'ring-teal-400',   dot: '#14b8a6' },
  { value: 'yellow', label: 'אישר',        bg: 'bg-yellow-100',  text: 'text-yellow-900', ring: 'ring-yellow-400', dot: '#eab308' },
  { value: 'red',    label: 'לא יכול',     bg: 'bg-red-100',     text: 'text-red-900',    ring: 'ring-red-400',    dot: '#ef4444' },
  { value: 'purple', label: 'דורש בירור',  bg: 'bg-purple-100',  text: 'text-purple-900', ring: 'ring-purple-400', dot: '#a855f7' },
]
const getStatus = v => STATUSES.find(s => s.value === v) || STATUSES[0]
const DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const VENUES = ['אולם 1','אולם 2','אולם 3','אולם 4','אולם 5','תיאטרון הבית','דירה']
const SLOTS  = 10
function emptySlots() {
  return Array.from({length: SLOTS}, (_, i) => ({ slot: i, name: '', status: 'white' }))
}

function ProductionInquiries() {
  const router = useRouter()
  const [events, setEvents]       = useState([])
  const [slots, setSlots]         = useState({})
  const [openEvent, setOpenEvent] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent, setNewEvent]         = useState({ event_name:'', date:'', day:'', venue:'', type:'' })
  const [savingEvent, setSavingEvent]   = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [editEventVal, setEditEventVal] = useState({})
  const [statusPicker, setStatusPicker] = useState(null)
  const [colorMenu, setColorMenu] = useState(null)
  const [collapsedEvents, setCollapsedEvents] = useState({})
  const [didAutoOpen, setDidAutoOpen] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [calEvents, setCalEvents] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const [eventTypes, setEventTypes] = useState([])
  const [view, setView] = useState('active')
  const [archiveSearch, setArchiveSearch] = useState('')
  const [openMonths, setOpenMonths] = useState({})
  const [collapsedMonths, setCollapsedMonths] = useState({})
  const [notesDraft, setNotesDraft] = useState({})
  const dragId = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOver, setDragOver] = useState({ id: null, after: false })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncOrphans, setSyncOrphans] = useState([])
  const [syncSel, setSyncSel] = useState(new Set())
  const [syncBusy, setSyncBusy] = useState(false)
  const [printMode, setPrintMode] = useState(null)
  const [flashId, setFlashId] = useState(null)

  const getTypeStyle = v => { const t = eventTypes.find(t => t.value === v); return t ? t.color : 'bg-gray-100 text-gray-600' }
  const getTypeLabel = v => { const t = eventTypes.find(t => t.value === v); return t ? t.label : v }

  useEffect(() => { load() }, [])

  // פתיחה אוטומטית של אירוע מתוך ניהול אירועים (?inq=שם&date=...&venue=...)
  useEffect(() => {
    if (loading || didAutoOpen) return
    const params = new URLSearchParams(window.location.search)
    const inqName = params.get('inq')
    if (!inqName) return
    setDidAutoOpen(true)
    ;(async () => {
      const date = params.get('date') || null
      const venue = params.get('venue') || null
      let match = date
        ? events.find(e => e.event_name === inqName && e.date === date)
        : events.find(e => e.event_name === inqName)
      if (!match) {
        const day = date ? DAYS[new Date(date).getDay()] : null
        const { data } = await supabase.from('production_events').insert({
          event_name: inqName, date, day, venue,
        }).select().single()
        if (data) {
          setEvents(prev => [...prev, data].sort((a,b) => (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')))
          setSlots(prev => ({ ...prev, [data.id]: emptySlots() }))
          match = data
        }
      }
      if (match) {
        const mid = match.id
        setOpenEvent(mid)
        setFlashId(mid)
        if (match.date) setView(match.date < todayStr ? 'archive' : 'active')
        let tries = 0
        const tryScroll = () => {
          const el = document.getElementById('prod-ev-' + mid)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          else if (tries++ < 25) setTimeout(tryScroll, 100)
        }
        setTimeout(tryScroll, 120)
        setTimeout(() => setFlashId(null), 2800)
      }
    })()
  }, [loading, events, didAutoOpen])

  async function load() {
    const { data: evs } = await supabase.from('production_events').select('*')
    setEvents((evs || []).slice().sort((a, b) => (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')))
    const { data: ts } = await supabase.from('event_types').select('*').order('sort_order')
    setEventTypes(ts || [])
    if (ts && ts.length) setNewEvent(p => p.type ? p : { ...p, type: ts[0].value })
    if (evs?.length) {
      const { data: ppl } = await supabase.from('production_people').select('*').in('production_event_id', evs.map(e => e.id))
      const map = {}
      evs.forEach(e => { map[e.id] = emptySlots() })
      ;(ppl || []).forEach(p => {
        if (map[p.production_event_id] && p.slot < SLOTS) {
          map[p.production_event_id][p.slot] = { slot: p.slot, name: p.name || '', status: p.status || 'white' }
        }
      })
      setSlots(map)
    }
    setLoading(false)
  }

  async function addEvent() {
    if (!newEvent.event_name.trim()) return
    setSavingEvent(true)
    const { data } = await supabase.from('production_events').insert({
      event_name: newEvent.event_name.trim(), date: newEvent.date || null,
      day: newEvent.day || null, venue: newEvent.venue || null,
      type: newEvent.type || null,
    }).select().single()
    if (data) {
      setEvents(prev => [...prev, data].sort((a,b) => (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')))
      setSlots(prev => ({ ...prev, [data.id]: emptySlots() }))
      setNewEvent({ event_name:'', date:'', day:'', venue:'', type:'' })
      setShowNewEvent(false)
      setOpenEvent(data.id)
    }
    setSavingEvent(false)
  }

  async function openImport() {
    setShowImport(v => !v)
    setShowNewEvent(false)
    if (!calEvents.length) {
      setImportLoading(true)
      const { data } = await supabase.from('events').select('id, title, date, end_date, time, venue, type').order('date', { ascending: true })
      setCalEvents(data || [])
      setImportLoading(false)
    }
  }

  async function importFromCalendar(ce) {
    const name = (ce.title || '').trim()
    if (!name) return
    const exists = events.find(e => e.event_name === name && (!ce.date || e.date === ce.date))
    if (exists) {
      setShowImport(false)
      setOpenEvent(exists.id)
      setTimeout(() => document.getElementById('prod-ev-' + exists.id)?.scrollIntoView({ behavior:'smooth', block:'center' }), 200)
      return
    }
    const day = ce.date ? DAYS[new Date(ce.date).getDay()] : null
    const { data } = await supabase.from('production_events').insert({
      event_name: name, date: ce.date || null, day, venue: ce.venue || null,
    }).select().single()
    if (data) {
      setEvents(prev => [...prev, data].sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')))
      setSlots(prev => ({ ...prev, [data.id]: emptySlots() }))
      setShowImport(false)
      setOpenEvent(data.id)
      setTimeout(() => document.getElementById('prod-ev-' + data.id)?.scrollIntoView({ behavior:'smooth', block:'center' }), 250)
    }
  }

  async function syncEventToCalendarAndConstraints(ev) {
    const evSlots = slots[ev.id] || emptySlots()
    // רק מי שאישר (צהוב)
    const confirmed = evSlots.filter(s => s.status === 'yellow' && s.name.trim()).map(s => s.name.trim())
    const crewList = confirmed.length ? 'צוות: ' + confirmed.join(', ') : ''

    // בדיקה אם האירוע כבר קיים ביומן (לפי שם מנורמל + תאריך)
    const target = (ev.event_name || '').trim()
    let q = supabase.from('events').select('id, title')
    if (ev.date) q = q.eq('date', ev.date)
    const { data: existingRows } = await q
    const existing = (existingRows || []).find(r => (r.title || '').trim() === target)

    if (existing) {
      const { error } = await supabase.from('events').update({ crew_notes: crewList || null }).eq('id', existing.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('events').insert({
        title: ev.event_name,
        date: ev.date || null,
        time: null,
        type: ev.type || null,
        venue: ev.venue || null,
        crew_notes: crewList || null,
      })
      if (error) return { error: error.message }
    }

    // סנכרון ללוח האילוצים: כל מי שאישר (צהוב) -> שורת "נמצא" אמיתית בתאריך האירוע
    if (ev.date) {
      const evTag = ev.event_name || ''
      // הסרת שורות אוטומטיות קודמות של האירוע הזה (כדי שמי שכבר לא צהוב יוסר)
      await supabase.from('crew_constraints').delete()
        .eq('date', ev.date).eq('notes', evTag).eq('available', true).is('crew_member_id', null)
      // לא לכפול שם שכבר יש לו שורה באותו יום (ידנית או מאירוע אחר)
      const { data: dayRows } = await supabase.from('crew_constraints')
        .select('crew_name').eq('date', ev.date)
      const taken = new Set((dayRows || []).map(r => (r.crew_name || '').trim()))
      const toInsert = confirmed
        .filter(n => !taken.has(n))
        .map(n => ({ crew_member_id: null, crew_name: n, date: ev.date, available: true, notes: evTag }))
      if (toInsert.length) await supabase.from('crew_constraints').insert(toInsert)
    }
    return { confirmed: confirmed.length, created: !existing }
  }

  async function pushToCalendar(ev) {
    const r = await syncEventToCalendarAndConstraints(ev)
    if (r.error) return alert('שגיאה: ' + r.error)
    if (r.created) alert(`האירוע נוסף ליומן${r.confirmed ? ` עם ${r.confirmed} אנשי צוות שאישרו` : ''}!`)
    else alert(r.confirmed
      ? `האירוע כבר קיים ביומן — עודכנה רשימת הצוות (${r.confirmed} שאישרו).`
      : 'האירוע כבר קיים ביומן — אין כרגע מי שאישר, רשימת הצוות נוקתה.')
  }

  async function pushSelectedToCalendar() {
    if (!selectedIds.size) return
    const sel = events.filter(e => selectedIds.has(e.id))
    if (!window.confirm(`לעדכן ${sel.length} אירועים מסומנים — ליומן ולאילוצים?`)) return
    let ok = 0, created = 0, totalConfirmed = 0, errors = 0
    for (const ev of sel) {
      const r = await syncEventToCalendarAndConstraints(ev)
      if (r.error) errors++
      else { ok++; if (r.created) created++; totalConfirmed += (r.confirmed || 0) }
    }
    alert(`עודכנו ${ok} אירועים — ליומן ולאילוצים` + (created ? ` (${created} חדשים)` : '') + `, ובסך הכול ${totalConfirmed} אישורי צוות` + (errors ? `. ${errors} נכשלו.` : '.'))
  }

  async function syncWithCalendar() {
    if (!liveEvents.length) return
    setBulkBusy(true)
    const { data: cal } = await supabase.from('events').select('title, date')
    const calSet = new Set((cal || []).map(c => `${(c.title||'').trim()}|${c.date||''}`))
    const orphans = liveEvents.filter(ev => !calSet.has(`${(ev.event_name||'').trim()}|${ev.date||''}`))
    if (!orphans.length) { setBulkBusy(false); alert('הכל מסונכרן — אין אירועים להסרה.'); return }
    if (!window.confirm(`להסיר ${orphans.length} אירועים מההפקה הטכנית שאינם קיימים ביומן?`)) { setBulkBusy(false); return }
    const ts = new Date().toISOString()
    const ids = orphans.map(o => o.id)
    await supabase.from('production_events').update({ deleted_at: ts }).in('id', ids)
    setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, deleted_at: ts } : e))
    setBulkBusy(false)
    alert(`הוסרו ${orphans.length} אירועים מההפקה הטכנית.`)
  }

  async function pushActive(skipIds) {
    let ok = 0, created = 0
    for (const ev of activeEvents) {
      if (skipIds && skipIds.includes(ev.id)) continue
      const r = await syncEventToCalendarAndConstraints(ev)
      if (!r.error) { ok++; if (r.created) created++ }
    }
    return { ok, created }
  }
  async function syncAll() {
    if (!activeEvents.length && !liveEvents.length) return
    setBulkBusy(true)
    // איתור אירועים שאינם קיימים ביומן (כולל כאלה שנמחקו ממנו) — לפני כל דחיפה
    const { data: cal } = await supabase.from('events').select('title, date')
    const calSet = new Set((cal || []).map(c => `${(c.title||'').trim()}|${c.date||''}`))
    const orphans = liveEvents.filter(ev => !calSet.has(`${(ev.event_name||'').trim()}|${ev.date||''}`))
    if (!orphans.length) {
      const { ok, created } = await pushActive(null)
      setBulkBusy(false)
      alert(`סונכרן עם היומן: עודכנו ${ok} אירועים` + (created ? ` (${created} חדשים)` : '') + '. אין אירועים שנמחקו מהיומן.')
      return
    }
    setBulkBusy(false)
    setSyncOrphans(orphans)
    setSyncSel(new Set())
    setSyncOpen(true)
  }
  async function confirmSync() {
    setSyncBusy(true)
    const delIds = syncOrphans.filter(o => syncSel.has(o.id)).map(o => o.id)
    if (delIds.length) {
      const ts = new Date().toISOString()
      await supabase.from('production_events').update({ deleted_at: ts }).in('id', delIds)
      setEvents(prev => prev.map(e => delIds.includes(e.id) ? { ...e, deleted_at: ts } : e))
    }
    const { ok, created } = await pushActive(delIds)
    setSyncBusy(false)
    setSyncOpen(false)
    setSyncOrphans([])
    setSyncSel(new Set())
    alert(`סונכרן עם היומן: עודכנו ${ok} אירועים` + (created ? ` (${created} חדשים)` : '') + (delIds.length ? `, הוסרו ${delIds.length} שנמחקו מהיומן` : '') + '.')
  }

  async function pushAllToCalendar() {
    if (!activeEvents.length) return
    if (!window.confirm(`לעדכן את כל ${activeEvents.length} האירועים בהפקה הטכנית — ליומן ולאילוצים?`)) return
    setBulkBusy(true)
    let ok = 0, created = 0, totalConfirmed = 0, errors = 0
    for (const ev of activeEvents) {
      const r = await syncEventToCalendarAndConstraints(ev)
      if (r.error) errors++
      else { ok++; if (r.created) created++; totalConfirmed += (r.confirmed || 0) }
    }
    setBulkBusy(false)
    alert(`עודכנו ${ok} אירועים — ליומן ולאילוצים` + (created ? ` (${created} חדשים)` : '') + `, ובסך הכול ${totalConfirmed} אישורי צוות` + (errors ? `. ${errors} נכשלו.` : '.'))
  }

  async function saveEventEdit() {
    if (!editingEvent) return
    const old = events.find(e => e.id === editingEvent)
    await supabase.from('production_events').update(editEventVal).eq('id', editingEvent)
    // סנכרון השינוי ליומן ולאילוצים — לפי האירוע התואם (התאמה לפי שם+תאריך ישנים)
    if (old) {
      const oldName = (old.event_name || '').trim()
      const oldDate = old.date || null
      const newName = (editEventVal.event_name || '').trim()
      const newDate = editEventVal.date || null
      let q = supabase.from('events').select('id, title, date')
      if (oldDate) q = q.eq('date', oldDate)
      const { data: rows } = await q
      const match = (rows || []).find(r => (r.title || '').trim() === oldName)
      if (match) {
        const upd = { title: editEventVal.event_name, date: newDate }
        if (editEventVal.type) upd.type = editEventVal.type
        if (editEventVal.venue) upd.venue = editEventVal.venue
        await supabase.from('events').update(upd).eq('id', match.id)
      }
      if (oldDate && (oldName !== newName || oldDate !== newDate)) {
        await supabase.from('crew_constraints')
          .update({ notes: editEventVal.event_name, date: newDate })
          .eq('date', oldDate).eq('notes', old.event_name).eq('available', true).is('crew_member_id', null)
      }
    }
    setEvents(prev => prev.map(e => e.id === editingEvent ? { ...e, ...editEventVal } : e))
    setEditingEvent(null)
  }

  async function deleteEvent(id) {
    const ts = new Date().toISOString()
    const { error } = await supabase.from('production_events').update({ deleted_at: ts }).eq('id', id)
    if (error) { alert('שגיאה במחיקה: ' + error.message); return }
    // מחיקת שורת הצוות המקבילה ביומן + שורות "נמצא" אוטומטיות שהאירוע יצר באילוצים
    const ev = events.find(e => e.id === id)
    if (ev) {
      const target = (ev.event_name || '').trim()
      let q = supabase.from('events').select('id, title, crew_notes')
      if (ev.date) q = q.eq('date', ev.date)
      const { data: rows } = await q
      const match = (rows || []).find(r => (r.title || '').trim() === target)
      if (match && (match.crew_notes || '').startsWith('צוות:')) {
        await supabase.from('events').update({ crew_notes: null }).eq('id', match.id)
      }
      if (ev.date) {
        await supabase.from('crew_constraints').delete()
          .eq('date', ev.date).eq('notes', ev.event_name).eq('available', true).is('crew_member_id', null)
      }
    }
    setEvents(prev => prev.map(e => e.id === id ? { ...e, deleted_at: ts } : e))
    if (openEvent === id) setOpenEvent(null)
  }

  async function restoreEvent(id) {
    await supabase.from('production_events').update({ deleted_at: null }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, deleted_at: null } : e))
  }

  async function purgeEvent(id) {
    await supabase.from('production_people').delete().eq('production_event_id', id)
    await supabase.from('production_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setSlots(prev => { const n = {...prev}; delete n[id]; return n })
    if (openEvent === id) setOpenEvent(null)
  }

  async function updateSlotName(eventId, slotIdx, name) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], name }
      return { ...prev, [eventId]: updated }
    })
  }

  async function saveSlotName(eventId, slotIdx) {
    const slot = (slots[eventId] || emptySlots())[slotIdx]
    await supabase.from('production_people').upsert({
      production_event_id: eventId, slot: slotIdx, name: slot.name, status: slot.status,
    }, { onConflict: 'production_event_id,slot' })
  }

  async function updateSlotStatus(eventId, slotIdx, status) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], status }
      return { ...prev, [eventId]: updated }
    })
    setStatusPicker(null)
    await supabase.from('production_people').upsert({
      production_event_id: eventId, slot: slotIdx,
      name: (slots[eventId]||emptySlots())[slotIdx].name, status,
    }, { onConflict: 'production_event_id,slot' })
  }


  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  const todayStr = new Date().toISOString().slice(0, 10)
  const liveEvents = events.filter(e => !e.deleted_at)
  const deletedEvents = events.filter(e => e.deleted_at)
  const activeEvents = liveEvents.filter(e => !(e.date && e.date < todayStr))
  const archivedAll = liveEvents.filter(e => e.date && e.date < todayStr)
  const archivedFiltered = archiveSearch.trim()
    ? archivedAll.filter(e => (e.event_name || '').toLowerCase().includes(archiveSearch.trim().toLowerCase()))
    : archivedAll
  const monthGroups = (() => {
    const groups = {}
    archivedFiltered.forEach(e => {
      const key = (e.date || '').slice(0, 7)
      ;(groups[key] = groups[key] || []).push(e)
    })
    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
      const [y, mo] = key.split('-')
      return { key, label: HE_MONTHS[Number(mo) - 1] + ' ' + y, events: groups[key].slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')) }
    })
  })()

  const dateNum = d => d ? (Number(String(d).slice(0, 10).replace(/-/g, '')) || 99991231) : 99991231
  const sortKey = e => (e.sort_order != null ? Number(e.sort_order) : dateNum(e.date))

  const activeMonthGroups = (() => {
    const groups = {}
    activeEvents.forEach(e => {
      const key = (e.date || '').slice(0, 7)
      ;(groups[key] = groups[key] || []).push(e)
    })
    return Object.keys(groups).sort((a, b) => {
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b)
    }).map(key => {
      if (key === '') return { key: 'a-nodate', label: 'ללא תאריך', events: groups[''].slice().sort((a, b) => sortKey(a) - sortKey(b)) }
      const [y, mo] = key.split('-')
      return { key: 'a-' + key, label: HE_MONTHS[Number(mo) - 1] + ' ' + y, events: groups[key].slice().sort((a, b) => sortKey(a) - sortKey(b)) }
    })
  })()

  async function saveNotes(ev) {
    const val = notesDraft[ev.id] ?? (ev.notes || '')
    if (val === (ev.notes || '')) return
    await supabase.from('production_events').update({ notes: val }).eq('id', ev.id)
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, notes: val } : e))
  }

  async function handleDrop(targetEv, groupEvents, srcIdArg, dropAfter) {
    const srcId = dragId.current || srcIdArg
    dragId.current = null
    if (!srcId || !groupEvents || srcId === targetEv.id) return
    const without = groupEvents.filter(e => e.id !== srcId)
    const tgtPos = without.findIndex(e => e.id === targetEv.id)
    if (tgtPos === -1) return
    const prevEv = dropAfter ? without[tgtPos] : without[tgtPos - 1]
    const nextEv = dropAfter ? without[tgtPos + 1] : without[tgtPos]
    const prevKey = prevEv ? sortKey(prevEv) : (nextEv ? sortKey(nextEv) - 1 : 0)
    const nextKey = nextEv ? sortKey(nextEv) : (prevEv ? sortKey(prevEv) + 1 : 1)
    const newOrder = (prevKey + nextKey) / 2
    await supabase.from('production_events').update({ sort_order: newOrder }).eq('id', srcId)
    setEvents(prev => prev.map(e => e.id === srcId ? { ...e, sort_order: newOrder } : e))
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exportSelectedPdf() {
    if (!selectedIds.size) return
    setPrintMode('selected')
    setTimeout(() => { window.print(); setPrintMode(null) }, 80)
  }

  function RenderCard(ev, groupEvents) {
        const evSlots = slots[ev.id] || emptySlots()
        const filledCount = evSlots.filter(s => s.name.trim()).length
        const firstEmptyHdr = evSlots.findIndex(s => !s.name.trim())
        return (
          <div key={ev.id} className={`prod-ev-card mb-3 transition-opacity duration-150 ${draggingId === ev.id ? 'opacity-40' : ''} ${printMode === 'selected' && !selectedIds.has(ev.id) ? 'hidden' : ''}`}>
            {groupEvents && dragOver.id === ev.id && !dragOver.after && draggingId !== ev.id && <div className="h-1 bg-[#E0197D] rounded-full mx-2 mb-2 transition-all"/>}
            <div id={'prod-ev-' + ev.id}
              onDragOver={e => { if (!groupEvents) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const r = e.currentTarget.getBoundingClientRect(); const af = (e.clientY - r.top) > r.height / 2; if (dragOver.id !== ev.id || dragOver.after !== af) setDragOver({ id: ev.id, after: af }) }}
              onDrop={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const af = (e.clientY - r.top) > r.height / 2; handleDrop(ev, groupEvents, e.dataTransfer.getData('text/plain'), af); setDraggingId(null); setDragOver({ id: null, after: false }) }}
              className={`bg-[#B6CFD0] border rounded-xl overflow-hidden transition-all duration-300 ${selectMode && selectedIds.has(ev.id) ? 'border-[#E0197D] ring-2 ring-[#E0197D]/40' : flashId === ev.id ? 'border-[#E0197D] ring-2 ring-[#E0197D] shadow-lg shadow-[#E0197D]/20' : 'border-black'}`}>
            <div className="flex items-center gap-3 px-4 py-3 flex-row-reverse">
              <div className="flex-1 min-w-0 text-right">
                {editingEvent === ev.id ? (
                  <div className="flex gap-2 flex-row-reverse" onClick={e=>e.stopPropagation()}>
                    <input value={editEventVal.event_name||''} onChange={e=>setEditEventVal(p=>({...p,event_name:e.target.value}))}
                      className="text-sm font-medium px-2 py-1 border border-[#E0197D] rounded-lg outline-none text-right flex-1"/>
                    <input type="date" value={editEventVal.date||''} onChange={e=>setEditEventVal(p=>({...p,date:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none"/>
                    <select value={editEventVal.venue||''} onChange={e=>setEditEventVal(p=>({...p,venue:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none">
                      <option value="">אולם</option>
                      {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={editEventVal.type||''} onChange={e=>setEditEventVal(p=>({...p,type:e.target.value}))}
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg outline-none">
                      <option value="">קטגוריה</option>
                      {eventTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={saveEventEdit} className="text-black text-sm font-medium">שמור</button>
                    <button onClick={()=>setEditingEvent(null)} className="text-black text-sm">ביטול</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[13px] font-semibold text-black">{ev.event_name}</div>
                    <div className="text-[13px] text-black mt-0.5 flex gap-2 justify-end flex-wrap">
                      {ev.date && <span>{fmtDate(ev.date)}</span>}
                      {ev.day && <span>יום {ev.day}</span>}
                      {ev.venue && <span>{ev.venue}</span>}
                      {ev.type && <span className={`px-1.5 py-0.5 rounded-full ${getTypeStyle(ev.type)}`}>{getTypeLabel(ev.type)}</span>}
                      <span className="text-black">·</span>
                      <span>{filledCount}/{SLOTS} אנשים</span>
                    </div>
                    {/* רשימת אנשים גלויה תמיד — שם ניטרלי + נקודת צבע לסטטוס, לחיצה פותחת תפריט */}
                    <div className="flex items-stretch gap-2 mt-1.5">
                    <div dir="rtl" className="flex gap-1.5 justify-start flex-wrap md:flex-nowrap md:overflow-x-auto md:pb-1 [scrollbar-width:thin] flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                      {evSlots.map((slot, idx) => {
                        if (!slot.name.trim() && idx !== firstEmptyHdr) return null
                        const st = getStatus(slot.status)
                        return (
                          <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-black rounded-full px-2 py-1 flex-shrink-0">
                            <button onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect()
                                setColorMenu(cm => (cm && cm.evId===ev.id && cm.idx===idx) ? null : { evId: ev.id, idx, x: r.left, y: r.bottom })
                              }} title={st.label}
                              className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{background: st.dot}}/>
                            <input value={slot.name} onChange={e => updateSlotName(ev.id, idx, e.target.value)}
                              onBlur={() => saveSlotName(ev.id, idx)} placeholder="+ שם"
                              className="bg-transparent outline-none text-[12px] text-right w-14 focus:w-28 transition-all text-black placeholder:text-gray-500"/>
                          </div>
                        )
                      })}
                    </div>
                    <textarea value={notesDraft[ev.id] ?? (ev.notes || '')} onClick={e=>e.stopPropagation()}
                      onChange={e=>setNotesDraft(d=>({...d,[ev.id]:e.target.value}))} onBlur={()=>saveNotes(ev)}
                      placeholder="הערות" dir="ltr" rows={1}
                      className="w-40 md:w-80 shrink-0 self-stretch text-[11px] px-2 py-1 border border-black rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] resize-y text-left"/>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectMode && <input type="checkbox" checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} onClick={e => e.stopPropagation()}
                  className="no-print w-4 h-4 cursor-pointer ml-1" style={{accentColor:'#E0197D'}}/>}
                {groupEvents && <span draggable onDragStart={e => { dragId.current = ev.id; setDraggingId(ev.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ev.id); const el = document.getElementById('prod-ev-' + ev.id); if (el) e.dataTransfer.setDragImage(el, 24, 24) }} onDragEnd={() => { dragId.current = null; setDraggingId(null); setDragOver({ id: null, after: false }) }}
                  className="no-print text-black hover:text-gray-700 p-1 cursor-grab active:cursor-grabbing" title="גרור לשינוי סדר">
                  <i className="ti ti-grip-vertical" style={{fontSize:14}}/></span>}
                <button onClick={e=>{e.stopPropagation();pushToCalendar(ev)}}
                  className="text-black hover:text-[#E0197D] p-1" title="עדכן ביומן">
                  <i className="ti ti-calendar-plus" style={{fontSize:13}}/></button>
                {ev.date && <button onClick={e=>{e.stopPropagation();router.push(`/dashboard/calendar?day=${ev.date}&ev=${encodeURIComponent(ev.event_name)}`)}}
                  className="text-black hover:text-[#E0197D] p-1" title="הקפצה ליומן (תצוגה יומית)">
                  <i className="ti ti-external-link" style={{fontSize:13}}/></button>}
                <button onClick={e=>{e.stopPropagation();setEditingEvent(ev.id);setEditEventVal({event_name:ev.event_name,date:ev.date||'',day:ev.day||'',venue:ev.venue||'',type:ev.type||''})}}
                  className="text-black hover:text-gray-600 p-1"><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                <button onClick={e=>{e.stopPropagation();if(window.confirm('למחוק את האירוע?'))deleteEvent(ev.id)}}
                  className="text-black hover:text-red-500 p-1"><i className="ti ti-trash" style={{fontSize:13}}/></button>
              </div>
            </div>
          </div>
            {groupEvents && dragOver.id === ev.id && dragOver.after && draggingId !== ev.id && <div className="h-1 bg-[#E0197D] rounded-full mx-2 mt-2 transition-all"/>}
          </div>
        )
  }

  return (
    <div className="w-full max-w-7xl">
      <style dangerouslySetInnerHTML={{__html: `.prod-print-thead { display: none; } @media print { html, body { height: auto !important; overflow: visible !important; } body * { visibility: hidden !important; } .prod-print-area, .prod-print-area * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .fixed.inset-0 { position: static !important; display: block !important; overflow: visible !important; height: auto !important; } main { display: block !important; } main > div:first-child { display: none !important; } .overflow-hidden, .overflow-y-auto { overflow: visible !important; height: auto !important; } aside, .no-print { display: none !important; } .prod-print-thead { display: table-header-group !important; } .prod-print-header-inner { display: flex; align-items: center; gap: 10px; padding: 2px 12px 8px; border-bottom: 2px solid #E0197D; direction: ltr; } .prod-print-area { position: static !important; padding: 12px; } .prod-print-area tr.prod-ev-card { break-inside: avoid !important; page-break-inside: avoid !important; } .prod-print-legend { display: flex !important; flex-wrap: wrap; gap: 4px 14px; align-items: center; padding: 6px 12px 10px; direction: rtl; } @page { margin: 12mm 8mm; } }`}} />
      
      <div className="prod-legend w-full bg-white border border-black rounded-xl px-4 py-2.5 mb-4 no-print">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[12px] font-medium text-gray-500">מקרא סטטוסים:</span>
          {STATUSES.map(s => (
            <span key={s.value} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10 flex-shrink-0" style={{background: s.dot}}/>
              <span className="text-[12px] text-gray-700">{s.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-start gap-2 mb-4 no-print">
        {selectMode ? (
          <>
            <button onClick={pushSelectedToCalendar} disabled={!selectedIds.size}
              className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1 disabled:opacity-50">
              <i className="ti ti-calendar-check"/> עדכן מסומנים ({selectedIds.size})
            </button>
            <button onClick={exportSelectedPdf} disabled={!selectedIds.size}
              className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center gap-1 disabled:opacity-50">
              <i className="ti ti-file-type-pdf"/> ייצא מסומנים ({selectedIds.size})
            </button>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
              className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-1">
              <i className="ti ti-x"/> בטל סימון
            </button>
          </>
        ) : (
          <>
            <button onClick={() => window.print()}
              className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 min-w-[150px]">
              <i className="ti ti-file-type-pdf"/> ייצוא PDF
            </button>
            <button onClick={() => setSelectMode(true)}
              className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 min-w-[150px]">
              <i className="ti ti-checkbox"/> בחר לייצוא
            </button>
          </>
        )}
        <button onClick={syncAll} disabled={bulkBusy || (activeEvents.length===0 && liveEvents.length===0)}
          className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 min-w-[150px] disabled:opacity-50">
          <i className="ti ti-refresh"/> {bulkBusy ? 'מסנכרן…' : 'סנכרן עם היומן'}
        </button>
        <button onClick={openImport}
          className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 min-w-[150px]">
          <i className="ti ti-calendar-down"/> ייבא מהיומן
        </button>
        <button onClick={() => { setShowNewEvent(v => !v); setShowImport(false) }}
          className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 min-w-[150px]">
          <i className="ti ti-plus"/> אירוע חדש
        </button>
      </div>
      {showImport && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={()=>setShowImport(false)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{fontSize:16}}/></button>
            <div className="text-[13px] font-medium text-gray-700 text-right">ייבא אירוע מהיומן</div>
          </div>
          <input value={importSearch} onChange={e=>setImportSearch(e.target.value)}
            placeholder="חיפוש לפי שם..." className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3"/>
          {importLoading ? (
            <div className="text-center text-gray-400 py-4 text-[13px]">טוען אירועים...</div>
          ) : (() => {
            const list = calEvents.filter(ce => !importSearch || (ce.title||'').includes(importSearch))
            if (list.length === 0) return <div className="text-center text-gray-400 py-4 text-[13px]">לא נמצאו אירועים</div>
            return (
              <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 [scrollbar-width:thin]">
                {list.map(ce => {
                  const already = events.some(e => e.event_name === (ce.title||'').trim() && (!ce.date || e.date === ce.date))
                  return (
                    <div key={ce.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg flex-row-reverse">
                      <div className="flex-1 text-right min-w-0">
                        <div className="text-[13px] text-gray-800 truncate">{ce.title}</div>
                        <div className="text-[11px] text-gray-400 flex gap-2 justify-end flex-wrap">
                          {ce.date && <span>{fmtDate(ce.date)}</span>}
                          {ce.venue && <span>{ce.venue}</span>}
                        </div>
                      </div>
                      <button onClick={()=>importFromCalendar(ce)} disabled={already}
                        className={`text-[12px] px-3 py-1.5 rounded-lg flex-shrink-0 ${already ? 'bg-gray-100 text-gray-400' : 'bg-[#E0197D] text-white hover:bg-[#A0106A]'}`}>
                        {already ? 'קיים' : 'ייבא'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
      {showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-700 mb-3 text-right">הוסף אירוע חדש</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input value={newEvent.event_name} onChange={e=>setNewEvent(p=>({...p,event_name:e.target.value}))}
              placeholder="שם האירוע *" className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right col-span-2"/>
            <input type="date" value={newEvent.date} onChange={e=>{
              const d=e.target.value
              const day=d?['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(d).getDay()]:''
              setNewEvent(p=>({...p,date:d,day}))
            }}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <select value={newEvent.day} onChange={e=>setNewEvent(p=>({...p,day:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
              <option value="">יום בשבוע</option>
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <input type="time" value={newEvent.time||''} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"/>
            <select value={newEvent.venue} onChange={e=>setNewEvent(p=>({...p,venue:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] col-span-2">
              <option value="">בחר אולם</option>
              {VENUES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <select value={newEvent.type} onChange={e=>setNewEvent(p=>({...p,type:e.target.value}))}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] col-span-2">
              <option value="">בחר קטגוריה</option>
              {eventTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addEvent} disabled={savingEvent || !newEvent.event_name.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {savingEvent ? 'שומר...' : 'הוסף'}
            </button>
            <button onClick={()=>setShowNewEvent(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">ביטול</button>
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-row-reverse no-print">
          <button onClick={() => setView('active')}
            className={`text-[12px] px-3 py-1.5 rounded-lg font-medium ${view === 'active' ? 'bg-[#E0197D] text-white border border-[#E0197D]' : 'bg-white border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3]'}`}>
            פעילות ({activeEvents.length})
          </button>
          <button onClick={() => setView('archive')}
            className={`text-[12px] px-3 py-1.5 rounded-lg font-medium ${view === 'archive' ? 'bg-[#E0197D] text-white border border-[#E0197D]' : 'bg-white border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3]'}`}>
            ארכיון ({archivedAll.length})
          </button>
          <button onClick={() => setView('trash')}
            className={`text-[12px] px-3 py-1.5 rounded-lg font-medium ${view === 'trash' ? 'bg-[#E0197D] text-white border border-[#E0197D]' : 'bg-white border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3]'}`}>
            סל מיחזור ({deletedEvents.length})
          </button>
          {view === 'archive' && (
            <input value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
              placeholder="חיפוש בארכיון..."
              className="flex-1 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
          )}
        </div>
      )}
      {events.length === 0 && !showNewEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין אירועים — לחץ על "אירוע חדש" להתחלה
        </div>
      )}
      <div className="prod-print-area">
        <div className="prod-print-legend" style={{ display: 'none' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>מקרא סטטוסים:</span>
          {STATUSES.map(s => (
            <span key={s.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 9999, background: s.dot, border: '1px solid rgba(0,0,0,0.1)', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#374151' }}>{s.label}</span>
            </span>
          ))}
        </div>
      {view === 'active' && activeEvents.length > 0 && (
        <>
          <div className="flex justify-end mb-2 no-print">
            <button onClick={() => {
              const allCollapsed = activeMonthGroups.every(g => collapsedMonths[g.key])
              if (allCollapsed) setCollapsedMonths({})
              else { const next = {}; activeMonthGroups.forEach(g => { next[g.key] = true }); setCollapsedMonths(next) }
            }} className="text-[11px] text-gray-500 hover:text-[#E0197D]">
              {activeMonthGroups.every(g => collapsedMonths[g.key]) ? 'הרחב הכל' : 'כווץ הכל'}
            </button>
          </div>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead className="prod-print-thead">
              <tr><td>
                <div className="prod-print-header-inner">
                  <HaziraLogo size={30} />
                  <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 17, color: '#A0106A' }}>תכנון הפקה</span>
                  <span style={{ width: 30, display: 'inline-block' }} />
                </div>
              </td></tr>
            </thead>
            <tbody>
              {activeMonthGroups.map(g => (
                <Fragment key={g.key}>
                  <tr className={`${printMode === 'selected' && !g.events.some(e => selectedIds.has(e.id)) ? 'hidden' : ''}`}>
                    <td style={{ padding: 0 }}>
                      <button onClick={() => setCollapsedMonths(p => ({ ...p, [g.key]: !p[g.key] }))}
                        className="w-full flex items-center justify-between px-4 py-2.5 mb-2 bg-gray-50 border border-black rounded-xl flex-row-reverse hover:bg-gray-100">
                        <span className="text-[13px] font-semibold text-gray-700 flex items-center gap-2 flex-row-reverse">
                          <i className={`ti ${collapsedMonths[g.key] ? 'ti-chevron-down' : 'ti-chevron-up'} text-gray-400 no-print`} style={{fontSize:15}}/>
                          {g.label}
                        </span>
                        <span className="text-[11px] text-gray-400">{g.events.length} אירועים</span>
                      </button>
                    </td>
                  </tr>
                  {(!collapsedMonths[g.key] || printMode === 'selected') && g.events.map(ev => (
                    <tr key={ev.id} className={`prod-ev-card ${printMode === 'selected' && !selectedIds.has(ev.id) ? 'hidden' : ''}`}>
                      <td style={{ padding: 0, verticalAlign: 'top' }}>{RenderCard(ev, g.events)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}
      {view === 'active' && events.length > 0 && activeEvents.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">אין אירועים פעילים</div>
      )}
      {view === 'archive' && monthGroups.map(g => (
        <div key={g.key} className="mb-3">
          <button onClick={() => setOpenMonths(p => ({ ...p, [g.key]: !p[g.key] }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl flex-row-reverse hover:bg-gray-100">
            <span className="text-[13px] font-semibold text-gray-700">{g.label}</span>
            <span className="text-[11px] text-gray-400">{g.events.length} אירועים</span>
          </button>
          {openMonths[g.key] && <div className="mt-2">{g.events.map(ev => RenderCard(ev))}</div>}
        </div>
      ))}
      {view === 'archive' && monthGroups.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">אין אירועים בארכיון</div>
      )}
      </div>
      {view === 'trash' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          {deletedEvents.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">סל המיחזור ריק</div>
          ) : deletedEvents.map(ev => (
            <div key={ev.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0 flex-row-reverse">
              <div className="flex-1 text-right min-w-0">
                <div className="text-[13px] text-gray-800 truncate">{ev.event_name}</div>
                <div className="text-[11px] text-gray-400">{ev.date ? fmtDate(ev.date) : ''}</div>
              </div>
              <button onClick={() => restoreEvent(ev.id)} className="text-[12px] text-[#E0197D] border border-[#E0197D] px-2 py-1 rounded-lg flex-shrink-0 hover:bg-[#FCE4F3]">שחזר</button>
              <button onClick={() => { if (window.confirm('למחוק לצמיתות? פעולה בלתי הפיכה.')) purgeEvent(ev.id) }} className="text-[12px] text-gray-400 hover:text-red-500 px-2 py-1 flex-shrink-0">מחק לצמיתות</button>
            </div>
          ))}
        </div>
      )}
            {colorMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setColorMenu(null)} />
          <div className="fixed z-[9999] bg-white border border-gray-200 rounded-xl p-1.5 flex flex-col gap-1 w-[170px]"
            style={{
              top: Math.min(colorMenu.y + 6, (typeof window !== 'undefined' ? window.innerHeight : 800) - 270),
              left: Math.max(8, Math.min(colorMenu.x - 150, (typeof window !== 'undefined' ? window.innerWidth : 400) - 178)),
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => { updateSlotStatus(colorMenu.evId, colorMenu.idx, s.value); setColorMenu(null) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${s.bg} ${s.text} hover:opacity-80 text-right`}>
                <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{background:s.dot}}/>
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
      {syncOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 no-print" onClick={() => !syncBusy && setSyncOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="text-[15px] font-bold text-gray-800">אירועים שאינם קיימים ביומן</div>
              <div className="text-[12px] text-gray-500 mt-0.5">סמן את האירועים שברצונך להסיר גם מההפקה הטכנית. מה שלא תסמן יישאר ויעודכן ליומן.</div>
            </div>
            <div className="px-5 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[12px] text-gray-400">{syncSel.size}/{syncOrphans.length} מסומנים</span>
              <div className="flex gap-3">
                <button onClick={() => setSyncSel(new Set(syncOrphans.map(o => o.id)))} className="text-[12px] text-[#E0197D] hover:text-[#A0106A]">סמן הכל</button>
                <button onClick={() => setSyncSel(new Set())} className="text-[12px] text-gray-500 hover:text-gray-700">נקה</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {syncOrphans.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0 cursor-pointer">
                  <input type="checkbox" checked={syncSel.has(o.id)} onChange={() => setSyncSel(prev => { const n = new Set(prev); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n })} style={{ accentColor: '#E0197D' }} />
                  <span className="text-[13px] text-gray-800 flex-1">{o.event_name || '(ללא שם)'}</span>
                  {o.date && <span className="text-[12px] text-gray-400">{o.date}</span>}
                </label>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-start">
              <button onClick={confirmSync} disabled={syncBusy} className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">{syncBusy ? 'מסנכרן…' : (syncSel.size ? `מחק ${syncSel.size} ועדכן ליומן` : 'עדכן ליומן בלי מחיקה')}</button>
              <button onClick={() => setSyncOpen(false)} disabled={syncBusy} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LoadFromGeneralSchedules({ onLoad, onImportExcel }) {
  const [files, setFiles] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const FOLDER = 'schedules-general'

  const isExcel = name => /\.(xlsx|xls)$/i.test(name)

  async function loadFiles() {
    setLoading(true)
    const { data } = await supabase.storage.from('venues').list(FOLDER, { sortBy: { column: 'name', order: 'asc' } })
    setFiles((data || []).filter(f => f.name !== '.emptydir'))
    setLoading(false)
  }

  function handleOpen() {
    setOpen(v => !v)
    loadFiles()
  }

  function openFile(fileName) {
    const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${fileName}`)
    onLoad(data.publicUrl, fileName)
    setOpen(false)
  }

  async function importExcel(fileName) {
    const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${fileName}`)
    const res = await fetch(data.publicUrl)
    const buf = await res.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const rows = json
      .filter(r => r.some(c => String(c).trim()))
      .map(r => ({
        time: (() => { const v = r[0]; if (typeof v === 'number') { const t = Math.round(v*24*60); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0') } return String(v || '').trim() })(),
        what:  String(r[1] || '').trim(),
        who:   String(r[2] || '').trim(),
        notes: String(r[3] || '').trim(),
      }))
    onImportExcel(rows, fileName)
    setOpen(false)
  }

  return (
    <div className="mb-4 no-print">
      <button onClick={handleOpen}
        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors flex-row-reverse text-right text-[13px] ${open ? 'bg-[#FCE4F3] border-[#E0197D] text-[#E0197D]' : 'bg-white border-gray-100 text-gray-600 hover:border-[#E0197D]'}`}>
        <i className="ti ti-folder text-[#E0197D]" style={{fontSize:15}}/>
        <span className="flex-1 font-medium">טען לוז מ"לוזים כללי"</span>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{fontSize:13}}/>
      </button>
      {open && (
        <div className="mt-1 bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loading && <div className="text-center text-[13px] text-gray-400 py-4">טוען...</div>}
          {!loading && files.length === 0 && <div className="text-center text-[13px] text-gray-400 py-4">אין קבצים</div>}
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 flex-row-reverse group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isExcel(f.name) ? 'bg-green-50' : 'bg-[#FCE4F3]'}`}>
                <i className={`ti ${isExcel(f.name) ? 'ti-file-spreadsheet text-green-600' : 'ti-file-type-pdf text-[#E0197D]'}`} style={{fontSize:16}}/>
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="text-[13px] text-gray-800 truncate">{f.name}</div>
              </div>
              {isExcel(f.name) ? (
                <button onClick={() => importExcel(f.name)}
                  className="text-[12px] text-green-600 border border-green-600 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                  <i className="ti ti-table-import" style={{fontSize:12}}/> ייבא
                </button>
              ) : (
                <button onClick={() => openFile(f.name)}
                  className="text-[12px] text-[#E0197D] border border-[#E0197D] px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                  <i className="ti ti-eye" style={{fontSize:12}}/> פתח
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductionSchedule({ profile }) {
  const [events, setEvents] = useState([])
  const [crew, setCrew] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generalFileViewer, setGeneralFileViewer] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    supabase.from('events').select('id,title,date,venue').order('date').then(({ data }) => setEvents(data || []))
    supabase.from('crew_members').select('id,full_name,role').eq('active',true).order('full_name').then(({ data }) => setCrew(data || []))
  }, [])

  async function importFromExcel(excelRows, fileName) {
    if (!schedule) {
      alert('בחר אירוע וצור לוז תחילה')
      return
    }
    setImporting(true)
    const startOrder = rows.length
    const inserted = []
    for (let i = 0; i < excelRows.length; i++) {
      const r = excelRows[i]
      const { data } = await supabase.from('schedule_rows').insert({
        schedule_id: schedule.id,
        time: r.time, what: r.what, who: r.who, notes: r.notes,
        sort_order: startOrder + i,
      }).select().single()
      if (data) inserted.push(data)
    }
    setRows(prev => [...prev, ...inserted])
    setImporting(false)
    alert(`יובאו ${inserted.length} שורות מ-${fileName}`)
  }

  async function selectEvent(eventId) {
    setSelectedEvent(eventId)
    setSchedule(null); setRows([])
    if (!eventId) return
    setLoading(true)
    const { data: sch } = await supabase.from('schedules').select('*').eq('event_id', eventId).single()
    if (sch) {
      setSchedule(sch)
      const { data: r } = await supabase.from('schedule_rows').select('*').eq('schedule_id', sch.id).order('sort_order')
      setRows(r || [])
    }
    setLoading(false)
  }

  async function createSchedule() {
    if (!selectedEvent) return
    const { data } = await supabase.from('schedules').insert({
      event_id: selectedEvent, status: 'draft', participants: '', visible_to: 'managers',
    }).select().single()
    setSchedule(data); setRows([])
  }

  async function updateSchedule(field, value) {
    if (!schedule) return
    await supabase.from('schedules').update({ [field]: value }).eq('id', schedule.id)
    setSchedule(prev => ({ ...prev, [field]: value }))
  }

  async function loadTemplate(tmpl) {
    if (!window.confirm('טעינת התבנית תחליף את הלוז הנוכחי. להמשיך?')) return
    await supabase.from('schedule_rows').delete().eq('schedule_id', schedule.id)
    const newRows = tmpl.rows.map((r, i) => ({ schedule_id: schedule.id, time: r.time, what: r.what, who: r.who, notes: r.notes, sort_order: i }))
    const { data } = await supabase.from('rundown_rows').insert(newRows).select()
    setRows(data || [])
    setShowTemplates(false)
  }

  async function addRow() {
    if (!schedule) return
    const { data } = await supabase.from('schedule_rows').insert({
      schedule_id: schedule.id, time: '', what: '', who: '', notes: '', sort_order: rows.length,
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
    if (schedule.visible_to === 'specific') return (schedule.visible_to_users || []).includes(profile.uid)
    return false
  }

  async function exportExcel() {
    if (!schedule || !selEv) return
    setExporting(true)
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    const ws = {}
    const borderThin = { top:{style:'thin',color:{rgb:'999999'}}, bottom:{style:'thin',color:{rgb:'999999'}}, left:{style:'thin',color:{rgb:'999999'}}, right:{style:'thin',color:{rgb:'999999'}} }
    ws['A1'] = { v: `לוז: ${selEv.title}`, t:'s', s:{ font:{bold:true,sz:16,name:'Calibri',color:{rgb:'CC1010'}}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A2'] = { v: `תאריך: ${fmtDate(selEv.date)}${selEv.venue?` | ${selEv.venue}`:''}`, t:'s', s:{ font:{sz:12,name:'Calibri',color:{rgb:'666666'}}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A3'] = { v: `משתתפים: ${schedule.participants||''}`, t:'s', s:{ font:{sz:12,name:'Calibri',italic:true}, alignment:{horizontal:'right',readingOrder:2} } }
    ws['A4'] = { v:'', t:'s' }
    const headers = ['שעה','מה','מי','הערות']
    headers.forEach((h,ci) => {
      const ref = XLSX.utils.encode_cell({r:4,c:ci})
      ws[ref] = { v:h, t:'s', s:{ fill:{patternType:'solid',fgColor:{rgb:'CC1010'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:12,name:'Calibri'}, alignment:{horizontal:'right',vertical:'center',readingOrder:2}, border:borderThin } }
    })
    rows.forEach((row,ri) => {
      const isOdd = ri%2!==0
      const vals = [row.time||'',row.what||'',row.who||'',row.notes||'']
      vals.forEach((v,ci) => {
        const ref = XLSX.utils.encode_cell({r:ri+5,c:ci})
        ws[ref] = { v, t:'s', s:{ fill:{patternType:'solid',fgColor:{rgb:isOdd?'FFF0F0':'FFFFFF'}}, font:{sz:12,name:'Calibri'}, alignment:{horizontal:'right',vertical:'center',readingOrder:2,wrapText:true}, border:borderThin } }
      })
    })
    ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length+5,c:3}})
    ws['!views'] = [{rightToLeft:true}]
    ws['!cols'] = [{wch:10},{wch:35},{wch:25},{wch:30}]
    ws['!rows'] = [{hpt:28},{hpt:18},{hpt:18},{hpt:10},{hpt:22},...rows.map(r=>({hpt:Math.max(20,Math.ceil(Math.max((r.what||'').length/35,(r.who||'').length/25,(r.notes||'').length/30))*18)}))]
    ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}},{s:{r:2,c:0},e:{r:2,c:3}}]
    XLSX.utils.book_append_sheet(wb, ws, 'לוז')
    XLSX.writeFile(wb, `לוז_${selEv.title}_${selEv.date}.xlsx`)
    setExporting(false)
  }

  const selEv = events.find(e => e.id === selectedEvent)
  const isManager = profile?.is_manager

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #schedule-print, #schedule-print * { visibility: visible; } #schedule-print { position: fixed; top: 0; left: 0; width: 100%; direction: rtl; } .no-print { display: none !important; } }`}</style>
      <div className="max-w-4xl">
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 no-print">
          <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע</div>
          <select value={selectedEvent} onChange={e => selectEvent(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
            <option value="">בחר אירוע...</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
          </select>
        </div>

        {importing && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-[13px] text-green-700 flex items-center gap-2 flex-row-reverse no-print">
            <i className="ti ti-loader-2 animate-spin" style={{fontSize:15}}/>
            מייבא שורות מ-Excel...
          </div>
        )}
        {generalFileViewer && (
          <div className="fixed inset-0 z-50 bg-black/70 flex flex-col no-print">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-row-reverse">
              <button onClick={() => setGeneralFileViewer(null)} className="flex items-center gap-1.5 text-gray-600 text-[13px]">
                <i className="ti ti-x" style={{fontSize:16}}/> סגור
              </button>
              <span className="text-[13px] font-medium text-gray-800 truncate max-w-[45%]">{generalFileViewer.name}</span>
              <a href={generalFileViewer.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-[#E0197D] hover:underline">
                <i className="ti ti-external-link" style={{fontSize:14}}/> פתח בדפדפן
              </a>
            </div>
            <iframe src={generalFileViewer.url} className="flex-1 w-full hidden md:block" title={generalFileViewer.name} allow="fullscreen" style={{border:'none'}}/>
            <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gray-50 md:hidden px-6 text-center">
              <a href={generalFileViewer.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[14px] bg-[#E0197D] text-white px-6 py-3 rounded-xl font-medium">
                <i className="ti ti-external-link" style={{fontSize:15}}/> פתח קובץ
              </a>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-8">טוען...</div>}
        {selectedEvent && !loading && !schedule && isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center no-print">
            <div className="text-[14px] text-gray-500 mb-4">אין לוז לאירוע זה עדיין</div>
            <button onClick={createSchedule} className="bg-[#E0197D] text-white px-6 py-2.5 rounded-lg text-sm hover:bg-[#A0106A]">+ צור לוז חדש</button>
          </div>
        )}
        {selectedEvent && !loading && !schedule && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">אין לוז זמין לאירוע זה</div>
        )}

        {schedule && (canView() || isManager) && (
          <>
            {isManager && (
              <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex flex-col gap-2 no-print">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">סטטוס:</span>
                  <button onClick={() => updateSchedule('status', schedule.status==='draft'?'final':'draft')}
                    className={`text-[12px] px-3 py-1.5 rounded-full border font-medium transition-colors ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041] border-[#085041]':'bg-[#FAEEDA] text-[#633806] border-[#633806]'}`}>
                    {schedule.status==='final' ? 'סופי' : 'בעבודה'}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">גלוי ל:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => updateSchedule('visible_to', 'managers')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='managers'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      מנהלים בלבד
                    </button>
                    <button onClick={() => updateSchedule('visible_to', 'all')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='all'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      כולם
                    </button>
                    <button onClick={() => updateSchedule('visible_to', 'specific')}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schedule.visible_to==='specific'?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                      אנשים ספציפיים
                    </button>
                  </div>
                </div>
                {schedule.visible_to === 'specific' && (
                  <div className="w-full mt-1">
                    <div className="text-[11px] text-gray-400 mb-1.5">בחר אנשי צוות:</div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {crew.map(c => {
                        const selected = (schedule.visible_to_users||[]).includes(c.id)
                        return (
                          <button key={c.id}
                            onClick={async () => {
                              const current = schedule.visible_to_users || []
                              const updated = selected ? current.filter(id => id !== c.id) : [...current, c.id]
                              await supabase.from('schedules').update({ visible_to_users: updated }).eq('id', schedule.id)
                              setSchedule(prev => ({ ...prev, visible_to_users: updated }))
                            }}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${selected?'bg-[#E1F5EE] text-[#085041] border-[#085041]':'border-gray-200 text-gray-500 hover:border-[#E0197D]'}`}>
                            {c.full_name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="flex-1"/>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 disabled:opacity-50">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> אקסל
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> PDF
                </button>
              </div>
            )}
            {!isManager && schedule.status==='final' && (
              <div className="flex gap-2 mb-4 justify-end no-print">
                <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 bg-white">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:14}}/> ייצוא לאקסל
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:border-[#E0197D] text-gray-600 bg-white">
                  <i className="ti ti-file-type-pdf" style={{fontSize:14}}/> ייצוא PDF
                </button>
              </div>
            )}
            <div id="schedule-print" className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="hidden print:flex justify-center py-3 border-b border-gray-200" style={{backgroundColor:'white'}}>
                <img src="/icon-192.png" style={{height:'55px'}} alt="הזירה"/>
              </div>
              <div className="px-6 py-5 border-b border-gray-100" style={{borderRight:'4px solid #E0197D'}}>
                <div className="flex items-start justify-between flex-row-reverse">
                  <div className="text-right">
                    <div className="text-[20px] font-bold text-gray-900">{selEv?.title}</div>
                    <div className="text-[13px] text-gray-500 mt-0.5">{fmtDate(selEv?.date)}{selEv?.venue?` · ${selEv.venue}`:''}</div>
                  </div>
                  <div className={`text-[11px] px-2.5 py-1 rounded-full font-medium no-print ${schedule.status==='final'?'bg-[#E1F5EE] text-[#085041]':'bg-[#FAEEDA] text-[#633806]'}`}>
                    {schedule.status==='final' ? 'סופי' : 'בעבודה'}
                  </div>
                </div>
                <div className="mt-3">
                  {isManager ? (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">משתתפים:</span>
                      <input value={schedule.participants||''} onChange={e => setSchedule(prev => ({...prev, participants: e.target.value}))}
                        onBlur={e => updateSchedule('participants', e.target.value)} placeholder="רשימת משתתפים..."
                        className="flex-1 text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right no-print"/>
                      <span className="hidden print:inline text-[13px] text-gray-700">{schedule.participants}</span>
                    </div>
                  ) : schedule.participants && (
                    <div className="text-[13px] text-gray-600 text-right">
                      <span className="text-[11px] text-gray-400 ml-1">משתתפים:</span>{schedule.participants}
                    </div>
                  )}
                </div>
              </div>
              <div className={`grid gap-0 bg-[#E0197D] text-white text-[12px] font-semibold no-print ${isManager?'grid-cols-[150px_2fr_1.5fr_1fr_40px]':'grid-cols-[150px_2fr_1.5fr_1fr]'}`}>
                <div className="px-3 py-2.5 text-right">שעה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
                {isManager && <div className="px-2 py-2.5"/>}
              </div>
              {rows.length === 0 && (
                <div className="text-center text-[13px] text-gray-400 py-8 no-print">
                  {isManager ? 'לחץ על "הוסף שורה" כדי להתחיל' : 'הלוז ריק'}
                </div>
              )}
              {rows.map((row, index) => (
                <div key={row.id}
                  className={`grid gap-0 border-b border-gray-50 group ${isManager?'grid-cols-[150px_2fr_1.5fr_1fr_40px]':'grid-cols-[150px_2fr_1.5fr_1fr]'} ${index%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                  {isManager ? (
                    <>
                      <textarea value={row.time||''} onChange={e=>updateRow(row.id,'time',e.target.value)} wrap="off"
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 font-mono resize-none w-full leading-5 whitespace-nowrap" rows={1}/>
                      <textarea value={row.what||''} onChange={e=>updateRow(row.id,'what',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.what||'').length/30))}/>
                      <textarea value={row.who||''} onChange={e=>updateRow(row.id,'who',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.who||'').length/20))}/>
                      <textarea value={row.notes||''} onChange={e=>updateRow(row.id,'notes',e.target.value)}
                        className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-gray-100 text-gray-500 resize-none w-full leading-5" rows={Math.max(1,Math.ceil((row.notes||'').length/20))}/>
                      <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveRow(index,-1)} disabled={index===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-up" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => deleteRow(row.id)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <i className="ti ti-trash" style={{fontSize:11}}/>
                        </button>
                        <button onClick={() => moveRow(index,1)} disabled={index===rows.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-down" style={{fontSize:11}}/>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 font-mono text-[#E0197D] font-medium whitespace-nowrap">{row.time && row.time !== "00:00" ? row.time : ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 break-words">{row.what || ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right border-l border-gray-100 text-gray-600 break-words">{row.who || ""}</div>
                      <div className="px-3 py-2.5 text-[13px] text-right text-gray-400 break-words">{row.notes || ""}</div>
                    </>
                  )}
                </div>
              ))}
              {isManager && (
                <div className="flex no-print">
                  <button onClick={addRow}
                    className="flex-1 py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                    <i className="ti ti-plus" style={{fontSize:13}}/> הוסף שורה
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {schedule && !canView() && !isManager && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">הלוז עדיין לא זמין לצפייה</div>
        )}
      </div>
    </>
  )
}

export function GeneralSchedulesMode() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [rows, setRows] = useState({})
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newVenue, setNewVenue] = useState('')
  const [saving, setSaving] = useState(false)
  const [importingId, setImportingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('general_schedules').select('*').order('title', { ascending: true })
    setSchedules(data || [])
    setLoading(false)
  }

  async function loadRows(scheduleId) {
    const { data } = await supabase.from('general_schedule_rows').select('*').eq('schedule_id', scheduleId).order('sort_order')
    setRows(prev => ({ ...prev, [scheduleId]: data || [] }))
  }

  async function createSchedule() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase.from('general_schedules').insert({ title: newTitle.trim(), venue: newVenue || null, participants: '' }).select().single()
    if (data) {
      setSchedules(prev => [data, ...prev])
      setRows(prev => ({ ...prev, [data.id]: [] }))
      setOpenId(data.id)
      setNewTitle('')
      setNewVenue('')
      setShowNew(false)
    }
    setSaving(false)
  }

  async function updateSchedule(id, field, value) {
    await supabase.from('general_schedules').update({ [field]: value }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function deleteSchedule(id) {
    await supabase.from('general_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  async function duplicateSchedule(sch) {
    const { data: newSch } = await supabase.from('general_schedules').insert({ title: sch.title + ' (עותק)', venue: sch.venue, participants: sch.participants || '' }).select().single()
    if (!newSch) return
    const { data: srcRows2 } = await supabase.from('general_schedule_rows').select('*').eq('schedule_id', sch.id).order('sort_order')
    const srcRows = srcRows2 || []
    if (srcRows.length > 0) {
      await supabase.from('general_schedule_rows').insert(srcRows.map((r,i) => ({ schedule_id: newSch.id, time: r.time, what: r.what, who: r.who, notes: r.notes, sort_order: i })))
    }
    setSchedules(prev => [newSch, ...prev])
    setRows(prev => ({ ...prev, [newSch.id]: srcRows.map((r,i) => ({ ...r, id: i, schedule_id: newSch.id })) }))
  }

  async function addRow(scheduleId) {
    const currentRows = rows[scheduleId] || []
    const { data } = await supabase.from('general_schedule_rows').insert({
      schedule_id: scheduleId, time: '', what: '', who: '', notes: '', sort_order: currentRows.length
    }).select().single()
    if (data) setRows(prev => ({ ...prev, [scheduleId]: [...(prev[scheduleId] || []), data] }))
  }

  async function updateRow(scheduleId, rowId, field, value) {
    setRows(prev => ({ ...prev, [scheduleId]: prev[scheduleId].map(r => r.id === rowId ? { ...r, [field]: value } : r) }))
    await supabase.from('general_schedule_rows').update({ [field]: value }).eq('id', rowId)
  }

  async function deleteRow(scheduleId, rowId) {
    await supabase.from('general_schedule_rows').delete().eq('id', rowId)
    setRows(prev => ({ ...prev, [scheduleId]: prev[scheduleId].filter(r => r.id !== rowId) }))
  }

  async function moveRow(scheduleId, index, dir) {
    const curr = [...(rows[scheduleId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setRows(prev => ({ ...prev, [scheduleId]: curr }))
    await Promise.all(curr.map((r, i) => supabase.from('general_schedule_rows').update({ sort_order: i }).eq('id', r.id)))
  }

  async function importExcel(scheduleId, file) {
    setImportingId(scheduleId)
    const XLSX = await import('xlsx-js-style')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const techRow = json[2] || []
    const castRow = json[3] || []
    const techNames = techRow.map(c => String(c||"").trim()).filter(c => c.length > 1)
    const castNames = castRow.map(c => String(c||"").trim()).filter(c => c.length > 1)
    const allParticipants = [...new Set([...techNames,...castNames])].join(", ")
    const SKIP = ['שעה','מה','מי','הערות','time']
    const excelRows = json
      .filter(r => r.some(c => String(c).trim()))
      .filter(r => !SKIP.includes(String(r[0] || '').trim()))
      .map(r => ({
        time: (() => { const v = r[0]; if (typeof v === 'number') { const t = Math.round(v*24*60); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0') } return String(v || '').trim() })(),
        what: String(r[1] || '').trim(),
        who:  String(r[2] || '').trim(),
        notes: String(r[3] || '').trim(),
      }))
    const currentRows = rows[scheduleId] || []
    const inserted = []
    for (let i = 0; i < excelRows.length; i++) {
      const { data } = await supabase.from('general_schedule_rows').insert({
        schedule_id: scheduleId, ...excelRows[i], sort_order: currentRows.length + i
      }).select().single()
      if (data) inserted.push(data)
    }
    setRows(prev => ({ ...prev, [scheduleId]: [...(prev[scheduleId] || []), ...inserted] }))
    if (allParticipants) {
      supabase.from("general_schedules").update({ participants: allParticipants }).eq("id", scheduleId)
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, participants: allParticipants } : s))
    }
    setImportingId(null)
  }

  function toggleOpen(id) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!rows[id]) loadRows(id)
  }

  async function exportXlsx(sch) {
    let schRows = rows[sch.id]
    if (!schRows) {
      const { data } = await supabase
        .from('general_schedule_rows')
        .select('*')
        .eq('schedule_id', sch.id)
        .order('sort_order')
      schRows = data || []
    }
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    const ws = {}
    const border = {
      top:    { style: 'thin', color: { rgb: '999999' } },
      bottom: { style: 'thin', color: { rgb: '999999' } },
      left:   { style: 'thin', color: { rgb: '999999' } },
      right:  { style: 'thin', color: { rgb: '999999' } },
    }
    ws['A1'] = { v: `לוז: ${sch.title}`, t: 's', s: { font: { bold: true, sz: 16, name: 'Calibri', color: { rgb: 'CC1010' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A2'] = { v: sch.venue || '', t: 's', s: { font: { sz: 12, name: 'Calibri', color: { rgb: '666666' } }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A3'] = { v: `משתתפים: ${sch.participants || ''}`, t: 's', s: { font: { sz: 12, name: 'Calibri', italic: true }, alignment: { horizontal: 'right', readingOrder: 2 } } }
    ws['A4'] = { v: '', t: 's' }
    const headers = ['שעה', 'מה', 'מי', 'הערות']
    headers.forEach((h, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 4, c: ci })
      ws[ref] = { v: h, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: 'CC1010' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 }, border } }
    })
    schRows.forEach((row, ri) => {
      const isOdd = ri % 2 !== 0
      const vals = [row.time || '', row.what || '', row.who || '', row.notes || '']
      vals.forEach((v, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 5, c: ci })
        ws[ref] = { v, t: 's', s: { fill: { patternType: 'solid', fgColor: { rgb: isOdd ? 'FFF0F0' : 'FFFFFF' } }, font: { sz: 12, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2, wrapText: true }, border } }
      })
    })
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: schRows.length + 5, c: 3 } })
    ws['!views'] = [{ rightToLeft: true }]
    ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 25 }, { wch: 30 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }]
    XLSX.utils.book_append_sheet(wb, ws, 'לוז')
    XLSX.writeFile(wb, `לוז_${sch.title}.xlsx`)
  }

  async function exportPdf(sch) {
    let schRows = rows[sch.id]
    if (!schRows) {
      const { data } = await supabase
        .from('general_schedule_rows')
        .select('*')
        .eq('schedule_id', sch.id)
        .order('sort_order')
      schRows = data || []
    }
    const win = window.open('', '_blank')
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>לוז: ${sch.title}</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; color: #111; }
          h2 { color: #CC1010; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #E0197D; color: white; padding: 8px 12px; text-align: right; }
          td { padding: 7px 12px; border-bottom: 1px solid #eee; text-align: right; }
          tr:nth-child(even) { background: #FFF8F8; }
        </style>
      </head>
      <body>
        <h2>${sch.title}</h2>
        <div class="meta">
          ${sch.venue ? `<span>${sch.venue}</span> · ` : ''}
          ${sch.participants ? `משתתפים: ${sch.participants}` : ''}
        </div>
        <table>
          <thead><tr><th>שעה</th><th>מה</th><th>מי</th><th>הערות</th></tr></thead>
          <tbody>
            ${schRows.map(r => `
              <tr>
                <td style="font-family:monospace;white-space:nowrap">${r.time || ''}</td>
                <td>${r.what || ''}</td>
                <td>${r.who || ''}</td>
                <td style="color:#888">${r.notes || ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNew(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus"/> לוז חדש
        </button>
      </div>
      {showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="שם הלוז *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2"/>
          <select value={newVenue} onChange={e => setNewVenue(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3">
            <option value="">בחר אולם</option>
            {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={createSchedule} disabled={saving || !newTitle.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {saving ? 'שומר...' : 'צור לוז'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
          </div>
        </div>
      )}
      {schedules.length === 0 && !showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין לוזים — לחץ על "לוז חדש" להתחלה
        </div>
      )}
      {schedules.map(sch => {
        const isOpen = openId === sch.id
        const schRows = rows[sch.id] || []
        return (
          <div key={sch.id} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => toggleOpen(sch.id)}>
              <div className="flex-1 text-right">
                <input
                  value={sch.title}
                  onChange={e => setSchedules(prev => prev.map(s => s.id === sch.id ? {...s, title: e.target.value} : s))}
                  onBlur={e => updateSchedule(sch.id, 'title', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="text-[13px] font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-[#E0197D] text-right w-full"
                />
                <div className="text-[11px] text-gray-400 mt-0.5 flex gap-2 justify-end flex-wrap">
                  {sch.venue && <span>{sch.venue}</span>}
                  {sch.participants && <span>{sch.participants}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input type="file" accept=".xlsx,.xls" className="hidden" id={`xl-${sch.id}`}
                  onChange={e => { if (e.target.files[0]) importExcel(sch.id, e.target.files[0]); e.target.value = '' }}/>
                <button onClick={e => { e.stopPropagation(); exportXlsx(sch) }}
                  className="text-gray-300 hover:text-green-600 p-1" title="ייצוא אקסל">
                  <i className="ti ti-file-spreadsheet" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); exportPdf(sch) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="ייצוא PDF">
                  <i className="ti ti-file-type-pdf" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); document.getElementById(`xl-${sch.id}`).click() }}
                  className="text-gray-300 hover:text-green-600 p-1" title="ייבא מאקסל">
                  <i className="ti ti-table-import" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); if (!rows[sch.id]) loadRows(sch.id).then(()=>duplicateSchedule(sch)); else duplicateSchedule(sch) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="שכפל לוז">
                  <i className="ti ti-copy" style={{fontSize:13}}/>
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm('למחוק את הלוז?')) deleteSchedule(sch.id) }}
                  className="text-gray-300 hover:text-red-500 p-1">
                  <i className="ti ti-trash" style={{fontSize:13}}/>
                </button>
                <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            </div>
            {isOpen && (
              <div className="border-t border-gray-50">
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="flex gap-2 mb-2">
                    <select defaultValue={sch.venue||''} onBlur={e => updateSchedule(sch.id, 'venue', e.target.value)}
                      onChange={e => updateSchedule(sch.id, 'venue', e.target.value)}
                      className="text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right w-40">
                      <option value="">בחר אולם</option>
                      {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <input value={sch.participants || ''}
                    onChange={e => setSchedules(prev => prev.map(s => s.id === sch.id ? {...s, participants: e.target.value} : s))}
                    onBlur={e => updateSchedule(sch.id, 'participants', e.target.value)}
                    placeholder="משתתפים..."
                    className="w-full text-[13px] px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
                </div>
                {importingId === sch.id && (
                  <div className="px-4 py-2 text-[12px] text-green-600 flex items-center gap-1 flex-row-reverse">
                    <i className="ti ti-loader-2 animate-spin"/> מייבא שורות...
                  </div>
                )}
                <div className="overflow-x-auto"><table className="w-full border-collapse" style={{tableLayout:"auto"}}>
                  <colgroup>
                    <col style={{width:'150px',minWidth:'150px'}}/>
                    <col/>
                    <col/>
                    <col/>
                    <col style={{width:'36px'}}/>
                  </colgroup>
                  <thead>
                    <tr className="bg-[#E0197D] text-white text-[11px] font-semibold">
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{width:"150px"}}>שעה</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">מה</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">מי</th>
                      <th className="px-3 py-2 text-right font-semibold border-r border-red-700">הערות</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                {schRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-[12px] text-gray-400 py-6">אין שורות — הוסף שורה או ייבא מאקסל</td></tr>
                )}
                {schRows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-50 group ${idx%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                    <td className="border-l border-gray-100 px-3 py-2 whitespace-nowrap text-[12px] font-mono text-right" style={{width:'150px',minWidth:'150px'}}>
                      <input value={row.time||''} onChange={e => updateRow(sch.id, row.id, 'time', e.target.value)}
                        className="w-full bg-transparent outline-none text-right font-mono"/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'180px'}}>
                      <textarea value={row.what||''} onChange={e=>updateRow(sch.id,row.id,'what',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.what||'').length/25))}/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'130px'}}>
                      <textarea value={row.who||''} onChange={e=>updateRow(sch.id,row.id,'who',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.who||'').length/20))}/>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-1" style={{minWidth:'130px'}}>
                      <textarea value={row.notes||''} onChange={e=>updateRow(sch.id,row.id,'notes',e.target.value)}
                        className="w-full bg-transparent outline-none text-right text-[12px] text-gray-500 resize-none leading-5 pt-1.5" rows={Math.max(1,Math.ceil((row.notes||'').length/20))}/>
                    </td>
                    <td style={{width:"36px"}} className="align-middle">
                      <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveRow(sch.id, idx, -1)} disabled={idx===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-up" style={{fontSize:10}}/>
                        </button>
                        <button onClick={() => deleteRow(sch.id, row.id)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <i className="ti ti-trash" style={{fontSize:10}}/>
                        </button>
                        <button onClick={() => moveRow(sch.id, idx, 1)} disabled={idx===schRows.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5">
                          <i className="ti ti-chevron-down" style={{fontSize:10}}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                  </tbody>
                </table></div>
                <button onClick={() => addRow(sch.id)}
                  className="w-full py-3 text-[12px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                  <i className="ti ti-plus" style={{fontSize:12}}/> הוסף שורה
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


function ProductionTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({ topic: '', body: '' })
  const [me, setMe] = useState('')
  const [commentsByTask, setCommentsByTask] = useState({})
  const [commentDraft, setCommentDraft] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setMe(p?.full_name || user.email || '')
    }
    const [{ data: ts }, { data: cs }] = await Promise.all([
      supabase.from('production_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('production_task_comments').select('*').order('created_at', { ascending: true }),
    ])
    setTasks(ts || [])
    const map = {}
    for (const cmt of (cs || [])) { (map[cmt.task_id] = map[cmt.task_id] || []).push(cmt) }
    setCommentsByTask(map)
    setLoading(false)
  }
  function fmtDT(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const p = n => String(n).padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  async function addComment(taskId) {
    const body = (commentDraft[taskId] || '').trim()
    if (!body) return
    const { data, error } = await supabase.from('production_task_comments').insert({ task_id: taskId, author: me, body }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return }
    setCommentsByTask(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), data] }))
    setCommentDraft(prev => ({ ...prev, [taskId]: '' }))
  }
  async function addTask() {
    const { data, error } = await supabase.from('production_tasks').insert({ topic: '', body: '', author: me }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return }
    setTasks(prev => [data, ...prev])
    setEditId(data.id)
    setDraft({ topic: '', body: '' })
  }
  function startEdit(t) { setEditId(t.id); setDraft({ topic: t.topic || '', body: t.body || '' }) }
  async function saveEdit(t) {
    setBusy(true)
    const { error } = await supabase.from('production_tasks').update({ topic: draft.topic, body: draft.body }).eq('id', t.id)
    setBusy(false)
    if (error) { alert('שגיאה: ' + error.message); return }
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, topic: draft.topic, body: draft.body } : x))
    setEditId(null)
  }
  async function deleteTask(t) {
    if (!window.confirm('למחוק את המשימה?')) return
    await supabase.from('production_tasks').delete().eq('id', t.id)
    setTasks(prev => prev.filter(x => x.id !== t.id))
    if (editId === t.id) setEditId(null)
  }

  return (
    <div dir="rtl">
      <div className="flex justify-end mb-3">
        <button onClick={addTask} className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus" /> הוסף משימה
        </button>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 text-[13px] py-8">טוען...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-gray-400 text-[13px] py-10 border border-gray-100 rounded-xl">אין משימות עדיין</div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map(t => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-3 bg-white">
              {editId === t.id ? (
                <div className="flex flex-col gap-2">
                  <input value={draft.topic} onChange={e => setDraft(d => ({ ...d, topic: e.target.value }))} placeholder="כותרת נושא"
                    className="text-[14px] font-medium px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                  <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} placeholder="טקסט חופשי..." rows={4}
                    className="text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(t)} disabled={busy} className="bg-[#E0197D] text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">{busy ? 'שומר...' : 'שמור'}</button>
                    <button onClick={() => { setEditId(null); if (!t.topic && !t.body) deleteTask(t) }} className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">ביטול</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-gray-800">{t.topic || '(ללא נושא)'}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{t.author ? `מאת ${t.author} · ` : ''}{fmtDT(t.created_at)}</div>
                      {t.body && <div className="text-[13px] text-gray-600 whitespace-pre-wrap mt-1.5">{t.body}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(t)} title="עריכה" className="text-gray-400 hover:text-[#E0197D] p-1"><i className="ti ti-edit" style={{ fontSize: 16 }} /></button>
                      <button onClick={() => deleteTask(t)} title="מחיקה" className="text-gray-400 hover:text-red-500 p-1"><i className="ti ti-trash" style={{ fontSize: 16 }} /></button>
                    </div>
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    {(commentsByTask[t.id] || []).map(cmt => (
                      <div key={cmt.id} className="text-[12px] mb-1.5">
                        <span className="text-gray-400">{cmt.author || 'אנונימי'} · {fmtDT(cmt.created_at)}</span>
                        <div className="text-gray-700 whitespace-pre-wrap">{cmt.body}</div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-1">
                      <input value={commentDraft[t.id] || ''} onChange={e => setCommentDraft(prev => ({ ...prev, [t.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addComment(t.id) }}
                        placeholder="הוסף תגובה..." className="flex-1 min-w-0 text-[12px] px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                      <button onClick={() => addComment(t.id)} className="text-[12px] text-[#E0197D] hover:text-[#A0106A] flex-shrink-0">שלח</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductionPage() {
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      setTab('inquiries')
    })
  }, [])

  if (!tab) return null

  const PTABS = [
    { id: 'inquiries', label: 'הפקה טכנית', icon: 'ti-clipboard-list' },
    { id: 'tasks', label: 'משימות', icon: 'ti-checklist' },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-4 justify-start" dir="rtl">
        {PTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-sm px-4 py-2 rounded-lg border flex items-center gap-1.5 transition-colors ${tab === t.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'bg-white border-gray-200 text-gray-600 hover:border-[#E0197D]'}`}>
            <i className={`ti ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'tasks' ? <ProductionTasks /> : <ProductionInquiries />}
    </div>
  )
}
