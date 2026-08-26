-- Parallel merchant delivery modes and multi-zone coverage.
-- Run ONCE in the Supabase SQL Editor as the database owner, after the prior migrations.
-- This migration adds only backward-compatible columns and RPCs; it does not create,
-- alter, or remove any merchant, customer, courier, or order record.

alter table public.merchants
  add column if not exists platform_delivery_enabled boolean not null default true,
  add column if not exists delivery_coverage_zones jsonb not null default '[]'::jsonb;

alter table public.merchants
  drop constraint if exists merchants_delivery_coverage_zones_array_check;
alter table public.merchants
  add constraint merchants_delivery_coverage_zones_array_check
  check (jsonb_typeof(delivery_coverage_zones) = 'array');

-- No existing merchant row is populated or changed here. Until a merchant saves
-- the new form, merchant_covers_delivery_destination falls back to the legacy
-- delivery_wilayas / delivery_communes fields below.

create index if not exists merchants_delivery_coverage_zones_idx
  on public.merchants using gin (delivery_coverage_zones);

create or replace function public.validate_merchant_delivery_coverage_zones(p_zones jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone jsonb;
  v_commune jsonb;
  v_seen text[] := '{}';
  v_key text;
begin
  if jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) > 10 then
    raise exception 'INVALID_DELIVERY_COVERAGE_ZONES';
  end if;
  for v_zone in select value from jsonb_array_elements(p_zones) loop
    if jsonb_typeof(v_zone) <> 'object'
      or nullif(trim(v_zone ->> 'wilaya'), '') is null
      or nullif(trim(v_zone ->> 'mainCommune'), '') is null
      or jsonb_typeof(coalesce(v_zone -> 'coveredCommunes', '[]'::jsonb)) <> 'array'
    then
      raise exception 'INVALID_DELIVERY_COVERAGE_ZONE';
    end if;
    if length(v_zone ->> 'wilaya') > 100 or length(v_zone ->> 'mainCommune') > 100
      or jsonb_array_length(coalesce(v_zone -> 'coveredCommunes', '[]'::jsonb)) > 200
    then
      raise exception 'INVALID_DELIVERY_COVERAGE_ZONE';
    end if;
    v_key := lower(trim(v_zone ->> 'wilaya')) || chr(0) || lower(trim(v_zone ->> 'mainCommune'));
    if v_key = any(v_seen) then raise exception 'DUPLICATE_DELIVERY_COVERAGE_ZONE'; end if;
    v_seen := array_append(v_seen, v_key);
    for v_commune in select value from jsonb_array_elements(coalesce(v_zone -> 'coveredCommunes', '[]'::jsonb)) loop
      if jsonb_typeof(v_commune) <> 'string' or nullif(trim(trim(both '"' from v_commune::text)), '') is null then
        raise exception 'INVALID_DELIVERY_COVERED_COMMUNE';
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.merchant_save_delivery_preferences(
  p_has_own_delivery boolean,
  p_platform_delivery_enabled boolean,
  p_delivery_fee integer,
  p_coverage_zones jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_merchant public.merchants;
begin
  if public.current_app_role() <> 'merchant' then raise exception 'MERCHANT_ROLE_REQUIRED'; end if;
  if not exists (select 1 from public.merchants where id = auth.uid() and status = 'approved') then
    raise exception 'MERCHANT_NOT_APPROVED';
  end if;
  if p_has_own_delivery is null or p_platform_delivery_enabled is null
    or p_delivery_fee is null or p_delivery_fee < 0 or p_delivery_fee > 1000000 then
    raise exception 'INVALID_DELIVERY_PREFERENCES';
  end if;
  perform public.validate_merchant_delivery_coverage_zones(p_coverage_zones);
  update public.merchants
  set has_own_delivery = p_has_own_delivery,
      platform_delivery_enabled = p_platform_delivery_enabled,
      delivery_fee = p_delivery_fee,
      delivery_coverage_zones = p_coverage_zones,
      delivery_wilayas = coalesce(array(select distinct nullif(trim(zone ->> 'wilaya'), '') from jsonb_array_elements(p_coverage_zones) zone where nullif(trim(zone ->> 'wilaya'), '') is not null), '{}'),
      delivery_communes = coalesce(array(select distinct commune from (select nullif(trim(zone ->> 'mainCommune'), '') as commune from jsonb_array_elements(p_coverage_zones) zone union select nullif(trim(covered #>> '{}'), '') as commune from jsonb_array_elements(p_coverage_zones) zone cross join lateral jsonb_array_elements(coalesce(zone -> 'coveredCommunes', '[]'::jsonb)) covered) communes where commune is not null), '{}'),
      updated_at = now()
  where id = auth.uid()
  returning * into v_merchant;
  return jsonb_build_object(
    'hasOwnDelivery', v_merchant.has_own_delivery,
    'platformDeliveryEnabled', v_merchant.platform_delivery_enabled,
    'deliveryFee', v_merchant.delivery_fee,
    'deliveryCoverageZones', v_merchant.delivery_coverage_zones
  );
end;
$$;

create or replace function public.merchant_covers_delivery_destination(p_merchant_id uuid, p_destination jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchants m
    where m.id = p_merchant_id
      and (
        m.nationwide_coverage
        or (
          jsonb_array_length(m.delivery_coverage_zones) > 0
          and exists (
            select 1
            from jsonb_array_elements(m.delivery_coverage_zones) zone
            where nullif(p_destination ->> 'wilaya', '') = nullif(zone ->> 'wilaya', '')
              and (
                nullif(p_destination ->> 'commune', '') = nullif(zone ->> 'mainCommune', '')
                or exists (
                  select 1 from jsonb_array_elements_text(coalesce(zone -> 'coveredCommunes', '[]'::jsonb)) covered
                  where covered = nullif(p_destination ->> 'commune', '')
                )
              )
          )
        )
        or (
          jsonb_array_length(m.delivery_coverage_zones) = 0
          and nullif(p_destination ->> 'wilaya', '') = any(m.delivery_wilayas)
          and (coalesce(array_length(m.delivery_communes, 1), 0) = 0 or nullif(p_destination ->> 'commune', '') = any(m.delivery_communes))
        )
      )
  );
$$;

-- Existing schedule logic now understands repeatable zones while keeping the same 90-minute contract.
create or replace function public.is_requested_delivery_window_available(
  p_merchant_id uuid,
  p_delivery_choice text,
  p_delivery_address jsonb,
  p_window_start timestamptz,
  p_window_end timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare s public.merchant_delivery_schedule_settings; v_range jsonb; v_local_start time; v_local_end time; v_window_local_start time; v_window_local_end time; v_day text;
begin
  if p_delivery_choice = 'pickup' then return p_window_start is null and p_window_end is null; end if;
  if p_delivery_choice not in ('store','courier') or p_window_start is null or p_window_end is distinct from p_window_start + interval '90 minutes' or p_window_start < now() then return false; end if;
  if nullif(p_delivery_address ->> 'wilaya','') is null or nullif(p_delivery_address ->> 'commune','') is null then return false; end if;
  if not public.merchant_covers_delivery_destination(p_merchant_id, p_delivery_address) then return false; end if;
  select * into s from public.merchant_delivery_schedule_settings where merchant_id = p_merchant_id;
  if not found or not s.scheduling_enabled or p_window_start < now() + make_interval(mins => s.preparation_minutes) then return false; end if;
  if exists (select 1 from jsonb_array_elements(s.blackout_windows) w where p_window_start < (w ->> 'end')::timestamptz and p_window_end > (w ->> 'start')::timestamptz) then return false; end if;
  v_day := extract(dow from p_window_start at time zone 'Africa/Algiers')::text;
  v_window_local_start := (p_window_start at time zone 'Africa/Algiers')::time;
  v_window_local_end := (p_window_end at time zone 'Africa/Algiers')::time;
  for v_range in select value from jsonb_array_elements(coalesce(s.weekly_schedule -> v_day, '[]'::jsonb)) loop
    v_local_start := (v_range ->> 'start')::time;
    v_local_end := (v_range ->> 'end')::time;
    if v_window_local_start >= v_local_start and v_window_local_end <= v_local_end then
      if p_delivery_choice = 'store' or public.has_scheduling_eligible_courier(p_merchant_id, p_delivery_address, p_window_start, p_window_end) then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;

-- Preserve optional scheduling from 20260906 while rejecting a delivery method
-- that the merchant has explicitly disabled. The centrally configured distance
-- quote remains authoritative for both store and platform delivery.
create or replace function public.create_customer_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_choice text default 'pickup',
  p_delivery_address jsonb default null,
  p_delivery_fee integer default 0,
  p_delivery_schedule_mode text default 'none',
  p_requested_delivery_window_start timestamptz default null,
  p_requested_delivery_window_end timestamptz default null
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare v_items jsonb; v_subtotal integer; v_weight numeric; v_order public.orders; v_quote record; v_requires boolean; v_verified boolean; v_schedule_status text := 'not_requested'; v_merchant public.merchants;
begin
  if public.current_app_role() <> 'customer' then raise exception 'Only customer accounts can create orders'; end if;
  if public.is_customer_blacklisted(auth.uid()) then raise exception 'CUSTOMER_ACCOUNT_BLOCKED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'An order needs at least one product'; end if;
  if p_delivery_choice not in ('pickup','store','courier') then raise exception 'Invalid delivery options'; end if;
  select * into v_merchant from public.merchants where id = p_merchant_id and status = 'approved';
  if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;
  if p_delivery_choice = 'store' and not v_merchant.has_own_delivery then raise exception 'STORE_DELIVERY_DISABLED'; end if;
  if p_delivery_choice = 'courier' and not v_merchant.platform_delivery_enabled then raise exception 'PLATFORM_DELIVERY_DISABLED'; end if;
  if p_delivery_choice <> 'pickup' and (p_delivery_address is null or nullif(p_delivery_address ->> 'wilaya','') is null or nullif(p_delivery_address ->> 'commune','') is null or nullif(p_delivery_address ->> 'label','') is null) then raise exception 'PRECISE_DELIVERY_ADDRESS_REQUIRED'; end if;
  if p_delivery_choice <> 'pickup' and not public.merchant_covers_delivery_destination(p_merchant_id, p_delivery_address) then raise exception 'DELIVERY_ADDRESS_OUTSIDE_COVERAGE'; end if;
  if p_delivery_choice = 'pickup' and (p_delivery_schedule_mode <> 'none' or p_requested_delivery_window_start is not null or p_requested_delivery_window_end is not null) then raise exception 'PICKUP_CANNOT_BE_SCHEDULED'; end if;
  if p_delivery_choice <> 'pickup' and p_delivery_schedule_mode not in ('none','next_available','selected_window') then raise exception 'INVALID_DELIVERY_SCHEDULE_MODE'; end if;
  if p_delivery_choice <> 'pickup' and p_delivery_schedule_mode <> 'none' then
    if p_requested_delivery_window_start is null or p_requested_delivery_window_end is null then raise exception 'DELIVERY_SCHEDULE_WINDOW_REQUIRED'; end if;
    if extract(epoch from (p_requested_delivery_window_end - p_requested_delivery_window_start)) <> 90 * 60 then raise exception 'DELIVERY_WINDOW_MUST_BE_90_MINUTES'; end if;
    if not public.is_requested_delivery_window_available(p_merchant_id, p_delivery_choice, p_delivery_address, p_requested_delivery_window_start, p_requested_delivery_window_end) then raise exception 'DELIVERY_WINDOW_UNAVAILABLE'; end if;
    v_schedule_status := 'requested';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'unit',p.unit,'department',p.department,'qty',line.qty,'weight_kg',p.weight_kg) order by p.name),'[]'::jsonb), coalesce(sum(p.price*line.qty),0), coalesce(sum(p.weight_kg*line.qty),0)
    into v_items,v_subtotal,v_weight from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id where p.merchant_id=p_merchant_id and p.available and line.qty between 1 and 100;
  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'One or more selected products are unavailable'; end if;
  select * into v_quote from public.quote_delivery(p_merchant_id,coalesce(p_delivery_address,'{}'::jsonb),v_weight);
  v_requires := p_delivery_choice = 'courier' and (v_subtotal >= 10000 or v_quote.is_interwilaya);
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) into v_verified;
  if v_requires and not v_verified then raise exception 'EMAIL_OTP_VERIFICATION_REQUIRED'; end if;
  insert into public.orders(customer_id,merchant_id,status,items,delivery_address,delivery_choice,subtotal,delivery_fee,total,requires_phone_verification,is_interwilaya,total_weight_kg,delivery_distance_km,estimated_delivery_minutes,origin_wilaya,origin_commune,destination_wilaya,destination_commune,delivery_schedule_mode,delivery_schedule_status,requested_delivery_window_start,requested_delivery_window_end)
  values(auth.uid(),p_merchant_id,'pending',v_items,p_delivery_address,p_delivery_choice,v_subtotal,case when p_delivery_choice='pickup' then 0 else v_quote.fee end,v_subtotal+case when p_delivery_choice='pickup' then 0 else v_quote.fee end,false,v_quote.is_interwilaya,v_weight,v_quote.distance_km,v_quote.eta_minutes,v_merchant.wilaya,v_merchant.commune,p_delivery_address->>'wilaya',p_delivery_address->>'commune',case when p_delivery_choice='pickup' then 'none' else p_delivery_schedule_mode end,v_schedule_status,p_requested_delivery_window_start,p_requested_delivery_window_end)
  returning * into v_order;
  insert into public.order_items(order_id,product_id,product_name,unit,unit_price,quantity) select v_order.id,p.id,p.name,p.unit,p.price,line.qty from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id;
  perform public.record_order_lifecycle_event(v_order.id,'customer_order_confirmed',jsonb_build_object('verification_required',v_requires,'delivery_fee',v_order.delivery_fee,'delivery_schedule_status',v_schedule_status));
  perform public.record_admin_order_notification(v_order.id,'order_created');
  return v_order;
end;
$$;

revoke all on function public.merchant_save_delivery_preferences(boolean,boolean,integer,jsonb) from public, anon;
grant execute on function public.merchant_save_delivery_preferences(boolean,boolean,integer,jsonb) to authenticated;
revoke all on function public.merchant_covers_delivery_destination(uuid,jsonb) from public, anon;
grant execute on function public.merchant_covers_delivery_destination(uuid,jsonb) to authenticated;
revoke all on function public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
