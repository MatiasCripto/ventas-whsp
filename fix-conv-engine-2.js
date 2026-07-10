const fs = require('fs');
const path = 'c:/Users/elpol/Desktop/SKILLS CLAUDE CODE/kit-automatizaciones-n8n/varios/ventas-whsp/src/lib/bot/conversation-engine.ts';
let content = fs.readFileSync(path, 'utf8');

let n = 0;

// 1. fetchCustomerHistory attr2/attr1 mapping (lines 226-227)
const r = content.replace(
  '        attr2: i.variant?.attr2,\n        attr1: i.variant?.attr1,',
  '        attribute_values: i.variant?.attribute_values,'
);
if (r !== content) { n++; content = r; }

// 2. fetchCart attr1/attr2 mapping (lines 258-259)
const r2 = content.replace(
  '    attr1: i.variant?.attr1,\n    attr2: i.variant?.attr2,',
  '    attribute_values: i.variant?.attribute_values,'
);
if (r2 !== content) { n++; content = r2; }

// 3. resolveProductVariant matching logic (2x, lines 330-331 and 353-354)
// Use a regex with g flag for both
const r3 = content.replace(
  '        (!item.attr2 || v.attr2?.toLowerCase() === item.attr2.toLowerCase()) &&\n        (!item.attr1 || v.attr1?.toLowerCase() === item.attr1.toLowerCase())',
  '        (!item.attribute_values || Object.entries(item.attribute_values).every(([key, val]) =>\n          v.attribute_values?.[key]?.toLowerCase() === val.toLowerCase()))'
);
if (r3 !== content) { n++; content = r3; }
// Second occurrence
const r3b = content.replace(
  '        (!item.attr2 || v.attr2?.toLowerCase() === item.attr2.toLowerCase()) &&\n        (!item.attr1 || v.attr1?.toLowerCase() === item.attr1.toLowerCase())',
  '        (!item.attribute_values || Object.entries(item.attribute_values).every(([key, val]) =>\n          v.attribute_values?.[key]?.toLowerCase() === val.toLowerCase()))'
);
if (r3b !== content) { n++; content = r3b; }

// 4. handleCheckout variant label (line 466)
const r4 = content.replace(
  "const label = [variant.attr1, variant.attr2].filter(Boolean).join(' / ');",
  "const label = variant.attribute_values ? Object.values(variant.attribute_values).filter(Boolean).join(' / ') : '';"
);
if (r4 !== content) { n++; content = r4; }

// 5. Look for any remaining attr1/attr2 patterns that might need fixing
// Check the signature line in resolveProductVariant
const r5 = content.replace(
  'item: { productName?: string; productId?: string; variantId?: string; attr1?: string; attr2?: string }',
  'item: { productName?: string; productId?: string; variantId?: string; attribute_values?: Record<string, string> }'
);
if (r5 !== content) { n++; content = r5; }

fs.writeFileSync(path, content, 'utf8');
console.log(`${n} patterns fixed`);
