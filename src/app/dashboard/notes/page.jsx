'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function NotesPage() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openNote, setOpenNote] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (openNote && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [openNote])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  async function createNote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('notes').insert({
      user_id: user.id, title: '', content: '',
    }).select().single()
    if (data) {
      setNotes(prev => [data, ...prev])
      openEdit(data)
    }
  }

  function openEdit(note) {
    setOpenNote(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  async function saveNote() {
    if (!openNote) return
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('notes').update({
      title: editTitle,
      content: editContent,
      updated_at: now,
    }).eq('id', openNote)
    setNotes(prev => prev.map(n =>
      n.id === openNote
        ? { ...n, title: editTitle, content: editContent, updated_at: now }
        : n
    ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
    setSaving(false)
    setOpenNote(null)
  }

  async function deleteNote(id) {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setConfirmDelete(null)
    if (openNote === id) setOpenNote(null)
  }

  function fmtDate(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return 'עכשיו'
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
  }

  function preview(content) {
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(0, 2).join(' · ') || 'ריק'
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={createNote}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1.5">
          <i className="ti ti-plus" style={{fontSize:14}}/> פתקייה חדשה
        </button>
        <div className="text-[12px] text-gray-400">{notes.length} פתקיות</div>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">📝</div>
          <div className="text-[14px] text-gray-500 mb-1">אין פתקיות עדיין</div>
          <div className="text-[12px] text-gray-400">לחץ על "פתקייה חדשה" להתחלה</div>
        </div>
      )}

      {/* Notes list */}
      <div className="grid gap-2">
        {notes.map(note => (
          <div key={note.id}
            className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3 flex-row-reverse hover:border-gray-200 transition-colors cursor-pointer group"
            onClick={() => openEdit(note)}>
            <div className="flex-1 text-right min-w-0">
              <div className="text-[13px] font-semibold text-gray-800 truncate">
                {note.title || <span className="text-gray-400 font-normal">ללא כותרת</span>}
              </div>
              <div className="text-[12px] text-gray-400 mt-0.5 truncate">{preview(note.content)}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] text-gray-300">{fmtDate(note.updated_at)}</span>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(note.id) }}
                className="text-gray-200 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="ti ti-trash" style={{fontSize:13}}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {openNote && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'85vh'}}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-row-reverse">
              <button onClick={saveNote} disabled={saving}
                className="bg-[#E0197D] text-white text-[13px] px-4 py-1.5 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button onClick={() => setOpenNote(null)}
                className="text-gray-400 hover:text-gray-600 p-1">
                <i className="ti ti-x" style={{fontSize:16}}/>
              </button>
            </div>
            <div className="px-4 pt-3 pb-2">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="כותרת..."
                className="w-full text-[15px] font-semibold text-gray-800 outline-none text-right placeholder:text-gray-300 bg-transparent"
              />
            </div>
            <div className="flex-1 px-4 pb-4 overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="כתוב כאן..."
                className="w-full h-full min-h-[200px] text-[13px] text-gray-700 outline-none text-right placeholder:text-gray-300 bg-transparent resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0" style={{background:'rgba(0,0,0,0.4)'}}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto mb-3">
              <i className="ti ti-trash text-[#E0197D]" style={{fontSize:22}}/>
            </div>
            <div className="text-center mb-4">
              <div className="text-[16px] font-semibold text-gray-900 mb-1">מחיקת פתקייה</div>
              <div className="text-[13px] text-gray-500">האם למחוק את הפתקייה?</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600">ביטול</button>
              <button onClick={() => deleteNote(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-[#E0197D] text-white text-[14px]">מחק</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
