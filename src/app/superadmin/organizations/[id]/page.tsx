'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

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

  // User management state
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [userForm, setUserForm] = useState({ email: '', full_name: '', role: 'agent' })
  const [userPassword, setUserPassword] = useState('')
  const [savingUser, setSavingUser] = useState(false)
  const [userError, setUserError] = useState('')

  const openAddUser = () => {
    setEditingUser(null)
    setUserForm({ email: '', full_name: '', role: 'agent' })
    setUserPassword('')
    setUserError('')
    setShowUserModal(true)
  }

  const openEditUser = (p: any) => {
    setEditingUser(p)
    setUserForm({ email: p.id, full_name: p.full_name, role: p.role })
    setUserPassword('')
    setUserError('')
    setShowUserModal(true)
  }

  const saveUser = async () => {
    setSavingUser(true)
    setUserError('')
    try {
      if (editingUser) {
        const res = await fetch(`/api/superadmin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: userForm.full_name, role: userForm.role }),
        })
        if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
        setOrg((prev: any) => prev ? {
          ...prev,
          profiles: prev.profiles.map((p: any) => p.id === editingUser.id ? { ...p, full_name: userForm.full_name, role: userForm.role } : p),
        } : prev)
      } else {
        const res = await fetch('/api/superadmin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: params.id, email: userForm.email, full_name: userForm.full_name, role: userForm.role }),
        })
        if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
        const data = await res.json()
        setUserPassword(data.temp_password)
        setOrg((prev: any) => prev ? {
          ...prev,
          profiles: [...prev.profiles, { id: data.id, full_name: userForm.full_name, role: userForm.role }],
        } : prev)
      }
      if (!userPassword) setShowUserModal(false)
    } catch (err: any) {
      setUserError(err.message)
    } finally {
      setSavingUser(false)
    }
  }

  const deleteUser = async (p: any) => {
    if (!confirm(`¿Eliminar usuario "${p.full_name}"?`)) return
    try {
      const res = await fetch(`/api/superadmin/users/${p.id}`, { method: 'DELETE' })
      if (!res.ok) return
      setOrg((prev: any) => prev ? { ...prev, profiles: prev.profiles.filter((x: any) => x.id !== p.id) } : prev)
    } catch {}
  }

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Usuarios</h3>
            <button onClick={openAddUser}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}>
              <Plus size={14} />
              Agregar
            </button>
          </div>
          {org.profiles.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin usuarios</p>
          ) : (
            <div className="space-y-2">
              {org.profiles.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] text-sm" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.full_name}</p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--subtle)' }}>{p.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="badge status-confirmed">{p.role}</span>
                    <button onClick={() => openEditUser(p)}
                      className="p-1.5 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-3)]"
                      style={{ color: 'var(--muted)' }} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteUser(p)}
                      className="p-1.5 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--danger-bg)]"
                      style={{ color: 'var(--danger)' }} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
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

      {/* User modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => !savingUser && setShowUserModal(false)}>
          <div className="w-full max-w-md rounded-[var(--radius-lg)] p-6 space-y-4" style={{ background: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{editingUser ? 'Editar usuario' : 'Agregar usuario'}</h3>
              <button onClick={() => setShowUserModal(false)} style={{ color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>

            {userError && (
              <div className="p-3 rounded-[var(--radius-md)] text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                {userError}
              </div>
            )}

            {userPassword ? (
              <div className="space-y-4">
                <div className="p-4 rounded-[var(--radius-md)]" style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Usuario creado exitosamente</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Contraseña temporal (no se volverá a mostrar):</p>
                  <p className="text-sm font-mono mt-1 font-bold" style={{ color: 'var(--foreground)' }}>{userPassword}</p>
                </div>
                <button onClick={() => setShowUserModal(false)}
                  className="w-full px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--brand)' }}>
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                {!editingUser && (
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Email</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                      placeholder="usuario@ejemplo.com" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Nombre completo</label>
                  <input value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                    placeholder="Nombre" />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Rol</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-[var(--radius-md)] text-sm border"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>
                    <option value="owner">Dueño</option>
                    <option value="admin">Admin</option>
                    <option value="agent">Agente</option>
                    <option value="viewer">Espectador</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowUserModal(false)}
                    className="flex-1 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
                    style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>
                    Cancelar
                  </button>
                  <button onClick={saveUser} disabled={savingUser || !userForm.full_name || (!editingUser && !userForm.email)}
                    className="flex-1 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--brand)' }}>
                    {savingUser ? 'Guardando...' : editingUser ? 'Guardar' : 'Crear usuario'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
