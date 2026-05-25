'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DepartmentsPage() {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDept, setNewDept] = useState('')
  const [adding, setAdding] = useState(false)
  const [isManager, setIsManager] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('is_manager').eq('id', user.id).single()
    setIsManager(p?.is_manager || false)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
    setLoading(false)
  }

  async function addDept(e) {
    e.preventDefault()
    if (!newDept.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: newDept.trim() })
      .select()
      .single()
    if (!error) setDepts(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
    setNewDept('')
    setAdding(false)
  }

  async function deleteDept(id) {
    await supabase.from('departments').delete().eq('id', id)
    setDepts(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="max-w-sm">
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        <div className="text-[13px] font-medium text-gray-800 mb-3">מחלקות הזירה</div>

        {/* Add form — manager only */}
        {isManager && (
          <form onSubmit={addDept} className="flex gap-2 mb-4 flex-row-reverse">
            <input
              value={newDept}
              onChange={e => setNewDept(e.target.value)}
              placeholder="שם מחלקה חדשה..."
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-[#E0197D] hover:bg-[#A0106A] text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <i className="ti ti-plus" />
            </button>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-6">טוען...</div>
        ) : depts.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">אין מחלקות</div>
        ) : (
          depts.map((d, i) => (
            <div key={d.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse">
              <div className="w-7 h-7 rounded-full bg-[#FCE4F3] text-[#E0197D] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <span className="flex-1 text-[13px] text-right text-gray-800">{d.name}</span>
              {isManager && (
                <button
                  onClick={() => deleteDept(d.id)}
                  className="text-gray-300 hover:text-[#E0197D] transition-colors"
                  title="מחק מחלקה"
                >
                  <i className="ti ti-trash" style={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {isManager && (
        <div className="bg-[#FCE4F3] border border-[#f5c6c6] rounded-xl p-3 text-[12px] text-[#A0106A]">
          <strong>שים לב:</strong> מחיקת מחלקה לא תמחק את העובדים שבה — רק את שם המחלקה מהרשימה.
        </div>
      )}
    </div>
  )
}
