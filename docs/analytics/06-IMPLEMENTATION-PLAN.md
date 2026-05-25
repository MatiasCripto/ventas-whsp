# Fase 6-8: Automatizaciones, Testing y Producción

## Fase 6: Automatizaciones

### Internal Jobs API (REUSADO de Clinify)

```
POST /api/jobs/execute
Headers: Authorization: Bearer JOB_SECRET
Body: { workflow, entityType, entityId }

Workflows iniciales:
- cart_abandonment_24h
- cart_abandonment_48h (con descuento)
- order_confirmation
- order_shipped
- order_delivered
- post_purchase_7d
- birthday_discount
- reengagement_30d
```

### Implementación
```typescript
// src/app/api/jobs/execute/route.ts
export async function POST(req: NextRequest) {
  const { workflow, entityType, entityId } = await req.json()
  
  // Idempotencia: check si ya se ejecutó
  const existing = await checkExisting(workflow, entityType, entityId)
  if (existing) return NextResponse.json({ ok: true, skipped: true })
  
  // Ejecutar workflow
  const result = await executeWorkflow(workflow, { entityType, entityId })
  
  // Log
  await logExecution({ workflow, entityType, entityId, status: 'success' })
  
  return NextResponse.json({ ok: true })
}
```

## Fase 7: Testing + Hardening

### Tests a Implementar

| Tipo | Cobertura | Herramienta |
|------|-----------|-------------|
| Unit | Intent classifier, product retrieval, context builder | Vitest |
| Unit | AI response parser, action validator | Vitest |
| Integration | WhatsApp webhook flow | Vitest + MSW |
| Integration | Order CRUD API | Vitest |
| Integration | Product search endpoints | Vitest |
| E2E | Dashboard navigation | Playwright |
| E2E | Product CRUD flow | Playwright |
| E2E | Order management flow | Playwright |

### Test de IA (crítico)
```typescript
// Test que la IA nunca inventa datos
describe('AI Response Safety', () => {
  it('should never hallucinate stock', () => {
    const context = buildCommerceContext({ products: [] })
    expect(context).not.toContain('stock')
    expect(context).not.toContain('disponible')
  })
  
  it('should use real prices from DB', async () => {
    const response = await generateResponse('search', { products: [{ price: 5000 }] })
    expect(response).toContain('5000')
    expect(response).not.toContain(Matchers.anyNumber()) // no inventa precios
  })
})
```

### Hardening
- Rate limiting (heredado de Clinify)
- Webhook secret validation (heredado)
- SQL injection prevention (parametrized queries via Supabase)
- XSS prevention (React sanitiza por defecto)
- Plan enforcement server-side
- Encrypt payment gateway credentials

## Fase 8: Production Readiness

### Checklist

- [ ] Migraciones SQL aplicadas sin errores
- [ ] RLS policies funcionando en todas las tablas
- [ ] Webhook de Evolution API configurado
- [ ] AI multi-provider configurable por tenant
- [ ] System prompt revisado y probado
- [ ] Importación CSV de productos
- [ ] Plan gates funcionando (client + server)
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Tests E2E de flujo crítico (producto → carrito → pedido)
- [ ] Rate limiting activo
- [ ] Error tracking (Sentry opcional)
- [ ] Backup automático de DB
- [ ] CI/CD en GitHub Actions

### Monitoreo
- Health check endpoint
- Automation logs dashboard
- AI cost tracking por conversación
- Error rate por provider
- Respuesta promedio del bot
- Tasa de conversión WhatsApp

## Roadmap Total

```
Semana 1-2:  Setup + Auth + Layout + DB migrations
Semana 3-4:  Commerce Brain (retrieval + AI)
Semana 5-6:  WhatsApp webhook + flujo completo
Semana 7-8:  Dashboard (productos, pedidos, clientes)
Semana 9:    Analytics + optimizaciones
Semana 10:   Testing + hardening + producción
```
