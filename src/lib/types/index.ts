// ============================================================
// Core Types — Concierge AI
// Reused pattern from Clinify, adapted for commerce
// ============================================================

export type UserRole = 'owner' | 'admin' | 'agent' | 'viewer'

export interface OrgSettings {
  businessType?: string
  salesPromptExtra?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  settings: OrgSettings | Record<string, unknown>
  trial_ends_at: string | null
  trial_used: boolean
  active?: boolean
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
}

export interface Store {
  id: string
  organization_id: string
  name: string
  logo_url: string | null
  address: string | null
  phone: string | null
  whatsapp_number: string | null
  timezone: string
  settings: Record<string, unknown>
  is_active: boolean
  evolution_instance: string | null
  created_at: string
}

// ── Commerce Types ─────────────────────────────────────────────

export type OrderStatus = 'pending' | 'awaiting_payment' | 'payment_under_review' | 'payment_confirmed' | 'payment_rejected' | 'preparing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded' | 'expired'
export type PaymentStatus = 'pending' | 'awaiting' | 'under_review' | 'confirmed' | 'paid' | 'failed' | 'refunded'
export type ConversationChannel = 'whatsapp' | 'instagram' | 'web'
export type ConversationStatus = 'open' | 'closed' | 'bot' | 'human'
export type InventoryMovementType = 'in' | 'out' | 'adjustment'
export type CouponType = 'percentage' | 'fixed'

export interface Product {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  category_id: string | null
  brand: string | null
  tags: string[]
  price: number
  compare_price: number | null
  images: string[]
  metadata: Record<string, unknown>
  is_active: boolean
  featured: boolean
  created_at: string
  updated_at: string
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string | null
  attribute_values: Record<string, string>
  price_override: number | null
  stock: number | null
  stock_alert_threshold: number | null
  images: string[]
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

export interface Customer {
  id: string
  organization_id: string
  store_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  whatsapp_id: string | null
  preferences: Record<string, unknown>
  total_orders: number
  lifetime_value: number
  last_order_at: string | null
  created_at: string
}

export interface Order {
  id: string
  organization_id: string
  store_id: string | null
  customer_id: string
  status: OrderStatus
  subtotal: number
  shipping_cost: number
  discount: number
  total: number
  coupon_id: string | null
  payment_method: string | null
  payment_status: PaymentStatus
  payment_id: string | null
  shipping_method: string | null
  shipping_address: string | null
  estimated_days: number | null
  tracking_number: string | null
  tracking_url: string | null
  notes: string | null
  source: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
  customer?: Customer
}

export interface OrderItem {
  id: string
  order_id: string
  variant_id: string
  product_name: string
  variant_label: string
  quantity: number
  unit_price: number
  total: number
  variant_snapshot?: Record<string, unknown>
}

export interface StorePaymentSettings {
  id: string
  organization_id: string
  store_id: string | null
  bank_name: string | null
  account_holder: string | null
  alias: string | null
  cvu: string | null
  payment_notes: string | null
  accepts_cash_on_delivery: boolean
  accepts_pickup_payment: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaymentProof {
  id: string
  organization_id: string
  store_id: string | null
  order_id: string
  customer_id: string
  image_url: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  review_note: string | null
  uploaded_at: string
  extracted_amount: number | null
  extracted_alias: string | null
  extracted_date: string | null
  extracted_bank: string | null
  extracted_holder: string | null
  ocr_confidence: number | null
  ocr_raw_text: string | null
  ocr_processed_at: string | null
}

export interface PaymentAccount {
  id: string
  organization_id: string
  bank_name: string
  account_holder: string
  alias: string | null
  cvu: string | null
  payment_method: string
  currency: string
  priority: number
  instructions: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  organization_id: string
  store_id: string | null
  customer_id: string | null
  channel: ConversationChannel
  channel_contact_id: string
  channel_chat_id: string
  status: ConversationStatus
  context: Record<string, unknown>
  human_takeover: boolean
  human_takeover_at: string | null
  human_takeover_reason: string | null
  human_released_at: string | null
  last_message_at: string | null
  created_at: string
  customer?: Customer
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  channel_message_id: string | null
  direction: 'inbound' | 'outbound'
  type: 'text' | 'image' | 'audio' | 'video'
  body: string | null
  media_url: string | null
  metadata: Record<string, unknown>
  sent_at: string
}

export interface Cart {
  id: string
  organization_id: string
  customer_id: string | null
  session_id: string | null
  expires_at: string
  items?: CartItem[]
}

export interface CartItem {
  id: string
  cart_id: string
  variant_id: string
  quantity: number
  added_at: string
  variant?: ProductVariant
  product?: Product
}

export interface AutomationLog {
  id: string
  organization_id: string
  store_id: string | null
  workflow: string
  entity_type: string
  entity_id: string
  status: 'success' | 'error'
  payload: Record<string, unknown>
  error: string | null
  executed_at: string
}

export interface CustomerScore {
  id: string
  customer_id: string
  organization_id: string
  total_orders: number
  total_spent: number
  avg_ticket: number
  recency_days: number
  frequency_count: number
  monetary_value: number
  rfm_segment: RfmSegment
  churn_risk: ChurnRisk
  ltv_estimated: number
  preferred_categories: string[]
  preferred_sizes: string[]
  computed_at: string
}

export type RfmSegment = 'champion' | 'loyal' | 'at_risk' | 'new_customer' | 'dormant' | 'lost'
export type ChurnRisk = 'low' | 'medium' | 'high' | 'churned'

export type OrderEventType =
  | 'created' | 'stock_reserved' | 'payment_requested'
  | 'proof_received' | 'payment_approved' | 'payment_rejected'
  | 'preparing' | 'shipped' | 'delivered' | 'completed'
  | 'cancelled' | 'expired' | 'refunded'
  | 'item_added' | 'item_removed' | 'quantity_modified' | 'note_added'
  // Bot conversation events
  | 'message_received' | 'message_sent' | 'intent_detected'
  | 'checkout_started' | 'checkout_completed'

export type OrderEventActorType = 'system' | 'admin' | 'customer' | 'ai'

export interface OrderEvent {
  id: string
  order_id: string
  type: OrderEventType
  actor_type: OrderEventActorType
  actor_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AnalyticsDaily {
  id: string
  organization_id: string
  store_id: string
  date: string
  total_orders: number
  total_revenue: number
  avg_order_value: number
  new_customers: number
  returning_customers: number
  top_products: Record<string, unknown>
  top_categories: Record<string, unknown>
  conversion_rate: number
  abandoned_carts: number
}

export interface Notification {
  id: string
  organization_id: string
  type: string
  title: string
  description: string | null
  read: boolean
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
