-- Automations schema

-- ============================================================
-- Automation Logs
-- ============================================================
CREATE TABLE automation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,

  workflow        TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,

  status          TEXT NOT NULL CHECK (status IN ('success', 'error')),
  payload         JSONB DEFAULT '{}',
  error           TEXT,

  executed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_logs_org ON automation_logs(organization_id);
CREATE INDEX idx_automation_logs_workflow ON automation_logs(workflow);
CREATE INDEX idx_automation_logs_entity ON automation_logs(entity_type, entity_id);
CREATE INDEX idx_automation_logs_executed ON automation_logs(executed_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_logs_org_access" ON automation_logs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
