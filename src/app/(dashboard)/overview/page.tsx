'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Package, Users, TrendingUp } from 'lucide-react'

interface KpiCard {
  label: string
  value: string
  icon: React.ReactNode
  change?: string
  color: string
}

export default function OverviewPage() {
  const { currentStore, authUser } = useAuthContext()
  const [kpis, setKpis] = useState<KpiCard[]>([
    { label: 'Pedidos Hoy', value: '—', icon: <ShoppingCart size={18} />, color: 'var(--brand)', change: '' },
    { label: 'Productos', value: '—', icon: <Package size={18} />, color: 'var(--success)', change: '' },
    { label: 'Clientes', value: '—', icon: <Users size={18} />, color: 'var(--info)', change: '' },
    { label: 'Ingresos Hoy', value: '—', icon: <TrendingUp size={18} />, color: 'var(--warning)', change: '' },
  ])

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return

    async function loadKpis() {
      try {
        const sb = createClient()

        const { count: products } = await sb.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true)
        const { count: customers } = await sb.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { data: todayOrders } = await sb.from('orders')
          .select('total')
          .eq('organization_id', orgId)
          .gte('created_at', today.toISOString())
        const todayRevenue = (todayOrders ?? []).reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0)

        setKpis([
          { label: 'Pedidos Hoy', value: String(todayOrders?.length ?? 0), icon: <ShoppingCart size={18} />, color: 'var(--brand)', change: '' },
          { label: 'Productos', value: String(products ?? 0), icon: <Package size={18} />, color: 'var(--success)', change: '' },
          { label: 'Clientes', value: String(customers ?? 0), icon: <Users size={18} />, color: 'var(--info)', change: '' },
          { label: 'Ingresos Hoy', value: `$${todayRevenue.toLocaleString()}`, icon: <TrendingUp size={18} />, color: 'var(--warning)', change: '' },
        ])
      } catch {
        // Dev mode — show sample data when Supabase is unavailable
        setKpis([
          { label: 'Pedidos Hoy', value: '12', icon: <ShoppingCart size={18} />, color: 'var(--brand)', change: '' },
          { label: 'Productos', value: '48', icon: <Package size={18} />, color: 'var(--success)', change: '' },
          { label: 'Clientes', value: '156', icon: <Users size={18} />, color: 'var(--info)', change: '' },
          { label: 'Ingresos Hoy', value: '$1,280', icon: <TrendingUp size={18} />, color: 'var(--warning)', change: '' },
        ])
      }
    }

    loadKpis()
  }, [authUser])

  const greeting = authUser?.profile?.full_name
    ? `Bienvenido, ${authUser.profile.full_name.split(' ')[0]}`
    : 'Bienvenido'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">{greeting}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {currentStore?.name ?? authUser?.organization?.name ?? 'Panel de control'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card p-4 card-hover">
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center"
                style={{ background: `${kpi.color}15`, color: kpi.color }}
              >
                {kpi.icon}
              </div>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4">Pedidos Recientes</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Conectá tu tienda para ver pedidos</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4">Conversaciones Activas</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Conectá WhatsApp para empezar</p>
        </div>
      </div>
    </div>
  )
}
