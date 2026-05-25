'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה לא נכונים')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-[#E0197D]">הזירה</div>
          <div className="text-sm text-gray-400">מערכת ניהול הפקה</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h1 className="text-[18px] font-semibold text-gray-800 text-center mb-6">כניסה למערכת</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="אימייל" required
              className="text-sm px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="סיסמה" required
              className="text-sm px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
            {error && <p className="text-[13px] text-[#E0197D] text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="bg-[#E0197D] text-white text-sm py-3 rounded-xl font-medium hover:bg-[#A0106A] disabled:opacity-50 mt-2">
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
