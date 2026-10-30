-- ===================================================
-- User Management RBAC - PHASE 2 (lock down direct writes)
-- Run ONLY AFTER (1) supabase_users_rbac.sql is applied and
-- (2) the new frontend (which calls rpc save_user) is deployed.
-- Afterwards anon/authenticated can only SELECT public.users;
-- INSERT/UPDATE/DELETE are possible only through save_user().
-- ===================================================

alter table public.users enable row level security;

drop policy if exists "users_select_only" on public.users;
create policy "users_select_only" on public.users
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.users from anon, authenticated;
