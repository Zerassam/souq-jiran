-- Run ONCE after 20260904_delivery_scheduling.sql.
-- PostgreSQL comparisons with NULL are not true, so anonymous callers must receive
-- an explicit non-role value instead of NULL. This preserves all valid role checks
-- while making existing <> guards reject unauthenticated requests deterministically.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '');
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to anon, authenticated;
