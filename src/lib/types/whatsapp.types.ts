// ============================================================
// WhatsApp / Evolution API types + E-commerce Bot state
// ============================================================

export interface EvolutionWebhookPayload {
  event: 'messages.upsert' | 'messages.update' | 'connection.update' | 'qr.updated'
  instance: string
  data: EvolutionMessageData | EvolutionConnectionData
  sender?: string
}

export interface EvolutionMessageData {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { url?: string; mimetype?: string; caption?: string }
    buttonsResponseMessage?: { selectedButtonId: string; selectedDisplayText: string }
    listResponseMessage?: { singleSelectReply: { selectedRowId: string } }
  }
  messageTimestamp: number
  pushName?: string
}

export interface EvolutionConnectionData {
  state: 'open' | 'close' | 'connecting'
  statusReason?: number
}

export type BotState =
  | 'idle'
  | 'greeting'
  | 'main_menu'
  | 'catalog'
  | 'product_detail'
  | 'order_status'
  | 'order_detail'
  | 'track_order'
  | 'support'
  | 'human_handoff'
  | 'closed'

export type CheckoutState = 'idle' | 'name' | 'dni' | 'shipping' | 'address' | 'payment_method' | 'payment_waiting_proof' | 'confirm' | 'completed'

export interface BotContext {
  phone: string
  customerId: string | null
  customerName: string | null
  state: BotState | CheckoutState
  selectedProductId: string | null
  selectedOrderId: string | null
  lastOrderId?: string
  lastMessageAt: string
  messageCount: number
  isKnownCustomer: boolean
  storeName?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  // Checkout flow data (persisted in context JSONB)
  checkoutItems?: Array<{ productName: string; quantity: number; size?: string; color?: string }>
  checkoutName?: string
  checkoutDni?: string
  checkoutShippingMethod?: 'shipping' | 'pickup'
  checkoutAddress?: string
  checkoutLocality?: string
  checkoutReferences?: string
  checkoutPickup?: boolean
  checkoutPaymentMethod?: 'transfer' | 'cash_on_delivery' | 'pickup_payment'
  // Active order tracking (for post-checkout flow)
  activeOrderId?: string
  editableOrder?: boolean
}

export interface SendTextPayload {
  number: string
  textMessage: { text: string }
  options?: { delay?: number; presence?: 'composing' | 'recording' }
}

// ── Types for pre-existing commerce/intent files ────────────
// These are referenced by src/lib/commerce/* and src/lib/bot/intent-classifier.ts
// which were adapted from the odonto-saas codebase.

import type { AgentAction as AiAgentAction } from '@/lib/bot/ai-chat'
export type AgentAction = AiAgentAction

export type BotIntent =
  | 'greet'
  | 'book_appointment'
  | 'cancel_appointment'
  | 'reschedule'
  | 'view_appointments'
  | 'confirm'
  | 'deny'
  | 'select_1' | 'select_2' | 'select_3' | 'select_4' | 'select_5' | 'select_6'
  | 'ask_human'
  | 'thanks'
  | 'nps_score'
  | 'search'
  | 'buy'
  | 'cart'
  | 'checkout'
  | 'track_order'
  | 'cancel_order'
  | 'catalog'
  | 'human'
  | 'help'
  | 'unknown'

export interface ProductResult {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  compare_price?: number | null
  images?: string[]
  brand?: string
  tags?: string[]
  category_id?: string
  category_name?: string
  variants?: Array<{
    id: string
    sku?: string
    color?: string
    size?: string
    stock: number
    price_override?: number | null
    images?: string[]
    is_active: boolean
  }>
}
