// ── Evolution API client — wrapped HTTP calls ──────────────
// COPIED from Clinify — 100% reusable
// https://github.com/MatiasCripto/clinifyAgent

const BASE_URL   = process.env.EVOLUTION_API_URL   ?? 'http://localhost:8080'
const API_KEY    = process.env.EVOLUTION_API_KEY    ?? ''
const INSTANCE   = process.env.EVOLUTION_INSTANCE   ?? 'concierge'

async function evolutionFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function sendText(phone: string, text: string, delay = 1200) {
  const payload = {
    number: phone,
    textMessage: { text },
    options: { delay, presence: 'composing' } as const,
  }
  return evolutionFetch(`message/sendText/${INSTANCE}`, payload)
}

export async function sendMultiple(phone: string, messages: string[], delayBetween = 1500) {
  for (const msg of messages) {
    await sendText(phone, msg, delayBetween)
  }
}

export async function markAsRead(jid: string, messageId: string) {
  return evolutionFetch(`message/markMessageAsRead/${INSTANCE}`, {
    readMessages: [{ remoteJid: jid, fromMe: false, id: messageId }],
  })
}

export async function getQrCode() {
  const res = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}

export async function getInstanceStatus() {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { apikey: API_KEY },
  })
  return res.json()
}
