'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, Copy } from 'lucide-react'

type Rubro = string
type AiProvider = 'openai' | 'anthropic' | 'deepseek' | 'groq'

const AI_MODEL_SUGGESTIONS: Record<AiProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
}

interface Credentials {
  org_id: string
  store_id: string
  owner_email: string
  temp_password: string
  evolution_instance: string
}

export default function NewOrganization() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  // Step 1 — Business
  const [orgName, setOrgName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [rubro, setRubro] = useState<Rubro>('ropa')
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    ;(async () => {
      try {
        const sb = createClient()
        const { data } = await sb.from('categories').select('name').limit(100)
        const names = [...new Set((data ?? []).map((c: any) => c.name).filter(Boolean))]
        setCategoryOptions(names.map(n => ({ id: n.toLowerCase(), name: n })))
        if (names.length > 0) setRubro(names[0].toLowerCase())
      } catch {
        setCategoryOptions([])
      }
    })()
  }, [])


  // Step 2 — Owner
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')

  // Step 3 — AI Config
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState(AI_MODEL_SUGGESTIONS.openai)

  const handleProviderChange = (provider: string) => {
    const p = provider as AiProvider
    setAiProvider(p)
    setAiModel(AI_MODEL_SUGGESTIONS[p])
  }

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleCreate = async () => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: orgName,
          store_name: storeName,
          rubro,
          owner_email: ownerEmail,
          owner_name: ownerName,
          ai_provider: aiProvider,
          ai_api_key: aiApiKey,
          ai_model: aiModel,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error creating organization')
      }

      const data = await res.json()
      setCredentials(data)
      setStep(4)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = () => {
    if (credentials) {
      navigator.clipboard.writeText(credentials.temp_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (credentials && step === 4) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--success-bg)' }}>
              <Check size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Tienda creada exitosamente</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Las credenciales se muestran una sola vez</p>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-[var(--radius-md)]" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
              ⚠️ Esta contraseña no se volverá a mostrar. Cópiela ahora.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Email del dueño</label>
              <p className="text-sm font-medium">{credentials.owner_email}</p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Contraseña temporal</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-mono" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {credentials.temp_password}
                </code>
                <button
                  onClick={copyPassword}
                  className="p-2 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--muted)' }}
                  title="Copiar contraseña"
                >
                  {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Instancia Evolution</label>
              <p className="text-sm font-mono">{credentials.evolution_instance}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push(`/superadmin/organizations/${credentials.org_id}`)}
              className="flex-1 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              Ver organización
            </button>
            <button
              onClick={() => router.push('/superadmin/organizations')}
              className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <button onClick={() => step === 1 ? router.push('/superadmin/organizations') : setStep(step - 1)}
        className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={16} />
        {step === 1 ? 'Volver a organizaciones' : 'Paso anterior'}
      </button>

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 h-1.5 rounded-full transition-colors"
            style={{ background: s <= step ? 'var(--brand)' : 'var(--surface-3)' }}
          />
        ))}
      </div>

      <div className="card p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-[var(--radius-md)] text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Step 1: Business info */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold">Datos del negocio</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre de la organización</label>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="Mi Tienda" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre de la tienda</label>
                <input value={storeName} onChange={(e) => setStoreName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="Tienda Principal" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Rubro</label>
                <select value={rubro} onChange={(e) => setRubro(e.target.value as Rubro)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>
                  {categoryOptions.length > 0 ? categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  )) : (
                    <>
                      <option value="ropa">Ropa</option>
                      <option value="otro">Otro</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => { if (orgName && storeName) setStep(2) }}
                className="px-6 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
                disabled={!orgName || !storeName}>
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Step 2: Owner info */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold">Datos del dueño</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Email</label>
                <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="dueño@ejemplo.com" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre completo</label>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="Juan Pérez" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => { if (validateEmail(ownerEmail) && ownerName) setStep(3) }}
                className="px-6 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
                disabled={!validateEmail(ownerEmail) || !ownerName}>
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Step 3: AI Config */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold">Configuración de IA</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Proveedor</label>
                <select value={aiProvider} onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>API Key</label>
                <input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="sk-..." />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Modelo</label>
                <input value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  placeholder="gpt-4o" />
                <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Sugerido: {AI_MODEL_SUGGESTIONS[aiProvider]}</p>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-[var(--radius-md)] space-y-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Resumen</p>
                <div className="text-sm space-y-1">
                  <p><span style={{ color: 'var(--muted)' }}>Organización:</span> {orgName}</p>
                  <p><span style={{ color: 'var(--muted)' }}>Tienda:</span> {storeName}</p>
                  <p><span style={{ color: 'var(--muted)' }}>Rubro:</span> {rubro}</p>
                  <p><span style={{ color: 'var(--muted)' }}>Dueño:</span> {ownerName} ({ownerEmail})</p>
                  <p><span style={{ color: 'var(--muted)' }}>IA:</span> {aiProvider} — {aiModel}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleCreate} disabled={loading || !aiApiKey}
                className="px-6 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--brand)' }}>
                {loading ? 'Creando...' : 'Crear tienda'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
