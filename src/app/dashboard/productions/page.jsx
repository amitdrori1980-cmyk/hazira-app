'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProductionsPage() {
  const [profile, setProfile] = useState(null)
  const [productions, setProductions] = useState([])
  const [contacts, setContacts] = useState({}) // prodId -> []
  const [loading, setLoading] = useState(true)
  const [openProd, setOpenProd] = useState(null)

  // New production
  const [showNewProd, setShowNewProd] = useState(false)
  const [newProdName, setNewProdName] = useState('')
  const [savingProd, setSavingProd] = useState(false)

  // Edit production name
  const [editingProd, setEditingProd] = useState(null)
  const [editProdName, setEditProdName] = useState('')

  // New contact
  const [addingContact, setAddingContact] = useState(null) // prodId
  const [newContact, setNewContact] = useState({ full_name:'', phone:'', email:'', role:'' })
  const [savingContact, setSavingContact] = useState(false)

  // Edit contact
  const [editingContact, setEditingContact] = useState(null) // contactId
  const [editContact, setEditContact] = useState({})

  // Selected contacts for email
  const [selectedContacts, setSelectedContacts] = useState({}) // contactId -> bool

  function toggleSelect(contactId) {
    setSelectedContacts(prev => ({ ...prev, [contactId]: !prev[contactId] }))
  }

  function sendEmailToSelected(prodContacts) {
    const selected = prodContacts.filter(c => selectedContacts[c.id] && c.email)
    if (!selected.length) return
    const emails = selected.map(c => c.email).join(',')
    window.location.href = `mailto:${emails}`
  }

  function selectAll(prodContacts) {
    const withEmail = prodContacts.filter(c => c.email)
    const allSelected = withEmail.every(c => selectedContacts[c.id])
    const newSel = {}
    withEmail.forEach(c => { newSel[c.id] = !allSelected })
    setSelectedContacts(prev => ({ ...prev, ...newSel }))
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: prods } = await supabase.from('productions').select('*').order('sort_order')
      setProductions(prods || [])
      if (prods?.length) {
        const { data: cts } = await supabase.from('production_contacts').select('*')
          .in('production_id', prods.map(p => p.id)).order('sort_order')
        const map = {}
        prods.forEach(p => { map[p.id] = [] })
        ;(cts || []).forEach(c => { if (map[c.production_id]) map[c.production_id].push(c) })
        setContacts(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function addProduction() {
    if (!newProdName.trim()) return
    setSavingProd(true)
    const { data } = await supabase.from('productions').insert({
      name: newProdName.trim(),
      sort_order: productions.length,
    }).select().single()
    if (data) {
      setProductions(prev => [...prev, data])
      setContacts(prev => ({ ...prev, [data.id]: [] }))
      setNewProdName(''); setShowNewProd(false)
      setOpenProd(data.id)
    }
    setSavingProd(false)
  }

  async function saveEditProd(id) {
    if (!editProdName.trim()) return
    await supabase.from('productions').update({ name: editProdName.trim() }).eq('id', id)
    setProductions(prev => prev.map(p => p.id === id ? { ...p, name: editProdName.trim() } : p))
    setEditingProd(null)
  }

  async function deleteProd(id) {
    if (!window.confirm('למחוק את ההפקה וכל אנשי הקשר?')) return
    await supabase.from('production_contacts').delete().eq('production_id', id)
    await supabase.from('productions').delete().eq('id', id)
    setProductions(prev => prev.filter(p => p.id !== id))
    setContacts(prev => { const n = {...prev}; delete n[id]; return n })
    if (openProd === id) setOpenProd(null)
  }

  async function addContact(prodId) {
    if (!newContact.full_name.trim() && !newContact.phone.trim()) return
    setSavingContact(true)
    const { data } = await supabase.from('production_contacts').insert({
      production_id: prodId,
      full_name: newContact.full_name.trim(),
      phone: newContact.phone.trim(),
      email: newContact.email.trim(),
      role: newContact.role.trim(),
      sort_order: (contacts[prodId] || []).length,
    }).select().single()
    if (data) {
      setContacts(prev => ({ ...prev, [prodId]: [...(prev[prodId]||[]), data] }))
      setNewContact({ full_name:'', phone:'', email:'', role:'' })
      setAddingContact(null)
    }
    setSavingContact(false)
  }

  async function saveEditContact(id, prodId) {
    await supabase.from('production_contacts').update(editContact).eq('id', id)
    setContacts(prev => ({
      ...prev,
      [prodId]: (prev[prodId]||[]).map(c => c.id === id ? { ...c, ...editContact } : c)
    }))
    setEditingContact(null)
  }

  async function deleteContact(id, prodId) {
    await supabase.from('production_contacts').delete().eq('id', id)
    setContacts(prev => ({ ...prev, [prodId]: (prev[prodId]||[]).filter(c => c.id !== id) }))
  }

  const isManager = profile?.is_manager

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-2xl">
      {/* Header */}
      {isManager && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setShowNewProd(v => !v)}
            className="bg-[#CC1010] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#a00c0c] flex items-center gap-1">
            <i className="ti ti-plus"/> הפקה חדשה
          </button>
        </div>
      )}

      {/* New production form */}
      {showNewProd && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="text-[13px] font-medium text-gray-700 mb-3 text-right">שם ההפקה</div>
          <input value={newProdName} onChange={e => setNewProdName(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addProduction()}
            placeholder="למשל: מחזמר הקיץ 2026"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] text-right mb-3"/>
          <div className="flex gap-2">
            <button onClick={addProduction} disabled={savingProd || !newProdName.trim()}
              className="flex-1 bg-[#CC1010] text-white text-sm py-2 rounded-lg hover:bg-[#a00c0c] disabled:opacity-50">
              {savingProd ? 'שומר...' : 'צור הפקה'}
            </button>
            <button onClick={() => { setShowNewProd(false); setNewProdName('') }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
              ביטול
            </button>
          </div>
        </div>
      )}

      {productions.length === 0 && !showNewProd && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין הפקות — לחץ על "הפקה חדשה" להתחלה
        </div>
      )}

      {/* Productions list */}
      {productions.map(prod => {
        const prodContacts = contacts[prod.id] || []
        const isOpen = openProd === prod.id

        return (
          <div key={prod.id} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            {/* Production header */}
            <div
              className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => setOpenProd(isOpen ? null : prod.id)}>
              <div className="flex-1 text-right">
                {editingProd === prod.id ? (
                  <div className="flex gap-2 flex-row-reverse" onClick={e => e.stopPropagation()}>
                    <input value={editProdName} onChange={e => setEditProdName(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && saveEditProd(prod.id)}
                      className="flex-1 text-[15px] font-semibold px-2 py-1 border border-[#CC1010] rounded-lg outline-none text-right"/>
                    <button onClick={() => saveEditProd(prod.id)} className="text-[#CC1010] text-sm font-medium">שמור</button>
                    <button onClick={() => setEditingProd(null)} className="text-gray-400 text-sm">ביטול</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[16px] font-semibold text-gray-900">{prod.name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{prodContacts.length} אנשי קשר</div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isManager && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setEditingProd(prod.id); setEditProdName(prod.name) }}
                      className="text-gray-300 hover:text-gray-600 p-1">
                      <i className="ti ti-pencil" style={{fontSize:13}}/>
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteProd(prod.id) }}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <i className="ti ti-trash" style={{fontSize:13}}/>
                    </button>
                  </>
                )}
                <i className={`ti ${isOpen?'ti-chevron-up':'ti-chevron-down'} text-gray-300`} style={{fontSize:13}}/>
              </div>
            </div>

            {/* Contacts */}
            {isOpen && (
              <div className="border-t border-gray-50">
                {/* Email toolbar */}
                {prodContacts.filter(c => c.email).length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex-row-reverse">
                    <button onClick={() => selectAll(prodContacts)}
                      className="text-[11px] text-gray-500 hover:text-[#CC1010] transition-colors">
                      {prodContacts.filter(c => c.email).every(c => selectedContacts[c.id]) ? 'בטל הכל' : 'בחר הכל'}
                    </button>
                    <div className="flex-1"/>
                    {Object.values(selectedContacts).some(Boolean) && (
                      <button onClick={() => sendEmailToSelected(prodContacts)}
                        className="flex items-center gap-1.5 text-[12px] bg-[#CC1010] text-white px-3 py-1.5 rounded-lg hover:bg-[#a00c0c]">
                        <i className="ti ti-mail" style={{fontSize:13}}/>
                        שלח מייל לנבחרים ({prodContacts.filter(c => selectedContacts[c.id] && c.email).length})
                      </button>
                    )}
                  </div>
                )}

                {prodContacts.length === 0 && !addingContact && (
                  <div className="text-center text-[13px] text-gray-400 py-6">
                    {isManager ? 'לחץ על "הוסף איש קשר" להתחלה' : 'אין אנשי קשר'}
                  </div>
                )}

                {prodContacts.map(c => (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse group">
                    {editingContact === c.id ? (
                      <div className="flex-1" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input value={editContact.full_name||''} onChange={e => setEditContact(p=>({...p,full_name:e.target.value}))}
                            placeholder="שם מלא" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right"/>
                          <input value={editContact.role||''} onChange={e => setEditContact(p=>({...p,role:e.target.value}))}
                            placeholder="תפקיד" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right"/>
                          <input value={editContact.phone||''} onChange={e => setEditContact(p=>({...p,phone:e.target.value}))}
                            placeholder="טלפון" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right" dir="ltr"/>
                          <input value={editContact.email||''} onChange={e => setEditContact(p=>({...p,email:e.target.value}))}
                            placeholder="אימייל" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right" dir="ltr"/>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEditContact(c.id, prod.id)}
                            className="flex-1 bg-[#CC1010] text-white text-sm py-1.5 rounded-lg hover:bg-[#a00c0c]">שמור</button>
                          <button onClick={() => setEditingContact(null)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {c.email && (
                          <input type="checkbox"
                            checked={!!selectedContacts[c.id]}
                            onChange={() => toggleSelect(c.id)}
                            className="w-4 h-4 accent-[#CC1010] flex-shrink-0 cursor-pointer"
                          />
                        )}
                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="text-[14px] font-medium text-gray-800">{c.full_name}</div>
                            {c.role && <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{c.role}</span>}
                          </div>
                          <div className="flex gap-3 justify-end mt-1 flex-wrap">
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[12px] text-[#CC1010] hover:underline" dir="ltr">
                                <i className="ti ti-phone" style={{fontSize:12}}/> {c.phone}
                              </a>
                            )}
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[12px] text-blue-500 hover:underline" dir="ltr">
                                <i className="ti ti-mail" style={{fontSize:12}}/> {c.email}
                              </a>
                            )}
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingContact(c.id); setEditContact({full_name:c.full_name||'',role:c.role||'',phone:c.phone||'',email:c.email||''}) }}
                              className="text-gray-300 hover:text-gray-600">
                              <i className="ti ti-pencil" style={{fontSize:12}}/>
                            </button>
                            <button onClick={() => deleteContact(c.id, prod.id)}
                              className="text-gray-300 hover:text-red-500">
                              <i className="ti ti-trash" style={{fontSize:12}}/>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Add contact form */}
                {addingContact === prod.id ? (
                  <div className="px-4 py-3 border-t border-gray-50 bg-gray-50">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input value={newContact.full_name} onChange={e => setNewContact(p=>({...p,full_name:e.target.value}))}
                        placeholder="שם מלא *" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right bg-white"/>
                      <input value={newContact.role} onChange={e => setNewContact(p=>({...p,role:e.target.value}))}
                        placeholder="תפקיד" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] text-right bg-white"/>
                      <input value={newContact.phone} onChange={e => setNewContact(p=>({...p,phone:e.target.value}))}
                        placeholder="טלפון" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] bg-white" dir="ltr"/>
                      <input value={newContact.email} onChange={e => setNewContact(p=>({...p,email:e.target.value}))}
                        placeholder="אימייל" className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#CC1010] bg-white" dir="ltr"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => addContact(prod.id)} disabled={savingContact}
                        className="flex-1 bg-[#CC1010] text-white text-sm py-1.5 rounded-lg hover:bg-[#a00c0c] disabled:opacity-50">
                        {savingContact ? 'שומר...' : 'הוסף'}
                      </button>
                      <button onClick={() => { setAddingContact(null); setNewContact({ full_name:'', phone:'', email:'', role:'' }) }}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">ביטול</button>
                    </div>
                  </div>
                ) : isManager && (
                  <button onClick={() => setAddingContact(prod.id)}
                    className="w-full py-3 text-[13px] text-gray-400 hover:text-[#CC1010] hover:bg-[#FDEAEA] transition-colors flex items-center justify-center gap-1">
                    <i className="ti ti-plus" style={{fontSize:13}}/> הוסף איש קשר
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
