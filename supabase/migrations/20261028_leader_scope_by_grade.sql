-- Fix: service leader saw ZERO servants.
-- Cause: 20261027 made visibility depend on profiles.managed_by = leader, but all existing servants
-- have managed_by NULL, so nothing matched. Correct rule (grade + gender, no explicit link):
--   SEE    : active SERVANT, same gender as the leader, at least one of the servant's grades is one of the leader's grades
--   MANAGE : same, but ALL of the servant's grades are inside the leader's grades (edit / reset password / deactivate)
-- A NULL / empty grade or gender never matches anything. Admin / general-secretariat / other leaders never match.

begin;

drop policy if exists profiles_select_scoped on public.profiles;
drop function if exists public.leader_can_manage(text, uuid, text, text[], text, text);

create or replace function public._leader_grade_match(
  p_role text, p_grade text, p_grades text[], p_gender text, p_status text, p_require_all boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.role = 'SERVICE_HEAD'
       and pr.assigned_gender is not null
       and p_role = 'SERVANT'
       and public.is_active_status(p_status)
       and p_gender is not null and p_gender = pr.assigned_gender
       and cardinality(sg.g) > 0
       and case when p_require_all
                then sg.g <@ lg.g
                else sg.g && lg.g end
    from public.profiles pr
    cross join lateral (
      select array(select distinct x from unnest(
               coalesce(p_grades, array[]::text[]) ||
               case when p_grade is not null then array[p_grade] else array[]::text[] end) x) as g
    ) sg
    cross join lateral (
      select coalesce(nullif(pr.assigned_grades, '{}'),
                      case when pr.assigned_grade is not null then array[pr.assigned_grade] else array[]::text[] end) as g
    ) lg
    where pr.id = auth.uid() and public.is_active_status(pr.status)
  ), false);
$$;

create or replace function public.leader_can_see(p_role text, p_grade text, p_grades text[], p_gender text, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select public._leader_grade_match(p_role, p_grade, p_grades, p_gender, p_status, false)
$$;
create or replace function public.leader_can_manage(p_role text, p_grade text, p_grades text[], p_gender text, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select public._leader_grade_match(p_role, p_grade, p_grades, p_gender, p_status, true)
$$;
revoke all on function public._leader_grade_match(text, text, text[], text, text, boolean) from public, anon;
revoke all on function public.leader_can_see(text, text, text[], text, text) from public, anon;
revoke all on function public.leader_can_manage(text, text, text[], text, text) from public, anon;
grant execute on function public._leader_grade_match(text, text, text[], text, text, boolean) to authenticated;
grant execute on function public.leader_can_see(text, text, text[], text, text) to authenticated;
grant execute on function public.leader_can_manage(text, text, text[], text, text) to authenticated;

create policy profiles_select_scoped on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.get_current_user_role() = 'ADMIN'
    or public.leader_can_see(role, assigned_grade, assigned_grades, assigned_gender, status)
  );

-- dropdown "responsible servant": any active servant with exactly that grade + gender, for callers who
-- have that student scope (can_access_student already restricts the caller to their own grades/gender).
create or replace function public.assignable_servants(p_grade text, p_gender text)
returns table (id uuid, full_name text, assigned_grade text, assigned_gender text, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.assigned_grade, s.assigned_gender, s.status
  from public.profiles s
  where s.role = 'SERVANT'
    and public.is_active_status(s.status)
    and s.assigned_grade = p_grade
    and s.assigned_gender = p_gender
    and public.can_access_student(p_grade, p_gender)
  order by s.full_name;
$$;

-- the explicit link is not used any more
drop index if exists public.profiles_managed_by_idx;
alter table public.profiles drop column if exists managed_by;

commit;
