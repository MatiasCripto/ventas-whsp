'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/lib/hooks/auth-context'

export default function Home() {
  const router = useRouter()
  const { authUser, loading } = useAuthContext()

  useEffect(() => {
    if (loading) return
    if (authUser) router.replace('/overview')
    else router.replace('/login')
  }, [authUser, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-[var(--muted)]">Cargando...</div>
    </div>
  )
}
