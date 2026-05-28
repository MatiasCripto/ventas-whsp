-- 024_recovery_automation.sql
-- Add reminder tracking fields to orders table.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_stopped BOOLEAN DEFAULT false;
