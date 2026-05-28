import { NextResponse } from 'next/server'
import { getInstanceStatus } from '@/lib/bot/evolution-client'

export async function GET() {
  try {
    const data = await getInstanceStatus()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
