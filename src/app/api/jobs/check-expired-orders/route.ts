import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runExpirationCheck } from '@/lib/workflows/order-expiration-check.workflow'

const JOB_SECRET = process.env.JOB_SECRET

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!JOB_SECRET) {
    return NextResponse.json({ error: 'Job secret not configured' }, { status: 503 })
  }
  if (auth !== JOB_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = createServiceClient()
    const result = await runExpirationCheck(sb)

    console.log('[CRON] check-expired-orders completed:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[CRON] check-expired-orders error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
