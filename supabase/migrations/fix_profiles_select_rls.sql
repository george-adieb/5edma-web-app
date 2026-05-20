-- ============================================================
-- Migration: Fix profiles SELECT RLS to allow all authenticated
--            users to read ALL profiles (needed for servant
--            assignment dropdown in Add New Student page).
--
-- Problem: A SERVANT user querying profiles sees only their own
--          row, even though fix_profiles_rls.sql sets using(true).
--          This happens because Supabase Dashboard may have created
--          a conflicting "Users can view their own data" policy, or
--          an older anon-only policy is overriding.
--
-- Solution: Drop ALL existing SELECT policies on profiles and
--           re-create a single clean one for authenticated users.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Step 1: Enable RLS (idempotent)
alter table public.profiles enable row level security;

-- Step 2: Drop every possible SELECT policy that could exist
drop policy if exists "Authenticated users can read all profiles"   on public.profiles;
drop policy if exists "Users can view own profile"                  on public.profiles;
drop policy if exists "Users can view their own data"               on public.profiles;
drop policy if exists "Users can view their own data."              on public.profiles;
drop policy if exists "Allow authenticated users to read profiles"  on public.profiles;
drop policy if exists "Allow read access for authenticated users"   on public.profiles;
drop policy if exists "profiles_select_authenticated"               on public.profiles;
drop policy if exists "Public profiles are viewable by everyone."   on public.profiles;
drop policy if exists "Public profiles are viewable by everyone"    on public.profiles;
drop policy if exists "Enable read access for all users"            on public.profiles;
drop policy if exists "Allow all for anon"                          on public.profiles;

-- Step 3: Create the single correct SELECT policy
--   Any authenticated (logged-in) user can read ALL profile rows.
--   This is required so:
--   - A SERVANT can see all other servants in their grade for the dropdown
--   - SERVICE_HEAD can see their servants
--   - ADMIN can see everyone
create policy "Authenticated users can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Step 4: Verify (run SELECT to check — expect multiple rows for SERVANT users)
-- select id, full_name, role, assigned_grade, assigned_gender, status
-- from public.profiles
-- where role = 'SERVANT';

-- ============================================================
-- After running this migration:
-- - A logged-in SERVANT user querying profiles WHERE role='SERVANT'
--   will see ALL servant rows, not just their own.
-- - The servant assignment dropdown in /students/new will correctly
--   list all servants matching the selected grade/gender.
-- ============================================================
