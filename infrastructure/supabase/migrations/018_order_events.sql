-- 018_order_events.sql
-- Order timeline / audit log
-- Records every state change, item mutation, and payment action for full accountability.

CREATE TABLE IF NOT EXISTS order_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  actor_type  TEXT NOT NULL DEFAULT 'system'
              CHECK (actor_type IN ('system', 'admin', 'customer', 'ai')),
  actor_id    UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at DESC);

-- Event types (stored as text, documented here for reference):
-- created, stock_reserved, payment_requested, proof_received,
-- payment_approved, payment_rejected, preparing, shipped,
-- delivered, completed, cancelled, expired, refunded,
-- item_added, item_removed, quantity_modified, note_added

-- RLS
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_order_events" ON order_events
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "org_insert_order_events" ON order_events
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Grants (table created after 009_rls_policies.sql)
GRANT SELECT, INSERT ON TABLE order_events TO anon;
GRANT ALL ON TABLE order_events TO authenticated;
GRANT ALL ON TABLE order_events TO service_role;
