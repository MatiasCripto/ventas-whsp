'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface Variant {
  id?: string
  color: string | null
  size: string | null
  stock: number
  price_override: number | null
  is_active: boolean
}

interface Props {
  productId?: string        // If set, directly persists to DB (edit mode)
  variants: Variant[]
  onChange: (v: Variant[]) => void
  attr1Label?: string
  attr2Label?: string
  lowStockThreshold?: number
}

export default function VariantsEditor({
  productId, variants, onChange,
  attr1Label = 'Color', attr2Label = 'Talle',
  lowStockThreshold = 5,
}: Props) {
  const [newVariant, setNewVariant] = useState({ color: '', size: '', stock: 0, price: '' })
  const [saving, setSaving] = useState(false)

  const totalStock = variants.reduce((s, v) => s + (v.is_active ? v.stock : 0), 0)

  function isLowStock(v: Variant) {
    return v.is_active && v.stock <= lowStockThreshold
  }

  async function handleAdd() {
    if (!newVariant.color && !newVariant.size) {
      alert(`Completá al menos ${attr1Label.toLowerCase()} o ${attr2Label.toLowerCase()}`)
      return
    }
    setSaving(true)
    const variant = {
      color: newVariant.color || null,
      size: newVariant.size || null,
      stock: newVariant.stock,
      price_override: newVariant.price ? parseFloat(newVariant.price) : null,
      is_active: true,
    }

    if (productId) {
      // Edit mode: persist directly to DB
      try {
        const sb = createClient()
        const { error } = await sb.from('product_variants').insert({
          product_id: productId,
          ...variant,
        })
        if (error) { alert('Error al agregar variante: ' + error.message); return }
        // Reload from DB
        const { data } = await sb.from('product_variants')
          .select('*')
          .eq('product_id', productId)
          .order('color', { ascending: true })
        onChange((data ?? []) as Variant[])
      } catch (err: any) {
        alert('Error: ' + (err?.message ?? 'desconocido'))
      }
    } else {
      // New mode: add to local state
      onChange([...variants, variant])
    }
    setNewVariant({ color: '', size: '', stock: 0, price: '' })
    setSaving(false)
  }

  async function handleDelete(index: number) {
    const v = variants[index]
    if (!confirm('¿Eliminar esta variante?')) return

    if (v.id && productId) {
      // Edit mode: delete from DB
      const sb = createClient()
      const { error } = await sb.from('product_variants').delete().eq('id', v.id)
      if (error) { alert('Error al eliminar: ' + error.message); return }
    }
    // Remove from local state
    onChange(variants.filter((_, i) => i !== index))
  }

  async function handleUpdateStock(index: number, stock: number) {
    const v = variants[index]
    const updated = variants.map((x, i) => i === index ? { ...x, stock } : x)
    onChange(updated)
    if (v.id && productId) {
      const sb = createClient()
      await sb.from('product_variants').update({ stock }).eq('id', v.id)
    }
  }

  async function handleUpdatePrice(index: number, price_override: number | null) {
    const v = variants[index]
    const updated = variants.map((x, i) => i === index ? { ...x, price_override } : x)
    onChange(updated)
    if (v.id && productId) {
      const sb = createClient()
      await sb.from('product_variants').update({ price_override }).eq('id', v.id)
    }
  }

  return (
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-4 py-2 font-medium">{attr1Label}</th>
                <th className="text-left px-4 py-2 font-medium">{attr2Label}</th>
                <th className="text-right px-4 py-2 font-medium">Stock</th>
                <th className="text-right px-4 py-2 font-medium">Precio</th>
                <th className="text-center px-4 py-2 font-medium">Activo</th>
                <th className="text-center px-4 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2">{v.color ?? '—'}</td>
                  <td className="px-4 py-2">{v.size ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" min={0} defaultValue={v.stock}
                      onBlur={e => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val !== v.stock) handleUpdateStock(i, val)
                      }}
                      className={`w-20 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm ${
                        isLowStock(v) ? 'border-red-400' : ''
                      }`}
                      style={{ borderColor: isLowStock(v) ? '#f87171' : 'var(--border)' }}
                    />
                    {isLowStock(v) && (
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
                        if (num !== v.price_override) handleUpdatePrice(i, num)
                      }}
                      className="w-24 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${v.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button type="button" onClick={() => handleDelete(i)}
                      className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
                      style={{ color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add variant form */}
      <div className="px-4 py-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <input type="text" placeholder={attr1Label} value={newVariant.color}
          onChange={e => setNewVariant(v => ({ ...v, color: e.target.value }))}
          className="flex-1 min-w-[100px] px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        <input type="text" placeholder={attr2Label} value={newVariant.size}
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
        <button type="button" onClick={handleAdd} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>
    </div>
  )
}
