// ── Checkout State Machine ──────────────────────────────────────
// Pure functions - NO side effects, NO Supabase imports.
// Backend controls the flow; AI only converses naturally.

import { buildProductPresentation } from '@/lib/bot/product-emoji-map'

export type CheckoutState = 'idle' | 'name' | 'dni' | 'shipping' | 'address' | 'payment_method' | 'payment_waiting_proof' | 'confirm' | 'completed'

export interface CheckoutItem {
  productName: string
  quantity: number
  size?: string
  color?: string
  productId?: string
  variantId?: string
}

export interface CheckoutSession {
  state: CheckoutState
  items: CheckoutItem[]
  customerName?: string
  dni?: string
  shippingMethod?: 'shipping' | 'pickup'
  address?: string
  locality?: string
  references?: string
  pickup: boolean
  paymentMethod?: 'transfer' | 'cash_on_delivery' | 'pickup_payment'
}

export interface CheckoutResult {
  session: CheckoutSession
  response: string
  action?: { type: 'checkout' | 'human_handoff'; reason?: string }
}

export const AI_GENERATE = '__AI_GENERATE__'

// ── Formal State Machine Types ────────────────────────────────
// Architecture preparada para migración futura.
// NO reemplaza la implementación actual — solo define tipos.

/** Fases formales del checkout */
export type CheckoutPhase =
  | { id: 'idle' }
  | { id: 'name' }
  | { id: 'dni' }
  | { id: 'shipping' }
  | { id: 'address' }
  | { id: 'payment_method' }
  | { id: 'payment_waiting_proof' }
  | { id: 'confirm' }
  | { id: 'completed' }
  | { id: 'error'; reason: string }

/** Transición formal entre fases */
export interface CheckoutTransition {
  from: CheckoutPhase['id']
  to: CheckoutPhase['id']
  trigger: string
}

/** Mapa de transiciones válidas */
export const VALID_TRANSITIONS: CheckoutTransition[] = [
  { from: 'idle',                to: 'name',                 trigger: 'init_checkout' },
  { from: 'name',                to: 'dni',                  trigger: 'name_provided' },
  { from: 'name',                to: 'error',                trigger: 'deny' },
  { from: 'dni',                 to: 'shipping',             trigger: 'dni_provided' },
  { from: 'dni',                 to: 'error',                trigger: 'deny' },
  { from: 'shipping',            to: 'address',              trigger: 'shipping_chosen' },
  { from: 'shipping',            to: 'payment_method',       trigger: 'pickup_chosen' },
  { from: 'address',             to: 'payment_method',       trigger: 'address_provided' },
  { from: 'payment_method',      to: 'payment_waiting_proof', trigger: 'transfer_chosen' },
  { from: 'payment_method',      to: 'confirm',              trigger: 'cash_chosen' },
  { from: 'payment_waiting_proof', to: 'payment_method',     trigger: 'deny' },
  { from: 'confirm',             to: 'completed',            trigger: 'confirmed' },
  { from: 'confirm',             to: 'name',                 trigger: 'deny' },
]

/** Verifica si una transición es válida según el mapa formal */
export function isValidTransition(from: CheckoutState, to: CheckoutState): boolean {
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to)
}

// ── Sentinels for human intent detection ─────────────────────

const CONFIRM_WORDS = /^(s[ií]|si|dale|ok|confirmo|confirmar|perfecto|de acuerdo|est[aá] bien|adelante|mandale|vamos|sip|sisi|obvio|claro|yes|ye[ps])\b/i
const DENY_WORDS = /^(no|nop|nel|no quiero|no estoy seguro|despu[eé]s|cancelar|mejor no|para|tengo que pensar|lo pienso)\b/i
const SHIPPING_WORDS = /(env[ií]o|domicilio|casa|correo|env[ií]ar|envi[aá]|reparto|courier|paquete)/i
const PICKUP_WORDS = /(retiro|local|tienda|paso a buscar|buscar|recojo|retirar|sucursal|negocio|vengo)/i
const HELP_WORDS = /(humano|persona|agente|hablar con alguien|asesor|ayuda|no entiendo)/i
const TRANSFER_WORDS = /(transferencia|banco|bancaria|transferir|cbu|cvu|alias|dep[oó]sito|cuenta)/i
const CASH_WORDS = /(efectivo|contra entrega|contraentrega|contado|pago al recibir|en mano|billete|cash)/i
const PICKUP_PAY_WORDS = /(pago al retirar|al retirar|pago en el local|en el local|abono|pago cuando|pagar cuando|ah[ií]|cuando pase|cuando vaya|retiro y pago|en persona)/i

// ── Init ────────────────────────────────────────────────────

export function initCheckout(
  items: CheckoutItem[],
  existingData?: { customerName?: string; dni?: string; address?: string },
): CheckoutSession {
  const hasName = !!existingData?.customerName
  const hasDni = !!existingData?.dni
  const hasAddress = !!existingData?.address

  // ALL data exists → jump to payment_method (still need to ask payment)
  if (hasName && hasDni && hasAddress) {
    return {
      state: 'payment_method',
      items,
      customerName: existingData!.customerName,
      dni: existingData!.dni,
      address: existingData!.address,
      shippingMethod: 'shipping',
      pickup: false,
    }
  }

  // Name + DNI exist → ask shipping method, then address if needed
  if (hasName && hasDni) {
    return {
      state: 'shipping',
      items,
      customerName: existingData!.customerName,
      dni: existingData!.dni,
      pickup: false,
    }
  }

  // Only name exists → ask DNI
  if (hasName) {
    return {
      state: 'dni',
      items,
      customerName: existingData!.customerName,
      pickup: false,
    }
  }

  // Nothing → start from scratch
  return {
    state: 'name',
    items,
    pickup: false,
  }
}

// ── Process message in current state ───────────────────────

export function processCheckoutMessage(
  text: string,
  session: CheckoutSession,
): CheckoutResult {
  const trimmed = text.trim()

  // Global: human handoff at any time
  if (HELP_WORDS.test(trimmed)) {
    return {
      session,
      response: AI_GENERATE,
      action: { type: 'human_handoff', reason: 'Cliente solicitó atención humana durante checkout' },
    }
  }

  switch (session.state) {
    case 'name':
      return handleNameState(trimmed, session)
    case 'dni':
      return handleDniState(trimmed, session)
    case 'shipping':
      return handleShippingState(trimmed, session)
    case 'address':
      return handleAddressState(trimmed, session)
    case 'payment_method':
      return handlePaymentMethodState(trimmed, session)
    case 'payment_waiting_proof':
      return handlePaymentWaitingProofState(trimmed, session)
    case 'confirm':
      return handleConfirmState(trimmed, session)
    case 'completed':
      return { session, response: AI_GENERATE }
    default:
      return { session, response: AI_GENERATE }
  }
}

// ── State handlers ─────────────────────────────────────────

function handleNameState(text: string, session: CheckoutSession): CheckoutResult {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'dni',
      customerName: text,
    }
    return {
      session: nextSession,
      response: 'Gracias. ¿Me decís tu DNI?',
    }
  }

  if (DENY_WORDS.test(text)) {
    return {
      session,
      response: AI_GENERATE,
      action: { type: 'human_handoff', reason: 'Usuario no quiso dar nombre durante checkout' },
    }
  }

  return {
    session,
    response: AI_GENERATE,
  }
}

function handleDniState(text: string, session: CheckoutSession): CheckoutResult {
  const digits = text.replace(/\D/g, '')

  if (digits.length >= 6 && digits.length <= 9) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'shipping',
      dni: digits,
    }
    return {
      session: nextSession,
      response: 'Gracias. ¿Cómo preferís recibirlo? ¿Envío a domicilio o retiro por el local?',
    }
  }

  if (DENY_WORDS.test(text) || /no (tengo|tiene|s[eé])/i.test(text)) {
    return {
      session,
      response: AI_GENERATE,
      action: { type: 'human_handoff', reason: 'Usuario no pudo o no quiso dar DNI' },
    }
  }

  return {
    session,
    response: AI_GENERATE,
  }
}

function handleShippingState(text: string, session: CheckoutSession): CheckoutResult {
  const lower = text.toLowerCase()

  if (SHIPPING_WORDS.test(lower) || /a (mi |la )?casa/i.test(lower) || /domicilio/i.test(lower)) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'address',
      shippingMethod: 'shipping',
      pickup: false,
    }
    return {
      session: nextSession,
      response: '¿Cuál es tu dirección completa? Incluí localidad si querés.',
    }
  }

  if (PICKUP_WORDS.test(lower) || /paso/i.test(lower) || /voy/i.test(lower)) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'payment_method',
      shippingMethod: 'pickup',
      pickup: true,
    }
    return {
      session: nextSession,
      response: '¿Cómo preferís pagar? ¿Transferencia bancaria o pago al retirar por el local?',
    }
  }

  return {
    session,
    response: AI_GENERATE,
  }
}

function handleAddressState(text: string, session: CheckoutSession): CheckoutResult {
  if (text.length >= 5) {
    let address = text
    let locality: string | undefined

    const parts = text.split(/[,;-]/).map((s: string) => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      address = parts[0]
      locality = parts.slice(1).join(', ')
    }

    const nextSession: CheckoutSession = {
      ...session,
      state: 'payment_method',
      address,
      locality: locality || undefined,
    }
    return {
      session: nextSession,
      response: '¿Cómo preferís pagar? ¿Transferencia bancaria o efectivo contra entrega?',
    }
  }

  return {
    session,
    response: AI_GENERATE,
  }
}

function handlePaymentMethodState(text: string, session: CheckoutSession): CheckoutResult {
  const lower = text.toLowerCase()

  // Transferencia bancaria
  if (TRANSFER_WORDS.test(lower) || /transferencia/i.test(lower)) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'payment_waiting_proof',
      paymentMethod: 'transfer',
    }
    // Return AI_GENERATE so the webhook route can send bank data
    return {
      session: nextSession,
      response: AI_GENERATE,
    }
  }

  // Cash on delivery (shipping only)
  if (CASH_WORDS.test(lower) && session.shippingMethod === 'shipping') {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'confirm',
      paymentMethod: 'cash_on_delivery',
    }
    const summary = buildSummary(nextSession)
    return {
      session: nextSession,
      response: `Perfecto. Confirmamos:\n\n${summary}\n\n¿Está todo bien para generar el pedido?`,
    }
  }

  // Pickup payment — also forces shipping method to pickup
  if (PICKUP_PAY_WORDS.test(lower) || (session.pickup && (CASH_WORDS.test(lower) || CONFIRM_WORDS.test(lower)))) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'confirm',
      shippingMethod: 'pickup',
      pickup: true,
      paymentMethod: 'pickup_payment',
    }
    const summary = buildSummary(nextSession)
    return {
      session: nextSession,
      response: `Perfecto. Confirmamos:\n\n${summary}\n\n¿Está todo bien para generar el pedido?`,
    }
  }

  // Unrecognized
  return {
    session,
    response: AI_GENERATE,
  }
}

function handlePaymentWaitingProofState(text: string, session: CheckoutSession): CheckoutResult {
  // User already chose transfer — they should send a proof image
  // If they say "ok" or "si", confirm and wait for proof
  if (CONFIRM_WORDS.test(text)) {
    return {
      session,
      response: 'Perfecto, cuando hagas la transferencia enviame el comprobante por acá 📸',
    }
  }

  if (DENY_WORDS.test(text)) {
    // User changed mind about payment method — go back
    const nextSession: CheckoutSession = {
      ...session,
      state: 'payment_method',
      paymentMethod: undefined,
    }
    return {
      session: nextSession,
      response: 'Sin problema. ¿Cómo preferís pagar entonces?',
    }
  }

  // Let AI handle any other response naturally
  return {
    session,
    response: AI_GENERATE,
  }
}

function handleConfirmState(text: string, session: CheckoutSession): CheckoutResult {
  if (CONFIRM_WORDS.test(text)) {
    const nextSession: CheckoutSession = {
      ...session,
      state: 'completed',
    }
    return {
      session: nextSession,
      response: AI_GENERATE,
      action: { type: 'checkout' },
    }
  }

  if (DENY_WORDS.test(text)) {
    return {
      session: { ...session, state: 'name', customerName: undefined, dni: undefined, address: undefined },
      response: 'Sin problema. Contame de nuevo, ¿cuál es tu nombre completo?',
    }
  }

  return {
    session,
    response: AI_GENERATE,
  }
}

// ── Helpers ────────────────────────────────────────────────

function buildSummary(session: CheckoutSession): string {
  const items = session.items
    .map(i => buildProductPresentation(i.productName, i.color, i.quantity, i.size))
    .join('\n')

  const method = session.pickup
    ? 'Retiro por el local'
    : `Envío a ${session.address}${session.locality ? `, ${session.locality}` : ''}`

  const payment = session.paymentMethod === 'transfer'
    ? 'Transferencia bancaria'
    : session.paymentMethod === 'cash_on_delivery'
    ? 'Efectivo contra entrega'
    : session.paymentMethod === 'pickup_payment'
    ? 'Pago al retirar'
    : ''

  const paymentLine = payment ? `\n💳 ${payment}` : ''

  return `${items}\n\n📦 ${method}${paymentLine}`
}

export function buildCheckoutContext(session: CheckoutSession): string {
  const parts: string[] = []
  if (session.customerName) parts.push(`Nombre: ${session.customerName}`)
  if (session.dni) parts.push(`DNI: ${session.dni}`)
  if (session.shippingMethod) {
    parts.push(`Método: ${session.shippingMethod === 'pickup' ? 'Retiro en local' : 'Envío a domicilio'}`)
  }
  if (session.address) parts.push(`Dirección: ${session.address}`)
  if (session.locality) parts.push(`Localidad: ${session.locality}`)
  if (session.paymentMethod) {
    const payLabel = session.paymentMethod === 'transfer' ? 'Transferencia' : session.paymentMethod === 'cash_on_delivery' ? 'Efectivo contra entrega' : 'Pago al retirar'
    parts.push(`Pago: ${payLabel}`)
  }
  return parts.join(' | ')
}
