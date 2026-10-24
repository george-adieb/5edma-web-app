-- Responsible servant must be eligible for the student's grade + gender.
--   1. assignable_servants() now also honours profiles.assigned_grades (multi-grade servants)
--      and tolerates the بنين/بنات labels for ذكر/أنثى.
--   2. students_servant_guard (BEFORE INSERT/UPDATE) rejects an ineligible students.servant
--      for end-user requests. students.servant stores the servant's full_name (or profile id).
--      Existing rows are untouched: on UPDATE it only validates when servant, grade or gender changes.
--      Calls without a user JWT (service role, SQL editor, yearly promotion) are not checked.
begin;

create or replace function public._norm_gender(p text)
returns text language sql immutable as $$
  select case btrim(coalesce(p, ''))
    when 'بنين' then 'ذكر'
    when 'بنات' then 'أنثى'
    when '' then null
    else btrim(p) end
$$;

create or replace function public._servant_eligible(p_profile public.profiles, p_grade text, p_gender text)
returns boolean language sql immutable as $$
  select p_profile.role = 'SERVANT'
     and public.is_active_status(p_profile.status)
     and p_grade is not null and p_gender is not null
     and public._norm_gender(p_profile.assigned_gender) = public._norm_gender(p_gender)
     and p_grade = any (
           case when coalesce(cardinality(p_profile.assigned_grades), 0) > 0 then p_profile.assigned_grades
                when p_profile.assigned_grade is not null then array[p_profile.assigned_grade]
                else array[]::text[] end)
$$;

create or replace function public.assignable_servants(p_grade text, p_gender text)
returns table (id uuid, full_name text, assigned_grade text, assigned_gender text, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.assigned_grade, s.assigned_gender, s.status
  from public.profiles s
  where public._servant_eligible(s, p_grade, p_gender)
    and public.can_access_student(p_grade, public._norm_gender(p_gender))
  order by s.full_name;
$$;
revoke all on function public.assignable_servants(text, text) from public, anon;
grant execute on function public.assignable_servants(text, text) to authenticated;

create or replace function public.students_servant_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if nullif(btrim(coalesce(new.servant, '')), '') is null then return new; end if;
  if tg_op = 'UPDATE'
     and old.servant is not distinct from new.servant
     and old.grade   is not distinct from new.grade
     and old.gender  is not distinct from new.gender then
    return new;   -- legacy assignment left as-is
  end if;
  if not exists (
    select 1 from public.profiles s
    where (s.full_name = btrim(new.servant) or s.id::text = btrim(new.servant))
      and public._servant_eligible(s, new.grade, new.gender)
  ) then
    raise exception 'الخادم المسؤول المختار غير مخصص لهذه المرحلة والنوع' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists students_servant_guard on public.students;
create trigger students_servant_guard
  before insert or update on public.students
  for each row execute function public.students_servant_guard();

commit;

-- ROLLBACK:
--   drop trigger students_servant_guard on public.students;
--   drop function public.students_servant_guard(); (assignable_servants: re-run 20261028_leader_scope_by_grade.sql)
