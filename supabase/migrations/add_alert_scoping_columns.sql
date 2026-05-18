-- ============================================================
-- Migration: Add alert scoping columns
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add grade/gender targeting and creator metadata to the alerts table
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS target_grades   text[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_genders  text[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_role text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_global       boolean  DEFAULT false NOT NULL;

-- Index for faster array overlap filtering
CREATE INDEX IF NOT EXISTS idx_alerts_target_grades ON alerts USING GIN (target_grades);

-- Backfill existing alerts as global (visible to ADMIN and SERVICE_HEAD)
-- so that nothing breaks for historical alerts created before this migration.
UPDATE alerts SET is_global = true WHERE target_grades IS NULL;
