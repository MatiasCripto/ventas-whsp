import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runPaymentReminders } from '@/lib/workflows/payment-reminder.workflow'

const JOB_SECRET = process.env.JOB_SECRET

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (JOB_SECRET && auth !== JOB_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = createServiceClient()
    const sent = await runPaymentReminders(sb)

    console.log('[CRON] send-payment-reminders completed:', { sent })
    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    console.error('[CRON] send-payment-reminders error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
