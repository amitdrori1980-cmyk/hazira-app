'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import HaziraLogo from '@/components/HaziraLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('שם משתמש או סיסמה שגויים')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5f5]">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-80 shadow-sm"
           style={{ borderTop: '3px solid #CC1010' }}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <HaziraLogo size={48} />
          <div className="text-center">
            <div className="text-xl font-bold text-[#CC1010]">הזירה</div>
            
          </div>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">אימייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••" required
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#CC1010] transition-colors" />
          </div>
          {error && <p className="text-xs text-[#CC1010] text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#CC1010] hover:bg-[#a00c0c] text-white text-sm font-medium py-2.5 rounded-lg transition-colors mt-1 disabled:opacity-60">
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  )
}
