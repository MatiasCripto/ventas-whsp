'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { formatRelative } from '@/lib/utils/formatters'
import { Bell, CheckCheck, ArrowLeft } from 'lucide-react'

export default function NotificationsPage() {
  const { authUser } = useAuthContext()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications({
    organizationId: authUser?.organization?.id ?? null,
    limit: 100,
  })

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/overview" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={18} />
          </a>
          <h1 className="text-xl font-semibold">Notificaciones</h1>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
              style={{ background: '#fef2f2', color: '#991b1b' }}>
              {unreadCount} sin leer
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-[var(--radius-md)]"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            <CheckCheck size={14} /> Marcar todas leídas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-8 text-center">
          <Bell size={32} className="mx-auto mb-2" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay notificaciones</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.read && markAsRead(n.id)}
              className="card p-4 cursor-pointer transition-colors flex items-start gap-3"
              style={{
                background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                borderLeft: n.read ? '3px solid transparent' : `3px solid var(--brand)`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--subtle)' }}>
                    {formatRelative(n.created_at)}
                  </span>
                </div>
                {n.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{n.description}</p>
                )}
                {n.entity_type && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--subtle)' }}>
                    {n.entity_type} · {n.entity_id?.slice(0, 8)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
