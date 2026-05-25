import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

function isPlaceholder() {
  return SUPABASE_URL.includes('placeholder')
}

function mockFetch(_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  return Promise.reject(new TypeError('Supabase not configured (dev mode)'))
}

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    ...(isPlaceholder() ? { global: { fetch: mockFetch } } : {}),
  })
}
