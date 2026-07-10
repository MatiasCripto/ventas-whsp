const fs = require('fs');
const path = 'c:/Users/elpol/Desktop/SKILLS CLAUDE CODE/kit-automatizaciones-n8n/varios/ventas-whsp/src/lib/bot/ai-chat.ts';
let content = fs.readFileSync(path, 'utf8');

let changed = 0;

// 1. Fix customer history line
const old1 = '`  - ${h.productName} (${attr1Label.toLowerCase()}: ${h.attr1 ?? \'N/A\'}, ${attr2Label.toLowerCase()}: ${h.attr2 ?? \'N/A\'}) — ${h.date}`';
// Escape $ for regex (it's a metacharacter)
const escaped1 = old1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const new1 = "`  - ${h.productName} (${h.attribute_values ? Object.values(h.attribute_values).filter(Boolean).join(' / ') : 'N/A'}) — ${h.date}`";
if (content.includes(old1)) {
  content = content.replace(old1, new1);
  changed++;
  console.log('Fix 1 applied: customer history');
} else {
  console.log('Fix 1 NOT FOUND');
}

// 2. Fix variant display — two lines: a1 and a2 assignments
const old2a = 'const a1 = v.attr1 ? `${attr1Label}: ${v.attr1}` : \'\'';
const old2b = 'const a2 = v.attr2 ? `${attr2Label}: ${v.attr2}` : \'\'';
const new2 = "const attrStr = v.attribute_values ? Object.entries(v.attribute_values).map(([k, val]) => `${k}: ${val}`).join(' | ') : ''";

if (content.includes(old2a) && content.includes(old2b)) {
  content = content.replace(old2a, new2);
  content = content.replace(old2b, '');
  changed++;
  console.log('Fix 2 applied: variant display');
} else {
  console.log('Fix 2 NOT FOUND');
  console.log('  old2a found:', content.includes(old2a));
  console.log('  old2b found:', content.includes(old2b));
}

// 3. Fix the [a1, a2].join line
const old3 = '[a1, a2].filter(Boolean).join(\' / \')';
// Escape for regex
// Actually just use string match, not regex
if (content.includes(old3)) {
  content = content.replace(old3, 'attrStr');
  changed++;
  console.log('Fix 3 applied: join line');
} else {
  console.log('Fix 3 NOT FOUND');
}

// 4. Fix order items display
const old4 = 'i.variant?.attr1 ?? \'\'} ${i.variant?.attr2 ?? \'\'})`';
const new4 = "i.variant?.attribute_values ? Object.values(i.variant.attribute_values).filter(Boolean).join(' / ') : ''})`";
if (content.includes(old4)) {
  content = content.replace(old4, new4);
  changed++;
  console.log('Fix 4 applied: order items');
} else {
  console.log('Fix 4 NOT FOUND');
}

// 5. Fix cart items display
const old5 = 'i.attr1 ?? \'\'} ${i.attr2 ?? \'\'})';
if (content.includes(old5)) {
  content = content.replace(old5, "i.attribute_values ? Object.values(i.attribute_values).filter(Boolean).join(' / ') : ''})");
  changed++;
  console.log('Fix 5 applied: cart items');
} else {
  console.log('Fix 5 NOT FOUND');
}

fs.writeFileSync(path, content, 'utf8');
console.log(`\nDone. ${changed} fixes applied.`);
