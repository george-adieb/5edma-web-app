-- Public update form: mother name + student's personal phone, location columns.
-- Run in Supabase SQL Editor BEFORE deploying public-update-student-data.
alter table public.students
  add column if not exists mother_name text,
  add column if not exists student_phone text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists location_updated_at timestamptz;
