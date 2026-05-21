-- ============================================================
-- GrantFlow Phase 16: Compliance Document Expiry Tracking
-- Run each block SEPARATELY in Supabase SQL Editor.
-- ============================================================

-- Block 1: Add expiry fields to existing documents table
--   is_compliance  — flag to mark a document as a compliance requirement
--   document_type  — category for grouping/filtering compliance docs
--   expires_at     — the date this document version becomes invalid
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_compliance  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_type  text CHECK (
    document_type IN (
      'ethics_clearance',
      'tax_clearance',
      'institutional_agreement',
      'research_permit',
      'financial_report',
      'identity_document',
      'insurance',
      'other'
    )
  ),
  ADD COLUMN IF NOT EXISTS expires_at     date;

-- Block 2: Partial index for fast expiry lookups (only compliance docs)
CREATE INDEX IF NOT EXISTS documents_expiry_compliance_idx
  ON documents (expires_at)
  WHERE is_compliance = true AND expires_at IS NOT NULL;

-- Block 3: Convenience view — compliance documents with computed expiry status
--   expiry_status: 'expired' | 'expiring_soon' | 'active' | 'no_expiry'
CREATE OR REPLACE VIEW compliance_document_status AS
SELECT
  d.*,
  CASE
    WHEN d.expires_at IS NULL                          THEN 'no_expiry'
    WHEN d.expires_at < CURRENT_DATE                   THEN 'expired'
    WHEN d.expires_at <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END AS expiry_status,
  (d.expires_at - CURRENT_DATE) AS days_until_expiry
FROM documents d
WHERE d.is_compliance = true;
