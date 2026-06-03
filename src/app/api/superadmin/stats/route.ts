import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySuperadmin } from '@/lib/superadmin/auth'

export async function GET(req: NextRequest) {
  const auth = await verifySuperadmin(req)
  if (!auth.authorized) return auth.response

  try {
    const sb = createServiceClient()

    const { count: totalOrganizations } = await sb
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)

    const { count: totalStores } = await sb
      .from('stores')
      .select('id', { count: 'exact', head: true })

    const { count: totalOrders } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })

    const { count: totalCustomers } = await sb
      .from('customers')
      .select('id', { count: 'exact', head: true })

    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count: organizationsThisMonth } = await sb
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth)

    return NextResponse.json({
      total_organizations: totalOrganizations ?? 0,
      total_stores: totalStores ?? 0,
      total_orders: totalOrders ?? 0,
      total_customers: totalCustomers ?? 0,
      organizations_this_month: organizationsThisMonth ?? 0,
    })
  } catch (err) {
    console.error('[SUPERADMIN] stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
