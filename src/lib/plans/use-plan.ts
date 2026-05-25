// ── Plan Enforcement ────────────────────────────────────────
// Client-side plan gates. Server-side enforcement is in the API routes.
// REUSED pattern from Clinify.

type PlanTier = 'starter' | 'growth' | 'pro' | 'enterprise'

interface PlanLimits {
  stores: number
  products: number
  teamMembers: number
  automations: boolean
  analytics: boolean
  apiAccess: boolean
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter:     { stores: 1, products: 100,  teamMembers: 1,  automations: false, analytics: false, apiAccess: false },
  growth:      { stores: 3, products: 1000, teamMembers: 5,  automations: true,  analytics: true,  apiAccess: false },
  pro:         { stores: 10, products: 10000, teamMembers: 20, automations: true, analytics: true, apiAccess: true },
  enterprise:  { stores: 999, products: 999999, teamMembers: 999, automations: true, analytics: true, apiAccess: true },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanTier] ?? PLAN_LIMITS.starter
}

export function canAddStore(currentCount: number, plan: string): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.stores
}

export function canAddProduct(currentCount: number, plan: string): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.products
}

export function canAddTeamMember(currentCount: number, plan: string): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.teamMembers
}

export function hasFeature(feature: 'automations' | 'analytics' | 'apiAccess', plan: string): boolean {
  const limits = getPlanLimits(plan)
  return limits[feature]
}

export function getPlanName(plan: string): string {
  const names: Record<string, string> = {
    starter: 'Starter',
    growth: 'Growth',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return names[plan] ?? plan
}
