'use client'

import { useEffect, useState } from 'react'

interface User {
  id: string
  full_name: string
  role: string
  organization_name: string
  created_at: string
}

export default function SuperadminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/superadmin/users')
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{users.length} registrados</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Nombre</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Rol</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Organización</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Creado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3">
                  <span className="badge" style={{
                    background: u.role === 'superadmin' ? 'var(--brand-subtle)' : 'var(--surface-2)',
                    color: u.role === 'superadmin' ? 'var(--brand)' : 'var(--muted)',
                  }}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{u.organization_name}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--muted)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
