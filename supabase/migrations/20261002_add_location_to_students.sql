-- ─── Migration: Add location columns to students table ───────────────────────
-- Safe migration: only adds new columns, does not modify or delete existing data.
-- Run this in Supabase SQL Editor once.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS latitude          numeric,
  ADD COLUMN IF NOT EXISTS longitude         numeric,
  ADD COLUMN IF NOT EXISTS location_accuracy text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Optional: add a comment for documentation
COMMENT ON COLUMN students.address            IS 'العنوان التفصيلي (نص مكتوب)';
COMMENT ON COLUMN students.latitude           IS 'خط العرض لموقع سكن المخدوم';
COMMENT ON COLUMN students.longitude          IS 'خط الطول لموقع سكن المخدوم';
COMMENT ON COLUMN students.location_accuracy  IS 'دقة الموقع (اختياري)';
COMMENT ON COLUMN students.location_updated_at IS 'تاريخ آخر تحديث للموقع';
