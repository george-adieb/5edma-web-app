-- Service-leader ↔ servant management.
--
-- Root cause of the visibility problem:
--   * profiles had `profiles_select_all_authenticated USING (true)` (+ a grade-based policy), so ANY
--     logged-in user could read EVERY profile — including ADMIN ("الأمانة العامة") emails/phones —
--     straight from the REST API, and the app filtered the list in the browser by grade only.
--   * There was no explicit leader→servant relationship, so "same grade" meant "managed by me".
--
-- This migration:
--   1. profiles.managed_by  → the service leader who manages a servant (explicit, admin-controlled).
--   2. Deactivated accounts (status 'غير نشط') lose all database access immediately.
--   3. profiles SELECT becomes: own row | ADMIN: all | SERVICE_HEAD: only the active servants they
--      manage that are entirely inside their grades + gender. Nobody else's profile is readable.
--   4. Two minimal RPCs replace the broad profile reads the UI used to rely on:
--        assignable_servants(grade, gender) – names for the "responsible servant" dropdown
--        profile_display_names(ids)         – author names on logs (admins appear as الأمانة العامة)
--   5. Audit actions deactivate / reactivate.
-- NOTE: existing servants get managed_by = NULL on purpose (no automatic assignment by grade);
--       an admin must assign them to a leader (Edit user → أمين الخدمة المسؤول).

begin;

alter table public.profiles
  add column if not exists managed_by uuid references public.profiles(id) on delete set null;
create index if not exists profiles_managed_by_idx on public.profiles (managed_by);

-- ── helpers (all SECURITY DEFINER so they can read profiles without RLS recursion) ──
create or replace function public.is_active_status(p_status text)
returns boolean language sql immutable as $$
  select coalesce(p_status, 'نشط') not in ('غير نشط', 'inactive')
$$;

create or replace function public.get_current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles
  where id = auth.uid() and public.is_active_status(status)
  limit 1;
$$;

create or replace function public.get_current_user_managed_grades()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
           nullif(assigned_grades, '{}'),
           case when assigned_grade is not null then array[assigned_grade] else array[]::text[] end)
  from public.profiles
  where id = auth.uid() and public.is_active_status(status)
  limit 1;
$$;

-- student scope: inactive accounts get nothing
create or replace function public.can_access_student(p_grade text, p_gender text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when pr.role = 'ADMIN' then true
      when pr.role in ('SERVICE_HEAD', 'SERVANT') then
            p_grade is not null and p_gender is not null
        and pr.assigned_gender is not null and pr.assigned_gender = p_gender
        and p_grade = any (
              case when coalesce(cardinality(pr.assigned_grades), 0) > 0 then pr.assigned_grades
                   when pr.assigned_grade is not null                    then array[pr.assigned_grade]
                   else array[]::text[] end)
      else false
    end
    from public.profiles pr
    where pr.id = auth.uid() and public.is_active_status(pr.status)
  ), false);
$$;

-- May the CURRENT user (a service leader) manage this servant row?
-- explicit link + active + servant + same gender + ALL of the servant's grades inside the leader's grades.
create or replace function public.leader_can_manage(
  p_role text, p_managed_by uuid, p_grade text, p_grades text[], p_gender text, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.role = 'SERVICE_HEAD'
       and pr.assigned_gender is not null
       and p_role = 'SERVANT'
       and public.is_active_status(p_status)
       and p_managed_by = pr.id
       and p_gender = pr.assigned_gender
       and cardinality(sg.g) > 0
       and sg.g <@ coalesce(nullif(pr.assigned_grades, '{}'),
                            case when pr.assigned_grade is not null then array[pr.assigned_grade] else array[]::text[] end)
    from public.profiles pr
    cross join lateral (
      select array(select distinct x from unnest(
               coalesce(p_grades, array[]::text[]) ||
               case when p_grade is not null then array[p_grade] else array[]::text[] end) x) as g
    ) sg
    where pr.id = auth.uid() and public.is_active_status(pr.status)
  ), false);
$$;

revoke all on function public.is_active_status(text) from public, anon;
revoke all on function public.leader_can_manage(text, uuid, text, text[], text, text) from public, anon;
grant execute on function public.is_active_status(text) to authenticated;
grant execute on function public.leader_can_manage(text, uuid, text, text[], text, text) to authenticated;

-- ── profiles SELECT: replace the two broad policies ─────────────────────────────
drop policy if exists profiles_select_all_authenticated on public.profiles;
drop policy if exists profiles_select_safe_role_based   on public.profiles;
drop policy if exists profiles_select_scoped            on public.profiles;
create policy profiles_select_scoped on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.get_current_user_role() = 'ADMIN'
    or public.leader_can_manage(role, managed_by, assigned_grade, assigned_grades, assigned_gender, status)
  );

-- ── RPC: servants a user may pick as "responsible servant" for a student ───────
create or replace function public.assignable_servants(p_grade text, p_gender text)
returns table (id uuid, full_name text, assigned_grade text, assigned_gender text, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.assigned_grade, s.assigned_gender, s.status
  from public.profiles s
  where s.role = 'SERVANT'
    and public.is_active_status(s.status)
    and s.assigned_grade = p_grade
    and s.assigned_gender = p_gender
    and public.can_access_student(p_grade, p_gender)           -- caller must have this scope
    and (
      public.get_current_user_role() in ('ADMIN', 'SERVANT')   -- admin: all; servant: peers in own scope
      or (public.get_current_user_role() = 'SERVICE_HEAD'
          and public.leader_can_manage(s.role, s.managed_by, s.assigned_grade, s.assigned_grades, s.assigned_gender, s.status))
    )
  order by s.full_name;
$$;

-- ── RPC: display names for log authors (admins are shown as الأمانة العامة) ────
create or replace function public.profile_display_names(p_ids uuid[])
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id,
         case when p.role in ('ADMIN', 'GENERAL_SECRETARIAT')
                   and coalesce(public.get_current_user_role(), '') <> 'ADMIN'
              then 'الأمانة العامة' else coalesce(p.full_name, '') end
  from public.profiles p
  where auth.uid() is not null and p.id = any (p_ids);
$$;

revoke all on function public.assignable_servants(text, text) from public, anon;
revoke all on function public.profile_display_names(uuid[]) from public, anon;
grant execute on function public.assignable_servants(text, text) to authenticated;
grant execute on function public.profile_display_names(uuid[]) to authenticated;

-- ── audit actions ───────────────────────────────────────────────────────────────
alter table public.user_audit_logs drop constraint if exists user_audit_logs_action_check;
alter table public.user_audit_logs add constraint user_audit_logs_action_check
  check (action in ('create','role_change','assignment_change','profile_update','password_reset','delete','deactivate','reactivate'));

commit;

-- ROLLBACK (restores the old, over-broad state):
--   create policy profiles_select_all_authenticated on public.profiles for select to authenticated using (true);
--   drop policy profiles_select_scoped on public.profiles;
--   alter table public.profiles drop column managed_by;
