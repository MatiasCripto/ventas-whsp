'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Store, Bell, Palette, Cpu, Save, Upload, X } from 'lucide-react'

export default function SettingsPage() {
  const { authUser, currentStore, updateOrgName, updateCurrentStore } = useAuthContext()
  const [orgName, setOrgName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [evolutionInstance, setEvolutionInstance] = useState('')
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (authUser?.organization?.name) setOrgName(authUser.organization.name)
    if (currentStore?.name) setStoreName(currentStore.name)
    if (currentStore?.logo_url) setStoreLogo(currentStore.logo_url)
    if (currentStore?.whatsapp_number) setWhatsappNumber(currentStore.whatsapp_number)
    if (currentStore?.evolution_instance) setEvolutionInstance(currentStore.evolution_instance)
    // Load AI config
    fetch('/api/settings/ai-config').then(r => r.json()).then(data => {
      if (data.provider) setAiProvider(data.provider)
      if (data.apiKey) setAiApiKey(data.apiKey)
      if (data.model) setAiModel(data.model)
    }).catch(() => {})
  }, [authUser, currentStore])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentStore) return
    setUploadingLogo(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${currentStore.organization_id}/${currentStore.id}/logo.${ext}`
      const { error: uploadError } = await sb.storage.from('store-logos').upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (uploadError) { alert('Error al subir logo: ' + uploadError.message); return }
      const { data: urlData } = sb.storage.from('store-logos').getPublicUrl(path)
      const logoUrl = urlData.publicUrl
      setStoreLogo(logoUrl)
      // Save via API route (uses service_role — bypasses RLS)
      await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl }),
      })
      updateCurrentStore({ logo_url: logoUrl })
    } catch (err: any) {
      alert('Error al subir logo: ' + (err?.message ?? 'desconocido'))
    }
    setUploadingLogo(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      // Save org/store via API (uses service_role — bypasses RLS)
      const res = await fetch('/api/settings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName !== authUser?.organization?.name ? orgName : undefined,
          storeName: storeName !== currentStore?.name ? storeName : undefined,
          whatsappNumber: whatsappNumber !== (currentStore?.whatsapp_number ?? '') ? whatsappNumber : undefined,
          evolutionInstance: evolutionInstance !== (currentStore?.evolution_instance ?? '') ? evolutionInstance : undefined,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Settings] API error:', errData)
      }

      // Update local state
      if (orgName !== authUser?.organization?.name) updateOrgName(orgName)
      if (currentStore) {
        const updates: Record<string, string | null> = {}
        if (storeName !== currentStore.name) updates.name = storeName
        if (whatsappNumber !== (currentStore.whatsapp_number ?? '')) updates.whatsapp_number = whatsappNumber
        if (evolutionInstance !== (currentStore.evolution_instance ?? '')) updates.evolution_instance = evolutionInstance
        if (Object.keys(updates).length > 0) updateCurrentStore(updates)
      }

      // Save AI config — only if apiKey doesn't contain the masked placeholder
      const isApiKeyDirty = aiApiKey && !aiApiKey.includes('••••')
      if (isApiKeyDirty) {
        await fetch('/api/settings/ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey, model: aiModel }),
        })
      }
    } catch {
      // dev mode — Supabase not available
    }

    // Persist to localStorage so dev mode survives refresh
    localStorage.setItem('ca-dev-org-name', orgName)
    localStorage.setItem('ca-dev-store-name', storeName)
    localStorage.setItem('ca-dev-whatsapp', whatsappNumber)
    if (evolutionInstance) localStorage.setItem('ca-dev-evolution-instance', evolutionInstance)
    if (storeLogo) localStorage.setItem('ca-dev-logo', storeLogo)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium text-white"
          style={{ background: 'var(--brand)' }}>
          General
        </span>
        <a href="/settings/payments"
          className="text-xs px-3 py-1.5 rounded-[var(--radius-full)] font-medium transition-colors"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          Pagos
        </a>
      </div>
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
          <h2 className="font-semibold text-sm">Mi Tienda</h2>
        </div>

        {/* Logo upload */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Foto de perfil</label>
          <div className="mt-2 flex items-center gap-4">
            {storeLogo ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
                <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                <button type="button" onClick={async () => {
                  setStoreLogo(null)
                  if (currentStore) {
                    await fetch('/api/settings/store', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logoUrl: null }),
                    })
                    updateCurrentStore({ logo_url: null })
                  }
                }}
                  className="absolute top-0 right-0 p-0.5 rounded-full bg-black/50 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl" style={{ color: 'var(--subtle)' }}>
                {currentStore?.name?.charAt(0)?.toUpperCase() ?? 'T'}
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border text-sm cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)' }}>
              {uploadingLogo ? (
                <span style={{ color: 'var(--muted)' }}>Subiendo...</span>
              ) : (
                <>
                  <Upload size={16} style={{ color: 'var(--muted)' }} />
                  <span>{storeLogo ? 'Cambiar foto' : 'Subir foto'}</span>
                </>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
            </label>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
            Formatos: PNG, JPG, WebP. Se verá en la barra lateral.
          </p>
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

      {/* AI Agent */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-semibold text-sm">Agente de IA</h2>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Proveedor</label>
          <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="groq">Groq</option>
            <option value="google">Google Gemini</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>API Key</label>
          <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Modelo</label>
          <input type="text" value={aiModel} onChange={e => setAiModel(e.target.value)}
            placeholder="gpt-4o"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] border text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Ej: gpt-4o, claude-sonnet-4-20250514, deepseek-chat, gemini-2.0-flash
          </p>
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
