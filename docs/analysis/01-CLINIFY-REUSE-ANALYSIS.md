# Fase 1: Análisis Profundo de ClinifyAgent y Mapeo de Reutilización

## Resumen Ejecutivo

| Dimensión | Reutilizable | Adaptable | Reemplazar |
|-----------|-------------|-----------|------------|
| **Infraestructura** (Supabase clients, middleware, rate limiter) | ~95% | ~5% | 0% |
| **Arquitectura IA** (providers, parser, patrones) | ~70% patrones, ~11% código | ~20% | ~10% |
| **WhatsApp/Webhook** (Evolution API, context cache, orquestación) | ~47% código, ~80% patrones | ~30% | ~20% |
| **Base de datos** (18 migraciones) | ~40% tablas | ~40% | ~20% |
| **Frontend** (UI primitives, layout, design system) | ~80% | ~20% | 0% |

**Total estimado de líneas reutilizables sin cambios: ~1,500 líneas**
**Total de arquitectura reutilizable como patrón: ~70%**

---

## 1. INFRAESTRUCTURA — 100% Reutilizable

### Supabase Clients
- `src/lib/supabase/client.ts` — Browser client. **Copiar igual.**
- `src/lib/supabase/server.ts` — Server client con cookies. **Copiar igual.**
- `src/lib/supabase/server-admin.ts` — Admin con service_role. **Copiar igual.**
- `src/lib/supabase/middleware.ts` — Auth guard middleware. **Copiar, solo cambiar rutas.**

### Rate Limiter
- `src/lib/utils/rate-limit.ts` — In-memory rate limiter. **Copiar igual.**

### Evolution API Client
- `src/lib/bot/evolution-client.ts` — sendText, sendMultiple, markAsRead. **Copiar igual si usamos Evolution.**

### Utilidades
- `src/lib/utils/cn.ts` — clsx + tailwind-merge. **Copiar igual.**
- `src/lib/utils/formatters.ts` — Fechas, moneda, iniciales. **Copiar, ajustar locale.**
- `src/lib/bot/intent-classifier.ts` — extractPhone, extractText. **Copiar igual.**

---

## 2. ARQUITECTURA IA — 70% Patrón Reutilizable

### 100% Reutilizable (código)
| Componente | Archivo | Líneas |
|-----------|---------|--------|
| 5 providers (OpenAI, Anthropic, DeepSeek, Groq, Google) | `ai-chat.ts:267-418` | ~150 |
| parseAgentResponse() | `ai-chat.ts:244-263` | ~20 |
| ChatMessage interface | `ai-chat.ts:20-23` | ~4 |
| AgentResponse interface | `ai-chat.ts:54-57` | ~4 |

### 100% Reutilizable (patrón)
| Patrón | Descripción |
|--------|-------------|
| **AI-first architecture** | IA genera respuestas, state machine solo trackea estado |
| **Structured actions** | IA devuelve `{ message, action: { type, payload } }` — backend valida y ejecuta |
| **Data injection** | Datos reales se fetchan de DB y se inyectan en contexto de IA |
| **Multi-provider routing** | Switch por provider configurable por tenant |
| **Conversation history sliding window** | Últimos N mensajes como contexto |

### Necesita Adaptación
| Componente | Cambio |
|-----------|--------|
| **System prompt** (ai-chat.ts:78-172) | Reescribir completo para comercio |
| **AiContext interface** (ai-chat.ts:25-51) | Cambiar campos de clínica a comercio |
| **AgentAction type** (ai-chat.ts:59-74) | `book/cancel` → `add_to_cart/checkout/search` |
| **buildAiPrompt()** (ai-chat.ts:176-240) | Nuevos campos de contexto comercial |
| **loadConfig()** (ai-chat.ts:422-436) | Si no usamos Supabase organizations.settings |

---

## 3. WHATSAPP / WEBHOOK — 80% Patrón Reutilizable

### 100% Reutilizable (código)
| Componente | Archivo |
|-----------|---------|
| Context cache con evicción TTL | `route.ts:20-42` |
| Context load/save con Supabase fallback | `route.ts:44-85` |
| Message persistence | `route.ts:87-98` |
| Stale context recovery (>30 min) | `route.ts:904-918` |
| Human takeover detection | `route.ts:982-1000` |
| `__FETCH_*` marker pattern | `route.ts:1004-1051` |
| Race condition handling (23505) | `route.ts:771-781` |
| Webhook secret validation | `route.ts:864-867` |
| Evolution GET handler (verification) | `route.ts:1285-1289` |

### 100% Reutilizable (patrón)
| Patrón | Descripción |
|--------|-------------|
| **Pipeline de orquestación** | Receive → Load → Process → Fetch → AI → Execute → Save → Send |
| **State machine pura** | `conversation-engine.ts` sin side effects, solo devuelve markers |
| **Batched queries** | `fetchAllAvailabilityBatched()` como modelo de eficiencia |
| **Singleton data fetchers** | `_specialtyMap` pattern con cierre por request |

### Necesita Reemplazo Completo
| Componente | Líneas | Reemplazo |
|-----------|--------|-----------|
| Todos los data fetchers | ~500 | Queries de productos, stock, precios |
| `saveAppointmentFromBot()` | ~110 | `saveOrderFromBot()` |
| `cancelAppointmentFromBot()` | ~5 | `cancelOrderFromBot()` |
| `registerNewPatient()` | ~15 | `registerCustomer()` |
| Action execution switch | ~75 | Acciones de comercio |
| Fallback responses | ~30 | Textos de comercio |

---

## 4. BASE DE DATOS — 40% Directo, 40% Adaptado

### 100% Reutilizable (tablas exactas)
| Tabla | Propósito | Cambio |
|-------|-----------|--------|
| **organizations** | Tenant principal | Solo renombrar lógica |
| **profiles** | Usuarios del sistema | Roles de comercio |
| **conversations** | Chats | Agregar channel discriminator |
| **messages** | Mensajes | Igual |
| **automation_logs** | Auditoría de jobs | Igual |
| **invoices** | Facturación | Reutilizar para pedidos |
| **invoice_items** | Items de factura | Reutilizar |
| **subscriptions** | Planes SaaS | Igual |
| **billing_records** | Historial de pagos | Igual |
| **support_tickets** | Soporte | Igual |
| **feature_flags** | Feature toggles | Igual |
| **platform_config** | Config global | Igual |

### Necesita Adaptación (renombrar + ajustar columnas)
| Tabla Actual | → Tabla Nueva | Cambios |
|-------------|--------------|---------|
| `clinics` | `stores` | Sin cambios estructurales |
| `professionals` | `agents` | Sin cambios estructurales |
| `patients` | `customers` | Agregar email como unique |
| `appointments` | `orders` | Cambiar status enum, agregar campos de envío/pago |
| `appointment_status` enum | `order_status` enum | pending/confirmed/paid/preparing/shipped/delivered/cancelled |
| `service_areas` | `product_categories` | Cambiar duración por metadata |
| `availability_templates` | `agent_schedules` | Sin cambios |
| `patient_scores` | `customer_scores` | Sin cambios (RFM igual) |
| `analytics_daily` | `analytics_daily` | Cambiar métricas |

### Eliminar (no reutilizable)
| Tabla | Razón |
|-------|-------|
| `tooth_records` | Odontología específica |
| `clinical_records` | Reemplazar por order_items |
| `clinical_treatments` | Reemplazar |
| `afip_credentials` | AFIP Argentina específico |
| `nps_responses` | Opcional, mantener si se quiere |

### Bugs Detectados para Corregir
1. `weekly_schedules` tiene RLS enabled pero **sin policies** (migration 005)
2. `api_keys` almacena `raw_value` en texto plano
3. `wa_conversations` y `conversations` son tablas duplicadas (migration 001 y 004)
4. Dos migration `016_*` con el mismo número

---

## 5. FRONTEND — 80% Reutilizable

### 100% Reutilizable (código)
| Componente | Archivo | Uso |
|-----------|---------|-----|
| Modal | `src/components/ui/modal.tsx` | CRUD operations |
| Badge + StatusBadge | `src/components/ui/badge.tsx` | Status tags |
| Avatar | `src/components/ui/avatar.tsx` | User display |
| StatCard | `src/components/ui/stat-card.tsx` | KPI metrics |
| ProgressBar | `src/components/ui/progress-bar.tsx` | Progress indicators |
| TrialBanner | `src/components/ui/trial-banner.tsx` | Trial UI |
| PlanLimitBanner | `src/components/ui/plan-limit-banner.tsx` | Plan gates |
| UpgradeGate | `src/components/ui/upgrade-gate.tsx` | Upgrade UI |

### 80% Reutilizable (con adaptación)
| Componente | Adaptación |
|-----------|------------|
| **Sidebar** | Nav items, roles, branding |
| **Topbar** | Notifications (orders vs appointments) |
| **DashboardLayout** | Rutas de comercio |
| **auth-context.tsx** | Entidades (store vs clinic) |
| **Plans (limits.ts, use-plan.ts)** | Límites de comercio (productos, clientes, agentes) |
| **Design system (globals.css)** | Colores de marca |

### Patrón de Ruta (100% reutilizable)
```
(dashboard)/  ← route group
  layout.tsx  ← sidebar + topbar + trial banner
  overview/
    page.tsx        ← server component (metadata + delegate)
    overview-content.tsx  ← client component (useState, useEffect, JSX)
  orders/           ← igual
  products/         ← igual
  customers/        ← igual
  ...
```

### Patrón de Página (100% reutilizable)
```
'use client'
Header (title + subtitle + action button)
KPI row (StatCards)
Search + filter pills
List/cards with data
Modal for create/edit
Delete confirmation
```

### Code Smells a NO Repetir
1. **Queries directas en useEffect** — usar React Query (ya instalado)
2. **Sin loading states** — agregar skeletons
3. **Sin error handling** — `.catch()` faltantes
4. **HTML inline de modales** — usar el componente Modal

---

## 6. NUEVAS ENTIDADES vs CLINIFY

| Clinify | → Concierge AI | Estrategia |
|---------|---------------|------------|
| `pacientes` | `customers` | Renombrar + agregar email, dirección, preferencias |
| `turnos` | `orders` | Reemplazar completamente |
| `profesionales` | `agents` | Renombrar + agregar comisión, métricas |
| `especialidades` | `categories` | Renombrar + jerarquía |
| `clínicas` | `stores` | Renombrar |
| `prestaciones` | `products` | Nueva tabla completa |
| No existe | `product_variants` | Nueva (stock por color/talle) |
| No existe | `cart` | Nueva (carrito conversacional) |
| No existe | `coupons` | Nueva (promociones) |
| No existe | `shipping_config` | Nueva |
| No existe | `faq_knowledge` | Nueva (base de conocimiento) |

---

## 7. RIESGOS IDENTIFICADOS

### Riesgo Crítico: Plan Enforcement Client-Side
Actualmente `canAdd*` se ejecuta SOLO en el browser. Para comercio, agregar server-side validation en API routes y/o RLS policies.

### Riesgo Alto: Sin Integración de Pagos
Clinify no tiene Stripe/MercadoPago. Para comercio es **crítico** desde el día 1.

### Riesgo Medio: Escalabilidad de Búsqueda
Para negocios con 10,000+ variantes, PostgreSQL full-text search + trigram similarity es el piso. Preparar arquitectura para embeddings futuros.

### Riesgo Medio: Evolution API como Single Point of Failure
Si Evolution API cae, el negocio no puede vender. Agregar health checks y failover.

### Riesgo Bajo: Duplicación de Chat Tables
Consolidar en una sola tabla `conversations` con `channel` discriminator.

---

## 8. DEUDA TÉCNICA HEREDADA (NO REPETIR)

1. **Dos tablas de conversaciones** (conversations + wa_conversations) — consolidar
2. **RLS activo sin policies** en weekly_schedules — corregir
3. **API keys en texto plano** — encriptar
4. **console.log rompiendo promesas** (paciente-detail) — ya corregido en Clinify
5. **Números mágicos** (max_tokens: 300 hardcodeado) — configurable por tenant
6. **Sin tests en webhook** — agregar tests de integración
