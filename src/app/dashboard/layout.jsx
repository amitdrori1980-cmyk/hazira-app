'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import HaziraLogo from '@/components/HaziraLogo'
import Link from 'next/link'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [navItems, setNavItems] = useState([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)

      // Load nav from DB
      const { data: nav } = await supabase
        .from('nav_items')
        .select('*')
        .eq('enabled', true)
        .order('sort_order')
      // Filter manager-only if not manager
      setNavItems((nav || []).filter(n => !n.manager_only || p?.is_manager))

      // Unread messages
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .or(`to_user.eq.${data.user.id},to_dept.eq.all`)
        .eq('read', false)
      setUnread(count || 0)
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : '?'

  return (
    <div className="flex flex-row-reverse h-screen bg-[#f8f5f5] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 flex flex-col bg-white border-l border-gray-100 flex-shrink-0">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <HaziraLogo size={32} />
            <div>
              <div className="text-sm font-bold text-[#CC1010]">הזירה</div>
              
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-2 bg-[#FDEAEA] rounded-full px-2 py-1">
              <div className="w-5 h-5 rounded-full bg-[#CC1010] text-white text-[9px] font-medium flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <span className="text-[11px] font-medium text-[#8B0000] flex-1 truncate">
                {profile.full_name?.split(' ')[0]}
              </span>
              <button onClick={logout} className="text-[#CC1010] text-xs" title="התנתק">
                <i className="ti ti-logout" style={{ fontSize: 12 }} />
              </button>
            </div>
          )}
        </div>

        <nav className="flex flex-col py-1 flex-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
                pathname === item.href
                  ? 'bg-white text-[#CC1010] font-medium border-l-2 border-[#CC1010]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} aria-hidden />
              {item.label}
              {item.label === 'הודעות' && unread > 0 && (
                <span className="mr-auto bg-[#CC1010] text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </Link>
          ))}

          {/* Settings link for managers */}
          {profile?.is_manager && (
            <>
              <div className="mx-4 my-1 border-t border-gray-100" />
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
                  pathname === '/dashboard/settings'
                    ? 'bg-white text-[#CC1010] font-medium border-l-2 border-[#CC1010]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <i className="ti ti-settings" style={{ fontSize: 15 }} aria-hidden />
                הגדרות
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100">
          <div className="flex-1">
            <div className="text-[13px] font-medium text-gray-800">
              שלום{profile ? ', ' + profile.full_name?.split(' ')[0] : ''}!
            </div>
            {profile && (
              <div className="text-[11px] text-gray-400">{profile.role} · {profile.dept}</div>
            )}
          </div>
          <HaziraLogo size={26} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </main>
    </div>
  )
}
