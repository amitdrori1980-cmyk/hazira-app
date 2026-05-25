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

  return (
    <div className="max-w-xl">
      {duplicating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl" dir="rtl">
            <div className="text-[15px] font-semibold text-gray-800 mb-4">שכפול אירוע</div>
            <form onSubmit={saveDuplicate} className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-gray-500 mb-1 block">שם האירוע</label>
                <input value={dupForm.title||""} onChange={e=>setDupForm(f=>({...f,title:e.target.value}))}
                  className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#FF3EB5]" required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-gray-500 mb-1 block">תאריך חדש *</label>
                  <input type="date" value={dupForm.date||""} onChange={e=>setDupForm(f=>({...f,date:e.target.value}))}
                    className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#FF3EB5]" required/>
                </div>
                <div>
                  <label className="text-[12px] text-gray-500 mb-1 block">שעה</label>
                  <input type="time" value={dupForm.time||""} onChange={e=>setDupForm(f=>({...f,time:e.target.value}))}
                    className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-gray-500 mb-1 block">סוג</label>
                <select value={dupForm.type||""} onChange={e=>setDupForm(f=>({...f,type:e.target.value}))}
                  className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#FF3EB5]">
                  {eventTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] text-gray-500 mb-1 block">תיאור</label>
                <textarea value={dupForm.description||""} onChange={e=>setDupForm(f=>({...f,description:e.target.value}))}
                  rows={2} className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#FF3EB5] resize-none"/>
              </div>
              <div className="flex gap-2 mt-1">
                <button type="submit" disabled={savingDup}
                  className="flex-1 bg-[#FF3EB5] text-white text-sm py-2.5 rounded-xl font-medium disabled:opacity-50">
                  {savingDup ? "שומר..." : "שכפל אירוע"}
                </button>
                <button type="button" onClick={()=>setDuplicating(null)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add form */}
      <div id="add-event-form" className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">הוסף אירוע חדש</div>
        <form onSubmit={addEvent} className="flex flex-col gap-2">
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="שם האירוע *"
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} type="date"
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
            <input value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} type="time"
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">עד תאריך:</span>
            <input value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} type="date"
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          </div>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none">
            {eventTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="תיאור"
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
          <select value={form.venue} onChange={e=>setForm(f=>({...f,venue:e.target.value}))}
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]">
            <option value="">בחר אולם...</option>
            {venues.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <textarea value={form.crew_notes} onChange={e=>setForm(f=>({...f,crew_notes:e.target.value}))}
            placeholder="הערות לצוות..." rows={2}
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5] resize-none"/>

          <button type="submit" disabled={adding}
            className="bg-[#FF3EB5] text-white text-sm py-2 rounded-lg hover:bg-[#CC0090] disabled:opacity-50">
            {adding?'מוסיף...':'הוסף אירוע'}
          </button>
        </form>
      </div>

      {/* Events list */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">כל האירועים</div>
        {loading ? <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        : events.length===0 ? <div className="text-center text-sm text-gray-400 py-6">אין אירועים</div>
        : events.map(ev=>{
          const [y,m,d]=ev.date.split('-').map(Number)
          const assignedCrew=(eventCrew[ev.id]||[]).map(id=>allCrew.find(c=>c.id===id)).filter(Boolean)
          const assignedEquip=eventEquip[ev.id]||[]

          return (
            <div key={ev.id} className="border-b border-gray-50 last:border-0">
              {editing===ev.id ? (
                <div className="py-2 flex flex-col gap-2">
                  <input value={editVal.title} onChange={e=>setEditVal(v=>({...v,title:e.target.value}))}
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editVal.date} onChange={e=>setEditVal(v=>({...v,date:e.target.value}))} type="date"
                      className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                    <input value={editVal.end_date||''} onChange={e=>setEditVal(v=>({...v,end_date:e.target.value}))} type="date" placeholder="עד תאריך"

                      className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                    <input value={editVal.time} onChange={e=>setEditVal(v=>({...v,time:e.target.value}))} type="time"
                      className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  </div>
                  <select value={editVal.type} onChange={e=>setEditVal(v=>({...v,type:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none">
                    {eventTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input value={editVal.description} onChange={e=>setEditVal(v=>({...v,description:e.target.value}))}
                    placeholder="תיאור" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]"/>
                  <select value={editVal.venue||''} onChange={e=>setEditVal(v=>({...v,venue:e.target.value}))}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5]">
                    <option value="">בחר אולם...</option>
                    {venues.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea value={editVal.crew_notes||''} onChange={e=>setEditVal(v=>({...v,crew_notes:e.target.value}))}
                    placeholder="הערות לצוות..." rows={2}
                    className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#FF3EB5] resize-none"/>
                  <div className="flex gap-2">
                    <button onClick={()=>saveEdit(ev.id)} className="flex-1 bg-[#FF3EB5] text-white text-sm py-1.5 rounded-lg">שמור</button>
                    <button onClick={()=>setEditing(null)} className="flex-1 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg">ביטול</button>
                  </div>
                </div>
              ) : (
                <div className="py-2.5">
                  <div className="flex items-center gap-2 flex-row-reverse group">
                    <div className="text-[11px] text-gray-400 w-20 text-right flex-shrink-0">
                      {d} {HE_MONTHS[m-1]}{ev.time?', '+ev.time.slice(0,5):''}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="text-[13px] text-gray-800">{ev.title}</div>
                      {ev.description&&<div className="text-[11px] text-gray-400">{ev.description}</div>}
                      {ev.venue&&<div className="text-[11px] text-gray-500 flex items-center gap-1 flex-row-reverse justify-end"><i className="ti ti-map-pin" style={{fontSize:10,color:'#FF3EB5'}}/>{ev.venue}</div>}
                      {ev.crew_notes&&(
                        <div className="text-[11px] text-[#CC0090] bg-[#FFE6F5] rounded px-1.5 py-0.5 mt-0.5 inline-block">
                          📝 {ev.crew_notes}
                        </div>
                      )}
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getTypeStyle(ev.type)}`}>
                      {getTypeLabel(ev.type)}
                    </span>
                    <button onClick={()=>togglePanel(ev.id,PANEL_CREW)}
                      title="צוות"
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${isOpen(ev.id,PANEL_CREW)?'bg-[#FF3EB5] text-white border-[#FF3EB5]':'border-gray-200 text-gray-500 hover:border-[#FF3EB5]'}`}>
                      <i className="ti ti-users" style={{fontSize:11}}/>
                      {assignedCrew.length}
                    </button>
                    <button onClick={()=>togglePanel(ev.id,PANEL_EQUIP)}
                      title="ציוד"
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${isOpen(ev.id,PANEL_EQUIP)?'bg-[#FF3EB5] text-white border-[#FF3EB5]':'border-gray-200 text-gray-500 hover:border-[#FF3EB5]'}`}>
                      <i className="ti ti-tool" style={{fontSize:11}}/>
                      {assignedEquip.length}
                    </button>
                    <button onClick={()=>startDuplicate(ev)} className="text-gray-200 hover:text-[#FF3EB5] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <i className="ti ti-copy" style={{fontSize:13}}/>
                    </button>
                    <button onClick={()=>startEdit(ev)} className="text-gray-200 hover:text-[#FF3EB5] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                    <button onClick={()=>{if(window.confirm('למחוק את האירוע "' + ev.title + '"?'))deleteEvent(ev.id)}} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  </div>

                  {isOpen(ev.id,PANEL_CREW)&&(
                    <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-[11px] font-medium text-gray-500 mb-2 text-right">שיוך צוות לאירוע</div>
                      {allCrew.length===0?(
                        <div className="text-[12px] text-gray-400 text-center py-2">הוסף אנשי צוות בדף הצוות תחילה</div>
                      ):(
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {allCrew.map(member=>{
                            const assigned=(eventCrew[ev.id]||[]).includes(member.id)
                            return (
                              <button key={member.id} onClick={()=>toggleCrewMember(ev.id,member.id)}
                                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${assigned?'bg-[#FF3EB5] text-white border-[#FF3EB5]':'border-gray-200 text-gray-600 hover:border-[#FF3EB5] bg-white'}`}>
                                {member.full_name}{member.role?` · ${member.role}`:''}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {isOpen(ev.id,PANEL_EQUIP)&&(
                    <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-[11px] font-medium text-gray-500 mb-2 text-right">ציוד לאירוע</div>
                      {allEquip.length===0?(
                        <div className="text-[12px] text-gray-400 text-center py-2">הוסף ציוד בדף הציוד תחילה</div>
                      ):(
                        <div className="flex flex-col gap-1.5">
                          {allEquip.map(item=>{
                            const row=assignedEquip.find(r=>r.equipment_id===item.id)
                            const assigned=!!row
                            return (
                              <div key={item.id} className="flex items-center gap-2 flex-row-reverse">
                                <button onClick={()=>toggleEquipItem(ev.id,item.id)}
                                  className={`flex-1 text-right text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${assigned?'bg-[#FFE6F5] border-[#FF3EB5] text-[#CC0090] font-medium':'border-gray-200 text-gray-600 hover:border-[#FF3EB5] bg-white'}`}>
                                  <div>{item.name}</div>
                                  {item.location&&<div className="text-[10px] text-gray-400">{item.location}</div>}
                                </button>
                                {assigned&&(
                                  <input
                                    value={row.quantity_needed||''}
                                    onChange={e=>updateEquipQty(ev.id,item.id,e.target.value)}
                                    placeholder="כמות"
                                    className="w-16 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-[#FF3EB5] text-center"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {assignedEquip.length>0&&(
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <div className="text-[11px] font-medium text-gray-500 mb-1.5 text-right">סיכום ציוד ({assignedEquip.length} פריטים):</div>
                          <div className="flex flex-col gap-1">
                            {assignedEquip.map(row=>{
                              const item=allEquip.find(i=>i.id===row.equipment_id)
                              return item?(
                                <div key={row.id} className="flex items-center gap-2 flex-row-reverse text-[11px]">
                                  <span className="flex-1 text-right text-gray-700">{item.name}</span>
                                  {row.quantity_needed&&<span className="text-[#FF3EB5] font-medium">{row.quantity_needed}</span>}
                                  {item.location&&<span className="text-gray-400">{item.location}</span>}
                                </div>
                              ):null
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-gray-400 py-8">טוען...</div>}>
      <EventsPageInner />
    </Suspense>
  )
}

