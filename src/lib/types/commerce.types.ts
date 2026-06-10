// ============================================================
// Commerce Brain Types
// ============================================================

export type CommerceIntent =
  | 'search_products'
  | 'get_product'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'checkout'
  | 'cancel_order'
  | 'track_order'
  | 'human_handoff'
  | 'apply_coupon'
  | 'get_customer_info'
  | 'greet'
  | 'thanks'
  | 'catalog'
  | 'unknown'

export interface CommerceContext {
  // Customer
  customer?: {
    name: string
    totalOrders: number
    lastPurchase?: string
  } | null
  // Retrieved products
  products?: CommerceProduct[]
  // Current cart
  cart?: {
    items: CommerceCartItem[]
    total: number
  } | null
  // Recent orders
  recentOrders?: CommerceOrder[]
  // Store policies
  storePolicies?: {
    name: string
    shipping: string
    payment: string
    returns: string
    minOrder?: number
    freeShippingFrom?: number
  }
  // Categories for browsing
  categories?: string[]
  // Conversation history
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  state: string
}

export interface CommerceProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  description: string | null
  attributes?: Array<{ name: string; values: string[] }>
  stock: number
  images: string[]
  category: string | null
  brand: string | null
  tags: string[]
}

export interface CommerceCartItem {
  productId: string
  variantId: string
  name: string
  variant: string
  quantity: number
  unitPrice: number
  total: number
  image: string | null
}

export interface CommerceOrder {
  id: string
  total: number
  status: string
  date: string
  items: number
}
