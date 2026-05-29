'use client'
import * as XLSX from 'xlsx'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDate(ds) {
  if (!ds) return ''
  const [y,m,d] = ds.split('-').map(Number)
  return `${d} ${HE_MONTHS[m-1]} ${y}`
}

function CompareMode({ events, allItems, selectedEvent, selectEvent, specItems }) {
  const [sameDay, setSameDay] = useState([])
  const [allSpecs, setAllSpecs] = useState({})
  const [loading, setLoading] = useState(false)
  const selEv = events.find(e => e.id === selectedEvent)

  useEffect(() => {
    if (!selectedEvent || !selEv?.date) { setSameDay([]); setAllSpecs({}); return }
    const same = events.filter(e => e.date === selEv.date && e.id !== selectedEvent)
    setSameDay(same)
    if (!same.length) { setAllSpecs({}); return }
    setLoading(true)
    Promise.all(same.map(e =>
      supabase.from('spec_items').select('*').eq('event_id', e.id)
        .then(({ data }) => ({ id: e.id, items: data || [] }))
    )).then(results => {
      const map = {}
      results.forEach(r => { map[r.id] = r.items })
      setAllSpecs(map)
      setLoading(false)
    })
  }, [selectedEvent, selEv?.date])

  const conflictMap = {}
  specItems.forEach(s => {
    if (!conflictMap[s.equipment_item_id]) conflictMap[s.equipment_item_id] = { qty: 0, evs: [] }
    conflictMap[s.equipment_item_id].qty += parseInt(s.quantity || 0)
    conflictMap[s.equipment_item_id].evs.push({ eventId: selectedEvent, qty: parseInt(s.quantity || 0) })
  })
  Object.entries(allSpecs).forEach(([evId, items]) => {
    items.forEach(s => {
      if (!conflictMap[s.equipment_item_id]) conflictMap[s.equipment_item_id] = { qty: 0, evs: [] }
      conflictMap[s.equipment_item_id].qty += parseInt(s.quantity || 0)
      conflictMap[s.equipment_item_id].evs.push({ eventId: evId, qty: parseInt(s.quantity || 0) })
    })
  })

  const conflicts = Object.entries(conflictMap)
    .filter(([itemId, data]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : Infinity
      return data.evs.length > 1 || data.qty > stock
    })
    .map(([itemId, data]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : null
      return { item, data, stock, overStock: stock && data.qty > stock }
    })
    .filter(c => c.item)

  return (
    <div>
      <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
        <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע לבדיקה</div>
        <select value={selectedEvent} onChange={e=>selectEvent(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
          <option value="">בחר אירוע...</option>
          {events.map(e=><option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
        </select>
      </div>
      {!selectedEvent && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">בחר אירוע לבדיקת התנגשויות</div>
      )}
      {selectedEvent && selEv && (
        <>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <div className="text-[13px] font-semibold text-gray-800 text-right mb-2">אירועים ביום {fmtDate(selEv.date)}</div>
            {sameDay.length === 0 ? (
              <div className="text-[12px] text-gray-400 text-right">אין אירועים נוספים ביום זה</div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                {[selEv, ...sameDay].map(e => (
                  <span key={e.id} className={`text-[12px] px-3 py-1.5 rounded-full border ${e.id===selectedEvent?'bg-[#E0197D] text-white border-[#E0197D]':'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {e.title}
                  </span>
                ))}
              </div>
            )}
          </div>
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-4">טוען...</div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between flex-row-reverse ${conflicts.length>0?'bg-[#FAECE7]':'bg-[#E1F5EE]'}`}>
                <div className={`text-[13px] font-semibold ${conflicts.length>0?'text-[#E0197D]':'text-[#085041]'}`}>
                  {conflicts.length>0 ? `⚠️ ${conflicts.length} התנגשויות ציוד` : '✅ אין התנגשויות'}
                </div>
                <div className="text-[11px] text-gray-500">{specItems.length} פריטים במפרט</div>
              </div>
              {conflicts.map(({ item, data, stock, overStock }) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse">
                  <div className="flex-1 text-right">
                    <div className="text-[13px] font-medium text-gray-800">{item.name}</div>
                    <div className="flex gap-2 justify-end mt-1 flex-wrap">
                      {data.evs.map((ev, i) => {
                        const evObj = events.find(e => e.id === ev.eventId)
                        return <span key={i} className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{evObj?.title}: ×{ev.qty}</span>
                      })}
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className={`text-[13px] font-bold ${overStock?'text-red-600':'text-[#E0197D]'}`}>{data.qty}/{stock || '∞'}</div>
                    <div className="text-[10px] text-gray-400">סה״כ / מלאי</div>
                    {overStock && <div className="text-[10px] text-red-500 font-bold">חסר {data.qty - stock}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TemplatesMode({ allItems, categories, subcats, onLoadTemplate, onCompare }) {
  const [templates, setTemplates] = useState([])
  const [checkedIds, setCheckedIds] = useState([])
  const [compareData, setCompareData] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [templateItems, setTemplateItems] = useState([])
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [openCat, setOpenCat] = useState(null)
  const [openSub, setOpenSub] = useState(null)

  useEffect(() => { loadTemplates() }, [])

  async function doCompare() {
    setComparing(true)
    const results = await Promise.all(checkedIds.map(id =>
      supabase.from('spec_items').select('*').eq('template_id', id).is('event_id', null)
        .then(({ data }) => ({ id, items: data || [] }))
    ))
    setCompareData(results)
    setComparing(false)
  }

  async function loadTemplates() {
    const { data } = await supabase.from('spec_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function selectTemplate(id) {
    setSelected(id)
    setOpenCat(null); setOpenSub(null)
    if (!id) { setTemplateItems([]); return }
    const { data } = await supabase.from('spec_items').select('*').eq('template_id', id).is('event_id', null)
    setTemplateItems(data || [])
  }

  async function createTemplate() {
    if (!newName.trim()) return
    setCreating(true)
    const { data } = await supabase.from('spec_templates').insert({ name: newName.trim(), description: newDesc.trim() }).select().single()
    if (data) {
      setTemplates(prev => [data, ...prev])
      setSelected(data.id)
      setTemplateItems([])
      setNewName(''); setNewDesc('')
    }
    setCreating(false)
  }

  async function deleteTemplate(id) {
    await supabase.from('spec_items').delete().eq('template_id', id)
    await supabase.from('spec_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (selected === id) { setSelected(null); setTemplateItems([]) }
  }

  function isInTemplate(itemId) {
    return templateItems.some(s => s.equipment_item_id === itemId)
  }

  async function toggleItem(item) {
    if (!selected) return
    const existing = templateItems.find(s => s.equipment_item_id === item.id)
    if (existing) {
      await supabase.from('spec_items').delete().eq('id', existing.id)
      setTemplateItems(prev => prev.filter(s => s.id !== existing.id))
    } else {
      const { data, error } = await supabase.from('spec_items').insert({
        template_id: selected,
        equipment_item_id: item.id,
        quantity: '1',
      }).select().single()
      if (!error && data) setTemplateItems(prev => [...prev, data])
    }
  }

  async function updateQty(specId, qty) {
    await supabase.from('spec_items').update({ quantity: qty }).eq('id', specId)
    setTemplateItems(prev => prev.map(s => s.id === specId ? { ...s, quantity: qty } : s))
  }

  const selTemplate = templates.find(t => t.id === selected)
  const specDisplay = templateItems.map(s => {
    const item = allItems.find(i => i.id === s.equipment_item_id)
    const sub  = subcats.find(sub => sub.id === item?.subcategory_id)
    const cat  = categories.find(c => c.id === sub?.category_id)
    return item ? { ...s, item, sub, cat } : null
  }).filter(Boolean)

  const specByCategory = categories.map(cat => ({
    cat,
    items: specDisplay.filter(s => s.cat?.id === cat.id)
  })).filter(g => g.items.length > 0)

  return (
    <div className="flex gap-4">
      {/* Right: template list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        {/* Create new */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-gray-500 mb-2">מפרט חדש</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="שם המפרט..."
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] mb-2 text-right"/>
          <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="תיאור (אופציונלי)..."
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] mb-2 text-right"/>
          <button onClick={createTemplate} disabled={creating || !newName.trim()}
            className="w-full bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
            + צור מפרט
          </button>
        </div>

        {/* Template list */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-gray-100">מפרטים קיימים</div>
          {templates.length === 0 ? (
            <div className="text-center text-[12px] text-gray-400 py-4">אין מפרטים עדיין</div>
          ) : templates.map(t => (
            <div key={t.id}
              onClick={() => selectTemplate(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer flex-row-reverse group ${selected===t.id?'bg-[#FCE4F3] text-[#E0197D]':'hover:bg-gray-50 text-gray-700'}`}>
              <input type="checkbox" checked={checkedIds.includes(t.id)}
                onClick={e=>e.stopPropagation()}
                onChange={e=>setCheckedIds(prev=>e.target.checked?[...prev,t.id]:prev.filter(x=>x!==t.id))}
                className="accent-[#E0197D] flex-shrink-0"/>
              <div className="flex-1 text-right">
                <div className="text-[13px] font-medium">{t.name}</div>
                {t.description && <div className="text-[11px] text-gray-400">{t.description}</div>}
              </div>
              <button onClick={e=>{e.stopPropagation();deleteTemplate(t.id)}}
                className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100">
                <i className="ti ti-trash" style={{fontSize:12}}/>
              </button>
            </div>
          ))}
          {checkedIds.length >= 2 && (
            <button onClick={doCompare}
              className="w-full mt-2 py-2 text-[13px] bg-[#E0197D] text-white rounded-lg">
              השואת התנגשויות ({checkedIds.length})
            </button>
          )}
          {compareData && (
            <div className="mt-3 bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                <button onClick={()=>setCompareData(null)} className="text-gray-400 hover:text-gray-600 text-[11px]">סגור</button>
                <div className="text-[11px] font-semibold text-gray-500">ציוד משותף בין המפרטים</div>
              </div>
              {(() => {
                const itemCounts = {}
                compareData.forEach(r => r.items.forEach(s => {
                  if (!itemCounts[s.equipment_item_id]) itemCounts[s.equipment_item_id] = { count: 0, names: [] }
                  itemCounts[s.equipment_item_id].count++
                  const tmpl = templates.find(t => t.id === r.id)
                  itemCounts[s.equipment_item_id].names.push(tmpl?.name || r.id)
                }))
                const shared = Object.entries(itemCounts).filter(([,v]) => v.count > 1)
                if (!shared.length) return <div className="text-center text-[12px] text-gray-400 py-4">אין ציוד משותף</div>
                return shared.map(([itemId, v]) => {
                  const item = allItems.find(i => i.id === itemId)
                  return (
                    <div key={itemId} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 flex-row-reverse">
                      <span className="text-[13px] text-gray-800">{item?.name || itemId}</span>
                      <span className="text-[11px] text-[#E0197D]">{v.names.join(', ')}</span>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>

        {/* Equipment browser */}
        {selected && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-gray-100">הוסף ציוד למפרט</div>
            {categories.map(cat => {
              const catSubs = subcats.filter(s => s.category_id === cat.id)
              const isOpen = openCat === cat.id
              return (
                <div key={cat.id}>
                  <button onClick={()=>setOpenCat(isOpen?null:cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium border-b border-gray-50 flex-row-reverse ${isOpen?'text-[#E0197D] bg-[#FCE4F3]':'text-gray-700 hover:bg-gray-50'}`}>
                    <span>{cat.name}</span>
                    <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-400`} style={{fontSize:11}}/>
                  </button>
                  {isOpen && catSubs.map(sub => {
                    const items = allItems.filter(i => i.subcategory_id === sub.id)
                    const isSubOpen = openSub === sub.id
                    return (
                      <div key={sub.id}>
                        <button onClick={()=>setOpenSub(isSubOpen?null:sub.id)}
                          className={`w-full flex items-center justify-between px-5 py-2 text-[11px] border-b border-gray-50 flex-row-reverse ${isSubOpen?'text-[#E0197D]':'text-gray-500 hover:bg-gray-50'}`}>
                          <span>{sub.name}</span>
                          <i className={`ti ${isSubOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:10}}/>
                        </button>
                        {isSubOpen && items.map(item => {
                          const inTemplate = isInTemplate(item.id)
                          return (
                            <button key={item.id} onClick={()=>toggleItem(item)}
                              className={`w-full flex items-center gap-2 px-6 py-1.5 text-[11px] border-b border-gray-50 flex-row-reverse text-right transition-colors ${inTemplate?'bg-[#E1F5EE] text-[#085041]':'text-gray-600 hover:bg-gray-50'}`}>
                              <i className={`ti ${inTemplate?'ti-circle-check':'ti-circle-plus'} flex-shrink-0`} style={{fontSize:13,color:inTemplate?'#22c55e':'#E0197D'}}/>
                              <span className="flex-1 truncate">{item.name}</span>
                              {item.units && <span className="text-gray-400">×{item.units}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Left: template items */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
            בחר מפרט או צור חדש
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="text-[11px] text-gray-400">{templateItems.length} פריטים</div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-gray-800">{selTemplate?.name}</div>
                {selTemplate?.description && <div className="text-[11px] text-gray-400">{selTemplate.description}</div>}
              </div>
            </div>
            {specDisplay.length === 0 ? (
              <div className="text-center text-[13px] text-gray-400 py-8">הוסף פריטים מהרשימה</div>
            ) : specByCategory.map(({cat, items}) => (
              <div key={cat.id}>
                <div className="px-4 py-2 bg-[#FCE4F3] text-[11px] font-semibold text-[#E0197D] text-right">{cat.name}</div>
                {items.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                    <span className="flex-1 text-[13px] text-right text-gray-800">{s.item.name}</span>
                    {s.sub && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.sub.name}</span>}
                    <input type="number" min="1" value={s.quantity||''}
                      onChange={e=>setTemplateItems(prev=>prev.map(x=>x.id===s.id?{...x,quantity:e.target.value}:x))}
                      onBlur={e=>updateQty(s.id, e.target.value)}
                      placeholder="כמות"
                      className="w-16 text-[11px] px-2 py-1 border border-gray-200 rounded-lg bg-white outline-none text-center focus:border-[#E0197D]"/>
                    <button onClick={()=>toggleItem(s.item)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100">
                      <i className="ti ti-x" style={{fontSize:12}}/>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


function GeneralFilesMode() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState({})
  const [viewing, setViewing] = useState(null)
  const [xlsxPreview, setXlsxPreview] = useState(null)
  const fileInputRef = useRef(null)
  const FOLDER = 'general'

  useEffect(() => { loadFiles() }, [])

  async function loadFiles() {
    setLoading(true)
    const { data } = await supabase.storage.from('venues').list(FOLDER, { sortBy: { column: 'name', order: 'asc' } })
    setFiles((data || []).filter(f => f.name !== '.emptydir'))
    setLoading(false)
  }

  async function handleUpload(e) {
    const fileList = Array.from(e.target.files)
    if (!fileList.length) return
    setUploading(true)
    for (const file of fileList) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_\u0590-\u05FF ]/g, '_')
      await supabase.storage.from('venues').upload(`${FOLDER}/${safeName}`, file, { upsert: true })
    }
    await loadFiles()
    setUploading(false)
    e.target.value = ''
  }

  async function deleteFile(fileName) {
    if (!window.confirm(`למחוק את "${fileName}"?`)) return
    await supabase.storage.from('venues').remove([`${FOLDER}/${fileName}`])
    setFiles(prev => prev.filter(f => f.name !== fileName))
    setSelectedFiles(prev => { const n = {...prev}; delete n[fileName]; return n })
  }

  function openFile(fileName) {
    const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${fileName}`)
    const isXlsx = /\.(xlsx|xls)$/i.test(fileName)
    const isMobile = window.innerWidth < 768
    if (isMobile && !isXlsx) {
      window.open(data.publicUrl, '_blank')
    } else if (isXlsx) {
      fetch(data.publicUrl)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          const title = rows[1]?.[0] || fileName
          const crew = rows[2]?.[0] || ''
          const headerIdx = rows.findIndex(r => String(r[0]).includes('שעה'))
          const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(4)
          const parsed = dataRows
            .filter(r => r.some(c => String(c).trim() !== ''))
            .map(r => {
              let time = r[0]
              if (typeof time === 'number') {
                const totalMins = Math.round(time * 24 * 60)
                const h = Math.floor(totalMins / 60) % 24
                const m = totalMins % 60
                time = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0')
              } else { time = String(time || '') }
              return { time, what: String(r[1]||''), who: String(r[2]||''), notes: String(r[3]||'') }
            })
          setXlsxPreview({ title, crew, rows: parsed, name: fileName })
        })
        .catch(() => window.open(data.publicUrl, '_blank'))
    } else {
      setViewing({ url: data.publicUrl, name: fileName })
    }
  }

  function toggleSelect(fileName) {
    setSelectedFiles(prev => ({ ...prev, [fileName]: !prev[fileName] }))
  }

  function selectAll() {
    const allSelected = files.every(f => selectedFiles[f.name])
    const newSel = {}
    files.forEach(f => { newSel[f.name] = !allSelected })
    setSelectedFiles(newSel)
  }

  function sendByEmail() {
    const selected = files.filter(f => selectedFiles[f.name])
    if (!selected.length) return
    const links = selected.map(f => {
      const { data } = supabase.storage.from('venues').getPublicUrl(`${FOLDER}/${f.name}`)
      return `${f.name}: ${data.publicUrl}`
    }).join('%0D%0A')
    window.location.href = `mailto:?subject=${encodeURIComponent('מפרטים כלליים')}&body=${encodeURIComponent(selected.map(f => { const { data } = supabase.storage.from('venues').getPublicUrl(FOLDER + '/' + f.name); return f.name + ': ' + data.publicUrl }).join('\n'))}`
  }

  const anySelected = files.some(f => selectedFiles[f.name])
  const selectedCount = files.filter(f => selectedFiles[f.name]).length

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-2xl">
      {/* PDF Viewer Modal - Desktop */}
      {xlsxPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col" dir="rtl">
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-800 text-[15px]">{xlsxPreview.title}</div>
              {xlsxPreview.crew && <div className="text-[12px] text-gray-500 mt-0.5">{xlsxPreview.crew}</div>}
            </div>
            <button onClick={()=>setXlsxPreview(null)} className="text-gray-400 hover:text-gray-700 p-2">
              <i className="ti ti-x" style={{fontSize:18}}/>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-[120px_2fr_1.5fr_1fr] bg-[#E0197D] text-white text-[12px] font-semibold sticky top-0">
              <div className="px-3 py-2.5">שעה</div>
              <div className="px-3 py-2.5 border-r border-red-700">מה</div>
              <div className="px-3 py-2.5 border-r border-red-700">מי</div>
              <div className="px-3 py-2.5 border-r border-red-700">הערות</div>
            </div>
            {xlsxPreview.rows.map((row, i) => (
              <div key={i} className={`grid grid-cols-[120px_2fr_1.5fr_1fr] border-b border-gray-100 ${i%2===0?'bg-white':'bg-[#FFF8F8]'}`}>
                <div className="px-3 py-2.5 text-[13px] font-mono text-[#E0197D] font-medium border-l border-gray-100">{row.time}</div>
                <div className="px-3 py-2.5 text-[13px] border-l border-gray-100 break-words">{row.what}</div>
                <div className="px-3 py-2.5 text-[13px] text-gray-600 border-l border-gray-100 break-words">{row.who}</div>
                <div className="px-3 py-2.5 text-[13px] text-gray-400 break-words">{row.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-row-reverse">
            <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-[13px]">
              <i className="ti ti-x" style={{fontSize:16}}/> סגור
            </button>
            <span className="text-[13px] font-medium text-gray-800 truncate max-w-[45%] text-center">{viewing.name}</span>
            <a href={viewing.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[13px] text-[#E0197D] hover:underline">
              <i className="ti ti-external-link" style={{fontSize:14}}/> פתח בדפדפן
            </a>
          </div>
          <iframe src={viewing.url} className="flex-1 w-full hidden md:block" title={viewing.name} allow="fullscreen" style={{border:'none'}}/>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload}/>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {/* Toolbar */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex-row-reverse">
            <button onClick={selectAll} className="text-[11px] text-gray-500 hover:text-[#E0197D]">
              {files.every(f => selectedFiles[f.name]) ? 'בטל הכל' : 'בחר הכל'}
            </button>
            <div className="flex-1"/>
            {anySelected && (
              <button onClick={() => {
                const selected = files.filter(f => selectedFiles[f.name])
                if (window.confirm(`למחוק ${selected.length} קבצים?`)) {
                  selected.forEach(f => deleteFile(f.name))
                }
              }}
                className="flex items-center gap-1.5 text-[12px] bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                <i className="ti ti-trash" style={{fontSize:13}}/> מחק ({selectedCount})
              </button>
            )}
            {anySelected && (
              <button onClick={sendByEmail}
                className="flex items-center gap-1.5 text-[12px] bg-[#E0197D] text-white px-3 py-1.5 rounded-lg hover:bg-[#A0106A]">
                <i className="ti ti-mail" style={{fontSize:13}}/> שלח במייל ({selectedCount})
              </button>
            )}
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center text-[13px] text-gray-400 py-8">אין קבצים עדיין</div>
        )}

        {files.map(f => (
          <div key={f.name} className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 last:border-0 group hover:bg-gray-50 flex-row-reverse">
            <input type="checkbox"
              checked={!!selectedFiles[f.name]}
              onChange={() => toggleSelect(f.name)}
              className="w-4 h-4 accent-[#E0197D] flex-shrink-0 cursor-pointer"
            />
            <div className="w-9 h-9 bg-[#FCE4F3] rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ti ti-file-type-pdf text-[#E0197D]" style={{fontSize:18}}/>
            </div>
            <div className="flex-1 text-right min-w-0 overflow-hidden">
              <div className="text-[13px] font-medium text-gray-800 truncate">{f.name}</div>
              <div className="text-[11px] text-gray-400">
                {f.metadata?.size ? `${Math.round(f.metadata.size / 1024)} KB` : ''}
              </div>
            </div>
            <button onClick={() => openFile(f.name)}
              className="text-[#E0197D] hover:text-[#A0106A] text-[12px] flex items-center gap-1 px-2 py-1.5 border border-[#E0197D] rounded-lg flex-shrink-0 whitespace-nowrap md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
              <i className="ti ti-eye" style={{fontSize:13}}/> צפה
            </button>
          </div>
        ))}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
          className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
          {uploading ? (
            <><i className="ti ti-loader-2 animate-spin" style={{fontSize:13}}/> מעלה...</>
          ) : (
            <><i className="ti ti-upload" style={{fontSize:13}}/> העלה PDF</>
          )}
        </button>
      </div>
    </div>
  )
}

export default function SpecsPage() {
  const [events, setEvents]         = useState([])
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats]       = useState([])
  const [allItems, setAllItems]     = useState([])
  const [specItems, setSpecItems]   = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [openCat, setOpenCat]   = useState(null)
  const [openSub, setOpenSub]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [mode, setMode]         = useState('templates')
  const [compareIds, setCompareIds] = useState([])
  const [templates, setTemplates] = useState([])
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: evs }, { data: cats }, { data: subs }, { data: items }, { data: tmps }] = await Promise.all([
        supabase.from('events').select('id,title,date,venue').order('date'),
        supabase.from('equipment_categories').select('*').order('sort_order'),
        supabase.from('equipment_subcategories').select('*').order('sort_order'),
        supabase.from('equipment_items').select('*').order('name'),
        supabase.from('spec_templates').select('*').order('created_at', { ascending: false }),
      ])
      setEvents(evs || [])
      setCategories(cats || [])
      setSubcats(subs || [])
      setAllItems(items || [])
      setTemplates(tmps || [])
      setLoading(false)
    }
    load()
  }, [])

  async function selectEvent(eventId) {
    setSelectedEvent(eventId)
    setOpenCat(null); setOpenSub(null)
    if (!eventId) { setSpecItems([]); return }
    const { data } = await supabase.from('spec_items').select('*').eq('event_id', eventId)
    setSpecItems(data || [])
  }

  async function loadTemplate(templateId) {
    if (!selectedEvent || !templateId) return
    setLoadingTemplate(true)
    // מחק פריטים קיימים
    await supabase.from('spec_items').delete().eq('event_id', selectedEvent)
    // טען פריטים מהתבנית
    const { data: tItems } = await supabase.from('spec_items').select('*').eq('template_id', templateId).is('event_id', null)
    if (tItems && tItems.length > 0) {
      const newItems = tItems.map(t => ({
        event_id: selectedEvent,
        equipment_item_id: t.equipment_item_id,
        quantity: t.quantity,
      }))
      const { data } = await supabase.from('spec_items').insert(newItems).select()
      setSpecItems(data || [])
    } else {
      setSpecItems([])
    }
    setShowLoadModal(false)
    setLoadingTemplate(false)
  }

  async function saveAsTemplate() {
    if (!selectedEvent || specItems.length === 0) return
    const selEv = events.find(e => e.id === selectedEvent)
    const name = `${selEv?.title || 'מפרט'} — תבנית`
    const { data: tmpl } = await supabase.from('spec_templates').insert({ name }).select().single()
    if (!tmpl) return
    const newItems = specItems.map(s => ({
      template_id: tmpl.id,
      equipment_item_id: s.equipment_item_id,
      quantity: s.quantity,
    }))
    await supabase.from('spec_items').insert(newItems)
    setTemplates(prev => [tmpl, ...prev])
    alert(`התבנית "${name}" נשמרה בהצלחה!`)
  }

  function isInSpec(itemId) {
    return specItems.some(s => s.equipment_item_id === itemId)
  }

  async function toggleItem(item) {
    if (!selectedEvent) return
    const existing = specItems.find(s => s.equipment_item_id === item.id)
    if (existing) {
      await supabase.from('spec_items').delete().eq('id', existing.id)
      setSpecItems(prev => prev.filter(s => s.id !== existing.id))
    } else {
      const { data, error } = await supabase.from('spec_items').insert({
        event_id: selectedEvent,
        equipment_item_id: item.id,
        quantity: '1',
      }).select().single()
      if (!error && data) setSpecItems(prev => [...prev, data])
    }
  }

  async function updateQty(specId, qty) {
    await supabase.from('spec_items').update({ quantity: qty }).eq('id', specId)
    setSpecItems(prev => prev.map(s => s.id === specId ? { ...s, quantity: qty } : s))
  }

  const specDisplay = specItems.map(s => {
    const item = allItems.find(i => i.id === s.equipment_item_id)
    const sub  = subcats.find(sub => sub.id === item?.subcategory_id)
    const cat  = categories.find(c => c.id === sub?.category_id)
    return item ? { ...s, item, sub, cat } : null
  }).filter(Boolean)

  const specByCategory = categories.map(cat => ({
    cat,
    items: specDisplay.filter(s => s.cat?.id === cat.id)
  })).filter(g => g.items.length > 0)

  const selEv = events.find(e => e.id === selectedEvent)

  return (
    <div className="max-w-4xl">
      {/* Load template modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="text-[14px] font-medium text-gray-800 mb-1 text-right">טען תבנית מאסטר</div>
            <div className="text-[12px] text-gray-400 mb-4 text-right">הפריטים הקיימים יימחקו ויוחלפו בתבנית</div>
            <div className="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="text-center text-[13px] text-gray-400 py-4">אין מפרטים — צור מפרט בטאב "מפרטים כלליים הפקות"</div>
              ) : templates.map(t => (
                <button key={t.id} onClick={() => loadTemplate(t.id)} disabled={loadingTemplate}
                  className="text-right px-4 py-3 border border-gray-200 rounded-lg hover:border-[#E0197D] hover:bg-[#FCE4F3] transition-colors disabled:opacity-50">
                  <div className="text-[13px] font-medium text-gray-800">{t.name}</div>
                  {t.description && <div className="text-[11px] text-gray-400">{t.description}</div>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLoadModal(false)} className="w-full border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {[
          {id:'templates', label:'מפרטים כלליים הפקות'},
          {id:'files', label:'📁 מפרטים כללי'},
          {id:'showfolders', label:'תיקי הצגות'},
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setMode(tab.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors ${mode===tab.id?'bg-[#E0197D] text-white border-[#E0197D]':'border-gray-200 text-gray-600 hover:border-[#E0197D]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* SPEC MODE */}
      {mode === 'spec' && (
        <div className="flex gap-4">
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-gray-500 mb-2">בחר אירוע</div>
              <select value={selectedEvent} onChange={e=>selectEvent(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]">
                <option value="">בחר אירוע...</option>
                {events.map(e=><option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
              </select>
              {selectedEvent && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setShowLoadModal(true)}
                    className="flex-1 text-[12px] px-3 py-1.5 border border-[#E0197D] text-[#E0197D] rounded-lg hover:bg-[#FCE4F3] flex items-center justify-center gap-1">
                    <i className="ti ti-download" style={{fontSize:12}}/> טען תבנית
                  </button>
                  <button onClick={saveAsTemplate} disabled={specItems.length === 0}
                    className="flex-1 text-[12px] px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1">
                    <i className="ti ti-star" style={{fontSize:12}}/> שמור תבנית
                  </button>
                </div>
              )}
            </div>

            {selectedEvent && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-gray-100">לקט ציוד</div>
                {categories.map(cat => {
                  const catSubs = subcats.filter(s => s.category_id === cat.id)
                  const isOpen = openCat === cat.id
                  return (
                    <div key={cat.id}>
                      <button onClick={()=>setOpenCat(isOpen?null:cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium border-b border-gray-50 flex-row-reverse ${isOpen?'text-[#E0197D] bg-[#FCE4F3]':'text-gray-700 hover:bg-gray-50'}`}>
                        <span>{cat.name}</span>
                        <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-400`} style={{fontSize:11}}/>
                      </button>
                      {isOpen && catSubs.map(sub => {
                        const items = allItems.filter(i => i.subcategory_id === sub.id)
                        const isSubOpen = openSub === sub.id
                        return (
                          <div key={sub.id}>
                            <button onClick={()=>setOpenSub(isSubOpen?null:sub.id)}
                              className={`w-full flex items-center justify-between px-5 py-2 text-[11px] border-b border-gray-50 flex-row-reverse ${isSubOpen?'text-[#E0197D]':'text-gray-500 hover:bg-gray-50'}`}>
                              <span>{sub.name}</span>
                              <i className={`ti ${isSubOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:10}}/>
                            </button>
                            {isSubOpen && items.map(item => {
                              const inSpec = isInSpec(item.id)
                              return (
                                <button key={item.id} onClick={()=>toggleItem(item)}
                                  className={`w-full flex items-center gap-2 px-6 py-1.5 text-[11px] border-b border-gray-50 flex-row-reverse text-right transition-colors ${inSpec?'bg-[#E1F5EE] text-[#085041]':'text-gray-600 hover:bg-gray-50'}`}>
                                  <i className={`ti ${inSpec?'ti-circle-check':'ti-circle-plus'} flex-shrink-0`} style={{fontSize:13,color:inSpec?'#22c55e':'#E0197D'}}/>
                                  <span className="flex-1 truncate">{item.name}</span>
                                  {item.units && <span className="text-gray-400">×{item.units}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {!selectedEvent ? (
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">בחר אירוע להתחלה</div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="text-[11px] text-gray-400">{specItems.length} פריטים</div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-gray-800">{selEv?.title}</div>
                    <div className="text-[11px] text-gray-400">{fmtDate(selEv?.date)}{selEv?.venue?` · ${selEv.venue}`:''}</div>
                  </div>
                </div>
                {specDisplay.length === 0 ? (
                  <div className="text-center text-[13px] text-gray-400 py-8">
                    <div className="mb-2">אין פריטים במפרט</div>
                    <div className="text-[12px] text-gray-300">טען תבנית או הוסף פריטים ידנית</div>
                  </div>
                ) : specByCategory.map(({cat, items}) => (
                  <div key={cat.id}>
                    <div className="px-4 py-2 bg-[#FCE4F3] text-[11px] font-semibold text-[#E0197D] text-right">{cat.name}</div>
                    {items.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                        <span className="flex-1 text-[13px] text-right text-gray-800">{s.item.name}</span>
                        {s.sub && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.sub.name}</span>}
                        <div className="flex flex-col items-center gap-0.5">
                          <input type="number" min="1" max={s.item.units ? parseInt(s.item.units) : undefined}
                            value={s.quantity||''}
                            onChange={e=>setSpecItems(prev=>prev.map(x=>x.id===s.id?{...x,quantity:e.target.value}:x))}
                            onBlur={e=>updateQty(s.id, e.target.value)}
                            placeholder="כמות"
                            className={`w-16 text-[11px] px-2 py-1 border rounded-lg bg-white outline-none text-center ${s.item.units && parseInt(s.quantity) > parseInt(s.item.units)?'border-red-400 bg-red-50 text-red-600':'border-gray-200 focus:border-[#E0197D]'}`}/>
                          {s.item.units && (
                            <span className={`text-[9px] ${parseInt(s.quantity) > parseInt(s.item.units)?'text-red-500 font-bold':'text-gray-400'}`}>
                              מלאי: {s.item.units}
                            </span>
                          )}
                        </div>
                        <button onClick={()=>toggleItem(s.item)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <i className="ti ti-x" style={{fontSize:12}}/>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEMPLATES MODE */}
      {mode === 'templates' && (
        <TemplatesMode allItems={allItems} categories={categories} subcats={subcats} onCompare={ids=>{ setCompareIds(ids); setMode('compare') }} />
      )}


      {/* FILES MODE */}
      {mode === 'files' && (
        <GeneralFilesMode />
      )}
      {mode === 'showfolders' && (
        <ShowFoldersMode />
      )}
    </div>
  )
}

function ShowFoldersMode() {
  const BUCKET = 'venues'
  const ROOT = 'show-files'
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [openFolder, setOpenFolder] = useState(null)
  const [folderFiles, setFolderFiles] = useState({})
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [viewing, setViewing] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => { loadFolders() }, [])

  async function loadFolders() {
    setLoading(true)
    const { data } = await supabase.from('show_folders').select('*').order('created_at', { ascending: true })
    setFolders(data || [])
    setLoading(false)
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    const storageKey = Date.now().toString()
    const displayName = newFolderName.trim()
    await supabase.storage.from(BUCKET).upload(`${ROOT}/${storageKey}/.keep`, new Blob(['']))
    await supabase.from('show_folders').insert({ name: displayName, storage_key: storageKey })
    setNewFolderName('')
    setShowNewFolder(false)
    await loadFolders()
    setCreatingFolder(false)
  }

  async function openFolderFiles(folder) {
    const key = folder.storage_key
    if (openFolder === key) { setOpenFolder(null); return }
    setOpenFolder(key)
    setLoadingFiles(true)
    const { data } = await supabase.storage.from(BUCKET).list(`${ROOT}/${key}`, { sortBy: { column: 'name', order: 'asc' } })
    setFolderFiles(prev => ({ ...prev, [key]: (data || []).filter(f => f.name !== '.keep') }))
    setLoadingFiles(false)
  }

  async function uploadFiles(e, folder) {
    const key = folder.storage_key
    const fileList = Array.from(e.target.files)
    if (!fileList.length) return
    setUploading(true)
    for (const file of fileList) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
      const safeName = Date.now() + '_' + Math.random().toString(36).slice(2,6) + (ext ? '.' + ext : '')
      await supabase.storage.from(BUCKET).upload(`${ROOT}/${key}/${safeName}`, file, { upsert: true })
    }
    const { data } = await supabase.storage.from(BUCKET).list(`${ROOT}/${key}`, { sortBy: { column: 'name', order: 'asc' } })
    setFolderFiles(prev => ({ ...prev, [key]: (data || []).filter(f => f.name !== '.keep') }))
    setUploading(false)
    e.target.value = ''
  }

  async function deleteFile(folderKey, fileName) {
    await supabase.storage.from(BUCKET).remove([`${ROOT}/${folderKey}/${fileName}`])
    setFolderFiles(prev => ({ ...prev, [folderKey]: prev[folderKey].filter(f => f.name !== fileName) }))
  }

  function openFile(folderKey, fileName) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${ROOT}/${folderKey}/${fileName}`)
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
    const isPdf = /\.pdf$/i.test(fileName)
    const isXlsx = /\.(xlsx|xls)$/i.test(fileName)
    if (isPdf || isImage) { setViewing({ url: data.publicUrl, name: fileName, type: isImage ? 'image' : 'pdf' }) }
    else if (isXlsx) {
      fetch(data.publicUrl)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          const title = rows[1]?.[0] || fileName
          const crew = rows[2]?.[0] || ''
          const headerIdx = rows.findIndex(r => String(r[0]).includes('שעה'))
          const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(4)
          const parsed = dataRows
            .filter(r => r.some(c => String(c).trim() !== ''))
            .map(r => {
              let time = r[0]
              if (typeof time === 'number') {
                const totalMins = Math.round(time * 24 * 60)
                const h = Math.floor(totalMins / 60) % 24
                const m = totalMins % 60
                time = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0')
              } else { time = String(time || '') }
              return { time, what: String(r[1]||''), who: String(r[2]||''), notes: String(r[3]||'') }
            })
          setXlsxPreview({ title, crew, rows: parsed, name: fileName })
        })
        .catch(() => window.open(data.publicUrl, '_blank'))
    }
    else { window.open(data.publicUrl, '_blank') }
  }

  function fileIcon(name) {
    if (/\.pdf$/i.test(name)) return 'ti-file-type-pdf text-[#E0197D]'
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return 'ti-photo text-blue-500'
    if (/\.(xlsx|xls)$/i.test(name)) return 'ti-file-spreadsheet text-green-600'
    return 'ti-file text-gray-400'
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-2xl">
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-row-reverse">
            <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 text-gray-600 text-[13px]">
              <i className="ti ti-x" style={{fontSize:16}}/> סגור
            </button>
            <span className="text-[13px] font-medium text-gray-800 truncate max-w-[45%]">{viewing.name}</span>
            <a href={viewing.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-[#E0197D] hover:underline">
              <i className="ti ti-external-link" style={{fontSize:14}}/> פתח בדפדפן
            </a>
          </div>
          {viewing.type === 'image' ? (
            <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
              <img src={viewing.url} alt={viewing.name} className="max-w-full max-h-full object-contain rounded"/>
            </div>
          ) : (
            <iframe src={viewing.url} className="flex-1 w-full" title={viewing.name} allow="fullscreen" style={{border:'none'}}/>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setShowNewFolder(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1.5">
          <i className="ti ti-folder-plus" style={{fontSize:14}}/> תיקייה חדשה
        </button>
        <span className="text-[12px] text-gray-400">{folders.length} תיקיות</span>
      </div>

      {showNewFolder && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="flex gap-2 flex-row-reverse">
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              placeholder="שם התיקייה..." autoFocus
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
            <button onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}
              className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {creatingFolder ? 'יוצר...' : 'צור'}
            </button>
            <button onClick={() => setShowNewFolder(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
          </div>
        </div>
      )}

      {folders.length === 0 && !showNewFolder && (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
          <div className="text-[14px] text-gray-500 mb-1">אין תיקיות עדיין</div>
          <div className="text-[12px] text-gray-400">לחץ על "תיקייה חדשה" להתחלה</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {folders.map(folder => (
          <div key={folder.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => openFolderFiles(folder)}>
              <div className="w-9 h-9 bg-[#FCE4F3] rounded-lg flex items-center justify-center flex-shrink-0">
                <i className={`ti ${openFolder === folder.storage_key ? 'ti-folder-open' : 'ti-folder'} text-[#E0197D]`} style={{fontSize:18}}/>
              </div>
              <div className="flex-1 text-right">
                <div className="text-[13px] font-semibold text-gray-800">{folder.name}</div>
                {folderFiles[folder.storage_key] && (
                  <div className="text-[11px] text-gray-400">{folderFiles[folder.storage_key].length} קבצים</div>
                )}
              </div>
              <i className={`ti ${openFolder === folder.storage_key ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
            </div>

            {openFolder === folder.storage_key && (
              <div className="border-t border-gray-50">
                {loadingFiles && <div className="text-center text-[13px] text-gray-400 py-4">טוען...</div>}
                {!loadingFiles && folderFiles[folder.storage_key]?.length === 0 && (
                  <div className="text-center text-[13px] text-gray-400 py-4">אין קבצים בתיקייה זו</div>
                )}
                {!loadingFiles && folderFiles[folder.storage_key]?.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 flex-row-reverse group">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className={`ti ${fileIcon(f.name)}`} style={{fontSize:16}}/>
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="text-[13px] text-gray-800 truncate">{f.name}</div>
                      <div className="text-[11px] text-gray-400">{f.metadata?.size ? `${Math.round(f.metadata.size/1024)} KB` : ''}</div>
                    </div>
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                      <button onClick={() => openFile(folder.storage_key, f.name)}
                        className="text-[12px] text-[#E0197D] border border-[#E0197D] px-2 py-1 rounded-lg flex items-center gap-1">
                        <i className="ti ti-eye" style={{fontSize:12}}/> פתח
                      </button>
                      <button onClick={() => { if(window.confirm('למחוק?')) deleteFile(folder.storage_key, f.name) }}
                        className="text-gray-300 hover:text-red-500 p-1">
                        <i className="ti ti-trash" style={{fontSize:13}}/>
                      </button>
                    </div>
                  </div>
                ))}
                <label className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1 cursor-pointer">
                  {uploading ? <><i className="ti ti-loader-2 animate-spin" style={{fontSize:13}}/> מעלה...</> : <><i className="ti ti-upload" style={{fontSize:13}}/> העלה קובץ</>}
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" className="hidden"
                    onChange={e => uploadFiles(e, folder)} disabled={uploading}/>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
