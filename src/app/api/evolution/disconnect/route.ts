import { NextResponse } from 'next/server'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'concierge'

export async function GET() {
  try {
    const res = await fetch(`${BASE_URL}/instance/logout/${INSTANCE}`, {
      headers: { apikey: API_KEY },
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
