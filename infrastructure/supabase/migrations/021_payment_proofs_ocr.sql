-- 021_payment_proofs_ocr.sql
-- Add OCR extraction columns to payment_proofs table.

ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS extracted_amount  NUMERIC(10,2);
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS extracted_alias   TEXT;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS extracted_date    TIMESTAMPTZ;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS extracted_bank    TEXT;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS extracted_holder  TEXT;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS ocr_confidence    REAL;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS ocr_raw_text      TEXT;
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS ocr_processed_at  TIMESTAMPTZ;
