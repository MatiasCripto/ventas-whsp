'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, X } from 'lucide-react'
import VariantsEditor from '@/components/products/variants-editor'
import type { Category } from '@/lib/types'
import type { Variant, ProductAttributeDef } from '@/components/products/variants-editor'

export default function EditProductPage() {
  const { authUser, currentStore } = useAuthContext()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [uploading, setUploading] = useState(false)
  const [attributes, setAttributes] = useState<ProductAttributeDef[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [trackStock, setTrackStock] = useState(false)
  const [stockInitial, setStockInitial] = useState(0)
  const [stockAlertThreshold, setStockAlertThreshold] = useState(5)
  const [form, setForm] = useState({
    name: '', description: '', price: '', compare_price: '', category_id: '', tags: '',
    images: [] as string[], is_active: true, featured: false,
  })

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId || !params.id) return
    async function load() {
      try {
        const sb = createClient()
        const [productRes, catRes, attrsRes, variantsRes] = await Promise.all([
          sb.from('products').select('*').eq('id', params.id as string).eq('organization_id', orgId).single(),
          sb.from('categories').select('id, name').eq('organization_id', orgId),
          sb.from('product_attributes').select('*, values:product_attribute_values(*)').eq('product_id', params.id as string).order('sort_order', { ascending: true }),
          sb.from('product_variants').select('*').eq('product_id', params.id as string).order('created_at', { ascending: true }),
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
          })
          const threshold = p.low_stock_threshold ?? 5
          setStockAlertThreshold(threshold)
        }

        setCategories((catRes.data ?? []) as Category[])

        // Load attribute definitions
        const attrsData = (attrsRes.data ?? []) as any[]
        const loadedAttrs: ProductAttributeDef[] = attrsData.map((a: any) => ({
          name: a.name,
          values: (a.values ?? []).map((v: any) => v.value).filter(Boolean),
        }))
        setAttributes(loadedAttrs)

        // Load variants
        const variantsData = (variantsRes.data ?? []) as any[]
        const loadedVariants: Variant[] = variantsData.map((v: any) => ({
          id: v.id,
          attribute_values: v.attribute_values ?? {},
          price_override: v.price_override ?? null,
          stock: v.stock ?? null,
          is_active: v.is_active ?? true,
        }))
        setVariants(loadedVariants)

        // Determine if stock tracking is enabled
        const hasStockTracking = loadedVariants.length === 0
          ? false
          : loadedVariants.some(v => v.stock !== null)
        setTrackStock(hasStockTracking)
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
        low_stock_threshold: trackStock ? stockAlertThreshold : null,
      }).eq('id', params.id as string)

      if (error) { setSaving(false); return alert('Error al guardar: ' + error.message) }

      const productId = params.id as string

      // Sync attribute definitions: delete and recreate
      // (simple approach since we're in test mode)
      const { data: existingAttrs } = await sb.from('product_attributes')
        .select('id').eq('product_id', productId)
      if (existingAttrs && existingAttrs.length > 0) {
        await sb.from('product_attributes').delete().eq('product_id', productId)
      }

      for (let ai = 0; ai < attributes.length; ai++) {
        const attr = attributes[ai]
        const { data: attrData, error: attrErr } = await sb.from('product_attributes').insert({
          product_id: productId,
          name: attr.name,
          sort_order: ai,
        }).select('id').single()
        if (attrErr) continue

        const valueRows = attr.values.map((val, vi) => ({
          attribute_id: attrData.id,
          value: val,
          sort_order: vi,
        }))
        if (valueRows.length > 0) {
          await sb.from('product_attribute_values').insert(valueRows)
        }
      }

      // Sync variants: delete and recreate
      const { data: existingVariants } = await sb.from('product_variants')
        .select('id').eq('product_id', productId)
      if (existingVariants && existingVariants.length > 0) {
        await sb.from('product_variants').delete().eq('product_id', productId)
      }

      if (variants.length > 0) {
        const variantRows = variants.map(v => ({
          product_id: productId,
          attribute_values: v.attribute_values,
          price_override: v.price_override,
          stock: trackStock ? (v.stock ?? 0) : null,
          is_active: v.is_active,
        }))
        const { error: varError } = await sb.from('product_variants').insert(variantRows)
        if (varError) {
          setSaving(false)
          return alert('Error al guardar variantes: ' + varError.message)
        }
      } else if (trackStock) {
        // No variants defined — create/replace single default variant with stock
        const { error: varError } = await sb.from('product_variants').insert({
          product_id: productId,
          attribute_values: {},
          price_override: null,
          stock: stockInitial,
          is_active: true,
        })
        if (varError) {
          setSaving(false)
          return alert('Error al guardar stock: ' + varError.message)
        }
      }

      setSaving(false)
      router.push(`/products/${params.id}`)
    } catch {
      setSaving(false)
      alert('Error al guardar producto')
    }
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>

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

        {/* Stock tracking */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={trackStock}
              onChange={e => setTrackStock(e.target.checked)} />
            Controlar stock
          </label>
          {trackStock && (
            <div className="flex gap-4">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  Stock inicial
                </label>
                <input type="number" min={0} value={stockInitial}
                  onChange={e => setStockInitial(Math.max(0, Number(e.target.value)))}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none max-w-[120px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  Alertar cuando stock sea menor a:
                </label>
                <input type="number" min={0} value={stockAlertThreshold}
                  onChange={e => setStockAlertThreshold(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none max-w-[120px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
            </div>
          )}
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

      <VariantsEditor
        attributes={attributes}
        variants={variants}
        trackStock={trackStock}
        stockAlertThreshold={stockAlertThreshold}
        onChange={(attrs, v) => { setAttributes(attrs); setVariants(v) }}
      />
    </div>
  )
}
