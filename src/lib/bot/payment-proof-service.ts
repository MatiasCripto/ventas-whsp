// ── Payment Proof Service ─────────────────────────────────────
// Manages payment proof lifecycle: create, approve, reject, query.
// The IA NEVER processes proofs — this is backend-only logic.

import type { PaymentProof } from '@/lib/types'
import { recordOrderEvent } from '@/lib/services/order-event.service'

export interface PaymentProofInput {
  organization_id: string
  store_id: string | null
  order_id: string
  customer_id: string
  image_url: string
}

/**
 * Create a new payment proof record.
 */
export async function createPaymentProof(
  sb: any,
  data: PaymentProofInput,
): Promise<PaymentProof | null> {
  try {
    const { data: proof, error } = await sb.from('payment_proofs').insert({
      organization_id: data.organization_id,
      store_id: data.store_id,
      order_id: data.order_id,
      customer_id: data.customer_id,
      image_url: data.image_url,
      status: 'pending',
    }).select('*').single()

    if (error) {
      console.error('[PAYMENT_PROOF] Create error:', error)
      return null
    }

    console.log('[PAYMENT_PROOF] Created:', { id: proof.id, order_id: data.order_id })
    return proof as PaymentProof
  } catch (err) {
    console.error('[PAYMENT_PROOF] Create exception:', err)
    return null
  }
}

/**
 * Approve a payment proof and update the order status.
 */
export async function approvePaymentProof(
  sb: any,
  proofId: string,
  reviewerId: string,
): Promise<boolean> {
  try {
    // Get the proof to find the order
    const { data: proof } = await sb.from('payment_proofs')
      .select('order_id')
      .eq('id', proofId)
      .single()

    if (!proof) {
      console.error('[PAYMENT_PROOF] Not found:', proofId)
      return false
    }

    // Update proof status
    const { error: proofError } = await sb.from('payment_proofs').update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', proofId)

    if (proofError) {
      console.error('[PAYMENT_PROOF] Approve proof error:', proofError)
      return false
    }

    // Update order status
    const { error: orderError } = await sb.from('orders').update({
      status: 'payment_confirmed',
      payment_status: 'confirmed',
    }).eq('id', proof.order_id)

    if (orderError) {
      console.error('[PAYMENT_PROOF] Approve order error:', orderError)
      return false
    }

    // Record audit event
    await recordOrderEvent(sb, {
      order_id: proof.order_id,
      type: 'payment_approved',
      actor_type: 'admin',
      actor_id: reviewerId,
      metadata: { proof_id: proofId },
    })

    console.log('[PAYMENT_PROOF] Approved:', { proofId, orderId: proof.order_id })
    return true
  } catch (err) {
    console.error('[PAYMENT_PROOF] Approve exception:', err)
    return false
  }
}

/**
 * Reject a payment proof.
 */
export async function rejectPaymentProof(
  sb: any,
  proofId: string,
  reviewerId: string,
  notes?: string,
): Promise<boolean> {
  try {
    const { data: proof } = await sb.from('payment_proofs')
      .select('order_id')
      .eq('id', proofId)
      .single()

    if (!proof) return false

    const { error } = await sb.from('payment_proofs').update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      notes: notes ?? null,
    }).eq('id', proofId)

    if (error) {
      console.error('[PAYMENT_PROOF] Reject error:', error)
      return false
    }

    // Record audit event
    await recordOrderEvent(sb, {
      order_id: proof.order_id,
      type: 'payment_rejected',
      actor_type: 'admin',
      actor_id: reviewerId,
      metadata: { proof_id: proofId, notes: notes ?? null },
    })

    console.log('[PAYMENT_PROOF] Rejected:', { proofId, orderId: proof.order_id })
    return true
  } catch (err) {
    console.error('[PAYMENT_PROOF] Reject exception:', err)
    return false
  }
}

/**
 * Get all payment proofs for an order.
 */
export async function getPaymentProofsByOrder(
  sb: any,
  orderId: string,
): Promise<PaymentProof[]> {
  try {
    const { data } = await sb.from('payment_proofs')
      .select('*')
      .eq('order_id', orderId)
      .order('uploaded_at', { ascending: false })

    return (data as PaymentProof[]) ?? []
  } catch (err) {
    console.error('[PAYMENT_PROOF] Query error:', err)
    return []
  }
}
