'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

const PANEL_CREW = 'crew'
const PANEL_EQUIP = 'equip'

function EventsPageInner() {
  const searchParams = useSearchParams()
  const [events, setEvents]         = useState([])
  const [depts, setDepts]           = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [allCrew, setAllCrew]       = useState([])
  const [allEquip, setAllEquip]     = useState([])
  const [venues, setVenues]         = useState([])
  const [eventCrew, setEventCrew]   = useState({})
  const [eventEquip, setEventEquip] = useState({})
  const [loading, setLoading]       = useState(true)
  const [form, setForm] = useState({ title:'', date: (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('date') : '') || '', end_date:'', time:'', type:'', description:'', crew_notes:'', venue:'', depts:[] })
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)
  const [editVal, setEditVal]       = useState({})
  const [openPanel, setOpenPanel]   = useState(null)
  const [equipQty, setEquipQty]     = useState({})
  const [duplicating, setDuplicating] = useState(null)
  const [dupForm, setDupForm]         = useState({})
  const [savingDup, setSavingDup]     = useState(false)

  useEffect(() => {
    load()
    const date = searchParams.get('date')
    if (date) {
      setTimeout(() => {
        document.getElementById('add-event-form')?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [])

  async function load() {
    const [
      { data: evs },
      { data: ds },
      { data: ts },
      { data: crew },
      { data: equip },
      { data: ven },
      { data: ec },
      { data: ee },
    ] = await Promise.all([
      supabase.from('events').select('*').order('date'),
      supabase.from('departments').select('name').order('name'),
      supabase.from('event_types').select('*').order('sort_order'),
      supabase.from('crew_members').select('id,full_name,role,dept').eq('active',true).order('full_name'),
      supabase.from('equipment').select('id,name,quantity,location').order('name'),
      supabase.from('venues').select('name').order('sort_order'),
      supabase.from('event_crew').select('event_id,crew_member_id'),
      supabase.from('event_equipment').select('event_id,equipment_id,quantity_needed,note'),
    ])
    setEvents(evs || [])
    setDepts((ds||[]).map(d=>d.name))
    const types = ts || []
    setEventTypes(types)
    if (types.length) setForm(f=>({...f,type:types[0].value}))
    setAllCrew(crew||[])
    setAllEquip(equip||[])
    setVenues((ven||[]).map(v=>v.name))

    const cm = {}
    ;(ec||[]).forEach(r=>{ if(!cm[r.event_id])cm[r.event_id]=[]; cm[r.event_id].push(r.crew_member_id) })
    setEventCrew(cm)

    const em = {}
    ;(ee||[]).forEach(r=>{ if(!em[r.event_id])em[r.event_id]=[]; em[r.event_id].push(r) })
    setEventEquip(em)

    setLoading(false)
  }

  const getTypeStyle = v => { const t=eventTypes.find(t=>t.value===v); return t?t.color:'bg-gray-100 text-gray-600' }
  const getTypeLabel = v => { const t=eventTypes.find(t=>t.value===v); return t?t.label:v }

  function toggleDept(dept) {
    setForm(f=>({...f, depts: f.depts.includes(dept)?f.depts.filter(d=>d!==dept):[...f.depts,dept]}))
  }

  function isOpen(eventId, type) { return openPanel?.id===eventId && openPanel?.type===type }
  function togglePanel(eventId, type) {
    setOpenPanel(p => (p?.id===eventId && p?.type===type) ? null : {id:eventId,type})
  }

  async function addEvent(e) {
    e.preventDefault()
    if(!form.title||!form.date) return
    setAdding(true)
    const payload={...form, depts:form.depts.length?form.depts:depts, end_date:form.end_date||null, time:form.time||null}
    const {data,error}=await supabase.from('events').insert(payload).select().single()
    if(!error){
      setEvents(prev=>[...prev,data].sort((a,b)=>a.date.localeCompare(b.date)))
      setEventCrew(prev=>({...prev,[data.id]:[]}))
      setEventEquip(prev=>({...prev,[data.id]:[]}))
    }
    setForm(f=>({...f,title:'',date:'',end_date:'',time:'',description:'',crew_notes:'',depts:[]}))
    setAdding(false)
  }

  async function deleteEvent(id) {
    await supabase.from('events').delete().eq('id',id)
    setEvents(prev=>prev.filter(e=>e.id!==id))
  }

  function startEdit(ev) {
    setEditing(ev.id)
    setEditVal({title:ev.title,date:ev.date,end_date:ev.end_date||'',time:ev.time||'',type:ev.type,description:ev.description||'',crew_notes:ev.crew_notes||''})
  }
  async function saveEdit(id) {
    await supabase.from('events').update(editVal).eq('id',id)
    setEvents(prev=>prev.map(e=>e.id===id?{...e,...editVal}:e))
    setEditing(null)
  }

  function startDuplicate(ev) {
    setDuplicating(ev)
    setDupForm({ title: ev.title + ' (עותק)', date: '', end_date: ev.end_date||'', time: ev.time||'', type: ev.type, description: ev.description||'', crew_notes: ev.crew_notes||'', venue: ev.venue||'', depts: ev.depts||[] })
  }

  async function saveDuplicate(e) {
    e.preventDefault()
    if (!dupForm.date) return
    setSavingDup(true)
    const { data, error } = await supabase.from('events').insert({ ...dupForm, end_date: dupForm.end_date||null, time: dupForm.time||null }).select().single()
    if (!error) {
      setEvents(prev => [...prev, data].sort((a,b) => a.date.localeCompare(b.date)))
      setEventCrew(prev => ({ ...prev, [data.id]: [] }))
      setEventEquip(prev => ({ ...prev, [data.id]: [] }))
    }
    setDuplicating(null)
    setSavingDup(false)
  }

  async function toggleCrewMember(eventId, memberId) {
    const current=eventCrew[eventId]||[]
    if(current.includes(memberId)){
      await supabase.from('event_crew').delete().eq('event_id',eventId).eq('crew_member_id',memberId)
      setEventCrew(prev=>({...prev,[eventId]:prev[eventId].filter(id=>id!==memberId)}))
    } else {
      await supabase.from('event_crew').insert({event_id:eventId,crew_member_id:memberId})
      setEventCrew(prev=>({...prev,[eventId]:[...(prev[eventId]||[]),memberId]}))
    }
  }

  async function toggleEquipItem(eventId, equipId) {
    const current=eventEquip[eventId]||[]
    const exists=current.find(r=>r.equipment_id===equipId)
    if(exists){
      await supabase.from('event_equipment').delete().eq('event_id',eventId).eq('equipment_id',equipId)
      setEventEquip(prev=>({...prev,[eventId]:prev[eventId].filter(r=>r.equipment_id!==equipId)}))
    } else {
      const qty=equipQty[equipId]||''
      const {data}=await supabase.from('event_equipment').insert({event_id:eventId,equipment_id:equipId,quantity_needed:qty}).select().single()
      if(data) setEventEquip(prev=>({...prev,[eventId]:[...(prev[eventId]||[]),data]}))
    }
  }

  async function updateEquipQty(eventId, equipId, qty) {
    await supabase.from('event_equipment').update({quantity_needed:qty}).eq('event_id',eventId).eq('equipment_id',equipId)
    setEventEquip(prev=>({...prev,[eventId]:prev[eventId].map(r=>r.equipment_id===equipId?{...r,quantity_needed:qty}:r)}))
  }
