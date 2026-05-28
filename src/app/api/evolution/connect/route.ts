import { NextResponse } from 'next/server'
import { getQrCode } from '@/lib/bot/evolution-client'

export async function GET() {
  try {
    const data = await getQrCode()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
