// ── Payment Proof OCR Workflow ────────────────────────────────
// Processes a payment proof image through OCR after upload.
// Fire-and-forget — never blocks the webhook response.

import { extractPaymentData, downloadImage } from '@/lib/services/ocr.service'
import { createServiceClient } from '@/lib/supabase/service'

export interface OcrWorkflowInput {
  proofId: string
  imageUrl: string
}

/**
 * Run OCR on a payment proof and store results.
 * Called async after createPaymentProof.
 */
export async function processPaymentProofOcr(input: OcrWorkflowInput): Promise<void> {
  console.log('[OCR_WORKFLOW] starting for proof:', input.proofId)

  try {
    const imageBuffer = await downloadImage(input.imageUrl)
    if (!imageBuffer) {
      console.warn('[OCR_WORKFLOW] could not download image:', input.proofId)
      return
    }

    const result = await extractPaymentData(imageBuffer)
    if (!result.rawText) {
      console.warn('[OCR_WORKFLOW] no text extracted from proof:', input.proofId)
      return
    }

    // Store results in the database
    const sb = createServiceClient()
    await sb.from('payment_proofs').update({
      extracted_amount: result.amount,
      extracted_alias: result.alias,
      extracted_bank: result.bank,
      extracted_holder: result.holder,
      ocr_confidence: result.confidence,
      ocr_raw_text: result.rawText,
      ocr_processed_at: new Date().toISOString(),
    }).eq('id', input.proofId)

    console.log('[OCR_WORKFLOW] completed for proof:', input.proofId, {
      amount: result.amount,
      alias: result.alias,
      bank: result.bank,
      confidence: result.confidence,
    })
  } catch (err) {
    console.error('[OCR_WORKFLOW] error for proof:', input.proofId, err)
  }
}
