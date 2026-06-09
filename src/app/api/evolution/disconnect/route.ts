import { NextResponse } from 'next/server'
import { logoutInstance } from '@/lib/evolution/evolution-api'

export async function GET() {
  const instanceName = process.env.EVOLUTION_INSTANCE || 'concierge-wpp'

  try {
    await logoutInstance(instanceName)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[EVO DISCONNECT]', err)
    return NextResponse.json({ ok: true })
  }
}
