-- Allow 'password_reset' and 'delete' in the audit log (no password material is ever stored).
alter table public.user_audit_logs drop constraint if exists user_audit_logs_action_check;
alter table public.user_audit_logs add constraint user_audit_logs_action_check
  check (action in ('create','role_change','assignment_change','profile_update','password_reset','delete'));
