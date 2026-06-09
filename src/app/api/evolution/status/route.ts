import { NextResponse } from 'next/server'
import { getConnectionState, fetchInstances } from '@/lib/evolution/evolution-api'

export async function GET() {
  const instanceName = process.env.EVOLUTION_INSTANCE || 'concierge-wpp'

  try {
    const instances = await fetchInstances()
    const existing = instances.find((i: any) => i.name === instanceName)

    if (!existing) {
      return NextResponse.json({ instance: { state: 'close' } })
    }

    const state = await getConnectionState(instanceName)
    return NextResponse.json({ instance: state ?? { state: 'close' } })
  } catch (err) {
    console.error('[EVO STATUS]', err)
    return NextResponse.json({ instance: { state: 'close' } })
  }
}
