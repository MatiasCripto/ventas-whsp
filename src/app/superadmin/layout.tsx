'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Users, LayoutDashboard, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Overview', href: '/superadmin', icon: LayoutDashboard },
  { label: 'Organizaciones', href: '/superadmin/organizations', icon: Building2 },
  { label: 'Usuarios', href: '/superadmin/users', icon: Users },
]

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        const { data: profile } = await sb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (!profile || profile.role !== 'superadmin') {
          router.push('/overview')
          return
        }
        setAuthorized(true)
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  if (loading) return null
  if (!authorized) return null

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-14 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: 'var(--brand)' }}>
            SA
          </div>
          <div>
            <span className="font-semibold text-sm">Superadmin</span>
            <p className="text-[10px]" style={{ color: 'var(--subtle)' }}>Concierge AI</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href))
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand-subtle)' : 'transparent',
                  color: active ? 'var(--brand)' : 'var(--muted)',
                }}
                onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <item.icon size={16} />
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-[var(--radius-md)] text-sm font-medium transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-14 px-6 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h1 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Concierge AI — Superadmin</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
