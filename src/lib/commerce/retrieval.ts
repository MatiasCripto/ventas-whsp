// ── Commerce Product Retrieval ──────────────────────────────
// Multi-strategy search: full-text + trigram + tags + category.
// NEVER returns made-up data. Returns real products from Supabase.
// The AI generates responses FROM this data, not from its training.

import { createServiceClient } from '@/lib/supabase/service'
import type { ProductResult } from '@/lib/types/whatsapp.types'
import { extractKeywords } from './intent'

interface RetrievalOptions {
  organizationId: string
  limit?: number
  categoryFilter?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
}

export async function retrieveProducts(
  query: string,
  options: RetrievalOptions
): Promise<ProductResult[]> {
  const keywords = extractKeywords(query)
  const orgId = options.organizationId
  const limit = options.limit ?? 5

  if (keywords.length === 0 && !options.categoryFilter) return []

  const sb = createServiceClient()

  // 1. Full-text search on products
  const fullTextResults = keywords.length > 0
    ? await searchFullText(sb, keywords, orgId, limit)
    : []

  // 2. Trigram similarity search (typo-tolerant)
  const trigramResults = keywords.length > 0
    ? await searchTrigram(sb, keywords, orgId, limit)
    : []

  // 3. Tag match
  const tagResults = keywords.length > 0
    ? await searchByTags(sb, keywords, orgId, limit)
    : []

  // 4. Category match
  const categoryResults = keywords.length > 0
    ? await searchByCategory(sb, keywords, orgId, limit)
    : []

  // 5. Category filter (if specified)
  let filteredResults: ProductResult[] = []
  if (options.categoryFilter) {
    filteredResults = await searchByExactCategory(sb, options.categoryFilter, orgId, limit)
  }

  // Merge all results, dedup, rank
  const seen = new Set<string>()
  const merged: ProductResult[] = []

  const allResults = [
    ...(options.categoryFilter ? filteredResults : []),
    ...fullTextResults,
    ...tagResults,
    ...trigramResults,
    ...categoryResults,
  ]

  for (const r of allResults) {
    if (!seen.has(r.productId)) {
      seen.add(r.productId)
      merged.push(r)
    }
  }

  // Apply price/in-stock filters
  let final = merged
  if (options.minPrice !== undefined) {
    final = final.filter(p => p.price >= options.minPrice!)
  }
  if (options.maxPrice !== undefined) {
    final = final.filter(p => p.price <= options.maxPrice!)
  }
  if (options.inStock) {
    final = final.filter(p => p.stock > 0)
  }

  return final.slice(0, limit)
}

export async function getProductDetail(
  productId: string,
  organizationId: string
): Promise<ProductResult | null> {
  const sb = createServiceClient()
  const { data: product } = await sb
    .from('products')
    .select(`
      id, name, slug, price, compare_price, images, description,
      tags, brand, is_active,
      category:categories(name),
      variants:product_variants(id, color, size, stock, price_override, is_active)
    `)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!product) return null

  const p = product as Record<string, unknown>
  const variants = (p.variants as Array<Record<string, unknown>> ?? [])
    .filter(v => v.is_active !== false)

  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[]
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))] as string[]
  const totalStock = variants.reduce((sum: number, v) => sum + (v.stock as number || 0), 0)
  const category = (p.category as Record<string, string> | null)?.name ?? ''

  return {
    productId: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    price: p.price as number,
    comparePrice: p.compare_price as number | null,
    images: p.images as string[] ?? [],
    category,
    colors,
    sizes,
    stock: totalStock,
    score: 1,
  }
}

// ── Search strategies ────────────────────────────────────────

async function searchFullText(
  sb: ReturnType<typeof createServiceClient>,
  keywords: string[],
  orgId: string,
  limit: number
): Promise<ProductResult[]> {
  const tsquery = keywords
    .filter(k => k.length >= 3)
    .map(k => `${k}:*`)
    .join(' & ')

  if (!tsquery) return []

  const { data } = await sb
    .rpc('search_products_fts', {
      query_text: tsquery,
      org_id: orgId,
      result_limit: limit,
    })

  if (!data || !Array.isArray(data)) return []
  return mapToProductResults(data)
}

async function searchTrigram(
  sb: ReturnType<typeof createServiceClient>,
  keywords: string[],
  orgId: string,
  limit: number
): Promise<ProductResult[]> {
  const { data } = await sb
    .rpc('search_products_trigram', {
      search_terms: keywords,
      org_id: orgId,
      result_limit: limit,
    })

  if (!data || !Array.isArray(data)) return []
  return mapToProductResults(data)
}

async function searchByTags(
  sb: ReturnType<typeof createServiceClient>,
  keywords: string[],
  orgId: string,
  limit: number
): Promise<ProductResult[]> {
  const { data } = await sb
    .rpc('search_products_by_tags', {
      search_terms: keywords,
      org_id: orgId,
      result_limit: limit,
    })

  if (!data || !Array.isArray(data)) return []
  return mapToProductResults(data)
}

async function searchByCategory(
  sb: ReturnType<typeof createServiceClient>,
  keywords: string[],
  orgId: string,
  limit: number
): Promise<ProductResult[]> {
  const { data } = await sb
    .rpc('search_products_by_category', {
      search_terms: keywords,
      org_id: orgId,
      result_limit: limit,
    })

  if (!data || !Array.isArray(data)) return []
  return mapToProductResults(data)
}

async function searchByExactCategory(
  sb: ReturnType<typeof createServiceClient>,
  categoryName: string,
  orgId: string,
  limit: number
): Promise<ProductResult[]> {
  const { data: products } = await sb
    .from('products')
    .select(`
      id, name, slug, price, compare_price, images,
      category:categories!inner(name)
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('categories.name', categoryName)
    .limit(limit)

  if (!products || !Array.isArray(products)) return []

  const results: ProductResult[] = []
  for (const p of products) {
    const prod = p as Record<string, unknown>
    const variants = await getVariantsForProduct(sb, prod.id as string)
    const colors = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[]
    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))] as string[]
    const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0)

    results.push({
      productId: prod.id as string,
      name: prod.name as string,
      slug: prod.slug as string,
      price: prod.price as number,
      comparePrice: prod.compare_price as number | null,
      images: prod.images as string[] ?? [],
      category: (prod.category as Record<string, string> | null)?.name ?? '',
      colors,
      sizes,
      stock: totalStock,
      score: 0.8,
    })
  }

  return results
}

// ── Helpers ──────────────────────────────────────────────────

function mapToProductResults(data: unknown[]): ProductResult[] {
  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      productId: r.product_id as string || r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      price: Number(r.price) || 0,
      comparePrice: r.compare_price ? Number(r.compare_price) : null,
      images: (r.images as string[]) ?? [],
      category: r.category_name as string ?? '',
      colors: (r.colors as string[]) ?? [],
      sizes: (r.sizes as string[]) ?? [],
      stock: Number(r.stock) || 0,
      score: Number(r.score) || 0,
    }
  })
}

async function getVariantsForProduct(
  sb: ReturnType<typeof createServiceClient>,
  productId: string
): Promise<Array<{ color: string | null; size: string | null; stock: number }>> {
  const { data } = await sb
    .from('product_variants')
    .select('color, size, stock')
    .eq('product_id', productId)
    .eq('is_active', true)

  return (data ?? []) as Array<{ color: string | null; size: string | null; stock: number }>
}
