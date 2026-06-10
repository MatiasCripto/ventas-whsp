'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, X, RefreshCw } from 'lucide-react'

export interface Variant {
  id?: string
  attribute_values: Record<string, string>
  price_override: number | null
  stock: number | null
  images?: string[]
  is_active: boolean
}

export interface ProductAttributeDef {
  name: string
  values: string[]
}

interface Props {
  attributes: ProductAttributeDef[]
  variants: Variant[]
  trackStock: boolean
  stockAlertThreshold: number
  onChange: (attrs: ProductAttributeDef[], variants: Variant[]) => void
}

// ── Cartesian product helper ──────────────────────────────
function cartesianProduct(attrs: ProductAttributeDef[]): Record<string, string>[] {
  if (attrs.length === 0) return []
  const result: Record<string, string>[] = []
  function build(idx: number, acc: Record<string, string>) {
    if (idx === attrs.length) {
      result.push({ ...acc })
      return
    }
    for (const v of attrs[idx].values) {
      acc[attrs[idx].name] = v
      build(idx + 1, acc)
    }
  }
  build(0, {})
  return result
}

export default function VariantsEditor({
  attributes, variants, trackStock, stockAlertThreshold, onChange,
}: Props) {
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrValue, setNewAttrValue] = useState('')
  const [focusedAttr, setFocusedAttr] = useState<number | null>(null)

  const combos = useMemo(() => cartesianProduct(attributes), [attributes])

  // ── Attribute management ────────────────────────────────

  function addAttribute() {
    const name = newAttrName.trim()
    if (!name || attributes.some(a => a.name.toLowerCase() === name.toLowerCase())) return
    onChange([...attributes, { name, values: [] }], variants)
    setNewAttrName('')
    setFocusedAttr(attributes.length)
  }

  function removeAttribute(idx: number) {
    const updated = attributes.filter((_, i) => i !== idx)
    // Also remove variants that used this attribute
    onChange(updated, [])
  }

  function addAttributeValue(attrIdx: number) {
    const val = newAttrValue.trim()
    if (!val) return
    const attr = attributes[attrIdx]
    if (attr.values.some(v => v.toLowerCase() === val.toLowerCase())) return
    const updated = attributes.map((a, i) =>
      i === attrIdx ? { ...a, values: [...a.values, val] } : a
    )
    onChange(updated, [])
    setNewAttrValue('')
  }

  function removeAttributeValue(attrIdx: number, valIdx: number) {
    const attr = attributes[attrIdx]
    const updated = attributes.map((a, i) =>
      i === attrIdx ? { ...a, values: a.values.filter((_, vi) => vi !== valIdx) } : a
    )
    onChange(updated, [])
  }

  // ── Variant generation ──────────────────────────────────

  function generateVariants() {
    const shouldWarn = variants.length > 0
    if (shouldWarn && !confirm('Generar nuevas variantes reemplazará las actuales. ¿Continuar?')) return

    const generated = combos.map(combo => ({
      attribute_values: combo,
      price_override: null as number | null,
      stock: trackStock ? 0 : null,
      is_active: true,
    }))
    onChange(attributes, generated)
  }

  // ── Variant configuration ───────────────────────────────

  function updateVariant(idx: number, patch: Partial<Variant>) {
    const updated = variants.map((v, i) => i === idx ? { ...v, ...patch } : v)
    onChange(attributes, updated)
  }

  function toggleActive(idx: number) {
    updateVariant(idx, { is_active: !variants[idx].is_active })
  }

  // ── Attribute key handlers ──────────────────────────────

  function handleAttrValueKeyDown(e: React.KeyboardEvent, attrIdx: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAttributeValue(attrIdx)
    }
    if (e.key === 'Backspace' && !newAttrValue && focusedAttr === attrIdx) {
      const attr = attributes[attrIdx]
      if (attr.values.length > 0) {
        removeAttributeValue(attrIdx, attr.values.length - 1)
      }
    }
  }

  const totalStock = variants.reduce((s, v) => s + (v.is_active && v.stock != null ? v.stock : 0), 0)

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm">
          Variantes ({variants.length})
        </h2>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {trackStock ? `Stock total: ${totalStock} unidades` : 'Sin control de stock'}
        </span>
      </div>

      {/* ── STEP 1: Define Attributes ──────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>
          Paso 1: Definir atributos
        </h3>

        {attributes.map((attr, ai) => (
          <div key={ai} className="mb-3 p-3 rounded-[var(--radius-md)]" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">{attr.name}</span>
              <button type="button" onClick={() => removeAttribute(ai)}
                className="p-0.5 rounded hover:bg-[var(--surface-3)] transition-colors"
                style={{ color: '#ef4444' }}>
                <X size={12} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {attr.values.map((val, vi) => (
                <span key={vi}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] text-xs font-medium"
                  style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}>
                  {val}
                  <button type="button" onClick={() => removeAttributeValue(ai, vi)}
                    className="hover:opacity-70">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <input type="text"
              placeholder="Agregar valor y presionar Enter"
              value={focusedAttr === ai ? newAttrValue : ''}
              onFocus={() => { setFocusedAttr(ai); setNewAttrValue('') }}
              onChange={e => { setFocusedAttr(ai); setNewAttrValue(e.target.value) }}
              onKeyDown={e => handleAttrValueKeyDown(e, ai)}
              className="w-full px-2 py-1 rounded-[var(--radius-md)] border text-xs bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input type="text" value={newAttrName}
            onChange={e => setNewAttrName(e.target.value)}
            placeholder="Nombre del atributo (ej: Color, Talle)"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttribute() } }}
            className="flex-1 px-3 py-1.5 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button type="button" onClick={addAttribute} disabled={!newAttrName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            <Plus size={14} />
            Agregar atributo
          </button>
        </div>

        {attributes.length > 0 && attributes.some(a => a.values.length > 0) && (
          <div className="mt-3">
            <p className="text-xs mb-2" style={{ color: 'var(--subtle)' }}>
              Se generarán {combos.length} variante{combos.length !== 1 ? 's' : ''}
            </p>
            {combos.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {combos.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-[var(--radius-full)]"
                    style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>
                    {Object.values(c).join(' / ')}
                  </span>
                ))}
              </div>
            )}
            <button type="button" onClick={generateVariants}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
            >
              <RefreshCw size={14} />
              Generar variantes
            </button>
          </div>
        )}
      </div>

      {/* ── STEP 3: Variant Table ──────────────────────────── */}
      {variants.length === 0 ? (
        <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {attributes.some(a => a.values.length > 0)
            ? 'Hacé clic en "Generar variantes" arriba.'
            : 'Definí atributos y sus valores para generar variantes.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-4 py-2 font-medium">Combinación</th>
                <th className="text-right px-4 py-2 font-medium">
                  {trackStock ? 'Stock' : 'Control'}
                </th>
                <th className="text-right px-4 py-2 font-medium">Precio</th>
                <th className="text-center px-4 py-2 font-medium">Activo</th>
                <th className="text-center px-4 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const comboLabel = Object.values(v.attribute_values).join(' / ') || '—'
                const isLowStock = trackStock && v.is_active && v.stock != null && v.stock <= stockAlertThreshold
                return (
                  <tr key={v.id ?? i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2 font-medium text-xs">{comboLabel}</td>
                    <td className="px-4 py-2 text-right">
                      {trackStock ? (
                        <input type="number" min={0}
                          value={v.stock ?? 0}
                          onChange={e => updateVariant(i, { stock: parseInt(e.target.value) || 0 })}
                          className={`w-20 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm ${
                            isLowStock ? 'border-red-400' : ''
                          }`}
                          style={{ borderColor: isLowStock ? '#f87171' : 'var(--border)' }}
                        />
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--subtle)' }}>—</span>
                      )}
                      {isLowStock && (
                        <span className="ml-1 text-xs text-red-500">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={0} step="0.01"
                        value={v.price_override ?? ''}
                        placeholder="—"
                        onChange={e => {
                          const val = e.target.value
                          updateVariant(i, { price_override: val ? parseFloat(val) : null })
                        }}
                        className="w-24 text-right px-2 py-1 rounded-[var(--radius-md)] border bg-transparent outline-none text-sm"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => toggleActive(i)}
                        className={`inline-block w-5 h-5 rounded border transition-colors ${
                          v.is_active ? 'bg-green-500 border-green-500' : 'bg-transparent'
                        }`}
                        style={{ borderColor: v.is_active ? 'var(--green-500)' : 'var(--border)' }}
                      >
                        {v.is_active && <span className="text-white text-xs flex items-center justify-center">✓</span>}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => {
                        const updated = variants.filter((_, vi) => vi !== i)
                        onChange(attributes, updated)
                      }}
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
        </div>
      )}
    </div>
  )
}
