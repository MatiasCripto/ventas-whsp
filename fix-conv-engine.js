const fs = require('fs');
const path = 'c:/Users/elpol/Desktop/SKILLS CLAUDE CODE/kit-automatizaciones-n8n/varios/ventas-whsp/src/lib/bot/conversation-engine.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. SQL SELECT patterns: attr1, attr2 -> attribute_values (3 occurrences)
content = content.replace(/attr1, attr2/g, 'attribute_values');

// 2. fetchCustomerHistory: color, size, -> attribute_values,
content = content.replace('color, size,', 'attribute_values,');

// 3. fetchCustomerHistory: the attr2/attr1 result mapping (2 lines)
content = content.replace(
  '        attr2: i.variant?.attr2,\n        attr1: i.variant?.attr1,',
  '        attribute_values: i.variant?.attribute_values,'
);

// 4. fetchCart: attr1, attr2 in the variant mapping
content = content.replace(
  'attr1: i.variant?.attr1,\n        attr2: i.variant?.attr2,',
  'attribute_values: i.variant?.attribute_values,'
);

// 5. resolveProductVariant function signature
content = content.replace(
  'item: { productName?: string; productId?: string; variantId?: string; attr1?: string; attr2?: string }',
  'item: { productName?: string; productId?: string; variantId?: string; attribute_values?: Record<string, string> }'
);

// 6. resolveProductVariant matching logic (2 occurrences - same pattern used twice)
content = content.replaceAll(
  '(!item.attr2 || v.attr2?.toLowerCase() === item.attr2.toLowerCase()) &&\n        (!item.attr1 || v.attr1?.toLowerCase() === item.attr1.toLowerCase())',
  '(!item.attribute_values || Object.entries(item.attribute_values).every(([key, val]) =>\n          v.attribute_values?.[key]?.toLowerCase() === val.toLowerCase()))'
);

// 7. handleCheckout variant label
content = content.replace(
  "const label = [variant.attr1, variant.attr2].filter(Boolean).join(' / ');",
  "const label = variant.attribute_values ? Object.values(variant.attribute_values).filter(Boolean).join(' / ') : '';"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
