// ── Payment Settings Service ──────────────────────────────────
// Reads store payment configuration from DB.
// EXCLUSIVELY uses payment_accounts. NO legacy fallback.
// The IA NEVER generates payment data — this service fetches it from the DB.

import { chooseBestAccount, formatAccountMessage } from '@/lib/services/payment-account.service'
import type { PaymentAccount } from '@/lib/types'

export type ResolvedPaymentData = {
  bank_name: string
  account_holder: string
  alias: string | null
  cvu: string | null
  payment_notes?: string | null
  source: 'payment_accounts'
}

/**
 * Get active payment data for an organization.
 * Uses chooseBestAccount for smart multi-account selection.
 */
export async function getStorePaymentSettings(
  sb: any,
  storeId: string,
  orgId?: string,
): Promise<ResolvedPaymentData | null> {
  console.log('[PAYMENT_SETTINGS] lookup — organizationId:', orgId, 'storeId:', storeId)

  if (!orgId) {
    console.log('[PAYMENT_SETTINGS] no orgId provided — skipping')
    return null
  }

  try {
    const account = await chooseBestAccount(sb, orgId)
    if (!account) {
      console.log('[PAYMENT_SETTINGS] no active account found for org:', orgId)
      return null
    }

    console.log('[PAYMENT_SETTINGS] account found:', account.bank_name, '| priority:', account.priority)

    return {
      bank_name: account.bank_name,
      account_holder: account.account_holder,
      alias: account.alias,
      cvu: account.cvu,
      source: 'payment_accounts',
    }
  } catch (err) {
    console.error('[PAYMENT_SETTINGS] error:', err)
    return null
  }
}

/**
 * Format payment data into a readable WhatsApp message.
 * Pure function — no side effects.
 */
export function formatPaymentSettings(settings: ResolvedPaymentData): string {
  const lines: string[] = ['Perfecto 😊\n', 'Te paso los datos para realizar la transferencia:\n']

  if (settings.bank_name) lines.push(`🏦 Banco: ${settings.bank_name}`)
  if (settings.account_holder) lines.push(`👤 Titular: ${settings.account_holder}`)
  if (settings.alias) lines.push(`🔑 Alias: ${settings.alias}`)
  if (settings.cvu) lines.push(`💳 CVU: ${settings.cvu}`)
  if (settings.payment_notes) lines.push(`\n📝 ${settings.payment_notes}`)

  lines.push('\nCuando realices el pago enviame el comprobante por acá 📸')

  return lines.join('\n')
}
