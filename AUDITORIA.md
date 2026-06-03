# Auditoría Completa — Concierge AI

> **Fecha**: 2026-06-03
> **Versión**: 1.0.0
> **Framework**: Next.js 16.2.6 + Supabase + Evolution API
> **Propósito**: Reporte integral del estado del proyecto, seguridad, base de datos y checklist de deploy

---

## 1. Árbol completo del proyecto

```
concierge-ai/
├── .env.example                        # Template de variables de entorno
├── .env.local                          # Variables locales (no comitear)
├── .gitignore
├── AGENTS.md                           # Reglas para agentes AI
├── CLAUDE.md                           # Referencia a AGENTS.md
├── AUDITORIA.md                        # ← Este archivo
├── README.md                           # Documentación del proyecto
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── package.json
│
├── infrastructure/
│   └── supabase/
│       └── migrations/                 # 27 migraciones SQL
│           ├── 000_full_schema.sql     # Schema completo combinado (001-008)
│           ├── 001_core_schema.sql     # Organizaciones + perfiles + tiendas
│           ├── 002_commerce_schema.sql # Productos, variantes, categorías
│           ├── 003_customers.sql       # Clientes
│           ├── 004_orders.sql          # Pedidos, order_items, carts
│           ├── 005_conversations.sql   # Conversaciones + mensajes
│           ├── 006_analytics.sql       # RFM scoring + analytics diarios
│           ├── 007_automations.sql     # Logs de automatizaciones
│           ├── 008_coupons.sql         # Cupones, envíos, planes
│           ├── 009_rls_policies.sql    # RLS SELECT para tablas core
│           ├── 010_write_policies_and_stock.sql
│           ├── 011_store_logos.sql     # Bucket store-logos
│           ├── 012_bot_infrastructure.sql
│           ├── 013_checkout_flow.sql   # DNI, dirección, pickup
│           ├── 014_payment_lifecycle.sql
│           ├── 015_storage_buckets.sql
│           ├── 016_payment_accounts.sql
│           ├── 017_payment_accounts_rls.sql
│           ├── 018_order_events.sql    # Eventos de auditoría
│           ├── 019_stock_reservations.sql # Sistema de reservas + funciones
│           ├── 020_order_expiration.sql
│           ├── 021_payment_proofs_ocr.sql
│           ├── 022_multi_payment_accounts.sql
│           ├── 023_notifications.sql
│           ├── 024_recovery_automation.sql
│           ├── 025_realtime_publications.sql
│           ├── 026_fix_store_logos_rls.sql
│           └── 027_superadmin.sql      # superadmin role + multi-instance
│
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                  # Root layout
    │   ├── middleware.ts               # Supabase session + superadmin route guard
    │   ├── page.tsx                    # Landing page (redirect)
    │   │
    │   ├── (auth)/
    │   │   └── login/page.tsx          # Login page
    │   │
    │   ├── (dashboard)/                # Panel principal (protegido por layout)
    │   │   ├── layout.tsx              # Sidebar + AuthProvider wrapper
    │   │   ├── analytics/page.tsx      # Gráficos con Recharts
    │   │   ├── automations/page.tsx    # Workflows programados
    │   │   ├── conversations/
    │   │   │   ├── page.tsx            # Lista de conversaciones
    │   │   │   └── [id]/page.tsx       # Detalle de conversación
    │   │   ├── customers/
    │   │   │   ├── page.tsx            # Lista de clientes
    │   │   │   └── [id]/page.tsx       # Detalle de cliente
    │   │   ├── notifications/page.tsx  # Campana + listado
    │   │   ├── orders/
    │   │   │   ├── page.tsx            # Lista de pedidos
    │   │   │   └── [id]/page.tsx       # Detalle + timeline
    │   │   ├── overview/page.tsx       # Métricas generales
    │   │   ├── products/
    │   │   │   ├── page.tsx            # Lista de productos
    │   │   │   ├── new/page.tsx        # Crear producto
    │   │   │   ├── [id]/page.tsx       # Detalle de producto
    │   │   │   └── [id]/edit/page.tsx  # Editar producto
    │   │   ├── settings/
    │   │   │   ├── page.tsx            # Store + AI config
    │   │   │   └── payments/page.tsx   # Cuentas bancarias
    │   │   └── whatsapp/page.tsx       # QR code + status conexión
    │   │
    │   ├── api/                        # 25 API Routes
    │   │   ├── health/
    │   │   │   └── route.ts            # 🟢 Health check
    │   │   ├── bot/
    │   │   │   └── send/route.ts       # Enviar mensaje manual
    │   │   ├── conversations/route.ts  # Listar conversaciones
    │   │   ├── customers/route.ts      # CRUD clientes
    │   │   ├── evolution/
    │   │   │   ├── connect/route.ts    # QR Evolution
    │   │   │   ├── disconnect/route.ts # Desconectar instancia
    │   │   │   └── status/route.ts     # Estado instancia
    │   │   ├── jobs/
    │   │   │   ├── execute/route.ts    # Workflows automations
    │   │   │   ├── check-expired-orders/route.ts
    │   │   │   ├── release-expired-reservations/route.ts
    │   │   │   └── send-payment-reminders/route.ts
    │   │   ├── notifications/route.ts  # CRUD notificaciones
    │   │   ├── orders/
    │   │   │   ├── route.ts            # Listar/actualizar pedidos
    │   │   │   ├── [id]/items/route.ts # Items de pedido
    │   │   │   └── [id]/status/route.ts# Cambiar estado
    │   │   ├── products/route.ts       # CRUD productos
    │   │   ├── settings/
    │   │   │   ├── store/route.ts      # Config tienda
    │   │   │   ├── ai-config/route.ts  # Config AI provider
    │   │   │   └── payment-accounts/route.ts
    │   │   ├── superadmin/
    │   │   │   ├── stats/route.ts      # Estadísticas globales
    │   │   │   ├── organizations/
    │   │   │   │   ├── route.ts        # CRUD + onboarding completo
    │   │   │   │   └── [id]/route.ts   # Detalle + delete org
    │   │   │   └── users/
    │   │   │       ├── route.ts        # Crear usuarios
    │   │   │       └── [userId]/route.ts # Editar/eliminar
    │   │   └── webhooks/whatsapp/route.ts # Webhook Evolution API
    │   │
    │   └── superadmin/                 # Frontend superadmin
    │       ├── layout.tsx
    │       ├── page.tsx
    │       ├── organizations/
    │       │   ├── page.tsx
    │       │   ├── new/page.tsx
    │       │   └── [id]/page.tsx
    │       └── users/page.tsx
    │
    └── lib/
        ├── auth/
        │   └── require-org.ts          # 🔐 Helper auth dashboard routes
        ├── bot/
        │   ├── ai-chat.ts              # Prompt engineering + llamadas AI
        │   ├── checkout-machine.ts     # Máquina de estados de checkout
        │   ├── conversation-engine.ts  # Motor de conversación + datos
        │   ├── evolution-client.ts     # Cliente HTTP Evolution API
        │   ├── intent-classifier.ts
        │   ├── order-service.ts
        │   ├── payment-proof-service.ts
        │   ├── payment-service.ts
        │   ├── product-emoji-map.ts
        │   └── storage-service.ts
        ├── commerce/                   # Motor e-commerce (legacy)
        │   ├── actions.ts
        │   ├── brain.ts
        │   ├── cart.ts
        │   ├── context.ts
        │   ├── intent.ts
        │   ├── retrieval.ts
        │   └── validation.ts
        ├── data/
        │   └── seed.ts
        ├── hooks/
        │   ├── auth-context.tsx        # Contexto de autenticación
        │   ├── use-auth.ts
        │   ├── use-notifications.ts
        │   ├── use-realtime-order.ts
        │   └── use-realtime-orders.ts
        ├── plans/
        │   └── use-plan.ts
        ├── repositories/              # Capa de datos
        │   ├── notification.repository.ts
        │   ├── order-event.repository.ts
        │   ├── order-expiration.repository.ts
        │   ├── payment-account.repository.ts
        │   └── stock-reservation.repository.ts
        ├── services/                  # Lógica de negocio
        │   ├── notification.service.ts
        │   ├── ocr.service.ts
        │   ├── order-editing.service.ts
        │   ├── order-event.service.ts
        │   ├── order-expiration.service.ts
        │   ├── order-recovery.service.ts
        │   ├── payment-account.service.ts
        │   └── stock-reservation.service.ts
        ├── stores/
        │   └── store.store.ts          # Zustand store
        ├── supabase/
        │   ├── client.ts              # Browser client (createBrowserClient)
        │   ├── server.ts              # Server component client
        │   ├── middleware.ts           # Next.js middleware
        │   └── service.ts             # Service role client (bypass RLS)
        ├── superadmin/
        │   ├── auth.ts                # verifySuperadmin helper
        │   └── utils.ts               # Utilidades superadmin
        ├── types/
        │   ├── index.ts
        │   ├── commerce.types.ts
        │   └── whatsapp.types.ts
        ├── utils/
        │   ├── cn.ts                  # clsx + tailwind-merge
        │   ├── formatters.ts
        │   ├── log.ts                 # 🆕 Structured logging helper
        │   └── rate-limit.ts          # Rate limiter in-memory
        └── workflows/                 # Workflows background
            ├── order-expiration-check.workflow.ts
            ├── payment-proof-ocr.workflow.ts
            └── payment-reminder.workflow.ts
```

---

## 2. Resumen de cambios acumulados

### Commits realizados (historia de git)

| Hash | Mensaje | Qué resolvió |
|------|---------|-------------|
| `09342b6` | feat: superadmin panel + multi-instance + rubros parametrizables | Panel superadmin completo, multi-instancia Evolution por store, tipos de variante parametrizables por rubro |
| `ece7f0f` | feat: Phase 4 — catalog search layer + pre-order stock check | Capa de búsqueda con filtros (texto, categoría, precio, tags), verificación de stock ANTES de crear orden |
| `7ceb37d` | feat: Phase 3 — conversation locking + dual product matching | Lock de concurrencia con stale timeout, matching de productos por ID+variante (no solo por nombre) |
| `ef822f4` | feat: Phase 2 — dark mode + state machine types | Correcciones de dark mode, tipos formales para checkout machine |
| `ffd39b5` | feat: Phase 1 — modular prompts + auth fix + expanded events | Prompts modulares (BASE/SALES/CHECKOUT/PAYMENT/JSON), fix de setState en auth, eventos de orden expandidos |
| `8c2bf97` | fix: settings store name + ByteString AI error + Stage 9 | Persistencia de nombre de tienda, fix de ByteString en llamadas AI (node:https directo) |
| `a600862` | fix: prevent Supabase auth from overriding dev mode | Dev mode no se sobreescribe con auth real al hacer refetch |
| `c4d300a` | fix: mock Supabase fetch in dev mode | Mock fetch para evitar DNS retry loop sin Supabase configurado |
| `03618f7` | fix: handle missing Supabase in dev mode | No crash en dashboard pages sin Supabase |
| `f4f5adc` | feat: Concierge AI MVP | MVP completo: dashboard + commerce engine + webhook WhatsApp |

### Cambios de seguridad aplicados (sin commit aún)

| Cambio | Archivos | Proposito |
|--------|----------|-----------|
| 🔐 `requireOrgAccess` helper | `src/lib/auth/require-org.ts` (nuevo) | Helper reutilizable para validar sesión + org en API routes |
| 🔐 Auth Evolution endpoints | 3 files: `evolution/*/route.ts` | Validan sesión vía cookie antes de conectar/desconectar/status |
| 🔐 Auth dashboard API routes | 11 files: `products`, `orders`, `customers`, `conversations`, `notifications`, `settings/*`, `bot/send`, `orders/[id]/*` | Validan sesión + pertenencia a org |
| 🔐 Dev mode production guard | `auth-context.tsx` | `process.env.NODE_ENV !== 'production'` bloquea dev mode en producción |
| 🟡 HMAC webhook | `webhooks/whatsapp/route.ts` | Verificación opcional de firma x-evolution-signature |
| 🟡 Rate limiting webhook | `webhooks/whatsapp/route.ts` | 30 msgs/min por teléfono |
| 🟢 Health check | `api/health/route.ts` (nuevo) | Verifica Supabase + Evolution + env vars |
| 🟢 Structured logging | `lib/utils/log.ts` (nuevo) | logInfo/logWarn/logError con metadatos |
| 🟢 AI context limits | `conversation-engine.ts` | fetchProducts: 50→30, variantes: sin límite→15 máx |

---

## 3. Estado actual de cada módulo

### Bot / Agente de ventas ✅ Completo
- Prompt engineering modular: BASE, SALES, CHECKOUT, PAYMENT, JSON_FORMAT
- Arquitectura agente con 6 acciones: `start_checkout`, `add_to_order`, `remove_from_order`, `human_handoff`, `request_payment_info`, `apply_coupon`
- Fallback detection para add-to-order desde texto de conversación
- Safety check: nunca envía JSON crudo al cliente
- Proveedores: OpenAI, Anthropic, DeepSeek, Groq, Google
- **⚠️ Sin límite de tokens estricto** — mitigado: máx 30 productos, 15 variantes c/u

### Checkout y pedidos ✅ Completo
- Máquina de estados: `name → dni → shipping → address → payment_method → payment_waiting_proof → confirm → completed`
- Smart skip: salta pasos si el cliente ya tiene datos cargados
- Creación de orden con items, stock check y reserva automática
- Eventos de auditoría: `created`, `payment_requested`, `proof_received`, `item_added`, `item_removed`
- Edición de pedidos activos: agregar/sacar items con recálculo de totales
- Transiciones de estado validadas por `order-service`

### Stock y reservas ✅ Completo
- `get_available_stock()`: stock real menos reservas activas
- `reserve_stock_for_order()`: row-level locking (`FOR UPDATE`), expira 2h
- `confirm_stock_for_order()`: descuenta stock real + inventory_movements
- `release_expired_reservations()`: cron-ready
- **⚠️ Depende de cron externo** para liberar reservas vencidas

### Pagos y OCR ✅ Completo
- Cuentas bancarias multi: alias, CBU/CVU, banco, titular, instrucciones
- Detección de comprobante vía imagen → upload a Storage → OCR con Tesseract.js
- Workflow OCR en background (fire-and-forget)
- Payment proof service con estados: pending → approved/rejected

### Conversaciones WhatsApp ✅ Completo
- Webhook Evolution API con rate limiting (30 msg/min por teléfono)
- HMAC opcional: verificación de firma si WEBHOOK_SECRET + Evolution configurados
- Lock de concurrencia (stale timeout 30s)
- Persistencia de contexto en DB (`conversations.context`)
- Soporte multi-instancia: instancia Evolution por store

### Dashboard ✅ Completo (12 páginas)
| Ruta | Propósito |
|------|-----------|
| `/overview` | Métricas generales (órdenes, ingresos, clientes) |
| `/products` | Listado + crear + editar + detalle |
| `/orders` | Listado + detalle con timeline de eventos |
| `/customers` | Listado + detalle con historial de compras |
| `/conversations` | Listado + detalle por conversación |
| `/analytics` | Gráficos con Recharts |
| `/notifications` | Campana con contador + listado |
| `/settings` | Store config + AI provider |
| `/settings/payments` | Cuentas bancarias |
| `/whatsapp` | QR + status de conexión |
| `/automations` | Workflows programados |

### Superadmin ✅ Completo
- Panel en `/superadmin/*` con layout propio
- Listado de organizaciones con métricas (stores, pedidos, clientes)
- Detalle con tabs: General, Usuarios, Pedidos, IA
- CRUD de usuarios: crear (con contraseña temporal), editar rol, eliminar
- Crear organización: onboarding completo (auth user + org + profile + Evolution instance + store)
- Eliminar organización: cascade completo (stores + profiles + auth users)
- Toggle activo/inactivo de organización
- Protegido por middleware + `verifySuperadmin`
- Solo accesible para rol `superadmin`

### Autenticación y RLS ✅ Completo
- **Cliente browser**: `createBrowserClient` de `@supabase/ssr`
- **Server components**: `createServerClient` con cookie store
- **Service (bypass RLS)**: `createClient` de `@supabase/supabase-js` con service_role
- **Middleware**: Session refresh + redirect + superadmin route guard
- **AuthProvider**: Carga profile → org → stores; suscripción a cambios de auth
- **RLS**: SELECT policies por organización en TODAS las tablas core
- **Dev mode**: Solo activo en `NODE_ENV !== 'production'`
- **Dashboard routes**: 11 rutas con `requireOrgAccess`

### Jobs y automatizaciones ⚠️ Parcial
- 4 endpoints cron con autenticación `JOB_SECRET`
- Workflows: `cart_abandonment_24h`, `post_purchase_7d`, `reengagement_30d`
- Idempotencia: check en `automation_logs` (24h window)
- Rate limiting: 10 jobs/min por workflow
- **⚠️ Sin scheduler automático** — depende de cron-job.org, n8n, o similar

### Multitienda (evolution por store) ✅ Completo
- `stores.evolution_instance` en DB (027_superadmin.sql)
- Webhook resuelve store por `payload.instance`
- Envío multi-instancia: `sendText(phone, text, undefined, instanceName)`
- Soporte en dashboard settings

### Rubros parametrizables ✅ Completo
- `stores.variant_attr1` (default: 'Talle')
- `stores.variant_attr2` (default: 'Color')
- Configurable por store desde superadmin al crear organización
- Función `getVariantAttrs(rubro)` en superadmin utils

---

## 4. Base de datos actualizada

### Tablas completas (27 migraciones)

| Tabla | Migration | Columnas clave | Propósito |
|-------|-----------|---------------|-----------|
| `organizations` | 001 | id, name, slug, active, settings | Organización multi-tenant |
| `profiles` | 001 | id (FK auth.users), organization_id, role, full_name | Perfiles de usuario |
| `stores` | 001+027 | id, organization_id, evolution_instance, variant_attr1/2 | Tiendas por org |
| `categories` | 002 | id, organization_id, parent_id | Categorías de productos |
| `products` | 002 | id, organization_id, price, search_vector | Productos con búsqueda |
| `product_variants` | 002 | id, product_id, color, size, stock | Variantes (talle/color) |
| `product_images` | 002 | id, product_id, url | Imágenes de productos |
| `inventory_movements` | 002 | id, variant_id, quantity, type | Movimientos de stock |
| `coupons` | 002 | id, organization_id, code, type, value | Cupones de descuento |
| `shipping_configs` | 002 | id, organization_id, price | Configuración de envío |
| `plans` | 002 | id, organization_id, plan | Planes de suscripción |
| `customers` | 003 | id, organization_id, phone, full_name | Clientes |
| `orders` | 004 | id, organization_id, customer_id, status, total | Pedidos |
| `order_items` | 004 | id, order_id, variant_id, product_name, quantity | Items de pedido |
| `carts` | 004 | id, organization_id, customer_id | Carritos |
| `cart_items` | 004 | id, cart_id, variant_id, quantity | Items del carrito |
| `conversations` | 005 | id, organization_id, channel_contact_id, context | Conversaciones WhatsApp |
| `messages` | 005 | id, conversation_id, direction, body | Mensajes |
| `customer_scores` | 006 | customer_id, rfm_segment, churn_risk | Scoring RFM |
| `analytics_daily` | 006 | store_id, date, total_revenue | Analytics diarios |
| `automation_logs` | 007 | organization_id, workflow, status | Logs de automatizaciones |
| `stock_reservations` | 019 | variant_id, order_id, quantity, expires_at, status | Reservas de stock |
| `order_expiration_settings` | 020 | organization_id, enabled, expiration_minutes | Config de expiración |
| `payment_accounts` | 016 | organization_id, bank_name, alias, cvu | Cuentas bancarias |
| `payment_proofs` | 014+021 | order_id, image_url, status, extracted_* | Comprobantes + OCR |
| `order_events` | 018 | order_id, type, actor_type, metadata | Auditoría de órdenes |
| `notifications` | 023 | organization_id, type, title, read | Notificaciones dashboard |
| `recovery_queue` | 024 | — | Cola de recuperación |

### Columnas agregadas en 027_superadmin.sql

```sql
-- stores
evolution_instance text          -- Instancia Evolution por tienda
variant_attr1     text DEFAULT 'Talle'  -- Nombre del primer atributo de variante
variant_attr2     text DEFAULT 'Color'  -- Nombre del segundo atributo de variante

-- organizations
active            boolean DEFAULT true  -- Permite desactivar organizaciones

-- ENUM user_role → se agregó 'superadmin'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
```

### Funciones y triggers vigentes

| Función/Trigger | Propósito | Grants |
|----------------|-----------|--------|
| `products_search_update()` trigger | Auto-actualiza search_vector en productos | — |
| `current_user_org_id()` | Helper RLS: org_id del usuario actual | — |
| `search_products_fts(text, uuid, int)` | Búsqueda full-text en español | — |
| `search_products_trigram(text[], uuid, int)` | Búsqueda typo-tolerant | — |
| `search_products_by_tags(text[], uuid, int)` | Búsqueda por tags | — |
| `search_products_by_category(text[], uuid, int)` | Búsqueda por categoría | — |
| `get_available_stock(uuid)` | Stock efectivo menos reservas activas | anon, authenticated, service_role |
| `reserve_stock_for_order(uuid)` | Reserva con row-level locking | service_role only |
| `confirm_stock_for_order(uuid)` | Confirma y descuenta stock real | service_role only |
| `release_stock_for_order(uuid)` | Libera reservas de una orden | service_role only |
| `release_expired_reservations()` | Libera reservas vencidas (cron) | service_role only |

### Tipos ENUM actualizados

```sql
user_role              → 'owner', 'admin', 'agent', 'viewer', 'superadmin'
order_status           → 'pending', 'confirmed', 'paid', 'preparing', 'shipped',
                          'delivered', 'cancelled', 'awaiting_payment',
                          'payment_under_review', 'payment_confirmed',
                          'payment_rejected', 'completed', 'refunded', 'expired'
payment_status         → 'pending', 'paid', 'failed', 'refunded',
                          'awaiting', 'under_review', 'confirmed'
conversation_channel   → 'whatsapp', 'instagram', 'web'
conversation_status    → 'open', 'closed', 'bot', 'human'
message_direction      → 'inbound', 'outbound'
message_type           → 'text', 'image', 'audio', 'video'
inventory_movement_type → 'in', 'out', 'adjustment'
coupon_type            → 'percentage', 'fixed'
plan_name              → 'starter', 'growth', 'pro', 'enterprise'
rfm_segment            → 'champion', 'loyal', 'at_risk', 'new_customer', 'dormant', 'lost'
churn_risk             → 'low', 'medium', 'high', 'churned'
```

---

## 5. API Routes completas

### Rutas públicas (sin auth)

| Método | Ruta | Auth | Función |
|--------|------|------|---------|
| GET | `/api/health` | Sin auth | Health check (Supabase + Evolution + env vars) |
| POST | `/api/webhooks/whatsapp` | HMAC opcional + rate limit | Webhook Evolution API — recibe mensajes WhatsApp |

### Rutas dashboard (🔐 sesión vía cookies + verificación de organización)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/api/products` | Listar productos con variantes y categoría |
| POST | `/api/products` | Crear producto |
| PATCH | `/api/products` | Actualizar producto |
| DELETE | `/api/products` | Eliminar producto |
| GET | `/api/orders` | Listar órdenes (filtro por customer/status) |
| PATCH | `/api/orders` | Actualizar orden |
| GET | `/api/customers` | Listar clientes |
| PATCH | `/api/customers` | Actualizar cliente |
| GET | `/api/conversations` | Listar conversaciones con datos del cliente |
| GET | `/api/notifications` | Listar notificaciones (con contador no leídas) |
| PATCH | `/api/notifications` | Marcar como leídas (individual o todas) |
| POST | `/api/orders/[id]/items` | Agregar item a orden (transaccional) |
| DELETE | `/api/orders/[id]/items` | Remover item de orden |
| PATCH | `/api/orders/[id]/status` | Cambiar estado de orden (validado) |
| POST | `/api/settings/store` | Actualizar nombre, WhatsApp, instance |
| GET | `/api/settings/ai-config` | Obtener config AI (provider, modelo) |
| POST | `/api/settings/ai-config` | Guardar API key + modelo |
| GET | `/api/settings/payment-accounts` | Obtener cuenta bancaria activa |
| POST | `/api/settings/payment-accounts` | Guardar/actualizar cuenta bancaria |
| DELETE | `/api/settings/payment-accounts` | Desactivar cuenta bancaria |
| POST | `/api/bot/send` | Enviar mensaje WhatsApp manualmente |

### Rutas Evolution (🔐 sesión vía cookies)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/api/evolution/connect` | Obtener QR code para conectar WhatsApp |
| GET | `/api/evolution/status` | Estado de conexión de la instancia |
| GET | `/api/evolution/disconnect` | Desconectar instancia WhatsApp |

### Rutas Cron (🔐 Bearer JOB_SECRET)

| Método | Ruta | Frecuencia sugerida | Función |
|--------|------|---------------------|---------|
| POST | `/api/jobs/release-expired-reservations` | Cada 5-10 min | Liberar reservas de stock vencidas |
| POST | `/api/jobs/check-expired-orders` | Cada 30 min | Expiracion de órdenes "awaiting_payment" |
| POST | `/api/jobs/send-payment-reminders` | Cada 60 min | Recordatorios de pago vía WhatsApp |
| POST | `/api/jobs/execute` | On-demand | Ejecutar workflow específico |

### Rutas Superadmin (🔐 sesión + rol superadmin)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/api/superadmin/stats` | Estadísticas globales (orgs, stores, orders, customers) |
| GET | `/api/superadmin/organizations` | Listar todas las organizaciones con métricas |
| POST | `/api/superadmin/organizations` | Crear organización (onboarding completo: auth + Evolution + store) |
| GET | `/api/superadmin/organizations/[id]` | Detalle completo: stores, profiles, orders, AI config |
| PATCH | `/api/superadmin/organizations/[id]` | Actualizar nombre/activo de org |
| DELETE | `/api/superadmin/organizations/[id]` | Eliminar org (cascade: stores → profiles → auth users) |
| GET | `/api/superadmin/users` | Listar todos los usuarios con organización |
| POST | `/api/superadmin/users` | Crear usuario en organización (con contraseña temporal) |
| PATCH | `/api/superadmin/users/[userId]` | Actualizar nombre/rol de usuario |
| DELETE | `/api/superadmin/users/[userId]` | Eliminar usuario (profile + auth user) |

---

## 6. Variables de entorno requeridas

```env
# ════════════════════════════════════════════════════════════
# Concierge AI — Variables de Entorno
# ════════════════════════════════════════════════════════════

# ── Supabase (OBLIGATORIO) ──────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── Evolution API (WhatsApp) (OBLIGATORIO) ──────────────────
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE=concierge-wpp

# ── Webhook Security (OPCIONAL) ─────────────────────────────
# Si se setea LA MISMA clave en Evolution API → envía firma HMAC.
# Si no se configura, el webhook funciona sin verificación.
WEBHOOK_SECRET=your-webhook-secret

# ── Job Security (RECOMENDADO) ──────────────────────────────
# Token que deben enviar los cron jobs en header Authorization.
JOB_SECRET=your-job-secret

# ── AI Provider (OBLIGATORIO para el bot) ───────────────────
# Se configura por organización en DB. Estos son defaults.
AI_PROVIDER=openai          # openai | anthropic | deepseek | groq | google
AI_API_KEY=sk-your-api-key
AI_MODEL=gpt-4o

# ── App URL (OBLIGATORIO) ──────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

---

## 7. Dependencias

### Producción

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `next` | 16.2.6 | Framework full-stack React |
| `react` / `react-dom` | 19.2.4 | UI library |
| `@supabase/supabase-js` | ^2.106.2 | Cliente Supabase (service client) |
| `@supabase/ssr` | ^0.10.3 | SSR cookies para auth |
| `@radix-ui/react-*` | varios | Componentes UI accesibles (12 paquetes) |
| `lucide-react` | ^1.16.0 | Iconos SVG |
| `framer-motion` | ^12.40.0 | Animaciones |
| `recharts` | ^3.8.1 | Gráficos de analytics |
| `zustand` | ^5.0.13 | Estado global (stores) |
| `@tanstack/react-query` | ^5.100.14 | Data fetching + caching |
| `date-fns` | ^4.3.0 | Manipulación de fechas |
| `clsx` / `tailwind-merge` | — | Utilidades CSS |
| `class-variance-authority` | ^0.7.1 | Variantes de componentes |
| `next-themes` | ^0.4.6 | Dark/light mode |
| `tesseract.js` | ^7.0.0 | OCR de comprobantes de pago |

### Desarrollo

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^4 | CSS utility framework |
| `@tailwindcss/postcss` | ^4 | Plugin PostCSS para v4 |
| `eslint` | ^9 | Linter |
| `eslint-config-next` | 16.2.6 | Config ESLint oficial Next.js |
| `@types/node` / `@types/react` / `@types/react-dom` | — | TypeScript types |

---

## 8. Problemas conocidos o pendientes

### 🔴 Críticos

| # | Problema | Archivo | Solución |
|---|----------|---------|----------|
| 1 | Webhook de 890 líneas con toda la lógica mezclada | `webhooks/whatsapp/route.ts` | Refactor: separar en handlers (`checkout.handler.ts`, `normal.handler.ts`, `media.handler.ts`) |

### 🟡 Importantes

| # | Problema | Impacto | Estado |
|---|----------|---------|--------|
| 2 | Sin scheduler automático para crons | Stock no se libera, órdenes no expiran | ⚠️ Configurar cron-job.org o n8n |
| 3 | Rate limiter in-memory | No funciona en multi-instancia/serverless | ⚠️ OK para single-instance |
| 4 | `buildAiPrompt` sin límite de tokens estricto | Prompt puede crecer con 30 productos | 🟢 Mitigado (30 prod, 15 vars) |
| 5 | Sin tests automatizados | Riesgo de regresiones | ❌ No hay tests unitarios ni e2e |
| 6 | `commerce/` directory legacy? | Posible código no usado | ❌ Verificar si se usa |

### 🟢 Mejoras planificadas

| # | Mejora | Prioridad |
|---|--------|-----------|
| 7 | Refactor webhook en handlers separados | Alta (mantenibilidad) |
| 8 | Cache de respuestas AI para FAQs | Media (costo AI) |
| 9 | Webhook Instagram | Baja (scope) |
| 10 | Stripe integration | Baja (pagos) |

### TODOs en el código

- `conversation-engine.ts:66` — Código comentado para migration 013 (DNI + default_address en customers)
- `checkout-machine.ts` — Varios estados comentados para futuras migraciones

---

## 9. Checklist de deploy

### 1. Variables de entorno a configurar

```env
# Obligatorias
NEXT_PUBLIC_SUPABASE_URL=        # URL de tu proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Anon key (pública, safe for client)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (SECRETA)
EVOLUTION_API_URL=               # URL de tu instancia Evolution API
EVOLUTION_API_KEY=               # API Key de Evolution
EVOLUTION_INSTANCE=              # Nombre de instancia WhatsApp

# Recomendadas
JOB_SECRET=                      # Token para cron jobs
NEXT_PUBLIC_APP_URL=             # URL pública de la app

# AI Provider (se configura por org en DB)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Opcional
WEBHOOK_SECRET=                  # Para HMAC del webhook
```

### 2. Migraciones a ejecutar en orden

```bash
# Opción 1: Schema completo (recomendado para deploy nuevo)
#   Ejecutar infrastructure/supabase/migrations/000_full_schema.sql

# Opción 2: Incremental (si ya hay schema)
#   001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010
#   011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → 019 → 020
#   021 → 022 → 023 → 024 → 025 → 026 → 027

# ⚠️ IMPORTANTE: Migration 027 tiene ALTER TYPE ... ADD VALUE
# que NO puede ejecutarse dentro de transacción.
# Ejecutar manualmente en SQL Editor:
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
```

### 3. Setup del primer superadmin

```sql
-- 1. Crear usuario en Supabase Auth (Auth > Users > Invite)
-- 2. Obtener el USER_ID del usuario creado
-- 3. Crear organización
INSERT INTO organizations (id, name, slug, active)
VALUES (gen_random_uuid(), 'Admin Org', 'admin-org', true);

-- 4. Asignar rol superadmin
INSERT INTO profiles (id, organization_id, full_name, role)
VALUES ('USER_ID', 'ORG_ID', 'Admin Name', 'superadmin');
```

### 4. Configuración de Evolution API

```bash
# 1. Instalar Evolution API (Docker):
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=your-api-key \
  -e DATABASE_ENABLED=true \
  -e DATABASE_CONNECTION_URI=postgresql://... \
  atendai/evolution-api

# 2. Crear instancia:
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "concierge-wpp",
    "webhookUrl": "https://tu-app.com/api/webhooks/whatsapp",
    "webhookEnabled": true,
    "webhookByEvents": true,
    "events": ["messages.upsert"]
  }'

# 3. Conectar QR desde el dashboard /whatsapp
```

### 5. Nginx (si aplica)

```nginx
server {
    listen 443 ssl;
    server_name concierge.tudominio.com;
    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /evolution/ {
        rewrite ^/evolution/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8080;
    }
}
```

### 6. Post-deploy

- [ ] `GET /api/health` → `{ status: "healthy" }`
- [ ] Configurar cron jobs (cron-job.org, GitHub Actions, o n8n):
  - `POST /api/jobs/release-expired-reservations` → cada 5-10 min
  - `POST /api/jobs/check-expired-orders` → cada 30 min
  - `POST /api/jobs/send-payment-reminders` → cada 60 min
- [ ] Escanear QR de WhatsApp en `/whatsapp`
- [ ] Configurar AI provider en Settings
- [ ] Configurar cuenta bancaria en Settings/Payments
- [ ] Probar flujo completo: mensaje → AI → checkout → pago
- [ ] Verificar que `JOB_SECRET` está configurado
- [ ] (Opcional) Configurar `WEBHOOK_SECRET` en Evolution + env

---

> **Build verificada**: ✅ `npx next build` — 0 errores, 0 warnings
> **Reporte generado**: 2026-06-03
