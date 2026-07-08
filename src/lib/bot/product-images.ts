// ── Product Image Service ──────────────────────────────────────
// Busca imágenes de productos en Supabase y las envía por Evolution API.

import { createServiceClient } from '@/lib/supabase/service'
import { sendImage } from '@/lib/bot/evolution-client'

export interface ProductImageResult {
  url: string
  alt: string
}

export interface ImageSearchResult {
  /** The single matched product, or null if ambiguous / not found */
  productName: string | null
  /** Images found for the matching product */
  images: ProductImageResult[]
  /** When multiple products match, list them here for disambiguation */
  ambiguousMatches: string[]
}

/**
 * Detecta el MIME type según la extensión del archivo en la URL.
 */
export function getMimeType(url: string): string {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? ''
  switch (ext) {
    case 'png':  return 'image/png'
    case 'webp': return 'image/webp'
    case 'gif':  return 'image/gif'
    case 'jfif':
    case 'jpeg':
    case 'jpg':  return 'image/jpeg'
    default:     return 'image/jpeg'
  }
}

/**
 * Busca un producto por nombre y retorna sus imágenes.
 *
 * Flujo:
 * 1. Busca productos por ilike name, filtrados por organization_id e is_active
 * 2. Si hay 0 resultados → retorna vacío
 * 3. Si hay varios resultados → retorna ambiguousMatches con los nombres
 * 4. Si hay 1 resultado → busca imágenes en product_images (orden sort_order, max 10)
 * 5. Fallback: si product_images no tiene nada, hace una segunda query a products.images[]
 */
export async function getProductImages(
  query: string,
  organizationId: string,
  userText?: string,
): Promise<ImageSearchResult> {
  const sb = createServiceClient()

  // 1. Buscar productos activos por nombre
  const { data: products } = await sb.from('products')
    .select('id, name, images, product_variants(id, attribute_values, images, is_active)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .limit(10)

  if (!products || products.length === 0) {
    return { productName: null, images: [], ambiguousMatches: [] }
  }

  // 2. Si hay varios, retornar lista para desambiguación
  if (products.length > 1) {
    return {
      productName: null,
      images: [],
      ambiguousMatches: products.map((p: any) => p.name),
    }
  }

  const product = products[0] as any
  let images: ProductImageResult[] = []

  // 3. Buscar variante específica según el texto del usuario (genérico)
  // Escanea las variantes y busca si algún valor de attribute_values aparece en el texto del usuario
  const textForMatching = (userText ?? query).toLowerCase()
  const matchingVariant = product.product_variants?.find((v: any) =>
    v.is_active &&
    v.attribute_values &&
    Object.values(v.attribute_values).some((val: any) =>
      val && textForMatching.includes(val.toString().toLowerCase())
    )
  )
  if (matchingVariant?.images?.length) {
    const altText = matchingVariant.attribute_values
      ? Object.values(matchingVariant.attribute_values).filter(Boolean).join(' / ')
      : product.name
    images = matchingVariant.images.slice(0, 10).map((url: string) => ({
      url, alt: `${product.name} - ${altText}`,
    }))
  }

  // 4. Query separada a product_images (tabla dedicada)
  if (images.length === 0) {
    const { data: productImages } = await sb.from('product_images')
      .select('url, alt, sort_order')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true })
      .limit(10)

    if (productImages?.length) {
      images = productImages.map((img: any) => ({
        url: img.url,
        alt: img.alt || product.name,
      }))
    }
  }

  // 5. Fallback: products.images[] (TEXT array directo en la tabla)
  if (images.length === 0 && product.images?.length) {
    images = product.images.slice(0, 10).map((url: string) => ({
      url, alt: product.name,
    }))
  }

  return {
    productName: product.name,
    images,
    ambiguousMatches: [],
  }
}

interface SendResult {
  sent: number
  failed: number
}

/**
 * Envía imágenes de un producto por WhatsApp de forma secuencial.
 *
 * - Caption solo en la primera imagen con formato 📸 {productName}
 * - 500ms de delay entre imágenes para rate limiting
 * - Detecta MIME type según extensión del archivo
 * - Try/catch individual: si una falla, continúa con la siguiente
 */
export async function sendProductImages(
  phone: string,
  images: ProductImageResult[],
  productName: string,
  instanceName?: string,
): Promise<SendResult> {
  let sent = 0
  let failed = 0

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const caption = i === 0 ? `📸 ${productName}` : undefined
    const delay = i === 0 ? 500 : 500
    const mimetype = getMimeType(img.url)

    try {
      await sendImage(phone, img.url, caption, delay, instanceName, mimetype)
      sent++
    } catch (err) {
      console.error(`[PRODUCT_IMAGES] failed to send image ${i + 1}/${images.length}:`, err)
      failed++
    }

    // Small delay between images (only if there are more to send)
    if (i < images.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return { sent, failed }
}
