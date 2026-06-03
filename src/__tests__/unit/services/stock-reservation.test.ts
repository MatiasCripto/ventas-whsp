import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reserveStockForOrder } from '@/lib/services/stock-reservation.service'
import { getVariantAvailableStock } from '@/lib/repositories/stock-reservation.repository'

// Mock Supabase RPC responses
let mockRpcResult = { data: true, error: null }
let rpcCallCount = 0
let getVariantCalled = false

const mockSb = {
  rpc: vi.fn((fn: string, params?: Record<string, unknown>) => {
    if (fn === 'get_available_stock') {
      getVariantCalled = true
      return mockRpcResult
    }
    if (fn === 'reserve_stock_for_order') {
      rpcCallCount++
      return mockRpcResult
    }
    return { data: null, error: { message: 'Unknown RPC' } }
  }),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [], error: null,
        })),
        single: vi.fn(() => ({ data: { id: 'order-1' }, error: null })),
        order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })),
      })),
      single: vi.fn(() => ({ data: null, error: null })),
      limit: vi.fn(() => ({ data: [], error: null })),
    })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
    update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
  })),
}

// Mock Supabase service
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSb,
}))

// Mock order event service
vi.mock('@/lib/services/order-event.service', () => ({
  recordOrderEvent: vi.fn(() => Promise.resolve()),
}))

describe('Stock Reservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcCallCount = 0
    getVariantCalled = false
    mockRpcResult = { data: true, error: null }
  })

  // ── Test 1: Successful reservation ──────────────────────────

  it('should reserve stock when available', async () => {
    mockRpcResult = { data: true, error: null }

    const result = await reserveStockForOrder(mockSb, 'order-123', 'customer-1')

    expect(result).toBe(true)
    expect(rpcCallCount).toBe(1)
    expect(mockSb.rpc).toHaveBeenCalledWith('reserve_stock_for_order', {
      p_order_id: 'order-123',
    })
  })

  // ── Test 2: Insufficient stock ─────────────────────────────

  it('should fail when stock is insufficient', async () => {
    // Simulate reserve_stock_for_order RPC returning false (PL/pgSQL returns false)
    mockRpcResult = { data: false, error: null }

    const result = await reserveStockForOrder(mockSb, 'order-456', 'customer-2')

    expect(result).toBe(false)
    expect(rpcCallCount).toBe(1)
  })

  it('should handle get_available_stock returning 0', async () => {
    mockRpcResult = { data: 0, error: null }

    const available = await getVariantAvailableStock(mockSb, 'variant-1')

    expect(available).toBe(0)
    expect(getVariantCalled).toBe(true)
    expect(mockSb.rpc).toHaveBeenCalledWith('get_available_stock', {
      p_variant_id: 'variant-1',
    })
  })

  it('should handle get_available_stock returning positive stock', async () => {
    mockRpcResult = { data: 10, error: null }

    const available = await getVariantAvailableStock(mockSb, 'variant-1')

    expect(available).toBe(10)
  })

  it('should handle RPC error in get_available_stock gracefully', async () => {
    mockRpcResult = { data: null, error: { message: 'RPC error' } }

    const available = await getVariantAvailableStock(mockSb, 'variant-1')

    expect(available).toBe(0)
  })

  // ── Test 3: Race condition — two simultaneous reservations ──

  it('should handle race condition: first succeeds, second fails', async () => {
    // Track calls to reserve_stock_for_order
    // First call returns true, second call returns false
    const mockReserve = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })   // first call succeeds
      .mockResolvedValueOnce({ data: false, error: null })  // second call fails
      .mockResolvedValue({ data: true, error: null })       // default fallback

    const raceSb = {
      rpc: mockReserve,
      from: mockSb.from,
    }

    // Execute both "simultaneously"
    const [result1, result2] = await Promise.all([
      reserveStockForOrder(raceSb, 'order-789', 'customer-1'),
      reserveStockForOrder(raceSb, 'order-790', 'customer-1'),
    ])

    expect(result1).toBe(true)
    expect(result2).toBe(false)
    expect(mockReserve).toHaveBeenCalledTimes(2)
  })

  it('should not corrupt stock state after failed reservation', async () => {
    // Simulate: first reserve succeeds, second fails (race condition)
    const mockReserve = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValue({ data: true, error: null })  // default fallback

    const raceSb = {
      rpc: mockReserve,
      from: mockSb.from,
    }

    // First order reserves successfully
    const firstOk = await reserveStockForOrder(raceSb, 'order-789', 'customer-1')
    expect(firstOk).toBe(true)

    // Second order attempt fails (race condition — stock already reserved)
    const secondOk = await reserveStockForOrder(raceSb, 'order-790', 'customer-1')
    expect(secondOk).toBe(false)

    // First order's reservation is still valid
    const firstStillValid = await reserveStockForOrder(raceSb, 'order-789', 'customer-1')
    expect(firstStillValid).toBe(true)

    expect(mockReserve).toHaveBeenCalledTimes(3)
  })
})
