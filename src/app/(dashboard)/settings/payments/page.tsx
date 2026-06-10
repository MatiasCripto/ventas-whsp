'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Banknote, Save, Eye, Trash2, Check, AlertCircle, Building2, User, Key, CreditCard } from 'lucide-react'
import type { PaymentAccount } from '@/lib/types'

export default function PaymentsSettingsPage() {
  const { authUser } = useAuthContext()
  const [account, setAccount] = useState<PaymentAccount | null>(null)
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [alias, setAlias] = useState('')
  const [cvu, setCvu] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'success' | 'error'>('idle')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const orgId = authUser?.organization?.id
        const apiUrl = `/api/settings/payment-accounts${orgId ? `?orgId=${orgId}` : ''}`
        const res = await fetch(apiUrl)
        if (res.ok) {
          const data = await res.json() as PaymentAccount | null
          if (data) {
            setAccount(data)
            setBankName(data.bank_name ?? '')
            setAccountHolder(data.account_holder ?? '')
            setAlias(data.alias ?? '')
            setCvu(data.cvu ?? '')
          }
        }
      } catch { /* dev mode */ }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!bankName.trim() || !accountHolder.trim()) return
    setSaving(true)
    setSaved('idle')
    try {
      const orgId = authUser?.organization?.id
      const res = await fetch(`/api/settings/payment-accounts${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: bankName.trim(),
          account_holder: accountHolder.trim(),
          alias: alias.trim() || null,
          cvu: cvu.trim() || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAccount(data)
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

  async function handleClear() {
    setSaving(true)
    try {
      const orgId = authUser?.organization?.id
      await fetch(`/api/settings/payment-accounts${orgId ? `?orgId=${orgId}` : ''}`, { method: 'DELETE' })
      setAccount(null)
      setBankName('')
      setAccountHolder('')
      setAlias('')
      setCvu('')
      setSaved('success')
      setTimeout(() => setSaved('idle'), 3000)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const previewMessage =
    `Perfecto 😊\n\nTe paso los datos para realizar la transferencia:\n\n` +
    `🏦 Banco: ${bankName || '…'}\n` +
    `👤 Titular: ${accountHolder || '…'}\n` +
    `${alias ? `🔑 Alias: ${alias}\n` : ''}` +
    `${cvu ? `💳 CVU: ${cvu}\n` : ''}` +
    `\nCuando realices el pago enviame el comprobante por acá 📸`

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <a href="/settings" className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            General
          </a>
          <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
            style={{ background: 'var(--brand)' }}>
            Pagos
          </span>
          <a href="/settings/agent"
            className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            Agente
          </a>
        </div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Sub-nav */}
      <div className="flex items-center gap-2 mb-2">
        <a href="/settings"
          className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          General
        </a>
        <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
          style={{ background: 'var(--brand)' }}>
          Pagos
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}>
          <Banknote size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Cuenta bancaria</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Configurá los datos que el agente enviará a tus clientes cuando elijan pagar por transferencia.
          </p>
        </div>
      </div>

      {account && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-xs font-medium"
          style={{ background: '#f0fdf4', color: '#065f46' }}>
          <Check size={14} />
          Cuenta activa — {account.bank_name}
        </div>
      )}

      {/* Form */}
      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              <Building2 size={12} /> Banco
            </label>
            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
              placeholder="Mercado Pago, Galicia, Nación..."
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none transition-colors focus:border-[var(--brand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              <User size={12} /> Titular
            </label>
            <input type="text" value={accountHolder} onChange={e => setAccountHolder(e.target.value)}
              placeholder="Nombre del titular"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none transition-colors focus:border-[var(--brand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              <Key size={12} /> Alias
            </label>
            <input type="text" value={alias} onChange={e => setAlias(e.target.value)}
              placeholder="tienda.ropa.mp"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none transition-colors focus:border-[var(--brand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              <CreditCard size={12} /> CVU
            </label>
            <input type="text" value={cvu} onChange={e => setCvu(e.target.value)}
              placeholder="0000003100012345678901"
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none transition-colors focus:border-[var(--brand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving || !bankName.trim() || !accountHolder.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--brand)' }}>
            <Save size={15} />
            {saving ? 'Guardando...' : saved === 'success' ? 'Guardado' : 'Guardar'}
          </button>

          {account && (
            <button onClick={handleClear} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
              <Trash2 size={15} />
              Desactivar cuenta
            </button>
          )}

          <button onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors ml-auto"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            <Eye size={15} />
            {showPreview ? 'Ocultar preview' : 'Vista previa'}
          </button>
        </div>

        {saved === 'error' && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#dc2626' }}>
            <AlertCircle size={12} /> Error al guardar. Intentá de nuevo.
          </div>
        )}
      </div>

      {/* Preview card */}
      {showPreview && (
        <div className="card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Eye size={14} style={{ color: 'var(--brand)' }} />
            <h2 className="font-semibold text-sm">Vista previa — cómo lo verá el cliente</h2>
          </div>
          <div className="rounded-[var(--radius-lg)] p-4 text-sm whitespace-pre-wrap leading-relaxed"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--foreground)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
            {previewMessage}
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Así llegará el mensaje al cliente cuando elija pagar por transferencia bancaria.
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-[var(--radius-md)] p-4 text-xs space-y-2"
        style={{ background: 'var(--surface-2)' }}>
        <p className="font-medium">¿Cómo funciona?</p>
        <p style={{ color: 'var(--muted)' }}>
          Cuando un cliente elige <strong>transferencia bancaria</strong> como método de pago, el agente envía automáticamente los datos configurados acá. El cliente envía el comprobante por WhatsApp y el pedido pasa a <strong>Pago en revisión</strong>. Desde el panel de pedidos podés aprobar o rechazar el comprobante.
        </p>
      </div>
    </div>
  )
}
