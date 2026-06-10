'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { Bot, Save } from 'lucide-react'

export default function AgentSettingsPage() {
  const { authUser } = useAuthContext()
  const [businessType, setBusinessType] = useState('')
  const [salesPromptExtra, setSalesPromptExtra] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/org-settings')
        if (res.ok) {
          const data = await res.json()
          setBusinessType(data.businessType ?? '')
          setSalesPromptExtra(data.salesPromptExtra ?? '')
        }
      } catch { /* dev mode */ }
      setLoading(false)
    }
    load()
  }, [authUser])

  async function handleSave() {
    setSaving(true)
    setSaved('idle')
    try {
      const res = await fetch('/api/settings/org-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType, salesPromptExtra }),
      })
      if (res.ok) {
        setSaved('success')
        setTimeout(() => setSaved('idle'), 3000)
      } else {
        setSaved('error')
      }
    } catch {
      setSaved('error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <a href="/settings" className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>General</a>
          <a href="/settings/payments" className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Pagos</a>
          <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
            style={{ background: 'var(--brand)' }}>Agente</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <a href="/settings" className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>General</a>
        <a href="/settings/payments" className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Pagos</a>
        <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
          style={{ background: 'var(--brand)' }}>Agente</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}>
          <Bot size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuración del agente</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Personalizá cómo se comporta el agente de ventas con tus clientes.
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Rubro del negocio</h2>
        <input type="text" value={businessType} onChange={e => setBusinessType(e.target.value)}
          placeholder="Ej: Indumentaria deportiva, cosmética natural, accesorios de tecnología"
          className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          Ayuda al agente a entender tu mercado. Aparece en la personalidad del vendedor.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Instrucciones personalizadas</h2>
        <textarea value={salesPromptExtra} onChange={e => setSalesPromptExtra(e.target.value)}
          placeholder="Ej: Preguntá siempre por el método de pago preferido antes de cerrar. Ofrecé descuento por cantidad a partir de 3 unidades. Recordá mencionar la garantía de 30 días."
          rows={6}
          className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none resize-y"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', minHeight: '120px' }}
        />
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          Estas instrucciones se agregan al prompt del agente. Podés darle reglas específicas de venta, descuentos, políticas, etc.
        </p>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--brand)' }}
      >
        <Save size={16} />
        {saving ? 'Guardando...' : saved === 'success' ? 'Guardado' : saved === 'error' ? 'Error al guardar' : 'Guardar Cambios'}
      </button>
    </div>
  )
}
