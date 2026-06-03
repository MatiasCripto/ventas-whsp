'use client'

import { useEffect, useState } from 'react'
import { Building2, ShoppingCart, Users, Store } from 'lucide-react'

interface Stats {
  total_organizations: number
  total_stores: number
  total_orders: number
  total_customers: number
  organizations_this_month: number
}

export default function SuperadminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/superadmin/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  const cards = [
    { label: 'Organizaciones activas', value: stats?.total_organizations ?? 0, icon: <Building2 size={20} />, color: 'var(--brand)' },
    { label: 'Tiendas', value: stats?.total_stores ?? 0, icon: <Store size={20} />, color: 'var(--info)' },
    { label: 'Pedidos totales', value: stats?.total_orders ?? 0, icon: <ShoppingCart size={20} />, color: 'var(--success)' },
    { label: 'Clientes totales', value: stats?.total_customers ?? 0, icon: <Users size={20} />, color: 'var(--warning)' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold">Panel general</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {stats?.organizations_this_month ?? 0} organizaciones creadas este mes
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-4 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{card.label}</span>
              <span style={{ color: card.color }}>{card.icon}</span>
            </div>
            <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
