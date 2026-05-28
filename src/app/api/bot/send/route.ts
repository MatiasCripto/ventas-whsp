import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { sendText } from '@/lib/bot/evolution-client'
import { saveMessage } from '@/lib/bot/conversation-engine'

export async function POST(req: NextRequest) {
  try {
    const { conversationId, phone, message } = await req.json()
    if (!phone || !message) return NextResponse.json({ error: 'phone and message required' }, { status: 400 })

    await sendText(phone, message)
    if (conversationId) await saveMessage(conversationId, 'outbound', message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
