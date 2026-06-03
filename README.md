# Concierge AI

Sistema operativo comercial conversacional para WhatsApp.

## Superadmin Setup

### 1. Ejecutar la migración

Aplicar `infrastructure/supabase/migrations/027_superadmin.sql` en Supabase Dashboard (SQL Editor).
Esta migración:
- Agrega el rol `superadmin` al ENUM `user_role` (FUERA de transacción)
- Agrega columnas `evolution_instance`, `variant_attr1`, `variant_attr2` a `stores`
- Agrega columna `active` a `organizations`

### 2. Crear el primer superadmin

Ejecutar en Supabase Dashboard (SQL Editor):

```sql
UPDATE profiles
SET role = 'superadmin'
WHERE id = (
  SELECT id FROM profiles
  WHERE role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1
);
```

Esto asigna el rol superadmin al primer owner registrado.

### 3. Acceder al panel

Visitar `/superadmin` en el navegador después de iniciar sesión con la cuenta superadmin.

## Rutas del Superadmin

| Ruta | Descripción |
|------|-------------|
| `/superadmin` | Panel general con KPIs |
| `/superadmin/organizations` | Lista de organizaciones |
| `/superadmin/organizations/new` | Wizard de onboarding |
| `/superadmin/organizations/[id]` | Detalle con tabs |
| `/superadmin/users` | Lista de todos los usuarios |

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
