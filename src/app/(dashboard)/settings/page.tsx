'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { Store, Bell, Palette, Save } from 'lucide-react'

export default function SettingsPage() {
  const { authUser, currentStore, updateOrgName } = useAuthContext()
  const [orgName, setOrgName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [evolutionInstance, setEvolutionInstance] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (authUser?.organization?.name) setOrgName(authUser.organization.name)
    if (currentStore?.name) setStoreName(currentStore.name)
    if (currentStore?.whatsapp_number) setWhatsappNumber(currentStore.whatsapp_number)
    if (currentStore?.evolution_instance) setEvolutionInstance(currentStore.evolution_instance)
  }, [authUser, currentStore])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const sb = createServiceClient()

    if (orgName !== authUser?.organization?.name) {
      await updateOrgName(orgName)
    }

    if (currentStore) {
      const updates: Record<string, string> = {}
      if (storeName !== currentStore.name) updates.name = storeName
      if (whatsappNumber !== (currentStore.whatsapp_number ?? '')) updates.whatsapp_number = whatsappNumber
      if (evolutionInstance !== (currentStore.evolution_instance ?? '')) updates.evolution_instance = evolutionInstance

      if (Object.keys(updates).length > 0) {
        await sb.from('stores').update(updates).eq('id', currentStore.id)
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-xl font-semibold">Configuración</h1>

      {/* Organization */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Organización</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre</label>
          <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* Store */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Store size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Tienda</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre de la tienda</label>
          <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* WhatsApp */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">WhatsApp</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Número de WhatsApp</label>
          <input type="text" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)}
            placeholder="+5491123456789"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Instancia de Evolution API</label>
          <input type="text" value={evolutionInstance} onChange={e => setEvolutionInstance(e.target.value)}
            placeholder="mi-instancia"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--brand)' }}
      >
        <Save size={16} />
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
      </button>
    </div>
  )
}
