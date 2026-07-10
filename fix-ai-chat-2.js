const fs = require('fs');
const path = 'c:/Users/elpol/Desktop/SKILLS CLAUDE CODE/kit-automatizaciones-n8n/varios/ventas-whsp/src/lib/bot/ai-chat.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix line 91: replace template literal refs with static text
content = content.replace(
  'Si los productos tienen variantes (${attr1Label} / ${attr2Label}) → pregunta por ${attr1Label.toLowerCase()} y ${attr2Label.toLowerCase()} antes de confirmar',
  "Si los productos tienen variantes (talle, color, etc.) → pregunta qué variante prefiere antes de confirmar"
);

// 2. Fix line 92: replace template literal refs with static text
content = content.replace(
  'Usa los terminos "${attr1Label}" y "${attr2Label}" cuando hables de variantes de productos',
  'Usá los términos de las variantes tal como aparecen en el contexto (ej: "Talle", "Color", "Medida")'
);

// 3. Fix line 96: replace template literal references
content = content.replace(
  'Confirma siempre: ${attr1Label.toLowerCase()}, ${attr2Label.toLowerCase()} y cantidad antes de iniciar checkout',
  'Confirma siempre la variante y cantidad antes de iniciar checkout'
);

// 4. Fix line 98: replace template literal references
content = content.replace(
  'Inclui los items en action.items con productName EXACTO del contexto, quantity, "${attr1Label.toLowerCase()}" y "${attr2Label.toLowerCase()}"',
  'Incluí los items en action.items con productName EXACTO del contexto, quantity, y attribute_values (objeto con los atributos de la variante, ej: {"Color":"Rojo","Talle":"M"})'
);

// 5. Fix lines 217-218: remove attr1Label/attr2Label declarations
content = content.replace(
  "  const attr1Label = (ctx.orgSettings as Record<string, any>)?.attr1Label ?? 'Variante 1'\n  const attr2Label = (ctx.orgSettings as Record<string, any>)?.attr2Label ?? 'Variante 2'\n",
  '  // Variant labels are dynamic — shown via attribute_values in product data\n'
);

// 6. Fix the [a1, a2] join line
content = content.replace(
  '${[a1, a2].filter(Boolean).join(\' / \')}',
  '${attrStr}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('All fixes applied');
