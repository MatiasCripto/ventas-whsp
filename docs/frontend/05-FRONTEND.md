# Fase 5: Dashboard y Frontend

## Estrategia de Reutilización

1. **Copiar carpeta completa** `src/components/ui/` de Clinify — 100% reutilizable
2. **Copiar** `src/components/layout/` y adaptar navegación
3. **Copiar** `src/lib/hooks/auth-context.tsx` y renombrar entidades
4. **Copiar** `src/lib/utils/` entero
5. **Copiar** design system (`globals.css`) y cambiar colores de marca
6. **Copiar** `src/app/(dashboard)/layout.tsx` y adaptar rutas

## Paleta de Colores (Concierge AI)

```css
:root {
  --brand: #7C3AED;         /* Violeta (vs indigo de Clinify) */
  --brand-light: #A78BFA;
  --brand-dark: #6D28D9;
  --brand-bg: #F5F3FF;
}
```

Justificación: Violeta transmite creatividad, lujo, confianza. Ideal para moda/indumentaria.

## Estructura de Componentes

```
src/
  app/
    (dashboard)/
      layout.tsx            ← REUSADO de Clinify (sidebar + topbar)
      overview/
        page.tsx
        overview-content.tsx ← KPIs comerciales
      orders/
        page.tsx
        orders-content.tsx
        [id]/page.tsx
      products/
        page.tsx
        products-content.tsx
        new/page.tsx
        [id]/page.tsx
      customers/
        page.tsx
        customers-content.tsx
        [id]/page.tsx
      conversations/
        page.tsx
        conversations-content.tsx
        [id]/page.tsx
      analytics/
        page.tsx
        analytics-content.tsx
      automations/
        page.tsx
        automations-content.tsx
      settings/
        page.tsx
        settings-content.tsx
    
  components/
    ui/                     ← 100% REUSADO de Clinify
    commerce/
      product-card.tsx
      variant-picker.tsx
      order-timeline.tsx
      customer-card.tsx
      inventory-input.tsx
      stock-badge.tsx
    layout/
      sidebar.tsx           ← ADAPTADO (nav items de comercio)
      topbar.tsx            ← ADAPTADO (notificaciones de pedidos)
    
  lib/
    hooks/
      auth-context.tsx      ← ADAPTADO (store en vez de clinic)
      use-auth.ts           ← REUSADO
      use-plan.ts           ← REUSADO
    utils/
      cn.ts                 ← REUSADO
      formatters.ts         ← REUSADO (ajustar locale)
    stores/
      dashboard-store.ts    ← NUEVO (filtros globales)
```

## Componentes Clave

### Overview (Dashboard Principal)
```typescript
// KPIs principales
- Ingresos hoy / este mes
- Pedidos (pendientes, confirmados, enviados)
- Clientes nuevos
- Productos más vendidos
- Tasa de conversión WhatsApp
```

### Products (Catálogo)
```typescript
- Lista con búsqueda + filtros (categoría, activo, stock bajo)
- Modal/tabla de variantes por producto
- Stock en tiempo real
- Carga masiva CSV
```

### Orders (Pedidos)
```typescript
- Timeline de estado del pedido
- Acciones por estado (confirmar → preparar → enviar → entregar)
- Detalle con items, cliente, dirección, pago
```

### Conversations (Bandeja)
```typescript
- Chats ordenados por último mensaje
- Indicador de IA vs humano
- Botón de human takeover con contexto
```

## Plan de Implementación

1. Setup del proyecto Next.js con Tailwind y Supabase
2. Copiar UI primitives de Clinify
3. Implementar auth + layout
4. Página de Productos (CRUD completo)
5. Página de Pedidos (CRUD + timeline)
6. Página de Clientes
7. Página de Conversaciones
8. Página de Analytics
9. Settings + plan gates
