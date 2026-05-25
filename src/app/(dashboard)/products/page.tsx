'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { Plus, Search } from 'lucide-react'

interface Product {
  id: string; name: string; slug: string; price: number
  is_active: boolean; stock: number; images: string[]
  category?: { name: string } | null
}

export default function ProductsPage() {
  const { authUser } = useAuthContext()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      try {
        const sb = createServiceClient()
        const { data } = await sb.from('products')
          .select('id, name, slug, price, is_active, images, category:categories(name)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
        const rows = (data ?? []) as unknown as Product[]
        // Add stock from variants
        const withStock = await Promise.all(rows.map(async (p) => {
          const { data: variants } = await sb.from('product_variants')
            .select('stock').eq('product_id', p.id).eq('is_active', true)
          const stock = (variants ?? []).reduce((s: number, v: { stock: number }) => s + (v.stock ?? 0), 0)
          return { ...p, stock }
        }))
        setProducts(withStock)
      } catch {
        // Dev mode — empty state
      }
      setLoading(false)
    }
    load()
  }, [authUser])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Productos</h1>
        <a
          href="/products/new"
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={16} />
          Nuevo Producto
        </a>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border max-w-md" style={{ borderColor: 'var(--border)' }}>
        <Search size={16} style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {search ? 'Sin resultados' : 'No hay productos todavía. ¡Creá el primero!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <a key={p.id} href={`/products/${p.id}`} className="card card-hover overflow-hidden">
              <div className="aspect-square bg-[var(--surface-2)] flex items-center justify-center">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl" style={{ color: 'var(--subtle)' }}>👕</span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-sm font-bold">${p.price.toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className={`badge ${p.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Stock: {p.stock}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
