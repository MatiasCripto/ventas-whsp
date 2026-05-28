'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, X } from 'lucide-react'
import type { Category } from '@/lib/types'

export default function NewProductPage() {
  const { authUser } = useAuthContext()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    name: '', description: '', price: '', category_id: '', tags: '',
    is_active: true, featured: false,
  })

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    ;(async () => {
      try {
        const sb = createClient()
        const { data } = await sb.from('categories').select('id, name').eq('organization_id', orgId)
        setCategories((data ?? []) as Category[])
      } catch {
        setCategories([])
      }
    })()
  }, [authUser])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !authUser?.organization?.id) return
    setUploadingImg(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${authUser.organization.id}/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) { alert('Error al subir: ' + uploadError.message); return }
      const { data: urlData } = sb.storage.from('product-images').getPublicUrl(path)
      setImageUrls(prev => [...prev, urlData.publicUrl])
    } catch { alert('Error al subir imagen') }
    setUploadingImg(false)
    e.target.value = ''
  }

  function removeImage(idx: number) {
    setImageUrls(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const orgId = authUser?.organization?.id
    if (!orgId) return
    setSaving(true)

    try {
      const sb = createClient()
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const { data, error } = await sb.from('products').insert({
        organization_id: orgId,
        name: form.name,
        slug,
        description: form.description || null,
        price: Number(form.price),
        category_id: form.category_id || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        images: imageUrls,
        is_active: form.is_active,
        featured: form.featured,
      }).select('id').single()

      setSaving(false)
      if (error) return alert('Error al crear: ' + error.message)
      if (data) router.push(`/products/${data.id}`)
    } catch {
      setSaving(false)
      alert('Error al crear producto (dev mode: Supabase no disponible)')
    }
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
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Imágenes</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden border"
                style={{ borderColor: 'var(--border)' }}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white">
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center w-20 h-20 rounded-[var(--radius-md)] border-2 border-dashed cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              {uploadingImg ? (
                <span className="text-xs">Subiendo...</span>
              ) : (
                <Upload size={20} />
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload} className="hidden" disabled={uploadingImg} />
            </label>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
            Formatos: PNG, JPG, WebP. Hacé clic para subir desde tu computadora.
          </p>
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
