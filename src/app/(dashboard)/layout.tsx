'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  MessageSquare, BarChart3, Settings, Zap,
  Menu, X, ChevronDown,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/overview',       icon: LayoutDashboard },
  { label: 'Productos',   href: '/products',       icon: Package },
  { label: 'Pedidos',     href: '/orders',         icon: ShoppingCart },
  { label: 'Clientes',    href: '/customers',      icon: Users },
  { label: 'Conversaciones', href: '/conversations', icon: MessageSquare },
  { label: 'Analytics',   href: '/analytics',      icon: BarChart3 },
  { label: 'Automatizaciones', href: '/automations', icon: Zap },
  { label: 'Configuración', href: '/settings',     icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { authUser, currentStore, setCurrentStore, signOut, loading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!authUser && !loading) {
      router.push('/login')
    }
  }, [authUser, loading, router])

  if (!authUser) return null

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-14 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--brand)' }}>
            C
          </div>
          <span className="font-semibold text-sm">Concierge AI</span>
        </div>

        {/* Store selector */}
        {authUser.stores.length > 0 && (
          <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <select
              value={currentStore?.id ?? ''}
              onChange={e => setCurrentStore(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-[var(--radius-sm)] border bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {authUser.stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand-subtle)' : 'transparent',
                  color: active ? 'var(--brand)' : 'var(--muted)',
                }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <item.icon size={16} />
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--brand-light)' }}>
              {authUser.profile?.full_name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{authUser.profile?.full_name}</p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>{authUser.organization?.name}</p>
            </div>
            <button onClick={signOut} className="text-xs" style={{ color: 'var(--muted)' }}>Salir</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between h-14 px-5 border-b shrink-0 lg:hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--muted)' }}>
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">Concierge AI</span>
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
