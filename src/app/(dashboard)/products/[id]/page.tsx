'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils/formatters'
import type { Product, ProductVariant } from '@/lib/types'

export default function ProductDetailPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId || !params.id) return
    async function load() {
      try {
        const sb = createClient()
        const { data: p } = await sb.from('products')
          .select('*, category:categories(id, name)')
          .eq('id', params.id as string).eq('organization_id', orgId).single()
        if (p) {
          setProduct(p as unknown as Product)
          const { data: v } = await sb.from('product_variants')
            .select('*').eq('product_id', p.id).order('color', { ascending: true })
          setVariants((v ?? []) as ProductVariant[])
        }
      } catch {
        // dev mode — Supabase not available
      }
      setLoading(false)
    }
    load()
  }, [authUser, params.id])

  async function handleDelete() {
    if (!confirm('¿Eliminar este producto permanentemente?')) return
    setDeleting(true)
    try {
      const sb = createClient()
      await sb.from('products').delete().eq('id', params.id as string)
    } catch {
      // dev mode — Supabase not available
    }
    setDeleting(false)
    router.push('/products')
  }

  async function handleToggleActive() {
    if (!product) return
    const sb = createClient()
    await sb.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    setProduct({ ...product, is_active: !product.is_active })
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
  if (!product) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Producto no encontrado</div>

  const totalStock = variants.reduce((s, v) => s + (v.is_active ? v.stock : 0), 0)
  const threshold = (product as any).low_stock_threshold ?? 5
  const lowStockVariants = variants.filter(v => v.is_active && v.stock <= threshold)
  const bestImage = product.images?.[0]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <a href="/products" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={18} />
        </a>
        <h1 className="text-xl font-semibold truncate flex-1">{product.name}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleToggleActive}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors ${
              product.is_active ? '' : 'text-white'
            }`}
            style={{
              background: product.is_active ? 'var(--surface-2)' : '#ef4444',
              color: product.is_active ? 'var(--muted)' : '#fff',
            }}
          >
            {product.is_active ? 'Activo' : 'Inactivo'}
          </button>
          <a href={`/products/${product.id}/edit`}
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <Pencil size={16} />
          </a>
          <button onClick={handleDelete} disabled={deleting}
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <div className="card overflow-hidden">
          <div className="aspect-square bg-[var(--surface-2)] flex items-center justify-center">
            {bestImage ? (
              <img src={bestImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl" style={{ color: 'var(--subtle)' }}>👕</span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(product.price)}</span>
              {product.compare_price && (
                <span className="text-sm line-through" style={{ color: 'var(--muted)' }}>
                  {formatCurrency(product.compare_price)}
                </span>
              )}
            </div>

            {product.description && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{product.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span style={{ color: 'var(--subtle)' }}>Slug</span>
                <p className="font-medium">{product.slug}</p>
              </div>
              <div>
                <span style={{ color: 'var(--subtle)' }}>Stock total</span>
                <p className="font-medium">{totalStock} unidades</p>
              </div>
              <div>
                <span style={{ color: 'var(--subtle)' }}>Categoría</span>
                <p className="font-medium">{(product as any).category?.name ?? '—'}</p>
              </div>
              <div>
                <span style={{ color: 'var(--subtle)' }}>Creado</span>
                <p className="font-medium">{formatDate(product.created_at)}</p>
              </div>
            </div>

            {product.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {product.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-[var(--radius-full)]"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {lowStockVariants.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] text-xs"
                style={{ background: '#fef2f2', color: '#991b1b' }}>
                <span>⚠ Stock bajo</span>
                <span className="font-medium">{lowStockVariants.length} variante{lowStockVariants.length > 1 ? 's' : ''} por debajo del umbral ({threshold})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Variantes ({variants.length})</h2>
        </div>
        {variants.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Sin variantes. Usá el seed data para crearlas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-4 py-2 font-medium">Color</th>
                <th className="text-left px-4 py-2 font-medium">Talle</th>
                <th className="text-right px-4 py-2 font-medium">Stock</th>
                <th className="text-right px-4 py-2 font-medium">Precio</th>
                <th className="text-center px-4 py-2 font-medium">Activo</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => {
                const isLowStock = v.is_active && v.stock <= threshold
                return (
                  <tr key={v.id} className={`border-t ${isLowStock ? 'bg-red-50' : ''}`} style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">{v.color ?? '—'}</td>
                    <td className="px-4 py-2">{v.size ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={isLowStock ? 'text-red-600 font-medium' : ''}>
                        {v.stock}
                        {isLowStock && <span className="ml-1">⚠</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{v.price_override ? formatCurrency(v.price_override) : '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${v.is_active ? 'status-confirmed' : 'status-cancelled'}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
