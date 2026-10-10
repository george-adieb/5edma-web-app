-- PROPOSED — NOT APPLIED. Review before running.
-- Goal: anon (public API key) gets NO direct access; logged-in app users keep the
-- exact access they have today; Edge Functions keep working (service role bypasses RLS).
-- Postgres 17.6 (security_invoker views supported).

begin;

-- ── 1. students ──────────────────────────────────────────────────────────────
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;
create policy students_select on public.students for select to authenticated using (true);
create policy students_insert on public.students for insert to authenticated with check (true);
create policy students_update on public.students for update to authenticated using (true) with check (true);
create policy students_delete on public.students for delete to authenticated using (true);

-- ── 2. attendance_records ────────────────────────────────────────────────────
drop policy if exists attendance_select on public.attendance_records;
drop policy if exists attendance_insert on public.attendance_records;
drop policy if exists attendance_update on public.attendance_records;
drop policy if exists attendance_delete on public.attendance_records;
create policy attendance_select on public.attendance_records for select to authenticated using (true);
create policy attendance_insert on public.attendance_records for insert to authenticated with check (true);
create policy attendance_update on public.attendance_records for update to authenticated using (true) with check (true);
create policy attendance_delete on public.attendance_records for delete to authenticated using (true);

-- ── 3. student_points_logs ───────────────────────────────────────────────────
drop policy if exists points_logs_select on public.student_points_logs;
drop policy if exists points_logs_insert on public.student_points_logs;
drop policy if exists points_logs_update on public.student_points_logs;
drop policy if exists points_logs_delete on public.student_points_logs;
create policy points_logs_select on public.student_points_logs for select to authenticated using (true);
create policy points_logs_insert on public.student_points_logs for insert to authenticated with check (true);
create policy points_logs_update on public.student_points_logs for update to authenticated using (true) with check (true);
create policy points_logs_delete on public.student_points_logs for delete to authenticated using (true);

-- ── 4. student_points_summary (view) ─────────────────────────────────────────
-- Currently runs as its owner, so it bypasses RLS and anon can read it.
-- security_invoker makes it obey the caller's RLS (anon: nothing; logged-in: same as today).
alter view public.student_points_summary set (security_invoker = true);

-- ── 5. alerts (same open pattern) ────────────────────────────────────────────
drop policy if exists alerts_select on public.alerts;
drop policy if exists alerts_insert on public.alerts;
drop policy if exists alerts_update on public.alerts;
drop policy if exists alerts_delete on public.alerts;
create policy alerts_select on public.alerts for select to authenticated using (true);
create policy alerts_insert on public.alerts for insert to authenticated with check (true);
create policy alerts_update on public.alerts for update to authenticated using (true) with check (true);
create policy alerts_delete on public.alerts for delete to authenticated using (true);

-- ── 6. classes / stages: read policy was open to anon ────────────────────────
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated using (true);
drop policy if exists stages_select on public.stages;
create policy stages_select on public.stages for select to authenticated using (true);

-- ── 7. follow_ups: RLS is ON but has ZERO policies, so even logged-in users are
--       denied today (src/lib/database.js reads/writes it). This ADDS access for
--       authenticated users, consistent with follow_up_logs. Remove this block if
--       follow_ups is intentionally unused.
drop policy if exists follow_ups_all on public.follow_ups;
create policy follow_ups_all on public.follow_ups for all to authenticated using (true) with check (true);

-- follow_up_logs: already authenticated-only (auth.role() = 'authenticated'). No change.

-- ── 8. Belt and braces: remove table privileges from anon entirely ───────────
-- anon currently holds INSERT/UPDATE/DELETE/TRUNCATE etc. on every table.
-- RLS already blocks row access once the policies above are in place; this also
-- removes the privilege itself (TRUNCATE is NOT governed by RLS).
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

commit;

-- ── VERIFY (run as anon key from outside; all should be empty/401/403) ────────
--   curl "$URL/rest/v1/students?select=*&limit=1"             -H "apikey: $ANON"   -> permission denied / []
--   curl "$URL/rest/v1/student_points_summary?select=*"       -H "apikey: $ANON"   -> permission denied / []
--   curl -X PATCH "$URL/rest/v1/students?id=eq.<id>" ...      -H "apikey: $ANON"   -> permission denied
-- and with a logged-in session: students, attendance, points, follow-up map still load.

-- ── ROLLBACK (restores today's open state; only if something breaks) ─────────
-- begin;
--   grant all on all tables in schema public to anon;
--   alter view public.student_points_summary reset (security_invoker);
--   -- for each of students, attendance_records, student_points_logs, alerts:
--   --   drop the authenticated-only policies and recreate with: ... to public using (true) / with check (true)
--   --   (original names: students_*, attendance_*, points_logs_*, alerts_*; classes_select, stages_select)
-- commit;
