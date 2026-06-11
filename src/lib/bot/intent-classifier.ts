// ── Unified Intent Classifier ──────────────────────────────
// Merged from commerce/intent.ts and the original bot classifier.
// Single source of truth for all intent detection.

import type { BotIntent } from '@/lib/types/whatsapp.types'

const PATTERNS: Array<{ intent: BotIntent; patterns: RegExp[] }> = [
  {
    intent: 'greet',
    patterns: [/^(hola|buenas?|buenos? d[ií]as?|buenas? tardes?|buenas? noches?|hey|ey)\b/i],
  },
  {
    intent: 'search_products',
    patterns: [
      /\b(busco?|buscando|ten[eé]s?|hay|tienen|consulta|quer[ií]a|quisiera|me gustar[ií]a|necesito|estoy buscando)\b/i,
      /\b(que .+ tienen|qu[eé] .+ hay|mostrame|mostrame)\b/i,
    ],
  },
  // Legacy alias: 'search' maps to the same patterns
  {
    intent: 'search',
    patterns: [
      /\b(quiero ver|ropa|remera?|pantal[oó]n?|zapatilla?)\b/i,
    ],
  },
  {
    intent: 'get_product',
    patterns: [
      /\b(mostrame|decime|informaci[oó]n|detalle|foto|imagen|c[oó]mo es)\b/i,
      /\bes[eé] (producto|modelo|art[ií]culo)\b/i,
    ],
  },
  {
    intent: 'add_to_cart',
    patterns: [
      /\b(quiero|llev[aá]r|comprar|reservar|pedir|encargar|me llevo|lo quiero|la quiero)\b/i,
      /\b(agreg[aa]l?o?|poneme|ponelo|metelo|anotalo)\b/i,
    ],
  },
  // Legacy alias: 'buy' maps to add_to_cart logic
  {
    intent: 'buy',
    patterns: [
      /\b(pasame|mandame|enviame|cu[eá]nto sale|precio|cu[aá]nto vale)\b/i,
    ],
  },
  {
    intent: 'remove_from_cart',
    patterns: [
      /\b(sacar|quitar|eliminar|borrar|remover|no lo quiero|no la quiero)\b/i,
    ],
  },
  {
    intent: 'view_cart',
    patterns: [
      /\b(carrito|carro|bolsa|mi pedido|lo que llevo|qu[eé] llevo|qu[eé] tengo|como voy)\b/i,
      /\b(ver carrito|ver pedido|resumen|total)\b/i,
    ],
  },
  // Legacy alias: 'cart' maps to view_cart
  {
    intent: 'cart',
    patterns: [
      /\b(c[uú]anto es)\b/i,
    ],
  },
  {
    intent: 'checkout',
    patterns: [
      /\b(comprar|pagar|finalizar|confirmar pedido|quiero pagar|ya voy a pagar|pago|transferencia|efectivo|mercadopago)\b/i,
      /\b(cu[aá]nto es|cu[aá]nto sale|total final|mandame|envi[aá]me|entreg[aá]|direcci[oó]n)\b/i,
    ],
  },
  {
    intent: 'cancel_order',
    patterns: [
      /\b(cancelar|anular|cancelaci[oó]n|no quiero el pedido|no voy a pagar|baja)\b/i,
    ],
  },
  {
    intent: 'track_order',
    patterns: [
      /\b(pedido|env[ií]o|seguimiento|tracking|rastrear|lleg[oó]|cu[aá]ndo llega|en camino)\b/i,
      /\b(mi pedido|mi compra|mi env[ií]o|d[oó]nde est[aá])\b/i,
    ],
  },
  {
    intent: 'apply_coupon',
    patterns: [
      /\b(c[oó]digo|descuento|cup[oó]n|promo|promoci[oó]n|oferta|2x1|llevo dos|segundo)\b/i,
    ],
  },
  {
    intent: 'catalog',
    patterns: [
      /\b(cat[aá]logo|novedades|nuevo|lanzamiento|colecci[oó]n|productos|qu[eé] tienen|qu[eé] venden|tienda)\b/i,
    ],
  },
  {
    intent: 'human_handoff',
    patterns: [
      /\b(humano|persona|asesor|hablar con alguien|representante|vendedor|quiero hablar con|queja|reclamo)\b/i,
    ],
  },
  // Legacy alias: 'human' maps to human_handoff
  {
    intent: 'human',
    patterns: [
      /\b(hablar con un)\b/i,
    ],
  },
  {
    intent: 'thanks',
    patterns: [/^(gracias|muchas gracias|grax|grc|thx|thanks|ok gracias|listo gracias|perfecto)\b/i],
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

// ── Keyword extraction for product search ────────────────────

const STOP_WORDS = [
  'que', 'qué', 'como', 'cómo', 'quien', 'quién', 'donde', 'dónde',
  'cuando', 'cuándo', 'hace', 'hacia', 'para', 'por', 'con', 'sin',
  'pero', 'mas', 'más', 'menos', 'entre', 'todo', 'toda', 'algo',
  'este', 'esta', 'ese', 'esa', 'un', 'una', 'unas', 'unos',
  'tenes', 'tiene', 'tienen', 'hay', 'esta', 'estan', 'está',
  'quiero', 'quisiera', 'necesito', 'busco', 'podes', 'puede',
  'algún', 'algun', 'alguna', 'alguno', 'ningun', 'ninguna',
]

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!,.:;"'()\[\]{}]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.includes(word))
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
