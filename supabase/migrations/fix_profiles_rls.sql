-- ============================================================
-- Migration: Enforce role-based INSERT/UPDATE on public.profiles
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Read access: any authenticated user reads ALL profiles ──
alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read all profiles" on public.profiles;
create policy "Authenticated users can read all profiles"
  on public.profiles for select to authenticated using (true);

-- ── 2. INSERT: own row only ────────────────────────────────────
drop policy if exists "Users can insert own profile"             on public.profiles;
drop policy if exists "Users can insert their own profile."      on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ── 3. UPDATE (own row) ────────────────────────────────────────
--    Split into two policies: one for ADMIN (unrestricted update),
--    one for SERVICE_HEAD (can only set role = SERVANT).

drop policy if exists "Users can update own profile"             on public.profiles;
drop policy if exists "Users can update own profile."            on public.profiles;
drop policy if exists "Admin can update any profile"             on public.profiles;
drop policy if exists "ServiceHead can update servant profiles"  on public.profiles;

-- ADMIN / GENERAL_SECRETARIAT: can update any profile with any role
create policy "Admin can update any profile"
  on public.profiles for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'GENERAL_SECRETARIAT')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'GENERAL_SECRETARIAT')
    )
  );

-- SERVICE_HEAD: can update profiles but ONLY when resulting role = SERVANT
-- (prevents privilege escalation to SERVICE_HEAD or ADMIN)
create policy "ServiceHead can update servant profiles"
  on public.profiles for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'SERVICE_HEAD'
    )
  )
  with check (
    role = 'SERVANT'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'SERVICE_HEAD'
    )
  );

-- Own-row update for SERVANT (can update their own profile only)
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 4. DELETE: own row only ────────────────────────────────────
drop policy if exists "Users can delete own profile"             on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete to authenticated
  using (auth.uid() = id);

-- ============================================================
-- After running: SERVICE_HEAD callers cannot set role to
-- SERVICE_HEAD or ADMIN via the API, even if they bypass the UI.
-- ============================================================
