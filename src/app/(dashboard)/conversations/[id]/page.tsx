'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { ArrowLeft, Phone, User } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatters'
import type { Conversation, Message } from '@/lib/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:   { label: 'Abierta',  color: '#065f46', bg: '#f0fdf4' },
  closed: { label: 'Cerrada',  color: '#991b1b', bg: '#fef2f2' },
  bot:    { label: 'Bot activo', color: '#5b21b6', bg: '#f5f3ff' },
  human:  { label: 'Humano',   color: '#1e40af', bg: '#eff6ff' },
}

export default function ConversationDetailPage() {
  const { authUser } = useAuthContext()
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId || !params.id) return
    async function load() {
      try {
        const sb = createServiceClient()
        const { data: conv } = await sb.from('conversations')
          .select('*, customer:customers(full_name, phone, email)')
          .eq('id', params.id as string).eq('organization_id', orgId).single()
        if (conv) {
          setConversation(conv as unknown as Conversation)
          const { data: msgs } = await sb.from('messages')
            .select('*').eq('conversation_id', conv.id)
            .order('sent_at', { ascending: true }).limit(100)
          setMessages((msgs ?? []) as Message[])
        }
      } catch {
        // dev mode — Supabase not available
      }
      setLoading(false)
    }
    load()
  }, [authUser, params.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
  if (!conversation) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Conversación no encontrada</div>

  const sc = STATUS_CONFIG[conversation.status] ?? STATUS_CONFIG.open

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <a href="/conversations" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={18} />
        </a>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'var(--brand)' }}>
            {conversation.customer?.full_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {conversation.customer?.full_name ?? 'Desconocido'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {conversation.customer?.phone && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                  <Phone size={10} /> {conversation.customer.phone}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
                style={{ background: sc.bg, color: sc.color }}>
                {sc.label}
              </span>
              {conversation.channel && (
                <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                  vía {conversation.channel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="card p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
            Sin mensajes en esta conversación
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-[var(--radius-lg)] px-4 py-2.5 ${
                  m.direction === 'inbound'
                    ? 'rounded-bl-sm'
                    : 'rounded-br-sm'
                }`}
                style={{
                  background: m.direction === 'inbound' ? 'var(--surface-2)' : 'var(--brand)',
                  color: m.direction === 'inbound' ? 'var(--foreground)' : '#fff',
                }}
              >
                {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                <p className={`text-[10px] mt-1 ${m.direction === 'inbound' ? 'text-left' : 'text-right'}`}
                  style={{ opacity: 0.6 }}>
                  {formatDateTime(m.sent_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context info */}
      {conversation.context && Object.keys(conversation.context as object).length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-2">Contexto de la conversación</h2>
          <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
            {JSON.stringify(conversation.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
