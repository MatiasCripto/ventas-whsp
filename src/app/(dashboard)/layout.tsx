'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  MessageSquare, BarChart3, Settings, Zap,
  Menu, Sun, Moon, Bell,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/overview',       icon: LayoutDashboard },
  { label: 'Productos',   href: '/products',       icon: Package },
  { label: 'Pedidos',     href: '/orders',         icon: ShoppingCart },
  { label: 'Clientes',    href: '/customers',      icon: Users },
  { label: 'Conversaciones', href: '/conversations', icon: MessageSquare },
  { label: 'WhatsApp',    href: '/whatsapp',     icon: MessageSquare },
  { label: 'Analytics',   href: '/analytics',      icon: BarChart3 },
  { label: 'Automatizaciones', href: '/automations', icon: Zap },
  { label: 'Configuración', href: '/settings',     icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { authUser, currentStore, setCurrentStore, signOut, loading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { unreadCount } = useNotifications({ organizationId: authUser?.organization?.id ?? null })
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!authUser && !loading) {
      router.push('/login')
    }
  }, [authUser, loading, router])

  if (!authUser) return null

  // If organization is inactive, show block screen
  if (authUser.organization?.active === false) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'var(--danger-bg)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--danger)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.062 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Organización desactivada</h2>
          <p style={{ color: 'var(--muted)' }}>
            Esta cuenta se encuentra actualmente deshabilitada. Para más información, comuníquese con su proveedor.
          </p>
          <button
            onClick={signOut}
            className="px-6 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

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
          {currentStore?.logo_url ? (
            <img src={currentStore.logo_url} alt="" className="w-7 h-7 rounded-[var(--radius-sm)] object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: 'var(--brand)' }}>
              {currentStore?.name?.charAt(0)?.toUpperCase() ?? 'T'}
            </div>
          )}
          <span className="font-semibold text-sm truncate">{currentStore?.name ?? 'Tienda'}</span>
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
          {/* Theme toggle */}
          <div className="flex items-center justify-center gap-1 px-3 pt-2">
            {mounted && (
              <>
                <button onClick={() => setTheme('light')}
                  className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${theme === 'light' ? '' : 'opacity-50 hover:opacity-100'}`}
                  style={{ background: theme === 'light' ? 'var(--surface-2)' : 'transparent', color: 'var(--muted)' }}
                  title="Modo claro"
                >
                  <Sun size={14} />
                </button>
                <button onClick={() => setTheme('dark')}
                  className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${theme === 'dark' ? '' : 'opacity-50 hover:opacity-100'}`}
                  style={{ background: theme === 'dark' ? 'var(--surface-2)' : 'transparent', color: 'var(--muted)' }}
                  title="Modo oscuro"
                >
                  <Moon size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between h-14 px-5 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ color: 'var(--muted)' }}>
              <Menu size={20} />
            </button>
            <span className="font-semibold text-sm truncate">{currentStore?.name ?? 'Tienda'}</span>
          </div>
          <a href="/notifications" className="relative p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--muted)' }}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: '#ef4444' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </a>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
