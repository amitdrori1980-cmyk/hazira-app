'use client'
import { useEffect, useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import HaziraLogo from '@/components/HaziraLogo'
import { supabase } from '@/lib/supabase'
// HAZIRA-TEAMCOORD-V3

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
  return Array.from({length: SLOTS}, (_, i) => ({ slot: i, name: '', status: 'white', note: '' }))
}

export default function TeamCoordMode() {
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
  const [prodSearch, setProdSearch] = useState('')
  const [openMonths, setOpenMonths] = useState({})
  const [collapsedMonths, setCollapsedMonths] = useState({})
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewPerson, setReviewPerson] = useState('')
  const [reviewLink, setReviewLink] = useState(null)
  const [reviewResponses, setReviewResponses] = useState([])
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewLinksList, setReviewLinksList] = useState([])
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
  const [allGenScheds, setAllGenScheds] = useState([])
  const [linkPickerFor, setLinkPickerFor] = useState(null)

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
        const { data } = await supabase.from('coord_events').insert({
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
        const firstScroll = () => {
          const el = document.getElementById('prod-ev-' + mid)
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
          if (tries++ < 25) setTimeout(firstScroll, 100)
        }
        const reAnchor = () => {
          const el = document.getElementById('prod-ev-' + mid)
          if (!el) return
          const vh = window.innerHeight || document.documentElement.clientHeight
          const r = el.getBoundingClientRect()
          if (r.bottom < 80 || r.top > vh - 80) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        setTimeout(firstScroll, 120)
        ;[700, 1400, 2400, 3400].forEach(t => setTimeout(reAnchor, t))
        setTimeout(() => setFlashId(null), 3600)
      }
    })()
  }, [loading, events, didAutoOpen])

  async function load() {
    const { data: evs } = await supabase.from('coord_events').select('*')
    setEvents((evs || []).slice().sort((a, b) => (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')))
    const { data: ts } = await supabase.from('event_types').select('*').order('sort_order')
    setEventTypes(ts || [])
    const { data: gscheds } = await supabase.from('general_schedules').select('id,title,linked_event_id')
    setAllGenScheds(gscheds || [])
    if (ts && ts.length) setNewEvent(p => p.type ? p : { ...p, type: ts[0].value })
    if (evs?.length) {
      const { data: ppl } = await supabase.from('coord_people').select('*').in('coord_event_id', evs.map(e => e.id))
      const map = {}
      evs.forEach(e => { map[e.id] = emptySlots() })
      ;(ppl || []).forEach(p => {
        if (map[p.coord_event_id] && p.slot < SLOTS) {
          map[p.coord_event_id][p.slot] = { slot: p.slot, name: p.name || '', status: p.status || 'white', note: p.note || '' }
        }
      })
      setSlots(map)
    }
    setLoading(false)
  }

  const linkedFor = ev => allGenScheds.find(g => g.linked_event_id === ev.id) || null

  async function linkSchedule(ev, gsId) {
    if (!ev || !gsId) return
    await supabase.from('general_schedules').update({ linked_event_id: null }).eq('linked_event_id', ev.id)
    await supabase.from('general_schedules').update({ linked_event_id: ev.id }).eq('id', gsId)
    setAllGenScheds(prev => prev.map(g => g.id === gsId ? { ...g, linked_event_id: ev.id } : (g.linked_event_id === ev.id ? { ...g, linked_event_id: null } : g)))
    setLinkPickerFor(null)
  }

  async function unlinkSchedule(gs) {
    if (!gs) return
    await supabase.from('general_schedules').update({ linked_event_id: null }).eq('id', gs.id)
    setAllGenScheds(prev => prev.map(g => g.id === gs.id ? { ...g, linked_event_id: null } : g))
  }

  function openLinkedSchedule(gs) {
    if (!gs) return
    window.location.href = '/dashboard/specs?tab=rundowns&schedule=' + gs.id
  }

  async function addEvent() {
    if (!newEvent.event_name.trim()) return
    setSavingEvent(true)
    const { data } = await supabase.from('coord_events').insert({
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
      const t = new Date()
      const todayIso = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0')
      const { data } = await supabase.from('events').select('id, title, date, end_date, time, venue, type').order('date', { ascending: true })
      // לא להציע אירועי עבר (אירוע שכבר הסתיים)
      setCalEvents((data || []).filter(e => (e.end_date || e.date || '') >= todayIso))
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
    const { data } = await supabase.from('coord_events').insert({
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
    await supabase.from('coord_events').update({ deleted_at: ts }).in('id', ids)
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
      await supabase.from('coord_events').update({ deleted_at: ts }).in('id', delIds)
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
    await supabase.from('coord_events').update(editEventVal).eq('id', editingEvent)
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
    const { error } = await supabase.from('coord_events').update({ deleted_at: ts }).eq('id', id)
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
    await supabase.from('coord_events').update({ deleted_at: null }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, deleted_at: null } : e))
  }

  async function purgeEvent(id) {
    await supabase.from('coord_people').delete().eq('coord_event_id', id)
    await supabase.from('coord_events').delete().eq('id', id)
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
    await supabase.from('coord_people').upsert({
      coord_event_id: eventId, slot: slotIdx, name: slot.name, status: slot.status,
    }, { onConflict: 'coord_event_id,slot' })
  }

  async function updateSlotStatus(eventId, slotIdx, status) {
    setSlots(prev => {
      const updated = [...(prev[eventId] || emptySlots())]
      updated[slotIdx] = { ...updated[slotIdx], status, note: '' }
      return { ...prev, [eventId]: updated }
    })
    setStatusPicker(null)
    await supabase.from('coord_people').upsert({
      coord_event_id: eventId, slot: slotIdx,
      name: (slots[eventId]||emptySlots())[slotIdx].name, status, note: '',
    }, { onConflict: 'coord_event_id,slot' })
  }


  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  const todayStr = new Date().toISOString().slice(0, 10)
  const liveEvents = events.filter(e => !e.deleted_at)
  const deletedEvents = events.filter(e => e.deleted_at)
  const activeEvents = liveEvents.filter(e => !(e.date && e.date < todayStr))
  const activeFiltered = prodSearch.trim()
    ? activeEvents.filter(e => (e.event_name || '').toLowerCase().includes(prodSearch.trim().toLowerCase()))
    : activeEvents
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
    activeFiltered.forEach(e => {
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
    await supabase.from('coord_events').update({ notes: val }).eq('id', ev.id)
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
    await supabase.from('coord_events').update({ sort_order: newOrder }).eq('id', srcId)
    setEvents(prev => prev.map(e => e.id === srcId ? { ...e, sort_order: newOrder } : e))
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function greenItems() {
    const items = []
    ;(events || []).forEach(ev => {
      if (ev.deleted_at) return
      const arr = slots[ev.id] || []
      arr.forEach(s => {
        if ((s.status === 'green' || s.status === 'teal') && s.name && s.name.trim()) {
          items.push({ eid: ev.id, slot: s.slot, name: s.name.trim(), event_name: ev.event_name || '', date: ev.date || '', venue: ev.venue || '' })
        }
      })
    })
    return items
  }

  function greenPeople() {
    const counts = {}
    greenItems().forEach(i => { counts[i.name] = (counts[i.name] || 0) + 1 })
    return Object.keys(counts).sort().map(name => ({ name, count: counts[name] }))
  }

  async function loadReviewLinksList() {
    const { data } = await supabase.from('coord_review_links').select('person_name').order('created_at', { ascending: false })
    setReviewLinksList(data || [])
  }

  function reviewablePeople() {
    const byName = {}
    greenPeople().forEach(g => { byName[g.name] = { name: g.name, count: g.count, hasLink: false } })
    ;(reviewLinksList || []).forEach(l => {
      if (!l.person_name) return
      if (!byName[l.person_name]) byName[l.person_name] = { name: l.person_name, count: 0, hasLink: true }
      else byName[l.person_name].hasLink = true
    })
    return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name))
  }

  async function buildNewLink(name) {
    const items = greenItems().filter(i => i.name === name)
    if (!items.length) { alert('אין פעולות בירוק לאיש הצוות הזה'); return null }
    let uid = null
    try { const { data } = await supabase.auth.getUser(); uid = data?.user?.id || null } catch (e) {}
    const token = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2))
    const { data, error } = await supabase.from('coord_review_links').insert({ token, person_name: name, created_by: uid, items }).select().single()
    if (error) { alert('שגיאה: ' + error.message); return null }
    return data
  }

  async function openReviewForPerson(name) {
    if (!name) return
    setReviewPerson(name)
    setReviewBusy(true)
    const { data: existing } = await supabase.from('coord_review_links').select('*').eq('person_name', name).order('created_at', { ascending: false }).limit(1)
    let lk = existing && existing[0]
    const liveGreen = greenItems().filter(i => i.name === name)
    if (!lk) {
      if (!liveGreen.length) { setReviewBusy(false); alert('אין פעולות בירוק לאיש הצוות הזה'); return }
      lk = await buildNewLink(name)
      if (!lk) { setReviewBusy(false); return }
      setReviewLink(lk); setReviewResponses([]); setReviewBusy(false); return
    }
    const { data: rs } = await supabase.from('coord_review_responses').select('*').eq('token', lk.token)
    const respondedKeys = (rs || []).filter(r => r.decision && r.item_key).map(r => r.item_key)
    const seen = new Set()
    const merged = []
    const pushKey = (k, obj) => { if (seen.has(k)) return; seen.add(k); merged.push(obj) }
    liveGreen.forEach(i => pushKey(i.eid + ':' + i.slot, i))
    respondedKeys.forEach(k => {
      const parts = k.split(':'); const eid = parts[0]; const slot = parseInt(parts[1], 10)
      const ev = (events || []).find(e => e.id === eid)
      const nm = (slots[eid] && slots[eid][slot] && slots[eid][slot].name) || name
      pushKey(k, { eid, slot, name: nm, event_name: ev ? (ev.event_name || '') : '', date: ev ? (ev.date || '') : '', venue: ev ? (ev.venue || '') : '' })
    })
    await supabase.from('coord_review_links').update({ items: merged }).eq('token', lk.token)
    lk = { ...lk, items: merged }
    setReviewLink(lk)
    setReviewResponses(rs || [])
    setReviewBusy(false)
  }

  async function forceNewReviewLink() {
    if (!reviewPerson) return
    if (!window.confirm('ליצור לינק חדש? הלינק הקודם והתגובות בו לא יוצגו יותר כאן.')) return
    setReviewBusy(true)
    const lk = await buildNewLink(reviewPerson)
    if (lk) { setReviewLink(lk); setReviewResponses([]) }
    setReviewBusy(false)
  }

  async function loadReviewResponses() {
    if (!reviewLink) return
    const { data } = await supabase.from('coord_review_responses').select('*').eq('token', reviewLink.token)
    setReviewResponses(data || [])
  }

  async function applyReviewResponses() {
    if (!reviewLink) return
    setReviewBusy(true)
    const { data: resp, error: rerr } = await supabase.from('coord_review_responses').select('*').eq('token', reviewLink.token)
    if (rerr) { setReviewBusy(false); alert('שגיאה בטעינת תגובות: ' + rerr.message); return }
    let items = reviewLink.items || []
    if (typeof items === 'string') { try { items = JSON.parse(items) } catch (e) { items = [] } }
    let applied = 0
    let firstErr = null
    for (const r of (resp || [])) {
      let it = null
      if (r.item_key) it = items.find(x => (x.eid + ':' + x.slot) === r.item_key)
      if (!it && r.item_index != null) it = items[r.item_index]
      if (!it) continue
      const status = r.decision === 'approve' ? 'yellow' : r.decision === 'reject' ? 'red' : null
      if (!status) continue
      const payload = { coord_event_id: it.eid, slot: it.slot, name: it.name, status }
      if (r.note && r.note.trim()) payload.note = r.note.trim()
      const { error } = await supabase.from('coord_people').upsert(payload, { onConflict: 'coord_event_id,slot' })
      if (error) { if (!firstErr) firstErr = error.message; continue }
      applied++
      setSlots(prev => {
        const arr = [...(prev[it.eid] || [])]
        if (arr[it.slot]) arr[it.slot] = { ...arr[it.slot], status, ...(payload.note != null ? { note: payload.note } : {}) }
        return { ...prev, [it.eid]: arr }
      })
    }
    await supabase.from('coord_review_links').update({ applied: true }).eq('token', reviewLink.token)
    setReviewBusy(false)
    if (firstErr) { alert('נשמרו ' + applied + ' פעולות. שגיאה: ' + firstErr); return }
    if (applied === 0) { alert('לא נמצאו תגובות לשמירה. ודא שאיש הצוות סימן אישור/לא יכול, ושלחצת "רענן תגובות".'); return }
    alert('נשמרו ' + applied + ' סטטוסים חזרה לאירועים')
    closeReview()
  }

  function closeReview() {
    setReviewOpen(false); setReviewPerson(''); setReviewLink(null); setReviewResponses([])
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
            <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 md:flex-row-reverse">
              <div className="flex-1 min-w-0 text-right w-full">
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
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 min-w-0">
                    <div className="text-[13px] font-semibold text-black break-words min-w-0">{ev.event_name}</div>
                    <div className="text-[13px] font-semibold text-black flex items-center gap-2 flex-wrap">
                      {ev.date && <span>{fmtDate(ev.date)}</span>}
                      {ev.day && <span>יום {ev.day}</span>}
                      {ev.venue && <span>{ev.venue}</span>}
                      {ev.type && <span className={`px-1.5 py-0.5 rounded-full ${getTypeStyle(ev.type)}`}>{getTypeLabel(ev.type)}</span>}
                    </div>
                    </div>
                    {/* רשימת אנשים גלויה תמיד — שם ניטרלי + נקודת צבע לסטטוס, לחיצה פותחת תפריט */}
                    <div className="flex flex-wrap items-end gap-2 mt-1.5">
                    <div dir="rtl" className="flex gap-1.5 justify-start flex-wrap flex-1 min-w-0" onClick={e => e.stopPropagation()}>
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
                            {slot.note && slot.note.trim() && (
                              <button onClick={(e)=>{e.stopPropagation(); alert('הערה מ' + (slot.name||'') + ':\n\n' + slot.note)}} title={slot.note}
                                className="text-[#E0197D] hover:text-[#A0106A] flex-shrink-0"><i className="ti ti-message-2" style={{fontSize:13}}/></button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <textarea value={notesDraft[ev.id] ?? (ev.notes || '')} onClick={e=>e.stopPropagation()}
                      onChange={e=>setNotesDraft(d=>({...d,[ev.id]:e.target.value}))} onBlur={()=>saveNotes(ev)}
                      placeholder="הערות" dir="ltr" rows={2}
                      className="w-full md:w-80 shrink-0 self-end text-[11px] px-2 py-1 border border-black rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] resize-y text-left"/>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-start shrink-0">
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
                {(() => {
                  const linkedGs = linkedFor(ev)
                  if (linkPickerFor === ev.id) {
                    return (
                      <select autoFocus defaultValue="" onClick={e=>e.stopPropagation()}
                        onChange={e => { if (e.target.value) linkSchedule(ev, e.target.value); else setLinkPickerFor(null) }}
                        onBlur={() => setLinkPickerFor(null)}
                        className="no-print text-[12px] px-2 py-1 border border-[#E0197D] rounded-lg bg-white outline-none text-right max-w-[150px]">
                        <option value="">בחר לוז…</option>
                        {allGenScheds.map(g => <option key={g.id} value={g.id}>{g.title}{g.linked_event_id && g.linked_event_id !== ev.id ? ' (מקושר)' : ''}</option>)}
                      </select>
                    )
                  }
                  if (linkedGs) {
                    return (
                      <>
                        <button onClick={e=>{e.stopPropagation();openLinkedSchedule(linkedGs)}}
                          className="text-[#E0197D] hover:text-[#A0106A] p-1" title={'פתח לוז: ' + linkedGs.title}>
                          <i className="ti ti-list" style={{fontSize:13}}/></button>
                        <button onClick={e=>{e.stopPropagation();unlinkSchedule(linkedGs)}}
                          className="text-black hover:text-red-500 p-1" title="נתק לוז">
                          <i className="ti ti-unlink" style={{fontSize:13}}/></button>
                      </>
                    )
                  }
                  return (
                    <button onClick={e=>{e.stopPropagation();setLinkPickerFor(ev.id)}}
                      className="text-black hover:text-[#E0197D] p-1" title="קשר לוז">
                      <i className="ti ti-link" style={{fontSize:13}}/></button>
                  )
                })()}
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
            <button onClick={() => { setReviewOpen(true); setReviewPerson(''); setReviewLink(null); setReviewResponses([]); loadReviewLinksList() }}
              className="bg-white border border-[#14b8a6] text-[#0f766e] text-sm px-4 py-2 rounded-lg hover:bg-[#ccfbf1] flex items-center justify-center gap-1 flex-1 min-w-[130px] md:flex-none md:min-w-[150px]">
              <i className="ti ti-clipboard-check"/> שלח לבדיקה
            </button>
          </>
        )}
        <button onClick={openImport}
          className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 flex-1 min-w-[130px] md:flex-none md:min-w-[150px]">
          <i className="ti ti-calendar-down"/> ייבא מהיומן
        </button>
        <button onClick={() => { setShowNewEvent(v => !v); setShowImport(false) }}
          className="bg-white border border-[#E0197D] text-[#E0197D] text-sm px-4 py-2 rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1 flex-1 min-w-[130px] md:flex-none md:min-w-[150px]">
          <i className="ti ti-plus"/> אירוע חדש
        </button>
      </div>
      {reviewOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-3 no-print" onClick={closeReview}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg my-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={closeReview} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{fontSize:18}}/></button>
              <div className="text-[15px] font-bold text-gray-800 text-right">שליחה לבדיקה</div>
            </div>

            {!reviewLink ? (
              <div>
                <div className="text-[13px] text-gray-500 mb-2 text-right">בחר איש צוות — ייאספו כל הפעולות שמסומנות אצלו בירוק או טורקיז:</div>
                {reviewablePeople().length === 0 ? (
                  <div className="text-[13px] text-gray-400 text-center py-6">אין כרגע פעולות לבדיקה</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {reviewablePeople().map(p => (
                      <button key={p.name} disabled={reviewBusy} onClick={() => openReviewForPerson(p.name)}
                        className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 hover:border-[#14b8a6] hover:bg-[#f0fdfa] text-right disabled:opacity-50">
                        <span className="text-[12px] text-gray-400">{p.count > 0 ? p.count + ' פעולות לבדיקה' : (p.hasLink ? 'לינק קיים' : '')}</span>
                        <span className="text-[14px] font-medium text-gray-800">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-[14px] font-bold text-gray-800 text-right mb-1">{reviewLink.person_name}</div>
                <div className="text-[12px] text-gray-500 text-right mb-3">{(reviewLink.items||[]).length} פעולות לבדיקה</div>

                <div className="text-[12px] text-gray-500 text-right mb-1">לינק לשליחה:</div>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => { try { navigator.clipboard.writeText((typeof window!=='undefined'?window.location.origin:'') + '/coord-review/' + reviewLink.token); alert('הלינק הועתק') } catch(e){} }}
                    className="bg-[#14b8a6] text-white text-[12px] px-3 py-2 rounded-lg hover:bg-[#0f766e] flex-shrink-0">העתק</button>
                  <button onClick={() => { if (typeof window!=='undefined') window.open(window.location.origin + '/coord-review/' + reviewLink.token, '_blank') }}
                    className="bg-white border border-[#14b8a6] text-[#0f766e] text-[12px] px-3 py-2 rounded-lg hover:bg-[#ccfbf1] flex-shrink-0 flex items-center gap-1"><i className="ti ti-external-link" style={{fontSize:13}}/> פתח</button>
                  <input readOnly value={(typeof window!=='undefined'?window.location.origin:'') + '/coord-review/' + reviewLink.token}
                    className="flex-1 text-[12px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none text-left" dir="ltr"/>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button onClick={loadReviewResponses} className="text-[12px] text-[#14b8a6] hover:underline flex items-center gap-1"><i className="ti ti-refresh" style={{fontSize:13}}/> רענן תגובות</button>
                    <button onClick={forceNewReviewLink} className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1"><i className="ti ti-plus" style={{fontSize:13}}/> לינק חדש</button>
                  </div>
                  <div className="text-[12px] font-medium text-gray-700">תגובות שהתקבלו</div>
                </div>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 mb-4 max-h-60 overflow-y-auto">
                  {(reviewLink.items||[]).map((it, idx) => {
                    const r = reviewResponses.find(x => x.item_key === (it.eid + ':' + it.slot)) || reviewResponses.find(x => x.item_index === idx)
                    const decLabel = r?.decision === 'approve' ? 'אישר' : r?.decision === 'reject' ? 'לא יכול' : 'ממתין'
                    const decColor = r?.decision === 'approve' ? 'text-yellow-700 bg-yellow-100' : r?.decision === 'reject' ? 'text-red-700 bg-red-100' : 'text-gray-400 bg-gray-100'
                    return (
                      <div key={idx} className="p-2.5 text-right">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${decColor}`}>{decLabel}</span>
                          <span className="text-[13px] text-gray-800 flex-1">{it.event_name}{it.date ? ` · ${fmtDate(it.date)}` : ''}{it.venue ? ` · ${it.venue}` : ''}</span>
                        </div>
                        {r?.note && <div className="text-[12px] text-gray-500 mt-1">הערה: {r.note}</div>}
                        {r?.updated_at && r?.decision && <div className="text-[11px] text-gray-400 mt-0.5">עודכן: {new Date(r.updated_at).toLocaleString('he-IL', {day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
                      </div>
                    )
                  })}
                </div>

                <button onClick={applyReviewResponses} disabled={reviewBusy}
                  className="w-full bg-[#E0197D] text-white text-[13px] px-4 py-2.5 rounded-lg hover:bg-[#A0106A] disabled:opacity-50 flex items-center justify-center gap-1">
                  <i className="ti ti-device-floppy"/> {reviewBusy ? 'שומר...' : 'שמור סטטוסים חזרה לאירועים'}
                </button>
                <div className="text-[11px] text-gray-400 text-center mt-2">אישר → צהוב · לא יכול → אדום</div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="mb-3 no-print">
            <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
              placeholder="חיפוש לפי שם אירוע..."
              className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
          </div>
          <div className="flex justify-end mb-2 no-print">
            <button onClick={() => {
              const allCollapsed = activeMonthGroups.every(g => collapsedMonths[g.key])
              if (allCollapsed) setCollapsedMonths({})
              else { const next = {}; activeMonthGroups.forEach(g => { next[g.key] = true }); setCollapsedMonths(next) }
            }} className="text-[11px] text-gray-500 hover:text-[#E0197D]">
              {activeMonthGroups.every(g => collapsedMonths[g.key]) ? 'הרחב הכל' : 'כווץ הכל'}
            </button>
          </div>
          <table className="w-full table-fixed" style={{ borderCollapse: 'collapse' }}>
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
          {activeMonthGroups.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">לא נמצאו אירועים</div>
          )}
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

