/**
 * Structured logging helper for Concierge AI.
 * Every log line includes org_id, conversation_id, and timestamp ISO.
 * Use in place of console.log in production code paths.
 */

type LogMeta = {
  orgId?: string | null
  conversationId?: string | null
  storeId?: string | null
  phone?: string | null
  [key: string]: unknown
}

function iso(): string {
  return new Date().toISOString()
}

function prefix(tag: string): string {
  return `[${tag}]`
}

export function logInfo(tag: string, message: string, meta?: LogMeta) {
  const base = { ts: iso(), ...meta }
  console.log(prefix(tag), message, JSON.stringify(base))
}

export function logWarn(tag: string, message: string, meta?: LogMeta) {
  const base = { ts: iso(), ...meta }
  console.warn(prefix(tag), message, JSON.stringify(base))
}

export function logError(tag: string, message: string, err?: unknown, meta?: LogMeta) {
  const base = {
    ts: iso(),
    error: err instanceof Error ? err.message : String(err ?? ''),
    stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('; ') : undefined,
    ...meta,
  }
  console.error(prefix(tag), message, JSON.stringify(base))
}
