// ── Commerce Conversation State Machine ─────────────────────
// ADAPTED from Clinify for commerce.
// Pure functions — tracks conversation STATE only.
// AI generates ALL customer-facing responses.
// Response strings here are markers (__AI_GENERATE__) or fallbacks.

import type { BotContext, BotState, BotIntent } from '@/lib/types/whatsapp.types'
import { classifyIntent } from './intent-classifier'

export interface EngineResult {
  newContext: BotContext
  responses: string[]
  shouldEndSession: boolean
}

function makeContext(phone: string, overrides: Partial<BotContext> = {}): BotContext {
  return {
    phone,
    customerId: null,
    customerName: null,
    storeId: null,
    organizationId: null,
    state: 'idle',
    lastMessageAt: new Date().toISOString(),
    messageCount: 0,
    isKnownCustomer: false,
    ...overrides,
  }
}

export function processMessage(
  incomingText: string,
  currentContext: BotContext | null,
  pushName?: string,
): EngineResult {
  const phone = currentContext?.phone ?? ''
  const ctx = currentContext ?? makeContext(phone)
  const text = incomingText.trim()
  const intent = classifyIntent(text)

  const next = { ...ctx, messageCount: ctx.messageCount + 1, lastMessageAt: new Date().toISOString() }

  // Global overrides
  if (text.toLowerCase() === 'menu' || text.toLowerCase() === 'menú') {
    next.state = 'main_menu'
    return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
  }

  if (intent === 'human' && ctx.state !== 'human_handoff') {
    next.state = 'human_handoff'
    return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
  }

  if (intent === 'thanks' && ctx.state !== 'human_handoff') {
    return { newContext: { ...next, state: 'idle' }, responses: ['__AI_GENERATE__'], shouldEndSession: true }
  }

  switch (ctx.state) {
    case 'idle':
    case 'greeting': {
      if (ctx.isKnownCustomer && ctx.customerName) {
        next.state = 'main_menu'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      next.state = 'identify_customer'
      return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
    }

    case 'identify_customer': {
      // Try to identify by name or phone
      const words = text.trim().split(/\s+/).filter(w => w.length > 0)
      if (words.length >= 2) {
        next.customerName = text.trim()
        next.isKnownCustomer = true
        next.state = 'main_menu'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
    }

    case 'main_menu': {
      if (intent === 'search' || intent === 'catalog') {
        next.state = 'search_products'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      if (intent === 'cart') {
        next.state = 'cart_view'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      if (intent === 'checkout') {
        next.state = 'checkout_confirm'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      if (intent === 'track_order') {
        next.state = 'order_tracking'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      if (intent === 'cancel_order') {
        next.state = 'cancel_select'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      // Default: let AI handle conversationally
      return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
    }

    case 'search_products':
    case 'product_select':
    case 'variant_select':
    case 'cart_view':
    case 'checkout_confirm':
    case 'checkout_address':
    case 'checkout_payment':
    case 'order_tracking':
    case 'cancel_select':
    case 'cancel_confirm': {
      // All these states are handled by the Commerce Brain + AI
      // The state machine passes through to let the AI handle the conversation
      return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
    }

    default: {
      next.state = 'idle'
      if (next.isKnownCustomer && next.customerName) {
        next.state = 'main_menu'
        return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
      }
      return { newContext: next, responses: ['__AI_GENERATE__'], shouldEndSession: false }
    }
  }
}

export function createInitialContext(phone: string): BotContext {
  return makeContext(phone)
}

export function makeMessage(
  direction: 'inbound' | 'outbound',
  text: string,
  phone: string,
  state?: BotState,
  intent?: BotIntent,
) {
  return {
    id: crypto.randomUUID(),
    phone,
    direction,
    text,
    timestamp: new Date().toISOString(),
    botState: state,
    intent,
  }
}
