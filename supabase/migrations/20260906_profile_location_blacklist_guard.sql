-- Location fields for all account types and production guard for order creation.
-- Safe to re-run: no rows are inserted, updated, or deleted.

alter table public.profiles
  add column if not exists wilaya text,
  add column if not exists commune text,
  add column if not exists address_label text,
  add column if not exists latitude numeric(10,7) check (latitude between -90 and 90),
  add column if not exists longitude numeric(10,7) check (longitude between -180 and 180);

alter table public.merchants
  add column if not exists has_own_delivery boolean not null default true,
  add column if not exists address_label text,
  add column if not exists latitude numeric(10,7) check (latitude between -90 and 90),
  add column if not exists longitude numeric(10,7) check (longitude between -180 and 180);

alter table public.couriers
  add column if not exists address_label text,
  add column if not exists latitude numeric(10,7) check (latitude between -90 and 90),
  add column if not exists longitude numeric(10,7) check (longitude between -180 and 180);

create or replace function public.is_customer_blacklisted(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_blacklist b
    where b.customer_id = p_customer_id
      and b.revoked_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

revoke all on function public.is_customer_blacklisted(uuid) from public;
grant execute on function public.is_customer_blacklisted(uuid) to authenticated;
