import { randomBytes } from 'crypto'

export function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '#@!$'
  const bytes = randomBytes(12)
  let password = ''
  password += upper[bytes[0] % upper.length]
  password += symbols[bytes[1] % symbols.length]
  const all = upper + lower + numbers
  for (let i = 2; i < 12; i++) {
    password += all[bytes[i] % all.length]
  }
  return password
}

export function getVariantAttrs(_rubro: string): {
  attr1: string
  attr2: string
} {
  // Legacy: previously mapped rubro → attr1/attr2 labels.
  // In the new dynamic system, variant attributes are stored in
  // product_variants.attribute_values JSONB.
  // Keeping function signature for backward compat, but returning generic labels.
  const map: Record<string, { attr1: string; attr2: string }> = {
    ropa:        { attr1: 'Talle',     attr2: 'Color' },
    calzado:     { attr1: 'Número',    attr2: 'Color' },
    electronica: { attr1: 'Capacidad', attr2: 'Color' },
    muebles:     { attr1: 'Material',  attr2: 'Medida' },
    alimentos:   { attr1: 'Peso',      attr2: 'Sabor' },
    ferreteria:  { attr1: 'Medida',    attr2: 'Material' },
    otro:        { attr1: 'Variante 1',attr2: 'Variante 2' },
  }
  return map[_rubro] ?? map['otro']
}
