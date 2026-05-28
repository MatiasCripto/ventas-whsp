import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { releaseExpiredReservations } from '@/lib/services/stock-reservation.service'

const JOB_SECRET = process.env.JOB_SECRET

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (JOB_SECRET && auth !== JOB_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = createServiceClient()
    const released = await releaseExpiredReservations(sb)

    console.log('[CRON] release-expired-reservations completed:', { released })
    return NextResponse.json({ ok: true, released })
  } catch (err) {
    console.error('[CRON] release-expired-reservations error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
