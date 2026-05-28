import { format, formatDistanceToNow, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { OrderStatus, PaymentStatus, RfmSegment, ChurnRisk } from '@/lib/types'

// ============================================================
// Date & Time
// ============================================================

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return `Hoy ${format(d, 'HH:mm')}`
  if (isTomorrow(d)) return `Mañana ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Ayer ${format(d, 'HH:mm')}`
  return formatDistanceToNow(d, { addSuffix: true, locale: es })
}

// ============================================================
// Currency
// ============================================================

export function formatCurrency(amount: number | null, currency = 'ARS'): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ============================================================
// Names & Initials
// ============================================================

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

// ============================================================
// Order Status
// ============================================================

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:             { label: 'Pendiente',           color: '#92400e', bg: '#fffbeb' },
  awaiting_payment:    { label: 'Esperando pago',      color: '#92400e', bg: '#fffbeb' },
  payment_under_review:{ label: 'Pago en revisión',    color: '#1e40af', bg: '#eff6ff' },
  payment_confirmed:   { label: 'Pago confirmado',     color: '#065f46', bg: '#f0fdf4' },
  payment_rejected:    { label: 'Pago rechazado',       color: '#991b1b', bg: '#fef2f2' },
  preparing:           { label: 'Preparando',          color: '#1e40af', bg: '#eff6ff' },
  shipped:             { label: 'Enviado',             color: '#5b21b6', bg: '#f5f3ff' },
  delivered:           { label: 'Entregado',           color: '#065f46', bg: '#f0fdf4' },
  completed:           { label: 'Completado',          color: '#065f46', bg: '#f0fdf4' },
  cancelled:           { label: 'Cancelado',           color: '#991b1b', bg: '#fef2f2' },
  refunded:            { label: 'Reembolsado',         color: '#374151', bg: '#f3f4f6' },
  expired:             { label: 'Expirado',            color: '#6b7280', bg: '#f3f4f6' },
}

export function getOrderStatusConfig(status: OrderStatus) {
  return ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.pending
}

// ============================================================
// Payment Status
// ============================================================

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendiente',     color: '#92400e', bg: '#fffbeb' },
  awaiting:    { label: 'Esperando',     color: '#92400e', bg: '#fffbeb' },
  under_review:{ label: 'En revisión',   color: '#1e40af', bg: '#eff6ff' },
  confirmed:   { label: 'Confirmado',    color: '#065f46', bg: '#f0fdf4' },
  paid:        { label: 'Pagado',        color: '#065f46', bg: '#f0fdf4' },
  failed:      { label: 'Fallido',       color: '#991b1b', bg: '#fef2f2' },
  refunded:    { label: 'Reembolsado',    color: '#374151', bg: '#f3f4f6' },
}

export function getPaymentStatusConfig(status: PaymentStatus) {
  return PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.pending
}

// ============================================================
// RFM Segments
// ============================================================

const RFM_CONFIG: Record<RfmSegment, { label: string; color: string; bg: string; description: string }> = {
  champion:     { label: 'Campeón',      color: '#065f46', bg: '#f0fdf4', description: 'Compra frecuente y reciente' },
  loyal:        { label: 'Leal',         color: '#1e40af', bg: '#eff6ff', description: 'Cliente estable de largo plazo' },
  at_risk:      { label: 'En riesgo',    color: '#92400e', bg: '#fffbeb', description: 'Fue frecuente, ahora inactivo' },
  new_customer: { label: 'Nuevo',        color: '#5b21b6', bg: '#f5f3ff', description: 'Primera o segunda compra' },
  dormant:      { label: 'Dormido',      color: '#374151', bg: '#f9fafb', description: 'Sin actividad reciente' },
  lost:         { label: 'Perdido',      color: '#991b1b', bg: '#fef2f2', description: 'Sin actividad en mucho tiempo' },
}

export function getRfmConfig(segment: RfmSegment) {
  return RFM_CONFIG[segment] ?? RFM_CONFIG.dormant
}

// ============================================================
// Churn
// ============================================================

const CHURN_CONFIG: Record<ChurnRisk, { label: string; color: string }> = {
  low:     { label: 'Estable',      color: '#10b981' },
  medium:  { label: 'Riesgo medio', color: '#f59e0b' },
  high:    { label: 'Alto riesgo',  color: '#ef4444' },
  churned: { label: 'Perdido',      color: '#6b7280' },
}

export function getChurnConfig(risk: ChurnRisk) {
  return CHURN_CONFIG[risk] ?? CHURN_CONFIG.low
}

// ============================================================
// Percentage
// ============================================================

export function formatPct(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}
