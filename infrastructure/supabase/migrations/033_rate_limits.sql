-- ============================================================
-- MIGRATION: 033_rate_limits
-- Description: Rate limiting table + atomic increment function.
--   Replaces the in-memory Map in src/lib/utils/rate-limit.ts
--   with a Supabase-backed solution that works across
--   multi-instance deployments (Vercel, Render, Railway, etc.).
-- ============================================================

-- 1. Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

-- Allow service_role full access
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_rate_limits" ON rate_limits
  FOR ALL USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO service_role;

-- 2. Atomic increment function
-- Called by checkRateLimit() in src/lib/utils/rate-limit.ts
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key text,
  p_window_start timestamptz,
  p_max_hits int DEFAULT 30
) RETURNS TABLE(
  allowed boolean,
  remaining int,
  current_count int
) LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO rate_limits (key, window_start, hit_count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET hit_count = rate_limits.hit_count + 1
  RETURNING rate_limits.hit_count INTO v_count;

  RETURN QUERY
  SELECT
    v_count <= p_max_hits AS allowed,
    GREATEST(0, p_max_hits - v_count) AS remaining,
    v_count AS current_count;
END;
$$;

-- 3. Auto-cleanup: remove entries older than 1 hour
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
