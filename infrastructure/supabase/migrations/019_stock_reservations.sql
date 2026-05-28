-- 019_stock_reservations.sql
-- Stock reservation system with row-level locking.
-- Prevents overselling by reserving stock at checkout time.

-- ============================================================
-- 1. Stock reservations table
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    UUID NOT NULL REFERENCES product_variants(id),
  order_id      UUID NOT NULL REFERENCES orders(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  expires_at    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'confirmed', 'released', 'expired')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant ON stock_reservations(variant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires ON stock_reservations(expires_at)
  WHERE status = 'active';

-- ============================================================
-- 2. get_available_stock(variant_id)
-- Returns effective stock minus active reservations.
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_stock(p_variant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_real_stock INTEGER;
  v_reserved   INTEGER;
BEGIN
  SELECT stock INTO v_real_stock
  FROM product_variants
  WHERE id = p_variant_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
  FROM stock_reservations
  WHERE variant_id = p_variant_id
    AND status = 'active';

  RETURN v_real_stock - v_reserved;
END;
$$;

-- ============================================================
-- 3. reserve_stock_for_order(order_id)
-- Creates reservation rows for each order item.
-- Uses row-level locking (FOR UPDATE) on variant rows.
-- Returns FALSE if any item has insufficient stock.
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_stock_for_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_available INTEGER;
  v_ok BOOLEAN := TRUE;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '2 hours';
BEGIN
  FOR v_item IN
    SELECT oi.variant_id, oi.quantity
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = p_order_id
    FOR UPDATE OF pv  -- row-level lock prevents race conditions
  LOOP
    -- Check available stock using current lock
    SELECT get_available_stock(v_item.variant_id) INTO v_available;

    IF v_available < v_item.quantity THEN
      v_ok := FALSE;
      EXIT;
    END IF;

    -- Create reservation
    INSERT INTO stock_reservations (variant_id, order_id, quantity, expires_at, status)
    VALUES (v_item.variant_id, p_order_id, v_item.quantity, v_expires_at, 'active');
  END LOOP;

  IF NOT v_ok THEN
    -- Release any reservations we already made
    UPDATE stock_reservations
    SET status = 'released'
    WHERE order_id = p_order_id AND status = 'active';

    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 4. confirm_stock_for_order(order_id)
-- Deducts real stock and records inventory movements.
-- Call when payment is confirmed.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_stock_for_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT sr.id, sr.variant_id, sr.quantity
    FROM stock_reservations sr
    WHERE sr.order_id = p_order_id AND sr.status = 'active'
    FOR UPDATE
  LOOP
    -- Deduct real stock
    UPDATE product_variants
    SET stock = stock - v_reservation.quantity
    WHERE id = v_reservation.variant_id;

    -- Record inventory movement
    INSERT INTO inventory_movements (variant_id, quantity, type, reference_type, reference_id, notes)
    VALUES (
      v_reservation.variant_id,
      v_reservation.quantity,
      'out',
      'order',
      p_order_id,
      'Stock confirmed for order'
    );

    -- Mark reservation as confirmed
    UPDATE stock_reservations
    SET status = 'confirmed'
    WHERE id = v_reservation.id;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 5. release_stock_for_order(order_id)
-- Releases all active reservations for an order.
-- Call when order is cancelled or expired.
-- ============================================================
CREATE OR REPLACE FUNCTION release_stock_for_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE stock_reservations
  SET status = 'released'
  WHERE order_id = p_order_id AND status = 'active';

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 6. release_expired_reservations()
-- Releases all reservations past their expiration time.
-- Called by cron job.
-- ============================================================
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE stock_reservations
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_stock_reservations" ON stock_reservations
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "service_insert_stock_reservations" ON stock_reservations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_update_stock_reservations" ON stock_reservations
  FOR UPDATE USING (true);

-- Grants
GRANT SELECT ON TABLE stock_reservations TO anon;
GRANT ALL ON TABLE stock_reservations TO authenticated;
GRANT ALL ON TABLE stock_reservations TO service_role;

GRANT EXECUTE ON FUNCTION get_available_stock TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reserve_stock_for_order TO service_role;
GRANT EXECUTE ON FUNCTION confirm_stock_for_order TO service_role;
GRANT EXECUTE ON FUNCTION release_stock_for_order TO service_role;
GRANT EXECUTE ON FUNCTION release_expired_reservations TO service_role;
