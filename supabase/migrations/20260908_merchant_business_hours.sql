-- Persist the public business hours used to label a store as open or closed.
-- Safe to run on an existing production database: it only adds defaulted columns
-- and a self-scoped RPC; it never inserts, deletes, or changes merchant records.

alter table public.merchants
  add column if not exists opening_hour smallint not null default 8 check (opening_hour between 0 and 23),
  add column if not exists closing_hour smallint not null default 21 check (closing_hour between 0 and 23);

create or replace function public.merchant_update_business_hours(
  p_opening_hour smallint,
  p_closing_hour smallint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if public.current_app_role() <> 'merchant' then
    raise exception 'Only merchants can update business hours';
  end if;
  if p_opening_hour is null or p_opening_hour not between 0 and 23
     or p_closing_hour is null or p_closing_hour not between 0 and 23
     or p_opening_hour = p_closing_hour then
    raise exception 'Invalid business hours';
  end if;

  update public.merchants
     set opening_hour = p_opening_hour,
         closing_hour = p_closing_hour,
         updated_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'Merchant store not found';
  end if;
  return true;
end;
$$;

revoke execute on function public.merchant_update_business_hours(smallint, smallint) from public, anon;
grant execute on function public.merchant_update_business_hours(smallint, smallint) to authenticated;

notify pgrst, 'reload schema';
