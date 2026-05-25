'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { TrendingUp, DollarSign, ShoppingBag, Users, Repeat, RotateCcw } from 'lucide-react'
import { formatCurrency, formatPct } from '@/lib/utils/formatters'

interface AnalyticsSummary {
  total_revenue: number
  total_orders: number
  avg_order_value: number
  new_customers: number
  returning_customers: number
  conversion_rate: number
  abandoned_carts: number
  topProducts: { name: string; total: number }[]
}

interface DailyRow {
  date: string
  total_revenue: number
  total_orders: number
  new_customers: number
  conversion_rate: number
}

const DAYS_RANGE = 30

export default function AnalyticsPage() {
  const { authUser, currentStore } = useAuthContext()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      const sb = createServiceClient()

      // — Period —
      const since = new Date()
      since.setDate(since.getDate() - DAYS_RANGE)
      const sinceStr = since.toISOString()

      // — Orders in period —
      const { data: orders } = await sb.from('orders')
        .select('total, created_at, customer_id')
        .eq('organization_id', orgId)
        .gte('created_at', sinceStr)
        .not('status', 'eq', 'cancelled')

      const totalRevenue = (orders ?? []).reduce((s: number, o: { total: number }) => s + Number(o.total), 0)
      const totalOrders = (orders ?? []).length
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      const uniqueCustomers = new Set((orders ?? []).map((o: { customer_id: string }) => o.customer_id)).size

      // — Customers —
      const { count: allCustomers } = await sb.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      const { count: newCustomers } = await sb.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', sinceStr)

      const returningOrders = (orders ?? []).filter((o: { customer_id: string }) => {
        // count how many orders this customer has in period
        return (orders ?? []).filter((oo: { customer_id: string }) => oo.customer_id === o.customer_id).length > 1
      }).length

      // — Conversion (abandoned carts) —
      const { count: carts } = await sb.from('carts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      const conversionRate = (carts ?? 0) > 0 ? totalOrders / (carts ?? 1) : 0

      // — Top products —
      const { data: items } = await sb.from('order_items')
        .select('product_name, total, order:orders!inner(organization_id, created_at)')
        .eq('order.organization_id', orgId)
        .gte('order.created_at', sinceStr)
        .not('order.status', 'eq', 'cancelled')

      const productMap: Record<string, number> = {}
      for (const item of (items ?? []) as { product_name: string; total: number }[]) {
        productMap[item.product_name] = (productMap[item.product_name] ?? 0) + Number(item.total)
      }
      const topProducts = Object.entries(productMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total }))

      setSummary({
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        avg_order_value: avgOrderValue,
        new_customers: newCustomers ?? 0,
        returning_customers: uniqueCustomers - (newCustomers ?? 0),
        conversion_rate: conversionRate,
        abandoned_carts: (carts ?? 0) - totalOrders,
        topProducts,
      })

      // — Daily series —
      const { data: dailyData } = await sb.from('analytics_daily')
        .select('date, total_revenue, total_orders, new_customers, conversion_rate')
        .eq('organization_id', orgId)
        .order('date', { ascending: false })
        .limit(DAYS_RANGE)

      setDaily((dailyData ?? []) as DailyRow[])
      setLoading(false)
    }
    load()
  }, [authUser])

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>

  const kpiCards = summary ? [
    { label: 'Ingresos (30d)', value: formatCurrency(summary.total_revenue), icon: <DollarSign size={18} />, color: 'var(--success)' },
    { label: 'Pedidos (30d)', value: String(summary.total_orders), icon: <ShoppingBag size={18} />, color: 'var(--brand)' },
    { label: 'Ticket Promedio', value: formatCurrency(summary.avg_order_value), icon: <TrendingUp size={18} />, color: 'var(--info)' },
    { label: 'Nuevos Clientes', value: String(summary.new_customers), icon: <Users size={18} />, color: 'var(--warning)' },
  ] : []

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center"
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
        {/* Top Products */}
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4">Productos Más Vendidos</h2>
          {summary && summary.topProducts.length > 0 ? (
            <div className="space-y-3">
              {summary.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5" style={{ color: 'var(--subtle)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.name}</p>
                    <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-1.5 rounded-full" style={{
                        background: 'var(--brand)',
                        width: `${Math.min(100, (p.total / (summary.topProducts[0]?.total || 1)) * 100)}%`,
                      }} />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin datos de productos vendidos</p>
          )}
        </div>

        {/* Customer metrics */}
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4">Clientes</h2>
          {summary ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} style={{ color: 'var(--info)' }} />
                  <span className="text-sm">Nuevos</span>
                </div>
                <span className="text-sm font-bold">{summary.new_customers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat size={16} style={{ color: 'var(--warning)' }} />
                  <span className="text-sm">Recurrentes</span>
                </div>
                <span className="text-sm font-bold">{summary.returning_customers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw size={16} style={{ color: 'var(--muted)' }} />
                  <span className="text-sm">Carritos abandonados</span>
                </div>
                <span className="text-sm font-bold">{summary.abandoned_carts}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm font-medium">Tasa de conversión</span>
                <span className="text-sm font-bold">{formatPct(summary.conversion_rate)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin datos</p>
          )}
        </div>
      </div>

      {/* Daily table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Últimos {DAYS_RANGE} Días</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th className="text-left px-4 py-2 font-medium">Fecha</th>
              <th className="text-right px-4 py-2 font-medium">Ingresos</th>
              <th className="text-right px-4 py-2 font-medium">Pedidos</th>
              <th className="text-right px-4 py-2 font-medium">Nuevos</th>
              <th className="text-right px-4 py-2 font-medium">Conversión</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(d => (
              <tr key={d.date} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-2">{d.date.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(d.total_revenue)}</td>
                <td className="px-4 py-2 text-right">{d.total_orders}</td>
                <td className="px-4 py-2 text-right">{d.new_customers}</td>
                <td className="px-4 py-2 text-right">{d.conversion_rate ? formatPct(d.conversion_rate) : '—'}</td>
              </tr>
            ))}
            {daily.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  Sin datos diarios. Ejecutá el cron de analytics para ver métricas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
