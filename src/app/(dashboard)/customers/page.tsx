'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import type { Customer } from '@/lib/types'

export default function CustomersPage() {
  const { authUser } = useAuthContext()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 25

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      try {
        const sb = createClient()
        let query = sb.from('customers')
          .select('*', { count: 'exact' })
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        if (search) {
          query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        }

        const { data, count } = await query
        setCustomers((data ?? []) as Customer[])
        setTotal(count ?? 0)
      } catch {
        // Dev mode — empty state
      }
      setLoading(false)
    }
    load()
  }, [authUser, search, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {total} total
        </span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border max-w-md" style={{ borderColor: 'var(--border)' }}>
        <Search size={16} style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      ) : customers.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{search ? 'Sin resultados' : 'No hay clientes todavía'}</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Contacto</th>
                  <th className="text-right px-4 py-3 font-medium">Órdenes</th>
                  <th className="text-right px-4 py-3 font-medium">Gasto Total</th>
                  <th className="text-right px-4 py-3 font-medium">Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-t cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => window.location.href = `/customers/${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{c.full_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {c.phone && <span style={{ color: 'var(--muted)' }}>{c.phone}</span>}
                        {c.email && <span className="text-xs" style={{ color: 'var(--subtle)' }}>{c.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{c.total_orders}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.lifetime_value)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                      {c.last_order_at ? formatDate(c.last_order_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-2 rounded-[var(--radius-md)] disabled:opacity-30 hover:bg-[var(--surface-2)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {page + 1} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-2 rounded-[var(--radius-md)] disabled:opacity-30 hover:bg-[var(--surface-2)] transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

