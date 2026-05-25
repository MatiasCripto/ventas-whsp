'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { Zap, ShoppingCart, Bell, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatRelative } from '@/lib/utils/formatters'

interface AutomationStat {
  workflow: string
  total: number
  success: number
  error: number
  last_run: string | null
}

const WORKFLOW_META: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  cart_abandonment_24h: {
    label: 'Carrito Abandonado (24h)',
    description: 'Recordatorio a clientes que dejaron productos en el carrito hace más de 24hs',
    icon: <ShoppingCart size={18} />,
  },
  post_purchase_7d: {
    label: 'Post-Compra (7 días)',
    description: 'Seguimiento a clientes 7 días después de su compra',
    icon: <Bell size={18} />,
  },
  reengagement_30d: {
    label: 'Re-engagement (30 días)',
    description: 'Reactivación de clientes inactivos por más de 30 días',
    icon: <MessageSquare size={18} />,
  },
}

export default function AutomationsPage() {
  const { authUser } = useAuthContext()
  const [stats, setStats] = useState<AutomationStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      const sb = createServiceClient()

      const { data } = await sb.from('automation_logs')
        .select('workflow, status, executed_at')
        .eq('organization_id', orgId)
        .order('executed_at', { ascending: false })
        .limit(1000)

      const rows = (data ?? []) as { workflow: string; status: string; executed_at: string }[]

      // Group by workflow
      const grouped: Record<string, { total: number; success: number; error: number; last_run: string | null }> = {}
      for (const r of rows) {
        if (!grouped[r.workflow]) grouped[r.workflow] = { total: 0, success: 0, error: 0, last_run: null }
        grouped[r.workflow].total++
        if (r.status === 'success') grouped[r.workflow].success++
        else grouped[r.workflow].error++
        if (!grouped[r.workflow].last_run || r.executed_at > grouped[r.workflow].last_run!) {
          grouped[r.workflow].last_run = r.executed_at
        }
      }

      setStats(Object.entries(grouped).map(([workflow, s]) => ({ workflow, ...s })))
      setLoading(false)
    }
    load()
  }, [authUser])

  const workflows = Object.entries(WORKFLOW_META)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Automatizaciones</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Workflows automáticos de WhatsApp activados por cron
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflows.map(([key, meta]) => {
            const stat = stats.find(s => s.workflow === key)
            return (
              <div key={key} className="card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                    style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}
                  >
                    {meta.icon}
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">{meta.label}</h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{meta.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Zap size={14} style={{ color: 'var(--muted)' }} />
                    <span>{stat?.total ?? 0} ejecuciones</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                    <span>{stat?.success ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle size={14} style={{ color: '#ef4444' }} />
                    <span>{stat?.error ?? 0}</span>
                  </div>
                </div>

                {stat?.last_run && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
                    <Clock size={12} />
                    <span>Último: {formatRelative(stat.last_run)}</span>
                  </div>
                )}

                {!stat && (
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                    Sin ejecuciones todavía. Activá el cron job para empezar.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold text-sm mb-3">¿Cómo funciona?</h2>
        <div className="text-xs space-y-2" style={{ color: 'var(--muted)' }}>
          <p>Las automatizaciones se ejecutan mediante un cron job externo que llama al endpoint interno:</p>
          <code className="block p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--surface-2)' }}>
            POST /api/jobs/execute
          </code>
          <p>Headers requeridos:</p>
          <code className="block p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--surface-2)' }}>
            Authorization: Bearer {'{JOB_SECRET}'}
          </code>
          <p>Parámetros:</p>
          <code className="block p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--surface-2)' }}>
            {'{ "workflow": "cart_abandonment_24h", "organization_id": "..." }'}
          </code>
        </div>
      </div>
    </div>
  )
}
