-- Repair the merchant location schema when an earlier deployment created the RPC
-- before the latitude and longitude columns. Safe to run repeatedly and does not
-- create, alter, or delete merchant records.

alter table public.merchants
  add column if not exists latitude numeric(10,7) check (latitude between -90 and 90),
  add column if not exists longitude numeric(10,7) check (longitude between -180 and 180);

create or replace function public.merchant_update_location(
  p_latitude numeric,
  p_longitude numeric
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
    raise exception 'Only merchants can update store location';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid geographic coordinates';
  end if;

  update public.merchants
     set latitude = p_latitude,
         longitude = p_longitude,
         updated_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'Merchant store not found';
  end if;
  return true;
end;
$$;

revoke execute on function public.merchant_update_location(numeric, numeric) from public, anon;
grant execute on function public.merchant_update_location(numeric, numeric) to authenticated;

notify pgrst, 'reload schema';
