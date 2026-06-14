'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { router.push('/login'); return }
      setEmail(user.email || '')
      setReady(true)
    })
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (pw1.length < 8) { setError('הסיסמה צריכה להיות באורך 8 תווים לפחות'); return }
    if (pw1 !== pw2) { setError('הסיסמאות אינן תואמות'); return }
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error: pwErr } = await supabase.auth.updateUser({ password: pw1 })
    if (pwErr) {
      setError('לא הצלחנו לעדכן את הסיסמה. נסה סיסמה אחרת.')
      setLoading(false)
      return
    }
    if (userData?.user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userData.user.id)
    }
    router.push('/dashboard')
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center" dir="rtl">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#E0197D] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-[#E0197D]">הזירה</div>
          <div className="text-sm text-gray-400">מערכת ניהול הפקה</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h1 className="text-[18px] font-semibold text-gray-800 text-center mb-2">בחירת סיסמה חדשה</h1>
          <p className="text-[13px] text-gray-400 text-center mb-6">{email}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input type="password" value={pw1} onChange={e=>setPw1(e.target.value)}
              placeholder="סיסמה חדשה" required
              className="text-sm px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
            <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)}
              placeholder="אימות סיסמה חדשה" required
              className="text-sm px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#E0197D] text-right"/>
            {error && <p className="text-[13px] text-[#E0197D] text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="bg-[#E0197D] text-white text-sm py-3 rounded-xl font-medium hover:bg-[#A0106A] disabled:opacity-50 mt-2">
              {loading ? 'שומר...' : 'שמירת סיסמה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
