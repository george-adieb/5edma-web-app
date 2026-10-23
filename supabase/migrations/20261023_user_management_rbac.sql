-- User Management & RBAC
-- Roles already in use (profiles.role): ADMIN, SERVICE_HEAD (أمين الخدمة), SERVANT (خادم). No new role needed.
--
-- 1. profiles can no longer be written from the browser. The previous policies allowed
--    ANY signed-in user to UPDATE their own row with no column limit (profiles_update_own),
--    i.e. `update profiles set role='ADMIN' where id = auth.uid()`. All writes now go
--    through the create-servant-user / manage-users Edge Functions (service role).
-- 2. user_audit_logs: admin-readable, service-role-writable.
-- 3. Trigger: the last ADMIN can never be demoted or deleted.

begin;

-- ── 1. profiles: remove browser write paths ─────────────────────────────────
drop policy if exists profiles_admin_insert                on public.profiles;
drop policy if exists profiles_admin_update                on public.profiles;
drop policy if exists profiles_service_head_insert_servants on public.profiles;
drop policy if exists profiles_service_head_update_servants on public.profiles;
drop policy if exists profiles_update_own                  on public.profiles;
-- legacy names from older migrations, if they were ever applied
drop policy if exists "Users can insert own profile"            on public.profiles;
drop policy if exists "Users can update own profile"            on public.profiles;
drop policy if exists "Admin can update any profile"            on public.profiles;
drop policy if exists "ServiceHead can update servant profiles" on public.profiles;
drop policy if exists "Users can delete own profile"            on public.profiles;

revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke select on public.profiles from anon;
-- SELECT policies are intentionally unchanged (profiles_select_all_authenticated is used by
-- the student/servant assignment dropdowns).

-- ── 2. Audit log ─────────────────────────────────────────────────────────────
create table if not exists public.user_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid not null,
  target_id      uuid,
  action         text not null check (action in ('create','role_change','assignment_change','profile_update')),
  previous_state jsonb,
  new_state      jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists user_audit_logs_created_idx on public.user_audit_logs (created_at desc);
create index if not exists user_audit_logs_target_idx  on public.user_audit_logs (target_id);

alter table public.user_audit_logs enable row level security;
drop policy if exists user_audit_logs_admin_select on public.user_audit_logs;
create policy user_audit_logs_admin_select on public.user_audit_logs
  for select to authenticated using (public.get_current_user_role() = 'ADMIN');

revoke all on public.user_audit_logs from anon, authenticated;
grant select on public.user_audit_logs to authenticated;   -- rows still gated by the policy above

-- ── 3. Never allow zero admins ───────────────────────────────────────────────
create or replace function public.profiles_guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'ADMIN'
     and (tg_op = 'DELETE' or new.role is distinct from 'ADMIN')
     and not exists (select 1 from public.profiles where role = 'ADMIN' and id <> old.id) then
    raise exception 'لا يمكن حذف أو تخفيض آخر مدير في النظام';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists profiles_guard_last_admin on public.profiles;
create trigger profiles_guard_last_admin
  before update of role or delete on public.profiles
  for each row execute function public.profiles_guard_last_admin();

commit;

-- ROLLBACK (restores the previous, insecure state — only if something breaks):
--   create policy profiles_update_own on public.profiles for update to public using (id = auth.uid());
--   grant insert, update, delete on public.profiles to authenticated;
--   drop trigger profiles_guard_last_admin on public.profiles;
