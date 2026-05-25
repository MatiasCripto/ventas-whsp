# Fase 2: Arquitectura del Sistema — Concierge AI

## Principios Arquitectónicos

1. **La IA conversa, la base de datos decide.** La IA JAMÁS inventa stock, precios, ni disponibilidad.
2. **El inventario es la source of truth.** Todo se valida server-side antes de ejecutar.
3. **Retrieval Commerce Brain.** No mandar catálogos enteros al prompt. Buscar, recuperar, luego generar.
4. **Multi-tenant nativo.** Mismo modelo que Clinify: organizations → stores.
5. **AI-first, rule fallback.** IA genera respuestas, state machine trackea estado.
6. **WhatsApp como canal primario.** Con abstracción para agregar canales después.

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Instagram                             │
│  (post con link wa.me/XXXXXXXXX)                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Evolution API (WhatsApp)                    │
│  Recibe mensaje → Webhook HTTP POST                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Route (webhook)                 │
│                                                         │
│  1. Validar webhook secret                               │
│  2. Rate limiting (30 req/min)                          │
│  3. Load conversation context                           │
│     (in-memory cache → Supabase)                        │
│  4. Run state machine (pure function)                   │
│  5. Fetch commerce data (si aplica)                     │
│  6. Build AI context                                    │
│  7. Call AI provider                                    │
│  8. Parse AI response                                   │
│  9. Execute action (validate server-side)               │
│  10. Save context + message                             │
│  11. Send response via Evolution API                    │
└──────────┬──────────┬──────────┬────────────────────────┘
           │          │          │
           ▼          ▼          ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│   Supabase   │ │   AI     │ │ Evolution│
│  (source of  │ │ Provider │ │  API     │
│   truth)     │ │(OpenAI,  │ │ (send)   │
│              │ │ Claude,  │ │          │
│  - products  │ │ Groq)    │ │          │
│  - variants  │ │          │ │          │
│  - customers │ │          │ │          │
│  - orders    │ │          │ │          │
│  - inventory │ │          │ │          │
└──────────────┘ └──────────┘ └──────────┘
```

---

## Commerce Brain (Retrieval Commerce)

Este es el corazón de la arquitectura. El flujo correcto:

```
Mensaje del cliente
    │
    ▼
1. Intent Extraction
   - ¿Qué quiere? (comprar, consultar, tracking, cancelar)
   - ¿Es pregunta de producto o acción?

    │
    ▼
2. Product Retrieval (si aplica)
   - Full-text search en PostgreSQL
   - Trigram similarity (pg_trgm)
   - Tags + categorías + metadata
   - Si pide "algo parecido a X", buscar tags similares

    │
    ▼
3. Context Builder
   - Productos recuperados + precios + stock
   - Cliente (historial, preferencias, talles)
   - Políticas (envíos, pagos, cambios)
   - Últimos N mensajes de la conversación

    │
    ▼
4. AI Response Generation
   - System prompt + context builder output
   - Modelo: GPT-4o / Claude Sonnet / Groq (configurable)

    │
    ▼
5. Action Execution (server-side validated)
   - add_to_cart → validar stock, precio
   - checkout → validar dirección, pago
   - cancel_order → validar estado
   - track_order → fetch real status

    │
    ▼
6. Response + State Update
```

### Principio Clave
La IA NUNCA ve todo el catálogo. Solo ve los productos que coinciden con la búsqueda del cliente.

Para 10 productos: el prompt incluye 10.
Para 10,000 variantes: el prompt incluye solo los 5-10 relevantes.

---

## Modelo de Datos

### Core Multi-Tenant (REUSADO DE CLINIFY)
```
organizations (id, name, slug, logo_url, plan, settings, trial_*, created_at)
profiles (id, organization_id, full_name, role, avatar_url, is_active)
```

### Comercio (NUEVO)
```
stores (id, organization_id, name, address, phone, whatsapp_number, timezone, settings, is_active)
  ↑ Renombrado de clinics

customers (id, organization_id, store_id, full_name, phone, email, address, notes, 
           whatsapp_id, preferences JSONB, total_orders, lifetime_value, last_order_at, 
           UNIQUE(organization_id, phone))
  ↑ Renombrado + extendido de patients

categories (id, organization_id, name, slug, description, parent_id, image_url, sort_order, is_active)
  ↑ Renombrado de specialties

products (id, organization_id, name, slug, description, category_id, brand, tags TEXT[],
          price, compare_price, images TEXT[], metadata JSONB, is_active, featured, created_at)
  ↑ NUEVA — Catálogo principal

product_variants (id, product_id, sku UNIQUE, color, size, stock, price_override, 
                  images TEXT[], is_active, UNIQUE(product_id, color, size))
  ↑ NUEVA — Stock por variante

product_images (id, product_id, variant_id NULL, url, alt, sort_order)

inventory_movements (id, variant_id, quantity, type ENUM(in/out/adjustment), 
                     reference_type, reference_id, notes, created_at)

orders (id, organization_id, store_id, customer_id, status ENUM, 
        subtotal, shipping_cost, discount, total, 
        payment_method, payment_status, shipping_method, shipping_address, 
        notes, source TEXT DEFAULT 'whatsapp', 
        created_at, updated_at)
  ↑ Reemplazo de appointments

order_items (id, order_id, variant_id, product_name, variant_label, 
             quantity, unit_price, total)
  ↑ Reemplazo de clinical_treatments

carts (id, organization_id, customer_id, session_id, expires_at, 
       UNIQUE(customer_id) — uno por cliente activo)

cart_items (id, cart_id, variant_id, quantity, added_at)

coupons (id, organization_id, code UNIQUE, type ENUM(percentage/fixed), 
         value, min_purchase, max_uses, used_count, expires_at, is_active)

shipping_configs (id, organization_id, name, price, min_order_free, 
                  estimated_days, is_active)
```

### Conversaciones (ADAPTADO DE CLINIFY)
```
conversations (id, organization_id, store_id, customer_id NULL, 
               channel ENUM(whatsapp/instagram/web), 
               channel_contact_id, channel_chat_id,
               status ENUM(open/closed/bot/human), 
               context JSONB, last_message_at, human_takeover BOOLEAN,
               UNIQUE(store_id, channel, channel_chat_id))
  ↑ Unificado: una sola tabla, channel discriminator

messages (id, conversation_id, channel_message_id UNIQUE,
          direction ENUM(inbound/outbound),
          type ENUM(text/image/audio/video),
          body TEXT, media_url TEXT,
          metadata JSONB, sent_at)

automation_logs (id, organization_id, store_id, workflow TEXT, 
                 entity_type, entity_id, status, payload JSONB, 
                 error TEXT, executed_at)
  ↑ Igual que Clinify

faq_knowledge (id, organization_id, question TEXT, answer TEXT, 
               tags TEXT[], category, is_active)
  ↑ NUEVA — Base de conocimiento comercial
```

### Analytics (ADAPTADO DE CLINIFY)
```
customer_scores (id, customer_id, organization_id, 
                 total_orders, total_spent, avg_ticket,
                 recency_days, frequency_count, monetary_value,
                 rfm_segment, churn_risk, ltv_estimated,
                 preferred_categories TEXT[], preferred_sizes TEXT[],
                 computed_at)
  ↑ Renombrado de patient_scores + preferencias comerciales

analytics_daily (id, organization_id, store_id, date,
                 total_orders, total_revenue, avg_order_value,
                 new_customers, returning_customers,
                 top_products JSONB, top_categories JSONB,
                 conversion_rate, abandoned_carts,
                 UNIQUE(store_id, date))
  ↑ Adaptado de analytics_daily
```

### Status Enums
```sql
order_status: pending | confirmed | paid | preparing | shipped | delivered | cancelled
payment_status: pending | paid | failed | refunded
conversation_channel: whatsapp | instagram | web
conversation_status: open | closed | bot | human
inventory_movement_type: in | out | adjustment
coupon_type: percentage | fixed
```

---

## Commerce Brain — Implementación

### PostgreSQL Full-Text Search

```sql
-- Index para búsqueda de productos
ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(array_to_string(tags, ' '),''))
  ) STORED;

CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Trigram similarity para búsqueda aproximada
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
```

### Intent Extraction (regex, no IA)

Patrones de regex para detectar intención sin llamar a IA:

```
COMPRA: "quiero", "comprar", "llevar", "precio", "cuánto", "talle", "color"
CONSULTA: "tenés", "hay", "tienen", "qué", "cómo"
TRACKING: "pedido", "envío", "llegó", "rastrear", "seguimiento"
CANCELAR: "cancelar", "cancelación", "anular"
CATALOGO: "novedades", "nuevo", "catálogo", "productos"
HUMANO: "humano", "persona", "asesor", "hablar con"
```

### Product Retrieval Flow

```
Mensaje: "tenés algo sexy negro?"

→ Intent: consulta_producto
→ Keywords extraídas: ["sexy", "negro"]
→ Search query: to_tsquery('spanish', 'sexy & negro')
→ También: tags ILIKE '%sexy%' OR tags ILIKE '%negro%'
→ También: name ILIKE '%negro%'
→ Result: top 5 productos con stock > 0
→ Context inyectado: "Productos disponibles: [lista con precio, colores, talles]"
→ AI genera respuesta natural
```

---

## Frontend — Estructura de Rutas

```
(dashboard)/
  layout.tsx          ← sidebar + topbar + providers
  overview/
    page.tsx          ← KPIs: ventas hoy, pedidos, clientes nuevos, conversión
    overview-content.tsx
  orders/
    page.tsx
    orders-content.tsx ← Lista de pedidos con filtros (estado, fecha, cliente)
    [id]/
      page.tsx        ← Detalle del pedido + acciones (confirmar, enviar, cancelar)
  products/
    page.tsx
    products-content.tsx ← Catálogo con búsqueda, filtros
    new/
      page.tsx        ← Nuevo producto + variantes
    [id]/
      page.tsx        ← Editar producto, gestionar variantes, stock
  customers/
    page.tsx
    customers-content.tsx ← Lista de clientes con historial
    [id]/
      page.tsx        ← Perfil del cliente + pedidos + conversaciones
  conversations/
    page.tsx
    conversations-content.tsx ← Bandeja de chats con filtros
    [id]/
      page.tsx        ← Conversación individual + human takeover
  analytics/
    page.tsx
    analytics-content.tsx ← Dashboard de métricas comerciales
  automations/
    page.tsx
    automations-content.tsx ← Jobs programados
  settings/
    page.tsx
    settings-content.tsx ← Perfil, tienda, WhatsApp, planes
```

---

## AI Agent — Comportamiento

### System Prompt (estructura)

```
Eres Concierge AI, un vendedor virtual experto para [nombre de tienda].

PERSONALIDAD:
- Amable, entusiasta, servicial
- Hablás natural como un vendedor real
- NO parecés chatbot
- Usás emojis con moderación

REGLAS:
- NUNCA inventes stock, precios ni disponibilidad
- NUNCA confirmes un pedido sin validación server-side
- SIEMPORE consultá la base de datos para precios y stock
- Si no sabés algo, decí "dejame consultar"

FLUJO DE VENTA:
1. Saludar y ofrecer ayuda
2. Preguntar qué busca
3. Buscar productos relevantes
4. Recomendar basado en preferencias
5. Preguntar variante (color/talle)
6. Confirmar precio y stock
7. Armar pedido
8. Preguntar dirección y pago
9. Confirmar pedido
10. Despedir y ofrecer más ayuda

UPSELL:
- Si lleva 1 par, sugerir 2x1
- Si lleva remera, sugerir jean que combina
- Si es cliente recurrente, preguntar si quiere lo mismo

HANDOFF:
- Si el cliente pide humano → human_handoff
- Si hay problema de pago → human_handoff
- Si el pedido es muy grande/complejo → human_handoff
```

### Action Types
```typescript
type AgentAction = {
  type: 'search_products' | 'get_product' | 'add_to_cart' | 'remove_from_cart'
      | 'checkout' | 'cancel_order' | 'track_order' | 'human_handoff'
      | 'apply_coupon' | 'get_customer_info' | 'update_profile'
  payload: Record<string, unknown>
}
```

### Memory Comercial (en context JSONB)
```json
{
  "lastSearch": "boxer negro",
  "viewedProducts": ["prod-1", "prod-3"],
  "preferredSize": "L",
  "preferredColor": "negro",
  "cart": [
    { "variantId": "var-123", "quantity": 2 }
  ],
  "currentStep": "selecting_variant"
}
```

---

## Automatizaciones (Internal Jobs API)

Mismo patrón que Clinify: sin n8n al principio.

### Jobs Planificados
```
cart_abandonment_24h    → Recordatorio de carrito abandonado (24h)
cart_abandonment_48h    → Segundo recordatorio (48h) + descuento
order_confirmation      → Mensaje de confirmación post-compra
order_shipped           → Notificación de envío con tracking
order_delivered         → Confirmación de entrega + pedir review
post_purchase_7d        → "¿Cómo te quedó? ¿Necesitás algo más?"
restock_alert           → Avisar cuando un producto vuelve a tener stock
birthday_discount       → Descuento de cumpleaños
reengagement_30d        → Cliente que no compra hace 30 días
```

### Arquitectura de Jobs
```
API Route: POST /api/jobs/execute
Headers: Authorization: Bearer JOB_SECRET
Body: { workflow: string, entityType: string, entityId: string }

→ Validate JOB_SECRET
→ Load workflow config
→ Execute workflow (fetch data, send message, log result)
→ Save to automation_logs (con idempotencia)
→ Return { ok: true }

Scheduler futuro: cron job que llama a /api/jobs/execute
```

---

## Seguridad

### Misma filosofía que Clinify
- RLS en todas las tablas (auth.uid() → profiles → organization_id)
- Webhook secret para Evolution API
- Rate limiting (30 req/min por IP)
- JOB_SECRET para automatizaciones
- Roles: owner / admin / agent / viewer

### Diferencias con Clinify
- Agregar server-side plan enforcement (Clinify solo lo hace client-side)
- Pagos: API key de MercadoPago/Stripe por tenant
- Encriptar credenciales de payment gateway

---

## Stack Tecnológico

```
Frontend:     Next.js 16 + React 19 + Tailwind CSS 4 + Framer Motion + Recharts
Backend:      Next.js API Routes + Supabase (PostgreSQL + Auth + Storage)
WhatsApp:     Evolution API (mismo que Clinify)
IA:           OpenAI / Anthropic / Groq / Google (multi-provider)
Estado:       React Query (server) + Zustand (client)
Testing:      Vitest + Playwright + MSW
CI/CD:        GitHub Actions (mismo que Clinify)
Pagos:        Stripe / MercadoPago (nuevo)
```

---

## Tradeoffs y Decisiones

| Decisión | Alternativa | Por qué esta |
|----------|-------------|--------------|
| PostgreSQL full-text vs Elasticsearch | Elasticsearch | Para 10k productos, PG es suficiente. Elasticsearch es overengineering. |
| Evolution API vs WATI | WATI | Ya tenemos Evolution funcionando. Mismo provider. |
| IA multi-provider vs solo OpenAI | Solo OpenAI | Ya tenemos la abstracción. El cliente puede elegir. |
| Carrito en DB vs carrito en IA | Híbrido | IA maneja la conversación, DB guarda el estado real. |
| Sin n8n vs con n8n | Sin n8n al inicio | Internal jobs cubren el 90% de los casos. n8n después. |
| Stripe vs MercadoPago | Ambos | LATAM necesita MP. Internacional Stripe. Configurable por tenant. |
