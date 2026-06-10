// Evolution API client — wraps HTTP calls to the Evolution API instance

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''

function resolveInstance(instanceName?: string): string {
  return instanceName ?? process.env.EVOLUTION_INSTANCE ?? 'concierge'
}

async function evolutionFetch(path: string, body?: unknown, instanceName?: string) {
  const instance = resolveInstance(instanceName)
  const fullPath = path.replace(/\${INSTANCE}/g, instance)
  const res = await fetch(`${BASE_URL}${fullPath}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error: ${err}`)
  }
  return res.json()
}

export async function sendText(phone: string, text: string, delay = 1200, instanceName?: string) {
  const instance = resolveInstance(instanceName)
  return evolutionFetch(`/message/sendText/${instance}`, {
    number: phone,
    text,
    delay,
  })
}

export async function sendMultiple(phone: string, messages: string[], delayBetween = 1500, instanceName?: string) {
  for (const msg of messages) {
    await sendText(phone, msg, delayBetween, instanceName)
  }
}

export async function markAsRead(jid: string, messageId: string, instanceName?: string) {
  const instance = resolveInstance(instanceName)
  return evolutionFetch(`/message/markMessageAsRead/${instance}`, {
    readMessages: [{ remoteJid: jid, fromMe: false, id: messageId }],
  })
}

export async function getQrCode(instanceName?: string) {
  const instance = resolveInstance(instanceName)
  const res = await fetch(`${BASE_URL}/instance/connect/${instance}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}

export async function getInstanceStatus(instanceName?: string) {
  const instance = resolveInstance(instanceName)
  const res = await fetch(`${BASE_URL}/instance/connectionState/${instance}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}

// ── Media / Image helpers ───────────────────────────────────

export async function sendImage(
  phone: string,
  imageUrl: string,
  caption?: string,
  delay = 1200,
  instanceName?: string,
  mimetype?: string,
) {
  const instance = resolveInstance(instanceName)
  const body: Record<string, unknown> = {
    number: phone,
    mediatype: 'image',
    media: imageUrl,
    caption: caption ?? '',
    delay,
  }
  if (mimetype) {
    body.mimetype = mimetype
  }
  return evolutionFetch(`/message/sendMedia/${instance}`, body)
}

/**
 * Download media from Evolution API by message key.
 * Returns raw ArrayBuffer for upload to Supabase Storage.
 */
export async function downloadMedia(
  remoteJid: string,
  messageId: string,
  instanceName?: string,
): Promise<ArrayBuffer | null> {
  const instance = resolveInstance(instanceName)
  try {
    const url = `${BASE_URL}/chat/getMedia/${instance}?msgKey=${messageId}&remoteJid=${encodeURIComponent(remoteJid)}`
    const res = await fetch(url, {
      headers: { apikey: API_KEY },
    })
    if (!res.ok) {
      console.error('[Evolution] downloadMedia error:', res.status)
      return null
    }
    return res.arrayBuffer()
  } catch (err) {
    console.error('[Evolution] downloadMedia exception:', err)
    return null
  }
}

// ── Instance management (for superadmin) ────────────────────

export async function createInstance(instanceName: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/instance/create`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instanceName }),
    })
    return res.ok
  } catch (err) {
    console.error('[Evolution] createInstance error:', err)
    return false
  }
}

export async function deleteInstance(instanceName: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: API_KEY },
    })
    return res.ok
  } catch {
    return false
  }
}
