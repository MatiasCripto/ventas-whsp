'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface OrgDetail {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
  settings: Record<string, any>
  stores: any[]
  profiles: any[]
  recent_orders: any[]
  ai_config: { provider: string; api_key_preview: string; model: string } | null
}

export default function OrganizationDetail() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('general')

  useEffect(() => {
    fetch(`/api/superadmin/organizations/${params.id}`)
      .then((res) => res.json())
      .then((data) => setOrg(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return null
  if (!org) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Organización no encontrada</div>

  const tabs = ['general', 'usuarios', 'pedidos', 'ia']

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => router.push('/superadmin/organizations')}
        className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={16} />
        Volver a organizaciones
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-white font-bold" style={{ background: 'var(--brand)' }}>
          {org.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{org.name}</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {org.active ? 'Activa' : 'Inactiva'} · Creada {new Date(org.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-md)]" style={{ background: 'var(--surface-2)' }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors capitalize"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--foreground)' : 'var(--muted)',
              boxShadow: tab === t ? 'var(--shadow-xs)' : 'none',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'general' && (
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Información general</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>ID</span>
                <p className="font-mono text-xs mt-0.5">{org.id}</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Slug</span>
                <p>{org.slug}</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Tiendas</span>
                <p>{org.stores.length}</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Usuarios</span>
                <p>{org.profiles.length}</p>
              </div>
            </div>
          </div>

          {org.stores.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Tiendas</h3>
              <div className="space-y-2">
                {org.stores.map((store: any) => (
                  <div key={store.id} className="p-3 rounded-[var(--radius-md)] text-sm" style={{ background: 'var(--surface-2)' }}>
                    <p className="font-medium">{store.name}</p>
                    {store.evolution_instance && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                        Evolution: {store.evolution_instance}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                      Variantes: {store.variant_attr1 ?? 'Talle'} / {store.variant_attr2 ?? 'Color'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-3">Usuarios</h3>
          {org.profiles.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin usuarios</p>
          ) : (
            <div className="space-y-2">
              {org.profiles.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] text-sm" style={{ background: 'var(--surface-2)' }}>
                  <div>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.id}</p>
                  </div>
                  <span className="badge status-confirmed">{p.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'pedidos' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-3">Últimos pedidos</h3>
          {org.recent_orders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin pedidos</p>
          ) : (
            <div className="space-y-2">
              {org.recent_orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] text-sm" style={{ background: 'var(--surface-2)' }}>
                  <div>
                    <p className="font-medium">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>${Number(o.total).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge" style={{
                      background: o.status === 'completed' ? 'var(--success-bg)' : 'var(--warning-bg)',
                      color: o.status === 'completed' ? '#065f46' : '#92400e',
                    }}>{o.status}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ia' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-3">Configuración de IA</h3>
          {org.ai_config ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Proveedor</span>
                <p className="font-medium">{org.ai_config.provider}</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>API Key</span>
                <p className="font-mono">{org.ai_config.api_key_preview}</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Modelo</span>
                <p className="font-medium">{org.ai_config.model}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin configuración de IA</p>
          )}
        </div>
      )}
    </div>
  )
}
