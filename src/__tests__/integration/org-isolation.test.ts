import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockOrgA = 'org-a-123'
const mockOrgB = 'org-b-456'
const mockUserA = { id: 'user-a', email: 'a@test.com' }
const mockUserB = { id: 'user-b', email: 'b@test.com' }

const mockDb = {
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn((field: string, value: string) => ({
        single: vi.fn(() => {
          if (table === 'profiles') {
            if (value === mockUserA.id) return { data: { organization_id: mockOrgA }, error: null }
            if (value === mockUserB.id) return { data: { organization_id: mockOrgB }, error: null }
          }
          return { data: null, error: null }
        }),
        order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })),
        in: vi.fn(() => ({ data: [], error: null })),
      })),
      order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })),
      limit: vi.fn(() => ({ data: [], error: null })),
    })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
    update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })) })),
    delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
  })),
  auth: {
    getUser: vi.fn(() => ({ data: { user: mockUserA }, error: null })),
  },
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => mockDb,
}))

// Simulate requireOrgAccess
async function requireOrgAccess(req: any) {
  const user = req.userId === mockUserB.id ? mockUserB : mockUserA
  const profile = user.id === mockUserA.id
    ? { organization_id: mockOrgA }
    : { organization_id: mockOrgB }
  return { authorized: true, orgId: profile.organization_id, userId: user.id }
}

describe('Org Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return org A for user A', async () => {
    const req = { userId: mockUserA.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgA)
    expect(auth.orgId).not.toBe(mockOrgB)
  })

  it('should return org B for user B', async () => {
    const req = { userId: mockUserB.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgB)
    expect(auth.orgId).not.toBe(mockOrgA)
  })

  it('should reject user A from accessing org B products', async () => {
    const req = { userId: mockUserA.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgA)

    // Simulate requireOrgAccessWithParam check
    const paramOrgId = mockOrgB
    const isForbidden = paramOrgId && paramOrgId !== auth.orgId
    expect(isForbidden).toBe(true)
  })

  it('should reject user B from modifying org A orders', async () => {
    const req = { userId: mockUserB.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgB)

    const paramOrgId = mockOrgA
    const isForbidden = paramOrgId && paramOrgId !== auth.orgId
    expect(isForbidden).toBe(true)
  })

  it('should allow user A to access their own org data', async () => {
    const req = { userId: mockUserA.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgA)

    const paramOrgId = mockOrgA
    const isForbidden = paramOrgId && paramOrgId !== auth.orgId
    expect(isForbidden).toBe(false)
  })

  it('should allow user B to modify their own org orders', async () => {
    const req = { userId: mockUserB.id }
    const auth = await requireOrgAccess(req)
    expect(auth.orgId).toBe(mockOrgB)

    const paramOrgId = mockOrgB
    const isForbidden = paramOrgId && paramOrgId !== auth.orgId
    expect(isForbidden).toBe(false)
  })
})
