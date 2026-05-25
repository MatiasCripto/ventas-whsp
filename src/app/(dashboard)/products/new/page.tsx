'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ArrowLeft } from 'lucide-react'
import type { Category } from '@/lib/types'

export default function NewProductPage() {
  const { authUser } = useAuthContext()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    name: '', description: '', price: '', category_id: '', tags: '', images: '',
    is_active: true, featured: false,
  })

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    createServiceClient().from('categories')
      .select('id, name').eq('organization_id', orgId)
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [authUser])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const orgId = authUser?.organization?.id
    if (!orgId) return
    setSaving(true)

    const sb = createServiceClient()
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data, error } = await sb.from('products').insert({
      organization_id: orgId,
      name: form.name,
      slug,
      description: form.description || null,
      price: Number(form.price),
      category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      images: form.images ? form.images.split('\n').map(i => i.trim()).filter(Boolean) : [],
      is_active: form.is_active,
      featured: form.featured,
    }).select('id').single()

    setSaving(false)
    if (error) return alert('Error al crear: ' + error.message)
    if (data) router.push(`/products/${data.id}`)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <a href="/products" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={18} />
        </a>
        <h1 className="text-xl font-semibold">Nuevo Producto</h1>
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

        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Imágenes (URLs, una por línea)</label>
          <textarea value={form.images} rows={3}
            onChange={e => setForm(f => ({ ...f, images: e.target.value }))}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none resize-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
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

        <div className="pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            {saving ? 'Creando...' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </div>
  )
}
