// ── Evolution API HTTP Client ────────────────────────────────
// Calls the local Evolution API container at EVOLUTION_API_URL

const BASE_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const API_KEY = process.env.EVOLUTION_API_KEY || ''

async function fetchApi(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution API error (${res.status}): ${text.slice(0, 300)}`)
  }
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

export interface InstanceState {
  state: 'open' | 'close' | 'connecting' | 'disconnected'
}

/** Create a new WhatsApp instance and return connection data (may include QR base64). */
export async function createInstance(instanceName: string, webhookUrl?: string) {
  const body: Record<string, any> = {
    instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  }
  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      enabled: true,
      events: ['messages.upsert'],
    }
  }
  return fetchApi('/instance/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** List all instances. */
export async function fetchInstances(): Promise<any[]> {
  const data = await fetchApi('/instance/fetchInstances')
  return Array.isArray(data) ? data : []
}

/** Get connection state of an instance. */
export async function getConnectionState(instanceName: string): Promise<InstanceState | null> {
  const data = await fetchApi(`/instance/connectionState/${instanceName}`)
  return data?.instance ?? null
}

/** Get QR code as base64 data URL. */
export async function getQrCode(instanceName: string): Promise<string | null> {
  try {
    const data = await fetchApi(`/instance/qrcode/${instanceName}?base64=true`)
    const base64 = data?.base64 ?? data?.qrcode?.base64 ?? null
    if (typeof base64 === 'string') return base64
    return null
  } catch {
    return null
  }
}

/** Logout/disconnect an instance. */
export async function logoutInstance(instanceName: string) {
  return fetchApi(`/instance/logout/${instanceName}`, {
    method: 'DELETE',
  })
}

/** Delete an instance entirely. */
export async function deleteInstance(instanceName: string) {
  return fetchApi(`/instance/delete/${instanceName}`, {
    method: 'DELETE',
  })
}

/** Ensure the instance exists (create if missing) and return its state + optional QR. */
export async function ensureInstance(instanceName: string, webhookUrl?: string): Promise<{
  state: InstanceState | null
  qrBase64: string | null
  created: boolean
}> {
  // Check if instance already exists
  const instances = await fetchInstances()
  const existing = instances.find((i: any) => i.name === instanceName)

  if (!existing) {
    // Create instance — this often returns QR code in the response
    const createRes = await createInstance(instanceName, webhookUrl)
    const qrBase64 = createRes?.qrcode?.base64 ?? null
    return { state: { state: 'connecting' }, qrBase64, created: true }
  }

  // Get current state
  const state = await getConnectionState(instanceName)
  return { state, qrBase64: null, created: false }
}
