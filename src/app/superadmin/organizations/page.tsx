'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Eye, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
  stores_count: number
  orders_count: number
  customers_count: number
}

export default function SuperadminOrganizations() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/superadmin/organizations')
      .then((res) => res.json())
      .then((data) => setOrgs(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const deleteOrg = async (org: Org) => {
    if (!confirm(`¿Eliminar organización "${org.name}"?\nSe eliminarán todas sus tiendas, usuarios y datos asociados.`)) return
    try {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`, { method: 'DELETE' })
      if (res.ok) setOrgs((prev) => prev.filter((o) => o.id !== org.id))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleActive = async (org: Org) => {
    try {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !org.active }),
      })
      if (res.ok) {
        setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, active: !o.active } : o)))
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Organizaciones</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{orgs.length} registradas</p>
        </div>
        <button
          onClick={() => router.push('/superadmin/organizations/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          <Plus size={16} />
          Nueva organización
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Nombre</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Activa</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Stores</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Pedidos</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Clientes</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Creada</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-medium">{org.name}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(org)} className="inline-flex" title={org.active ? 'Activa' : 'Inactiva'}>
                    {org.active ? (
                      <ToggleRight size={18} style={{ color: 'var(--success)' }} />
                    ) : (
                      <ToggleLeft size={18} style={{ color: 'var(--muted)' }} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">{org.stores_count}</td>
                <td className="px-4 py-3 text-center">{org.orders_count}</td>
                <td className="px-4 py-3 text-center">{org.customers_count}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                  {new Date(org.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => router.push(`/superadmin/organizations/${org.id}`)}
                      className="p-1.5 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)' }}
                      title="Ver detalle"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => deleteOrg(org)}
                      className="p-1.5 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--danger-bg)]"
                      style={{ color: 'var(--danger)' }}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
