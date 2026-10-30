-- ===================================================
-- User Management RBAC - PHASE 1 (additive, safe to run anytime)
-- Server-side write path for public.users. Mirrors src/utils/permissions.js.
-- Errors: invalid credentials -> 28000, not allowed -> 42501 (PostgREST: HTTP 403).
-- ===================================================

create or replace function public.rbac_users_level(u public.users)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(u.role, '')) = 'viewer' then
      case when u.page_access->>'Users' in ('view', 'full') then 'view' else 'none' end
    when lower(coalesce(u.role, '')) = 'admin' then
      case when u.page_access->>'Users' = 'view' then 'view' else 'full' end
    when u.page_access->>'Users' in ('view', 'full') then u.page_access->>'Users'
    else 'none'
  end
$$;

create or replace function public.save_user(
  p_auth_username text,
  p_auth_password text,
  p_username      text,
  p_password      text,
  p_role          text,
  p_firm_name     text,
  p_page_access   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.users;
  target public.users;
begin
  select * into caller
  from public.users
  where lower(username) = lower(trim(coalesce(p_auth_username, '')))
    and password = coalesce(p_auth_password, '')
  limit 1;

  if not found then
    raise exception 'Invalid credentials' using errcode = '28000';
  end if;

  if public.rbac_users_level(caller) <> 'full' then
    raise exception 'Forbidden: you have view-only access to User Management'
      using errcode = '42501';
  end if;

  if coalesce(p_role, '') not in ('admin', 'user', 'viewer') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_page_access is null or jsonb_typeof(p_page_access) <> 'object' then
    raise exception 'Invalid page_access' using errcode = '22023';
  end if;

  -- Only admins may create/modify admins (no privilege escalation).
  select * into target from public.users where username = trim(p_username);
  if lower(caller.role) <> 'admin'
     and (p_role = 'admin' or (found and lower(coalesce(target.role, '')) = 'admin')) then
    raise exception 'Forbidden: only admins can manage admin users' using errcode = '42501';
  end if;

  insert into public.users (username, password, role, firm_name, page_access)
  values (trim(p_username), p_password, p_role, p_firm_name, p_page_access)
  on conflict (username) do update
    set password    = excluded.password,
        role        = excluded.role,
        firm_name   = excluded.firm_name,
        page_access = excluded.page_access;
end;
$$;

revoke all on function public.save_user(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.save_user(text, text, text, text, text, text, jsonb) to anon, authenticated;
