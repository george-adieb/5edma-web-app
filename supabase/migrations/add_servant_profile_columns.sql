-- ============================================================
-- Migration: Add extra servant profile columns to public.profiles
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

alter table public.profiles
  add column if not exists confession_father text,
  add column if not exists address           text,
  add column if not exists job               text,
  add column if not exists phone             text,
  add column if not exists status            text default 'نشط',
  add column if not exists talents           text,
  add column if not exists notes             text;

-- ============================================================
-- After running: Add New Servant form will save all 7 new
-- fields to public.profiles. No changes needed to servants table
-- (it is empty and unused).
-- ============================================================
