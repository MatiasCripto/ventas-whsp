// ── Product Emoji Mapping ──────────────────────────────────────
// Pure functions - NO side effects. Category-aware, color-aware.
// Premium Zara/Shopify aesthetic: 1 emoji per product, max 2 per message.

const PRODUCT_EMOJI_MAP: Record<string, string> = {
  remera: '👕',
  remerón: '👕',
  polera: '👕',
  buzo: '🧥',
  canguro: '🧥',
  hoodie: '🧥',
  sweater: '🧥',
  pulóver: '🧥',
  campera: '🧥',
  chaqueta: '🧥',
  camisa: '👔',
  jean: '👖',
  jeans: '👖',
  pantalón: '👖',
  jogging: '👖',
  short: '🩳',
  bermuda: '🩳',
  vestido: '👗',
  pollera: '👗',
  falda: '👗',
  corpiño: '👙',
  bikini: '👙',
  bombacha: '🩲',
  boxer: '🩲',
  slip: '🩲',
  malla: '🩱',
  medias: '🧦',
  calcetines: '🧦',
  top: '🎽',
  musculosa: '🎽',
  zapatilla: '👟',
  zapato: '👟',
  calzado: '👟',
  gorra: '🧢',
  visera: '🧢',
  bolso: '👜',
  mochila: '👜',
  cartera: '👜',
  lentes: '👓',
  anteojos: '👓',
  cinturón: '🔗',
  bufanda: '🧣',
  pijama: '🛌',
  camisón: '🛌',
  kimono: '🥋',
  conjunto: '🛍️',
  combo: '🛍️',
  pack: '🛍️',
  kit: '🛍️',
  accesorio: '💎',
  pulsera: '💎',
  anillo: '💎',
  collar: '💎',
}

const COLOR_EMOJI_MAP: Record<string, string> = {
  blanco: '⚪',
  negro: '⚫',
  rojo: '🔴',
  azul: '🔵',
  verde: '🟢',
  amarillo: '🟡',
  naranja: '🟠',
  marrón: '🟤',
  marron: '🟤',
  gris: '🩶',
  rosa: '🩷',
  violeta: '🟣',
  lila: '🟣',
}

const FALLBACK_EMOJI = '🛍️'

const COLOR_KEYWORDS = Object.keys(COLOR_EMOJI_MAP)
const PRODUCT_KEYWORDS = Object.keys(PRODUCT_EMOJI_MAP)

/** Get the category emoji for a product by matching keywords in its name. */
export function getProductEmoji(productName: string): string {
  const lower = productName.toLowerCase()
  for (const keyword of PRODUCT_KEYWORDS) {
    if (lower.includes(keyword)) return PRODUCT_EMOJI_MAP[keyword]
  }
  return FALLBACK_EMOJI
}

/** Get the color dot emoji for a color name. */
export function getColorEmoji(color?: string): string {
  if (!color) return ''
  const lower = color.toLowerCase()
  for (const keyword of COLOR_KEYWORDS) {
    if (lower.includes(keyword)) return COLOR_EMOJI_MAP[keyword]
  }
  return ''
}

/** Build a clean product presentation line: "👕 Producto (Color: Rojo / Talle: M) x1" */
export function buildProductPresentation(
  productName: string,
  quantity?: number,
  attribute_values?: Record<string, string>,
): string {
  const emoji = getProductEmoji(productName)
  const parts = [emoji, productName]
  const label = attribute_values ? Object.values(attribute_values).filter(Boolean).join(' / ') : ''
  if (label) parts.push(`(${label})`)
  if (quantity && quantity > 0) parts.push(`x${quantity}`)
  return parts.join(' ')
}
