-- Add context column to conversations (for bot state) + realtime
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY messages;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS evolution_instance TEXT;
CREATE INDEX IF NOT EXISTS idx_stores_evolution_instance ON stores(evolution_instance);
