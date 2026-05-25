// ── WhatsApp Intent Classifier ─────────────────────────────
// ADAPTED from Clinify for commerce intents

import type { BotIntent } from '@/lib/types/whatsapp.types'

const PATTERNS: Array<{ intent: BotIntent; patterns: RegExp[] }> = [
  {
    intent: 'greet',
    patterns: [/^(hola|buenas?|buenos? d[ií]as?|buenas? tardes?|buenas? noches?|hey|ey)\b/i],
  },
  {
    intent: 'search',
    patterns: [
      /\b(busco?|buscando|ten[eé]s?|hay|tienen|consulta|quiero ver|mostrame|quer[ií]a)\b/i,
      /\b(que .+ tienen|qu[eé] .+ hay|c[aá]talogo|novedades|productos|venden|ropa|remera?|pantal[oó]n?|zapatilla?)\b/i,
    ],
  },
  {
    intent: 'buy',
    patterns: [
      /\b(quiero|llev[aá]r|comprar|reservar|pedir|encargar|me llevo|lo quiero|agreg[aá])\b/i,
      /\b(pasame|mandame|enviame|cu[eá]nto sale|precio|cu[aá]nto vale)\b/i,
    ],
  },
  {
    intent: 'cart',
    patterns: [
      /\b(carrito|carro|bolsa|mi pedido|qu[eé] llevo|qu[eé] tengo|resumen|total|como voy|c[uú]anto es)\b/i,
    ],
  },
  {
    intent: 'checkout',
    patterns: [
      /\b(comprar|pagar|finalizar|confirmar pedido|quiero pagar|pago|transferencia|efectivo|mercadopago|direcci[oó]n)\b/i,
    ],
  },
  {
    intent: 'track_order',
    patterns: [
      /\b(pedido|env[ií]o|seguimiento|tracking|rastrear|mi compra|mi env[ií]o|d[oó]nde est[aá]|cu[aá]ndo llega)\b/i,
    ],
  },
  {
    intent: 'cancel_order',
    patterns: [
      /\b(cancelar|anular|cancelaci[oó]n|no quiero el pedido|baja)\b/i,
    ],
  },
  {
    intent: 'catalog',
    patterns: [
      /\b(novedades|nuevo|lanzamiento|colecci[oó]n|cat[aá]logo|que tienen|que venden|tienda|productos)\b/i,
    ],
  },
  {
    intent: 'human',
    patterns: [
      /\b(persona|humano|asesor|hablar con alguien|vendedor|representante|queja|reclamo|hablar con un)\b/i,
    ],
  },
  {
    intent: 'thanks',
    patterns: [/^(gracias|muchas gracias|grax|grc|thx|thanks|ok gracias|listo gracias|perfecto|bien)\b/i],
  },
  {
    intent: 'help',
    patterns: [/\b(ayuda|help|no entiendo|c[oó]mo funciona|qu[eé] puede hacer|que podes hacer|que sabes hacer)\b/i],
  },
]

export function classifyIntent(text: string): BotIntent {
  const normalized = text.trim()
  for (const { intent, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(normalized))) return intent
  }
  return 'unknown'
}

export function extractPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '').replace(/@lid$/, '')
}

export function extractText(data: { message?: Record<string, unknown> }): string {
  if (!data.message) return ''
  const m = data.message as {
    conversation?: string
    extendedTextMessage?: { text?: string }
    buttonsResponseMessage?: { selectedButtonId?: string }
    listResponseMessage?: { singleSelectReply?: { selectedRowId?: string } }
    imageMessage?: { caption?: string }
  }
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.imageMessage?.caption ||
    ''
  )
}
