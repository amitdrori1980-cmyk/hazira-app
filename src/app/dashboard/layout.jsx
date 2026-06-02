'use client'
import { useEffect, useState, useRef } from 'react'
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
  const [muted, setMuted] = useState(() => typeof window !== 'undefined' && localStorage.getItem('notif-muted') === 'true')
  const [menuOpen, setMenuOpen] = useState(false)
  const audioCtxRef = useRef(null)

  function playSound() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ac = audioCtxRef.current
      if (ac.state === 'suspended') ac.resume()
      const freqs = [523, 659, 784]
      freqs.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain()
        o.connect(g); g.connect(ac.destination)
        o.type = 'sine'; o.frequency.value = f
        const t = ac.currentTime + i * 0.15
        g.gain.setValueAtTime(0.3, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
        o.start(t); o.stop(t + 0.6)
      })
    } catch(e) {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        supabase.auth.onAuthStateChange((event, session) => {
          if (!session) router.push('/login')
        })
        return
      }
      const data = { user: sessionData.session.user }
      supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)

      const { data: nav } = await supabase
        .from('nav_items')
        .select('*')
        .eq('enabled', true)
        .order('sort_order')
      const { data: opsCrew } = await supabase.from('operations_crew').select('id,full_name').eq('user_id', data.user.id).eq('active', true).maybeSingle()
      if (opsCrew && !p?.is_manager) {
        setNavItems([{ label: 'מחלקת תפעול', href: '/dashboard/operations', icon: 'ti-settings', manager_only: false }])
        if (!p) setProfile({ full_name: opsCrew.full_name, is_manager: false })
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/operations')) {
          router.push('/dashboard/operations')
        }
      } else {
        setNavItems((nav || []).filter(n => !n.manager_only || p?.is_manager))
      }

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .or(`to_user.eq.${data.user.id},to_dept.eq.all`)
        .eq('read', false)
      const prev = parseInt(localStorage.getItem('notif-count') || '0')
      if (count > prev && prev >= 0) {
        if (!localStorage.getItem('notif-muted') || localStorage.getItem('notif-muted') === 'false') {
          try {
            const ac = new AudioContext()
            const freqs = [523, 659, 784]
            freqs.forEach((f, i) => {
              const o = ac.createOscillator(), g = ac.createGain()
              o.connect(g); g.connect(ac.destination)
              o.type = 'sine'; o.frequency.value = f
              const t = ac.currentTime + i * 0.15
              g.gain.setValueAtTime(0.3, t)
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
              o.start(t); o.stop(t + 0.6)
            })
          } catch(e) {}
        }
      }
      localStorage.setItem('notif-count', count || 0)
      setUnread(count || 0)
    })
    })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('layout-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        if (!muted) playSound()
        setUnread(prev => prev + 1)
        window.dispatchEvent(new CustomEvent('new-message'))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [muted])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    localStorage.setItem('notif-muted', next)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : '?'

  const bottomNavItems = navItems.slice(0, 4)

  return (
    <div className="flex flex-row-reverse h-screen bg-[#f8f5f5] overflow-hidden">

      {/* SIDEBAR - desktop only */}
      <aside className="hidden md:flex w-48 flex-col bg-white border-l border-gray-100 flex-shrink-0">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <HaziraLogo size={32} />
            <div>
              <div className="text-sm font-bold text-[#E0197D]">הזירה</div>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-2 bg-[#FCE4F3] rounded-full px-2 py-1">
              <div className="w-5 h-5 rounded-full bg-[#E0197D] text-white text-[9px] font-medium flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <span className="text-[11px] font-medium text-[#A0106A] flex-1 truncate">
                {profile.full_name?.split(' ')[0]}
              </span>
              <button onClick={logout} className="text-[#E0197D] text-xs" title="התנתק">
                <i className="ti ti-logout" style={{ fontSize: 12 }} />
              </button>
              <button onClick={toggleMute} title={muted ? "הפעל צליל" : "השתק צליל"}
                className="text-gray-400 hover:text-[#E0197D] p-1 rounded transition-colors">
                <i className={muted ? "ti ti-bell-off" : "ti ti-bell"} style={{ fontSize: 14 }} />
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
                  ? 'bg-white text-[#E0197D] font-medium border-l-2 border-[#E0197D]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} aria-hidden />
              {item.label}
              {item.label === 'הודעות' && unread > 0 && (
                <span className="mr-auto bg-[#E0197D] text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </Link>
          ))}

          {profile?.is_manager && (
            <>
              <div className="mx-4 my-1 border-t border-gray-100" />
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
                  pathname === '/dashboard/settings'
                    ? 'bg-white text-[#E0197D] font-medium border-l-2 border-[#E0197D]'
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

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden text-gray-500 p-1"
          >
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>

          <div className="flex-1">
            <div className="text-[13px] font-medium text-gray-800">
              שלום{profile ? ', ' + profile.full_name?.split(' ')[0] : ''}!
            </div>
            {profile && (
              <div className="text-[11px] text-gray-400">{profile.role} · {profile.dept}</div>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-5">
          {children}
        </div>
      </main>

      {/* BOTTOM NAV - mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50">
        {bottomNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative ${
              pathname === item.href ? 'text-[#E0197D]' : 'text-gray-400'
            }`}
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 20 }} />
            <span className="text-[10px]">{item.label}</span>
            {item.label === 'הודעות' && unread > 0 && (
              <span className="absolute top-2 right-1/4 bg-[#E0197D] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                {unread}
              </span>
            )}
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-gray-400"
        >
          <i className="ti ti-dots" style={{ fontSize: 20 }} />
          <span className="text-[10px]">עוד</span>
        </button>
      </nav>

      {/* MOBILE DRAWER MENU */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />

          <div className="relative w-64 bg-white h-full flex flex-col shadow-xl mr-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <HaziraLogo size={28} />
                <span className="font-bold text-[#E0197D]">הזירה</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 p-1">
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            {profile && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#FCE4F3] mx-3 mt-3 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#E0197D] text-white text-sm font-medium flex items-center justify-center">
                  {initials}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#A0106A]">{profile.full_name}</div>
                  <div className="text-[11px] text-[#E0197D]">{profile.role}</div>
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto py-2 mt-2">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-[14px] ${
                    pathname === item.href
                      ? 'text-[#E0197D] font-medium bg-[#FCE4F3]'
                      : 'text-gray-600'
                  }`}
                >
                  <i className={`ti ${item.icon}`} style={{ fontSize: 17 }} />
                  {item.label}
                  {item.label === 'הודעות' && unread > 0 && (
                    <span className="mr-auto bg-[#E0197D] text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {unread}
                    </span>
                  )}
                </Link>
              ))}

              {profile?.is_manager && (
                <>
                  <div className="mx-4 my-1 border-t border-gray-100" />
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-[14px] ${
                      pathname === '/dashboard/settings'
                        ? 'text-[#E0197D] font-medium bg-[#FCE4F3]'
                        : 'text-gray-600'
                    }`}
                  >
                    <i className="ti ti-settings" style={{ fontSize: 17 }} />
                    הגדרות
                  </Link>
                </>
              )}
            </nav>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={logout}
                className="flex items-center gap-2 text-gray-500 text-sm w-full"
              >
                <i className="ti ti-logout" style={{ fontSize: 16 }} />
                התנתק
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
