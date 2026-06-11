// ── AES-256-GCM Encryption Utility ─────────────────────────────
// Used to encrypt sensitive data (AI API keys) at rest in the DB.
// Encrypted values are prefixed with "enc:" to distinguish them
// from legacy plaintext values during migration.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const ENCRYPTED_PREFIX = 'enc:'

function deriveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY must be at least 16 characters long. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  // Derive a 32-byte (256-bit) key via SHA-256
  return createHash('sha256').update(raw, 'utf-8').digest()
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string prefixed with "enc:" that can be stored in the DB.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  // Format: enc:base64(iv + ciphertext + tag)
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    Buffer.from(authTag, 'hex'),
  ]).toString('base64')

  return ENCRYPTED_PREFIX + combined
}

/**
 * Decrypt a string that was encrypted with encrypt().
 * Supports legacy plaintext values (no "enc:" prefix) for backward
 * compatibility during the migration from plaintext to encrypted.
 */
export function decrypt(encrypted: string): string {
  // Legacy plaintext — not encrypted
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    return encrypted
  }

  const key = deriveKey()
  const combined = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64')

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf-8')
  return decrypted
}

/**
 * Check if a value has been encrypted with the enc: prefix.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}
