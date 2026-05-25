# Concierge AI — Visión del Producto

## ¿Qué es?

Concierge AI es una **infraestructura de ventas conversacionales con IA** para negocios que venden principalmente por Instagram + WhatsApp.

No es un chatbot. No es un ecommerce. No es un CRM.

Es un **vendedor IA conversacional 24/7** que vive en WhatsApp y vende como un humano.

## El Problema

Los negocios en LATAM (indumentaria, accesorios, calzado, etc.) venden por Instagram:
- Publican fotos en Instagram
- El cliente escribe al WhatsApp del negocio
- El dueño/empleado responde MANUALMENTE

Problemas concretos:
- Responden tarde (a veces horas o días)
- Pierden ventas porque no contestan rápido
- No tienen seguimiento de clientes
- No controlan stock bien ("chequeo y te digo")
- Responden preguntas repetitivas todo el día
- No hacen remarketing
- No saben qué productos se venden más
- No convierten conversaciones en ventas

## La Solución

Un AI agent en WhatsApp que:

### 1. Atiende 24/7
Responde al instante, cualquier hora, cualquier día.

### 2. Sabe TODO del catálogo
Precios, colores, talles, stock real, promociones.
NUNCA inventa nada — todo viene de la base de datos.

### 3. Vende como humano
NO es un bot con menús.
Habla natural, recomienda, hace upsell, genera confianza.

### 4. Toma pedidos completos
Arma el carrito, confirma dirección, método de pago.
Deja el pedido listo para procesar.

### 5. Hace seguimiento
Recupera carritos abandonados.
Pregunta si quiere comprar de nuevo.
Avisa cuando llega nuevo stock.

### 6. Dashboard simple
El negocio ve sus pedidos, clientes, productos, ventas.
Todo claro, sin complejidad técnica.

## El Nombre

**Concierge AI** — porque se comporta como un conserje de tienda:
sabe lo que hay, recomienda, recuerda a los clientes, y cierra ventas.

## Stack Tecnológico

- Next.js 16.x (App Router)
- Supabase (PostgreSQL + RLS + Auth)
- Evolution API (WhatsApp)
- OpenAI / Anthropic / Groq (multi-provider IA)
- n8n (automatizaciones futuras)
- TypeScript
- Tailwind CSS
- Vitest + Playwright

## Diferenciación

| Aspecto | Concierge AI | Competencia (Wazzy, BotPenguin, etc.) |
|---------|-------------|--------------------------------------|
| Conversación | Natural, contextual, fluida | Menús rígidos, flujos predefinidos |
| Catálogo | Server-side validated, real | Depende de integraciones limitadas |
| Memoria | Comercial: compras, preferencias, talles | Sin memoria o muy básica |
| Control | Código propio, datos propios | Caja negra SaaS |
| Precio | Escalable, sin markup por conversación | $200-$500/mes fijo |
| Customización | Ilimitada | Lo que ellos permitan |
| Multi-local | Nativo multi-tenant | Una cuenta por negocio |
