import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'

function isPlaceholder() {
  return SUPABASE_URL.includes('placeholder')
}

function mockFetch(_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  return Promise.reject(new TypeError('Supabase not configured (dev mode)'))
}

export function createServiceClient() {
  const url = SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(isPlaceholder() ? { global: { fetch: mockFetch } } : {}),
  })
}
