// ── OCR Service ───────────────────────────────────────────────
// Extracts payment data from proof images using Tesseract.js.
// Fire-and-forget after upload — never blocks the webhook.

import { createWorker } from 'tesseract.js'

export interface OcrResult {
  amount: number | null
  alias: string | null
  bank: string | null
  holder: string | null
  confidence: number
  rawText: string
}

const BANKS = [
  'Santander', 'Galicia', 'BBVA', 'Frances', 'Nacion', 'Nación',
  'Provincia', 'Macro', 'Supervielle', 'Ciudad', 'Hipotecario',
  'Patagonia', 'Comafi', 'Columbia', 'Brubank', 'Mercado Pago',
  'Naranja X', 'Uala', 'DolarApp', 'Rebanking', 'Prex',
]

/**
 * Process an image URL through Tesseract OCR.
 * Returns extracted payment data from the image.
 */
export async function extractPaymentData(imageBuffer: Buffer): Promise<OcrResult> {
  try {
    const worker = await createWorker('spa')
    const { data } = await worker.recognize(imageBuffer)
    await worker.terminate()

    const text = data.text.trim()
    const confidence = data.confidence

    return {
      amount: extractAmount(text),
      alias: extractAlias(text),
      bank: extractBank(text),
      holder: extractHolder(text),
      confidence: confidence / 100,
      rawText: text.slice(0, 2000),
    }
  } catch (err) {
    console.error('[OCR] Processing error:', err)
    return {
      amount: null, alias: null, bank: null, holder: null,
      confidence: 0, rawText: '',
    }
  }
}

/**
 * Extract amount from OCR text.
 * Matches patterns like "$1,500.00", "1500,00", "$ 500"
 */
function extractAmount(text: string): number | null {
  const patterns = [
    /\$[\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/,
    /total[\s:]*\$?[\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
    /importe[\s:]*\$?[\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
    /monto[\s:]*\$?[\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const raw = match[1].replace(/\./g, '').replace(',', '.')
      const num = parseFloat(raw)
      if (!isNaN(num) && num > 0) return num
    }
  }
  return null
}

/**
 * Extract alias from OCR text.
 * Matches "alias: palabra.palabra.palabra"
 */
function extractAlias(text: string): string | null {
  const patterns = [
    /alias[\s:]*([a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+\.[a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+\.[a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+)/,
    /([a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+\.[a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+\.[a-záéíóúñA-ZÁÉÍÓÚÑ0-9]+)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].toLowerCase()
  }
  return null
}

/**
 * Extract bank name from OCR text.
 */
function extractBank(text: string): string | null {
  for (const bank of BANKS) {
    if (text.toLowerCase().includes(bank.toLowerCase())) return bank
  }
  return null
}

/**
 * Extract holder name from OCR text.
 */
function extractHolder(text: string): string | null {
  const patterns = [
    /titular[\s:]*([\wáéíóúñÁÉÍÓÚÑ\s]+?)(?:\n|$|\.)/i,
    /beneficiario[\s:]*([\wáéíóúñÁÉÍÓÚÑ\s]+?)(?:\n|$|\.)/i,
    /cuenta[\s:]*([\wáéíóúñÁÉÍÓÚÑ\s]+?)(?:\n|$|\.)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const name = match[1].trim()
      if (name.length > 3 && name.length < 80) return name
    }
  }
  return null
}

/**
 * Download an image from a URL.
 */
export async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[OCR] Download error:', err)
    return null
  }
}
