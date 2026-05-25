import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Store, Organization } from '@/lib/types'

interface StoreState {
  organization: Organization | null
  currentStore: Store | null
  stores: Store[]
  setOrganization: (org: Organization) => void
  setCurrentStore: (store: Store) => void
  setStores: (stores: Store[]) => void
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      organization: null,
      currentStore: null,
      stores: [],
      setOrganization: (org) => set({ organization: org }),
      setCurrentStore: (store) => set({ currentStore: store }),
      setStores: (stores) => set({ stores }),
    }),
    { name: 'ca-store-store' }
  )
)
