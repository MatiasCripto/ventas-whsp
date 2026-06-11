'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Store, UserRole } from '@/lib/types'

export interface AuthUser {
  user: User
  profile: Profile | null
  organization: Organization | null
  stores: Store[]
  currentStoreId: string | null
  role: UserRole | null
}

interface AuthContextValue {
  authUser: AuthUser | null
  loading: boolean
  currentStore: Store | null
  setCurrentStore: (id: string) => void
  updateOrgName: (name: string) => void
  updateCurrentStore: (updates: Partial<Store>) => void
  updateAvatarUrl: (url: string) => void
  signOut: () => Promise<void>
}

function getDevOrg(): Organization {
  if (typeof window === 'undefined') return { id: 'dev-org', name: 'Mi Tienda Dev', slug: 'mi-tienda-dev', logo_url: null, plan: 'growth', settings: {}, trial_ends_at: null, trial_used: false, active: true, created_at: new Date().toISOString() }
  return {
    id: 'dev-org', name: localStorage.getItem('ca-dev-org-name') || 'Mi Tienda Dev', slug: 'mi-tienda-dev',
    logo_url: localStorage.getItem('ca-dev-logo'), plan: 'growth', settings: {},
    trial_ends_at: null, trial_used: false, active: true, created_at: new Date().toISOString(),
  }
}

function getDevStore(): Store {
  if (typeof window === 'undefined') return { id: 'dev-store', organization_id: 'dev-org', name: 'Tienda Dev', logo_url: null, address: null, phone: '+5491123456789', whatsapp_number: '+5491123456789', timezone: 'America/Argentina/Buenos_Aires', settings: {}, is_active: true, evolution_instance: null, variant_attr1: 'Talle', variant_attr2: 'Color', created_at: new Date().toISOString() }
  return {
    id: 'dev-store', organization_id: 'dev-org', name: localStorage.getItem('ca-dev-store-name') || 'Tienda Dev',
    logo_url: localStorage.getItem('ca-dev-logo'), address: null, phone: '+5491123456789',
    whatsapp_number: localStorage.getItem('ca-dev-whatsapp') || '+5491123456789',
    timezone: 'America/Argentina/Buenos_Aires', settings: {}, is_active: true,
    evolution_instance: localStorage.getItem('ca-dev-evolution-instance') || null,
    variant_attr1: 'Talle', variant_attr2: 'Color', created_at: new Date().toISOString(),
  }
}

function getDevAuthUser(): AuthUser {
  return {
    user: { id: 'dev-user', email: 'dev@tienda.com' } as User,
    profile: { id: 'dev-user', organization_id: 'dev-org', full_name: 'Usuario Dev', role: 'owner', avatar_url: null, is_active: true },
    organization: getDevOrg(),
    stores: [getDevStore()],
    currentStoreId: 'dev-store',
    role: 'owner',
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()
  const isDevMode = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production' && localStorage.getItem('ca-dev-mode') === 'true'

  // Dev mode: skip Supabase auth entirely — moved to useEffect for correct React lifecycle
  useEffect(() => {
    if (isDevMode) {
      setAuthUser(getDevAuthUser())
      setLoading(false)
    }
  }, [isDevMode])

  const loadUserData = useCallback(async (user: User) => {
    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const profile = profileRes.data as Profile | null

    const orgRes = profile?.organization_id
      ? await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      : { data: null }
    const org = (orgRes.data as Organization | null) ?? null

    let stores: Store[] = []
    if (org) {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
      stores = (data as Store[]) ?? []
    }

    // Apply localStorage overrides (set by settings page save, survives RLS fails)
    let finalOrg = org
    let finalStores = stores
    if (typeof window !== 'undefined') {
      const lsOrgName = localStorage.getItem('ca-dev-org-name')
      if (lsOrgName && org) finalOrg = { ...org, name: lsOrgName }
      const lsStoreName = localStorage.getItem('ca-dev-store-name')
      if (lsStoreName) finalStores = stores.map(s => ({ ...s, name: lsStoreName }))
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ca-current-store') : null
    const currentStoreId = (stored && finalStores.find(s => s.id === stored))
      ? stored
      : finalStores[0]?.id ?? null

    setAuthUser({ user, profile, organization: finalOrg, stores: finalStores, currentStoreId, role: profile?.role ?? null })
  }, [supabase])

  useEffect(() => {
    if (isDevMode) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUserData(session.user).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDevMode) return
      if (session?.user) loadUserData(session.user)
      else setAuthUser(null)
    })

    return () => subscription.unsubscribe()
  }, [loadUserData, supabase.auth, isDevMode])

  const setCurrentStore = useCallback((storeId: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('ca-current-store', storeId)
    setAuthUser(prev => prev ? { ...prev, currentStoreId: storeId } : prev)
  }, [])

  const updateOrgName = useCallback((name: string) => {
    setAuthUser(prev => prev?.organization
      ? { ...prev, organization: { ...prev.organization, name } }
      : prev)
  }, [])

  const updateAvatarUrl = useCallback((url: string) => {
    setAuthUser(prev => prev?.profile
      ? { ...prev, profile: { ...prev.profile, avatar_url: url } }
      : prev)
  }, [])

  const updateCurrentStore = useCallback((updates: Partial<Store>) => {
    setAuthUser(prev => {
      if (!prev) return prev
      const id = prev.currentStoreId ?? prev.stores[0]?.id
      return { ...prev, stores: prev.stores.map(s => s.id === id ? { ...s, ...updates } : s) }
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ca-current-store')
      window.location.href = '/login'
    }
  }, [supabase.auth])

  const currentStore = authUser?.stores.find(s => s.id === authUser.currentStoreId)
    ?? authUser?.stores[0]
    ?? null

  return (
    <AuthContext.Provider value={{ authUser, loading, currentStore, setCurrentStore, updateOrgName, updateCurrentStore, updateAvatarUrl, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
