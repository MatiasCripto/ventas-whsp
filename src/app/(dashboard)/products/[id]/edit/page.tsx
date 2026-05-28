'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, X, Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/types'

interface Variant {
  id: string; color: string | null; size: string | null
  stock: number; price_override: number | null; is_active: boolean
}

export default function EditProductPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [uploading, setUploading] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [savingVariant, setSavingVariant] = useState(false)
  const [newVariant, setNewVariant] = useState({ color: '', size: '', stock: 0, price: '' })
  const [form, setForm] = useState({
    name: '', description: '', price: '', compare_price: '', category_id: '', tags: '',
    images: [] as string[], is_active: true, featured: false, low_stock_threshold: 5,
  })

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId || !params.id) return
    async function load() {
      try {
        const sb = createClient()
        const [productRes, catRes, variantsRes] = await Promise.all([
          sb.from('products').select('*').eq('id', params.id as string).eq('organization_id', orgId).single(),
          sb.from('categories').select('id, name').eq('organization_id', orgId),
          sb.from('product_variants').select('*').eq('product_id', params.id as string).order('color', { ascending: true }),
        ])
        const p = productRes.data as Record<string, any> | null
        if (p) {
          setForm({
            name: p.name ?? '',
            description: p.description ?? '',
            price: String(p.price ?? ''),
            compare_price: p.compare_price ? String(p.compare_price) : '',
            category_id: p.category_id ?? '',
            tags: (p.tags ?? []).join(', '),
            images: p.images ?? [],
            is_active: p.is_active ?? true,
            featured: p.featured ?? false,
            low_stock_threshold: p.low_stock_threshold ?? 5,
          })
        }
        setCategories((catRes.data ?? []) as Category[])
        setVariants((variantsRes.data ?? []) as Variant[])
      } catch {
        // dev mode
      }
      setLoading(false)
    }
    load()
  }, [authUser, params.id])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !authUser?.organization?.id) return
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${authUser.organization.id}/${params.id}/${Date.now()}.${ext}`
      const { error } = await sb.storage.from('product-images').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) { alert('Error al subir: ' + error.message); return }
      const { data: urlData } = sb.storage.from('product-images').getPublicUrl(path)
      setForm(f => ({ ...f, images: [...f.images, urlData.publicUrl] }))
    } catch (err: any) {
      alert('Error al subir imagen: ' + (err?.message ?? 'desconocido'))
    }
    setUploading(false)
  }

  function removeImage(url: string) {
    setForm(f => ({ ...f, images: f.images.filter(i => i !== url) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const orgId = authUser?.organization?.id
    if (!orgId) return
    setSaving(true)
    try {
      const sb = createClient()
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const { error } = await sb.from('products').update({
        name: form.name,
        slug,
        description: form.description || null,
        price: Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        category_id: form.category_id || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        images: form.images,
        is_active: form.is_active,
        featured: form.featured,
        low_stock_threshold: form.low_stock_threshold,
      }).eq('id', params.id as string)
      setSaving(false)
      if (error) return alert('Error al guardar: ' + error.message)
      router.push(`/products/${params.id}`)
    } catch {
      setSaving(false)
      alert('Error al guardar producto')
    }
  }

  async function handleAddVariant() {
    if (!newVariant.color && !newVariant.size) return alert('Completá al menos color o talle')
    setSavingVariant(true)
    try {
      const sb = createClient()
      const { error } = await sb.from('product_variants').insert({
        product_id: params.id as string,
        color: newVariant.color || null,
        size: newVariant.size || null,
        stock: newVariant.stock,
        price_override: newVariant.price ? parseFloat(newVariant.price) : null,
        is_active: true,
      })
      if (error) return alert('Error al agregar variante: ' + error.message)
      setNewVariant({ color: '', size: '', stock: 0, price: '' })
      // Reload variants
      const { data } = await sb.from('product_variants').select('*').eq('product_id', params.id as string).order('color', { ascending: true })
      setVariants((data ?? []) as Variant[])
    } catch (err: any) {
      alert('Error: ' + (err?.message ?? 'desconocido'))
    }
    setSavingVariant(false)
  }

  async function handleUpdateVariantStock(id: string, stock: number) {
    const sb = createClient()
    const { error } = await sb.from('product_variants').update({ stock }).eq('id', id)
    if (error) return alert('Error al actualizar stock: ' + error.message)
    setVariants(v => v.map(v => v.id === id ? { ...v, stock } : v))
  }

  async function handleUpdateVariantPrice(id: string, price_override: number | null) {
    const sb = createClient()
    const { error } = await sb.from('product_variants').update({ price_override }).eq('id', id)
    if (error) return alert('Error al actualizar precio: ' + error.message)
    setVariants(v => v.map(v => v.id === id ? { ...v, price_override } : v))
  }

  async function handleDeleteVariant(id: string) {
    if (!confirm('¿Eliminar esta variante?')) return
    const sb = createClient()
    const { error } = await sb.from('product_variants').delete().eq('id', id)
    if (error) return alert('Error al eliminar: ' + error.message)
    setVariants(v => v.filter(v => v.id !== id))
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>

  const totalStock = variants.reduce((s, v) => s + (v.is_active ? v.stock : 0), 0)
  const threshold = form.low_stock_threshold

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <a href={`/products/${params.id}`} className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={18} />
        </a>
        <h1 className="text-xl font-semibold">Editar Producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre *</label>
          <input type="text" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Descripción</label>
          <textarea value={form.description} rows={3}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none resize-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Precio *</label>
            <input type="number" required min={0} step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Precio comparativa</label>
            <input type="number" min={0} step="0.01" value={form.compare_price}
              onChange={e => setForm(f => ({ ...f, compare_price: e.target.value }))}
              placeholder="Ej: 15000"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Categoría</label>
            <select value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Tags (separados por coma)</label>
            <input type="text" value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="moda, algodon, casual"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {/* Low stock threshold */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Alerta de stock bajo (umbral)
          </label>
          <input type="number" min={0} value={form.low_stock_threshold}
            onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none max-w-[120px]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Si el stock de una variante es menor o igual a este número, se mostrará una alerta.
          </p>
        </div>

        {/* Image upload */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Imágenes</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {form.images.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden border"
                style={{ borderColor: 'var(--border)' }}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(url)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-[var(--radius-md)] border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)' }}>
              {uploading ? (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Subiendo...</span>
              ) : (
                <Upload size={18} style={{ color: 'var(--muted)' }} />
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleImageUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            Activo
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.featured}
              onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
            />
            Destacado
          </label>
        </div>

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <a href={`/products/${params.id}`}
            className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--muted)' }}
          >
            Cancelar
          </a>
        </div>
      </form>

      {/* Variants section */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm">Variantes ({variants.length})</h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Stock total: {totalStock} unidades
          </span>
        </div>

        {variants.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Sin variantes. Agregá la primera abajo.
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
                <th className="text-center px-4 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => {
                const isLowStock = v.is_active && v.stock <= threshold
                return (
                  <tr key={v.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">{v.color ?? '—'}</td>
                    <td className="px-4 py-2">{v.size ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={0} defaultValue={v.stock}
                        onBlur={e => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val !== v.stock) handleUpdateVariantStock(v.id, val)
                        }}
                        className={`w-20 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm ${
                          isLowStock ? 'border-red-400' : ''
                        }`}
                        style={{ borderColor: isLowStock ? '#f87171' : 'var(--border)' }}
                      />
                      {isLowStock && (
                        <span className="ml-1 text-xs text-red-500">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={0} step="0.01"
                        defaultValue={v.price_override ?? ''}
                        placeholder="—"
                        onBlur={e => {
                          const val = e.target.value
                          const num = val ? parseFloat(val) : null
                          if (num !== v.price_override) handleUpdateVariantPrice(v.id, num)
                        }}
                        className="w-24 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${v.is_active ? 'status-confirmed' : 'status-cancelled'}`} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => handleDeleteVariant(v.id)}
                        className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
                        style={{ color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Add variant form */}
        <div className="px-4 py-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
          <input type="text" placeholder="Color" value={newVariant.color}
            onChange={e => setNewVariant(v => ({ ...v, color: e.target.value }))}
            className="flex-1 min-w-[100px] px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <input type="text" placeholder="Talle" value={newVariant.size}
            onChange={e => setNewVariant(v => ({ ...v, size: e.target.value }))}
            className="flex-1 min-w-[80px] px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <input type="number" placeholder="Stock" min={0} value={newVariant.stock}
            onChange={e => setNewVariant(v => ({ ...v, stock: parseInt(e.target.value) || 0 }))}
            className="w-20 px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <input type="number" placeholder="Precio" min={0} step="0.01" value={newVariant.price}
            onChange={e => setNewVariant(v => ({ ...v, price: e.target.value }))}
            className="w-24 px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button type="button" onClick={handleAddVariant} disabled={savingVariant}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
