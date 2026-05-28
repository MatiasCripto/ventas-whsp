-- Checkout Flow: conversational commerce fields

-- ============================================================
-- Customers: add checkout data fields
-- ============================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_address TEXT;

-- ============================================================
-- Orders: add checkout flow fields
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locality TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS references TEXT;
