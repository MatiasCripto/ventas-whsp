-- 023_notifications.sql
-- Admin notifications with Realtime support.

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  read            BOOLEAN DEFAULT false,
  entity_type     TEXT,
  entity_id       UUID,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(organization_id, read)
  WHERE read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_notifications" ON notifications
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "org_insert_notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "org_update_notifications" ON notifications
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON TABLE notifications TO anon;
GRANT ALL ON TABLE notifications TO authenticated;
GRANT ALL ON TABLE notifications TO service_role;

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
