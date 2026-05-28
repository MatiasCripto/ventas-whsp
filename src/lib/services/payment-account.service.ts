// ── Payment Account Service ───────────────────────────────────
// Business logic for selecting the best payment account.

import { getActiveAccounts } from '@/lib/repositories/payment-account.repository'
import type { PaymentAccount } from '@/lib/types'

export interface AccountSelectionOptions {
  paymentMethod?: string
  currency?: string
}

/**
 * Choose the best payment account based on method, currency, and priority.
 * Falls back to default, then highest priority, then first active.
 */
export async function chooseBestAccount(
  sb: any,
  orgId: string,
  options?: AccountSelectionOptions,
): Promise<PaymentAccount | null> {
  const accounts = await getActiveAccounts(sb, orgId)
  if (!accounts.length) return null

  const { paymentMethod, currency } = options ?? {}

  // Try to find exact match on both method and currency
  if (paymentMethod && currency) {
    const match = accounts.find(a =>
      a.payment_method === paymentMethod && a.currency === currency
    )
    if (match) return match
  }

  // Try method match only
  if (paymentMethod) {
    const match = accounts.find(a => a.payment_method === paymentMethod)
    if (match) return match
  }

  // Try currency match only
  if (currency) {
    const match = accounts.find(a => a.currency === currency)
    if (match) return match
  }

  // Return default account if set
  const defaultAccount = accounts.find(a => a.is_default)
  if (defaultAccount) return defaultAccount

  // Return highest priority
  return accounts[0]
}

/**
 * Format payment account into WhatsApp-friendly message.
 */
export function formatAccountMessage(account: PaymentAccount): string {
  const lines: string[] = ['Perfecto 😊\n', 'Te paso los datos para realizar la transferencia:\n']

  if (account.bank_name) lines.push(`🏦 Banco: ${account.bank_name}`)
  if (account.account_holder) lines.push(`👤 Titular: ${account.account_holder}`)
  if (account.alias) lines.push(`🔑 Alias: ${account.alias}`)
  if (account.cvu) lines.push(`💳 CVU: ${account.cvu}`)
  if (account.instructions) lines.push(`\n📝 ${account.instructions}`)

  lines.push('\nCuando realices el pago enviame el comprobante por acá 📸')

  return lines.join('\n')
}
