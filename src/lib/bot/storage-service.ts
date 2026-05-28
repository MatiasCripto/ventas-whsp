// ── Supabase Storage Service ─────────────────────────────────
// Handles file uploads to Supabase Storage buckets.

const BUCKET_PAYMENT_PROOFS = 'payment-proofs'

/**
 * Upload a payment proof image to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadPaymentProof(
  sb: any,
  orderId: string,
  customerId: string,
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  try {
    const ext = fileName.split('.').pop() || 'jpg'
    const storagePath = `${customerId}/${orderId}_${Date.now()}.${ext}`

    const { data, error } = await sb.storage
      .from(BUCKET_PAYMENT_PROOFS)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (error) {
      console.error('[STORAGE] Upload error:', error)
      return null
    }

    // Get public URL
    const { data: publicData } = sb.storage
      .from(BUCKET_PAYMENT_PROOFS)
      .getPublicUrl(storagePath)

    console.log('[STORAGE] Upload success:', { path: storagePath, url: publicData?.publicUrl })
    return publicData?.publicUrl ?? null
  } catch (err) {
    console.error('[STORAGE] Upload exception:', err)
    return null
  }
}
