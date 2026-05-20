-- ══════════════════════════════════════════════════════════════════
-- Points System Migration
-- Run this in your Supabase SQL editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Points log table (source of truth)
CREATE TABLE IF NOT EXISTS student_points_logs (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  points               INTEGER       NOT NULL,
  reason               TEXT          NOT NULL,
  source               TEXT          NOT NULL CHECK (source IN ('attendance', 'activity', 'manual', 'correction')),
  attendance_record_id UUID          NULL,  -- references attendance_records.id when source='attendance'
  created_by           UUID          NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for quick per-student lookups
CREATE INDEX IF NOT EXISTS idx_student_points_logs_student_id
  ON student_points_logs (student_id);

-- Index to prevent duplicate attendance points (used in addAttendancePointsIfNeeded)
CREATE INDEX IF NOT EXISTS idx_student_points_logs_att_record
  ON student_points_logs (attendance_record_id, source)
  WHERE attendance_record_id IS NOT NULL;

-- 2. Summary view: total points per student (log is the source of truth)
CREATE OR REPLACE VIEW student_points_summary AS
SELECT
  student_id,
  SUM(points) AS total_points,
  COUNT(*)    AS log_count
FROM student_points_logs
GROUP BY student_id;

-- 3. RLS — enable and add permissive policies (adjust to your project's RLS strategy)
ALTER TABLE student_points_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all logs (role-based filtering is done in the app)
CREATE POLICY "Authenticated users can read points logs"
  ON student_points_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert new logs
CREATE POLICY "Authenticated users can insert points logs"
  ON student_points_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Optionally: allow update/delete for admins only (adjust as needed)
-- For now we treat the log as append-only; corrections use negative points.
