-- Student data scoping (grade + gender) enforced in the database.
--
-- Root cause being fixed: students / attendance_records / student_points_logs / alerts had
-- policies `USING (true)` for role PUBLIC (so even anonymous visitors could read and write),
-- and the only scoping was done in the browser, and only for SERVANT. A SERVICE_HEAD (or
-- anyone calling the REST API directly) saw every student.
--
-- Rules (single source of truth: public.can_access_student):
--   ADMIN          → every student
--   SERVICE_HEAD   → students whose grade is in profiles.assigned_grades (exact match)
--                    AND gender = profiles.assigned_gender
--   SERVANT        → same, using assigned_grade (or assigned_grades if present)
--   anything else, or empty grades / missing gender / student with NULL grade or gender → DENY
-- Related tables inherit the rule through student_id.

begin;

-- ── 1. Scope function (SECURITY DEFINER so it can read profiles without RLS recursion) ──
create or replace function public.can_access_student(p_grade text, p_gender text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select case
      when pr.role = 'ADMIN' then true
      when pr.role in ('SERVICE_HEAD', 'SERVANT') then
            p_grade  is not null
        and p_gender is not null
        and pr.assigned_gender is not null
        and pr.assigned_gender = p_gender
        and p_grade = any (
              case when coalesce(cardinality(pr.assigned_grades), 0) > 0 then pr.assigned_grades
                   when pr.assigned_grade is not null                    then array[pr.assigned_grade]
                   else array[]::text[] end)
      else false
    end
    from public.profiles pr
    where pr.id = auth.uid()
  ), false);
$$;
revoke all on function public.can_access_student(text, text) from public, anon;
grant execute on function public.can_access_student(text, text) to authenticated;

-- ── 2. students ───────────────────────────────────────────────────────────────
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;
create policy students_select on public.students for select to authenticated
  using (public.can_access_student(grade, gender));
create policy students_insert on public.students for insert to authenticated
  with check (public.can_access_student(grade, gender));
create policy students_update on public.students for update to authenticated
  using (public.can_access_student(grade, gender))
  with check (public.can_access_student(grade, gender));
create policy students_delete on public.students for delete to authenticated
  using (public.can_access_student(grade, gender));

-- ── 3. Tables keyed by student_id: visible only if the student is visible ───────
-- (the sub-select on students is itself filtered by students_select)
do $$
declare t text;
begin
  foreach t in array array['attendance_records','follow_ups','follow_up_logs','student_points_logs'] loop
    execute format('create policy %I on public.%I for all to authenticated
                      using (student_id in (select s.id from public.students s))
                      with check (student_id in (select s.id from public.students s))',
                   t || '_scoped', t);
  end loop;
end $$;

-- remove every previous (open) policy on those tables, keeping only the new *_scoped one
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('attendance_records','follow_ups','follow_up_logs','student_points_logs')
             and policyname not like '%\_scoped' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── 4. Points summary view must obey the caller's RLS ─────────────────────────
alter view public.student_points_summary set (security_invoker = true);

-- ── 5. alerts: authenticated only; changes by admin or the author ─────────────
drop policy if exists alerts_select on public.alerts;
drop policy if exists alerts_insert on public.alerts;
drop policy if exists alerts_update on public.alerts;
drop policy if exists alerts_delete on public.alerts;
create policy alerts_select on public.alerts for select to authenticated using (true);
create policy alerts_insert on public.alerts for insert to authenticated with check (auth.uid() is not null);
create policy alerts_update on public.alerts for update to authenticated
  using (created_by = auth.uid() or public.get_current_user_role() = 'ADMIN')
  with check (created_by = auth.uid() or public.get_current_user_role() = 'ADMIN');
create policy alerts_delete on public.alerts for delete to authenticated
  using (created_by = auth.uid() or public.get_current_user_role() = 'ADMIN');

-- ── 6. classes / stages / class_servants reads: authenticated only ────────────
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated using (true);
drop policy if exists stages_select on public.stages;
create policy stages_select on public.stages for select to authenticated using (true);

-- ── 7. Anonymous role gets no table privileges at all ─────────────────────────
-- (public pages go through service-role Edge Functions: get-student-points,
--  public-update-student-data)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

commit;

-- ROLLBACK (restores the old open state — only if something breaks):
--   grant all on all tables in schema public to anon;
--   alter view public.student_points_summary reset (security_invoker);
--   -- recreate the old `... to public using (true)` policies by name:
--   --   students_*, attendance_*, points_logs_*, alerts_*, follow_up_logs_* (auth.role()='authenticated')
