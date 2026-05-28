'use client'

import { useAuthContext } from '@/lib/hooks/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Phone, Globe } from 'lucide-react'
import { formatRelative } from '@/lib/utils/formatters'

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <Phone size={14} />,
  instagram: <MessageSquare size={14} />,
  web: <Globe size={14} />,
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:   { label: 'Abierta',  color: '#065f46', bg: '#f0fdf4' },
  closed: { label: 'Cerrada',  color: '#991b1b', bg: '#fef2f2' },
  bot:    { label: 'Bot activo', color: '#5b21b6', bg: '#f5f3ff' },
  human:  { label: 'Humano',   color: '#1e40af', bg: '#eff6ff' },
}

interface ConvRow {
  id: string
  channel: string
  status: string
  human_takeover: boolean
  last_message_at: string | null
  created_at: string
  customer: { full_name: string; phone: string | null } | null
  messages: { body: string }[] | null
}

export default function ConversationsPage() {
  const { authUser } = useAuthContext()
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const orgId = authUser?.organization?.id
    if (!orgId) return
    async function load() {
      try {
        const sb = createClient()
        let query = sb.from('conversations')
          .select('id, channel, status, human_takeover, last_message_at, created_at, customer:customers(full_name, phone), messages:messages(body)')
          .eq('organization_id', orgId)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(50)

        if (filter) {
          if (filter === 'human') query = query.eq('human_takeover', true)
          else query = query.eq('status', filter)
        }

        const { data } = await query
        setConvs((data ?? []) as unknown as ConvRow[])
      } catch {
        // Dev mode â€” empty state
      }
      setLoading(false)
    }
    load()
  }, [authUser, filter])

  const statuses = ['', 'open', 'bot', 'human', 'closed']

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Conversaciones</h1>

      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-[var(--radius-full)] text-xs font-medium transition-colors ${
              filter === s ? 'text-white' : ''
            }`}
            style={{
              background: filter === s ? 'var(--brand)' : 'var(--surface-2)',
              color: filter === s ? '#fff' : 'var(--muted)',
            }}
          >
            {s ? STATUS_CONFIG[s]?.label ?? s : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>
      ) : convs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay conversaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {convs.map(c => {
            const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.open
            const lastMsg = c.messages?.[0]?.body ?? ''
            return (
              <div key={c.id}
                className="card card-hover p-4 flex items-start gap-4 cursor-pointer"
                onClick={() => window.location.href = `/conversations/${c.id}`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}
                >
                  {c.customer?.full_name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.customer?.full_name ?? 'Desconocido'}</span>
                    {CHANNEL_ICONS[c.channel] && (
                      <span style={{ color: 'var(--subtle)' }}>{CHANNEL_ICONS[c.channel]}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.label}
                    </span>
                    {c.human_takeover && (
                      <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] font-medium"
                        style={{ background: '#eff6ff', color: '#1e40af' }}
                      >
                        Humano
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>
                      {lastMsg}
                    </p>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--subtle)' }}>
                  {c.last_message_at ? formatRelative(c.last_message_at) : formatRelative(c.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

