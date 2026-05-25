-- Core multi-tenant schema (REUSED pattern from Clinify)
-- organizations, profiles, stores

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- CORE: Organizations (multi-tenant root)
-- ============================================================
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  plan            TEXT DEFAULT 'starter',
  settings        JSONB DEFAULT '{}',
  trial_ends_at   TIMESTAMPTZ,
  trial_used      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CORE: Profiles (users within orgs)
-- ============================================================
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent', 'viewer');

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  role            user_role DEFAULT 'agent',
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- ============================================================
-- CORE: Stores (sucursales/tiendas within orgs)
-- ============================================================
CREATE TABLE stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  phone             TEXT,
  whatsapp_number   TEXT,
  timezone          TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  settings          JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT true,
  evolution_instance TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stores_org ON stores(organization_id);
CREATE INDEX idx_stores_instance ON stores(evolution_instance) WHERE evolution_instance IS NOT NULL;
