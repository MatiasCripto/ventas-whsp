'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/overview')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>Concierge AI</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Iniciar sesión</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-[var(--radius-md)] text-white font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--brand)' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') localStorage.setItem('ca-dev-mode', 'true')
              window.location.href = '/overview'
            }}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--subtle)' }}
          >
            Modo Desarrollo (sin Supabase)
          </button>
        </div>
      </div>
    </div>
  )
}
