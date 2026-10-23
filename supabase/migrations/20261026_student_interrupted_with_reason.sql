-- New student status: 'منقطع بسبب' (absence reason is known → exempt from automatic follow-up).
--
-- * students.status is free text (no enum / CHECK existed; stored values: منتظم, جديد, يحتاج افتقاد),
--   so the new value is added as a plain string — nothing existing is rewritten.
-- * students.interruption_reason : the private reason (required while status = 'منقطع بسبب').
-- * students.follow_up_baseline_date : set when a student LEAVES 'منقطع بسبب'; attendance on or
--   before this date is ignored by automatic follow-up, so old absences don't resurface.
-- * student_status_history : audit trail of entering / leaving the status (keeps the old reason).
-- Attendance, follow-up logs, notes and points are never touched.

begin;

alter table public.students
  add column if not exists interruption_reason     text,
  add column if not exists follow_up_baseline_date date;

create table if not exists public.student_status_history (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students(id) on delete cascade,
  old_status          text,
  new_status          text,
  interruption_reason text,
  changed_by          uuid,
  changed_at          timestamptz not null default now()
);
create index if not exists student_status_history_student_idx on public.student_status_history (student_id, changed_at desc);

alter table public.student_status_history enable row level security;
drop policy if exists student_status_history_select on public.student_status_history;
create policy student_status_history_select on public.student_status_history
  for select to authenticated using (student_id in (select s.id from public.students s));
revoke all on public.student_status_history from anon, authenticated;
grant select on public.student_status_history to authenticated;

-- Server-side enforcement (applies to every writer: browser, Edge Functions, SQL).
-- BEFORE trigger: validate / normalise the row. AFTER trigger: write the history row
-- (it must run after the student row exists because of the foreign key).
create or replace function public.students_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reason text;
begin
  if new.status = 'منقطع بسبب' then
    v_reason := nullif(btrim(coalesce(new.interruption_reason, '')), '');
    if v_reason is null then
      raise exception 'من فضلك اكتب سبب الانقطاع' using errcode = '23514';
    end if;
    new.interruption_reason := v_reason;
  else
    if tg_op = 'UPDATE' and old.status = 'منقطع بسبب' then
      -- leaving the status: restart follow-up eligibility from today
      new.follow_up_baseline_date := (now() at time zone 'Africa/Cairo')::date;
    end if;
    new.interruption_reason := null;
  end if;
  return new;
end $$;

create or replace function public.students_status_history_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'منقطع بسبب' and (tg_op = 'INSERT' or old.status is distinct from 'منقطع بسبب') then
    insert into public.student_status_history (student_id, old_status, new_status, interruption_reason, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, new.interruption_reason, auth.uid());
  elsif tg_op = 'UPDATE' and old.status = 'منقطع بسبب' and new.status is distinct from 'منقطع بسبب' then
    -- keep the old reason in history even though the live column is cleared
    insert into public.student_status_history (student_id, old_status, new_status, interruption_reason, changed_by)
    values (new.id, old.status, new.status, old.interruption_reason, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists students_status_guard on public.students;
create trigger students_status_guard
  before insert or update on public.students
  for each row execute function public.students_status_guard();

drop trigger if exists students_status_history_log on public.students;
create trigger students_status_history_log
  after insert or update of status on public.students
  for each row execute function public.students_status_history_log();

-- Belt and braces (the trigger already raises a friendlier message).
alter table public.students drop constraint if exists students_interruption_reason_chk;
alter table public.students add constraint students_interruption_reason_chk
  check (status is distinct from 'منقطع بسبب' or length(btrim(coalesce(interruption_reason, ''))) > 0);

commit;

-- ROLLBACK:
--   drop trigger students_status_guard on public.students; drop trigger students_status_history_log on public.students;
--   drop function public.students_status_guard(); drop function public.students_status_history_log();
--   alter table public.students drop constraint students_interruption_reason_chk;
--   drop table public.student_status_history;
--   alter table public.students drop column interruption_reason, drop column follow_up_baseline_date;
