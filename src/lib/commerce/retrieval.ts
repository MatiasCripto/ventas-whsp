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
    if (!seen.has(r.id)) {
      seen.add(r.id)
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
    final = final.filter((p: any) => p.stock === null || p.stock > 0)
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
      variants:product_variants(id, attribute_values, stock, price_override, is_active)
    `)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!product) return null

  const p = product as Record<string, unknown>
  const variants = (p.variants as Array<Record<string, unknown>> ?? [])
    .filter(v => v.is_active !== false)

  const category = (p.category as Record<string, string> | null)?.name ?? ''

  return {
    id: (p.id as string) ?? '',
    name: p.name as string,
    slug: p.slug as string,
    price: p.price as number,
    compare_price: p.compare_price as number | null ?? undefined,
    images: (p.images as string[]) ?? [],
    category_name: category,
    variants: (p.variants as ProductResult['variants']) ?? [],
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
      id, name, slug, description, price, compare_price, images,
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

    results.push({
      id: prod.id as string,
      name: prod.name as string,
      slug: prod.slug as string,
      description: prod.description as string | null ?? undefined,
      price: prod.price as number,
      compare_price: prod.compare_price as number | null ?? undefined,
      images: prod.images as string[] ?? [],
      category_name: (prod.category as Record<string, string> | null)?.name ?? '',
      variants,
    })
  }

  return results
}

// ── Helpers ──────────────────────────────────────────────────

function mapToProductResults(data: unknown[]): ProductResult[] {
  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      id: (r.product_id as string) || (r.id as string),
      name: r.name as string,
      slug: r.slug as string,
      description: r.description as string | null ?? (r.product_description as string | null) ?? undefined,
      price: Number(r.price) || 0,
      compare_price: r.compare_price ? Number(r.compare_price) : null,
      images: (r.images as string[]) ?? [],
      category_name: (r.category_name as string) ?? '',
      brand: (r.brand as string) ?? undefined,
      tags: (r.tags as string[]) ?? undefined,
      variants: (r.variants as ProductResult['variants']) ?? undefined,
    }
  })
}

async function getVariantsForProduct(
  sb: ReturnType<typeof createServiceClient>,
  productId: string
): Promise<ProductResult['variants']> {
  const { data } = await sb
    .from('product_variants')
    .select('id, attribute_values, stock, price_override, is_active')
    .eq('product_id', productId)
    .eq('is_active', true)

  return (data ?? []) as ProductResult['variants']
}
