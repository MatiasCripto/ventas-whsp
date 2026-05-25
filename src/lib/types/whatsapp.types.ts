// ============================================================
// WhatsApp / Bot Types — Concierge AI
// Adapted from Clinify for commerce
// ============================================================

export type BotState =
  | 'idle'
  | 'greeting'
  | 'identify_customer'
  | 'main_menu'
  | 'search_products'
  | 'product_select'
  | 'variant_select'
  | 'add_to_cart'
  | 'cart_view'
  | 'checkout_confirm'
  | 'checkout_address'
  | 'checkout_payment'
  | 'order_tracking'
  | 'cancel_select'
  | 'cancel_confirm'
  | 'human_handoff'

export type BotIntent =
  | 'greet'
  | 'search'
  | 'buy'
  | 'cart'
  | 'checkout'
  | 'track_order'
  | 'cancel_order'
  | 'human'
  | 'thanks'
  | 'catalog'
  | 'help'
  | 'unknown'

export interface BotContext {
  phone: string
  customerId: string | null
  customerName: string | null
  storeId: string | null
  organizationId: string | null
  state: BotState
  // Search context
  lastSearch?: string
  searchResults?: ProductResult[]
  // Selection context
  selectedProductId?: string | null
  selectedVariantId?: string | null
  // Checkout context
  pendingAddress?: string | null
  pendingPaymentMethod?: string | null
  // Cart
  cartTotal?: number
  cartItemCount?: number
  // Order tracking
  selectedOrderId?: string | null
  selectedOrderStatus?: string | null
  // Commerce data (pre-fetched)
  availableCategories?: string[]
  availablePaymentMethods?: string[]
  storeInfo?: {
    name: string
    shipping: string
    payment: string
    returns: string
    minOrder?: number
    freeShippingFrom?: number
  }
  // Conversation memory
  customer?: {
    name: string
    totalOrders: number
    preferredSizes?: string[]
    preferredColors?: string[]
  }
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  lastMessageAt: string
  messageCount: number
  isKnownCustomer: boolean
}

export interface ProductResult {
  productId: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  images: string[]
  category: string
  colors: string[]
  sizes: string[]
  stock: number
  score: number
}

export interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: EvolutionMessageData
}

export interface EvolutionMessageData {
  key?: {
    remoteJid?: string
    fromMe?: boolean
    id?: string
  }
  pushName?: string
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { url?: string; caption?: string }
    buttonsResponseMessage?: { selectedButtonId?: string }
    listResponseMessage?: { singleSelectReply?: { selectedRowId?: string } }
  }
}

export interface SendTextPayload {
  number: string
  textMessage: { text: string }
  options?: { delay?: number; presence?: 'composing' | 'recording' | 'paused' }
}

export interface AgentAction {
  type: 'search_products' | 'get_product' | 'add_to_cart' | 'remove_from_cart'
      | 'checkout' | 'cancel_order' | 'track_order' | 'human_handoff'
      | 'apply_coupon' | 'get_customer_info' | 'update_profile'
  payload: Record<string, unknown>
}

export interface AgentResponse {
  message: string
  action: AgentAction | null
}
