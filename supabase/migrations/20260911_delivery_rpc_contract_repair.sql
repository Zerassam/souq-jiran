-- Run manually ONCE in the Supabase SQL Editor as the database owner, after
-- 20260910_immediate_orders_cart_compatibility.sql.
--
-- This repair is deliberately non-destructive. It neither inserts, changes,
-- nor deletes any production account, store, product, address, order, courier,
-- pricing configuration, or coverage setting. Missing merchant columns receive
-- schema defaults only, so existing rows keep their existing values where any
-- earlier migration has already supplied them.

-- Some installations ran the delivery RPC migration before the merchant
-- preference columns. Add only the missing compatibility columns required by
-- the immediate checkout and coverage contracts.
alter table public.merchants
  add column if not exists has_own_delivery boolean not null default true,
  add column if not exists platform_delivery_enabled boolean not null default true,
  add column if not exists delivery_coverage_zones jsonb not null default '[]'::jsonb,
  add column if not exists delivery_fee integer not null default 0,
  add column if not exists delivery_wilayas text[] not null default '{}'::text[],
  add column if not exists delivery_communes text[] not null default '{}'::text[],
  add column if not exists nationwide_coverage boolean not null default false;

alter table public.merchants
  drop constraint if exists merchants_delivery_coverage_zones_array_check;
alter table public.merchants
  add constraint merchants_delivery_coverage_zones_array_check
  check (jsonb_typeof(delivery_coverage_zones) = 'array');

create index if not exists merchants_delivery_coverage_zones_idx
  on public.merchants using gin (delivery_coverage_zones);

-- A delivery destination is accepted only when it is covered by an explicit
-- multi-zone declaration, an older coverage array, nationwide coverage, or the
-- merchant's own registered commune when no coverage preferences exist yet.
-- The final fallback is deliberately local and never authorizes broad delivery.
create or replace function public.merchant_covers_delivery_destination(
  p_merchant_id uuid,
  p_destination jsonb
)
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
        coalesce(m.nationwide_coverage, false)
        or (
          jsonb_array_length(coalesce(m.delivery_coverage_zones, '[]'::jsonb)) > 0
          and exists (
            select 1
            from jsonb_array_elements(coalesce(m.delivery_coverage_zones, '[]'::jsonb)) zone
            where nullif(trim(p_destination ->> 'wilaya'), '') = nullif(trim(zone ->> 'wilaya'), '')
              and (
                nullif(trim(p_destination ->> 'commune'), '') = nullif(trim(zone ->> 'mainCommune'), '')
                or exists (
                  select 1
                  from jsonb_array_elements_text(coalesce(zone -> 'coveredCommunes', '[]'::jsonb)) covered
                  where nullif(trim(p_destination ->> 'commune'), '') = nullif(trim(covered), '')
                )
              )
          )
        )
        or (
          cardinality(coalesce(m.delivery_wilayas, '{}'::text[])) > 0
          and nullif(trim(p_destination ->> 'wilaya'), '') = any(m.delivery_wilayas)
          and (
            cardinality(coalesce(m.delivery_communes, '{}'::text[])) = 0
            or nullif(trim(p_destination ->> 'commune'), '') = any(m.delivery_communes)
          )
        )
        or (
          jsonb_array_length(coalesce(m.delivery_coverage_zones, '[]'::jsonb)) = 0
          and cardinality(coalesce(m.delivery_wilayas, '{}'::text[])) = 0
          and nullif(trim(p_destination ->> 'wilaya'), '') = nullif(trim(m.wilaya), '')
          and nullif(trim(p_destination ->> 'commune'), '') = nullif(trim(m.commune), '')
        )
      )
  );
$$;

-- PostgreSQL identifies functions by input types, not parameter names. The
-- earlier signature used p_destination, while the installed Android build calls
-- p_destination_json. Drop and recreate the same typed signature so PostgREST
-- exposes the compatible argument name after the schema reload below.
drop function if exists public.quote_delivery(uuid, jsonb, numeric);
create function public.quote_delivery(
  p_merchant_id uuid,
  p_destination_json jsonb,
  p_weight_kg numeric default 0.25
)
returns table(
  distance_km numeric,
  fee integer,
  eta_minutes integer,
  is_interwilaya boolean,
  is_precise boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_wilaya text;
  v_merchant_latitude numeric;
  v_merchant_longitude numeric;
  v_pricing record;
  v_distance numeric := 0;
  v_interwilaya boolean := false;
  v_is_precise boolean := false;
begin
  select m.wilaya, m.latitude, m.longitude
    into v_merchant_wilaya, v_merchant_latitude, v_merchant_longitude
  from public.merchants m
  where m.id = p_merchant_id and m.status = 'approved';
  if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;

  select * into v_pricing from public.delivery_pricing_config where id = true;
  if not found then raise exception 'DELIVERY_PRICING_NOT_CONFIGURED'; end if;

  v_interwilaya := coalesce(v_merchant_wilaya <> nullif(p_destination_json ->> 'wilaya', ''), false);
  if v_merchant_latitude is not null and v_merchant_longitude is not null
    and nullif(p_destination_json ->> 'latitude', '') is not null
    and nullif(p_destination_json ->> 'longitude', '') is not null
  then
    v_distance := 6371 * 2 * asin(sqrt(
      power(sin(radians(((p_destination_json ->> 'latitude')::numeric - v_merchant_latitude) / 2)), 2)
      + cos(radians(v_merchant_latitude))
        * cos(radians((p_destination_json ->> 'latitude')::numeric))
        * power(sin(radians(((p_destination_json ->> 'longitude')::numeric - v_merchant_longitude) / 2)), 2)
    ));
    v_is_precise := true;
  end if;

  return query
  select
    round(v_distance, 2),
    greatest(
      v_pricing.minimum_fee,
      round(
        v_pricing.base_fee
        + v_distance * v_pricing.fee_per_km
        + greatest(coalesce(p_weight_kg, 0.25), 0.05) * v_pricing.fee_per_kg
        + case when v_interwilaya then v_pricing.interwilaya_surcharge else 0 end
      )::integer
    ),
    greatest(20, ceil((v_distance / v_pricing.average_speed_kmh) * 60 + 25)::integer),
    v_interwilaya,
    v_is_precise;
end;
$$;

-- Do not load a full merchants rowtype here: installations missing a historical
-- column can otherwise fail with "record v_merchant has no field ...". Explicit
-- scalar values retain both delivery modes in parallel and keep pickup separate.
create or replace function public.create_customer_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_choice text default 'pickup',
  p_delivery_address jsonb default null,
  p_delivery_fee integer default 0,
  p_delivery_schedule_mode text default 'none',
  p_requested_delivery_window_start timestamptz default null,
  p_requested_delivery_window_end timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_subtotal integer;
  v_weight numeric;
  v_order public.orders;
  v_quote record;
  v_requires_email_verification boolean;
  v_email_verified boolean;
  v_merchant_wilaya text;
  v_merchant_commune text;
  v_has_own_delivery boolean;
  v_platform_delivery_enabled boolean;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'CUSTOMER_ROLE_REQUIRED';
  end if;
  if public.is_customer_blacklisted(auth.uid()) then
    raise exception 'CUSTOMER_ACCOUNT_BLOCKED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one product';
  end if;
  if p_delivery_choice not in ('pickup', 'store', 'courier') then
    raise exception 'Invalid delivery options';
  end if;

  select m.wilaya, m.commune, coalesce(m.has_own_delivery, true), coalesce(m.platform_delivery_enabled, true)
    into v_merchant_wilaya, v_merchant_commune, v_has_own_delivery, v_platform_delivery_enabled
  from public.merchants m
  where m.id = p_merchant_id and m.status = 'approved';
  if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;
  if p_delivery_choice = 'store' and not v_has_own_delivery then
    raise exception 'STORE_DELIVERY_DISABLED';
  end if;
  if p_delivery_choice = 'courier' and not v_platform_delivery_enabled then
    raise exception 'PLATFORM_DELIVERY_DISABLED';
  end if;
  if p_delivery_choice <> 'pickup' and (
    p_delivery_address is null
    or nullif(trim(p_delivery_address ->> 'wilaya'), '') is null
    or nullif(trim(p_delivery_address ->> 'commune'), '') is null
    or nullif(trim(p_delivery_address ->> 'label'), '') is null
  ) then
    raise exception 'PRECISE_DELIVERY_ADDRESS_REQUIRED';
  end if;
  if p_delivery_choice <> 'pickup'
    and not public.merchant_covers_delivery_destination(p_merchant_id, p_delivery_address)
  then
    raise exception 'DELIVERY_ADDRESS_OUTSIDE_COVERAGE';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'price', p.price, 'unit', p.unit,
      'department', p.department, 'qty', line.qty, 'weight_kg', p.weight_kg
    ) order by p.name), '[]'::jsonb),
    coalesce(sum(p.price * line.qty), 0),
    coalesce(sum(p.weight_kg * line.qty), 0)
  into v_items, v_subtotal, v_weight
  from jsonb_to_recordset(p_items) line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id
  where p.merchant_id = p_merchant_id and p.available and line.qty between 1 and 100;
  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then
    raise exception 'One or more selected products are unavailable';
  end if;

  select * into v_quote
  from public.quote_delivery(p_merchant_id, coalesce(p_delivery_address, '{}'::jsonb), v_weight);
  v_requires_email_verification := p_delivery_choice = 'courier'
    and (v_subtotal >= 10000 or v_quote.is_interwilaya);
  select exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  ) into v_email_verified;
  if v_requires_email_verification and not v_email_verified then
    raise exception 'EMAIL_OTP_VERIFICATION_REQUIRED';
  end if;

  insert into public.orders(
    customer_id, merchant_id, status, items, delivery_address, delivery_choice,
    subtotal, delivery_fee, total, requires_phone_verification, is_interwilaya,
    total_weight_kg, delivery_distance_km, estimated_delivery_minutes,
    origin_wilaya, origin_commune, destination_wilaya, destination_commune,
    delivery_schedule_mode, delivery_schedule_status,
    requested_delivery_window_start, requested_delivery_window_end
  ) values (
    auth.uid(), p_merchant_id, 'pending', v_items, p_delivery_address, p_delivery_choice,
    v_subtotal,
    case when p_delivery_choice = 'pickup' then 0 else v_quote.fee end,
    v_subtotal + case when p_delivery_choice = 'pickup' then 0 else v_quote.fee end,
    false, v_quote.is_interwilaya, v_weight, v_quote.distance_km, v_quote.eta_minutes,
    v_merchant_wilaya, v_merchant_commune,
    p_delivery_address ->> 'wilaya', p_delivery_address ->> 'commune',
    'none', 'not_requested', null, null
  ) returning * into v_order;

  insert into public.order_items(order_id, product_id, product_name, unit, unit_price, quantity)
  select v_order.id, p.id, p.name, p.unit, p.price, line.qty
  from jsonb_to_recordset(p_items) line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id;

  perform public.record_order_lifecycle_event(
    v_order.id,
    'customer_order_confirmed',
    jsonb_build_object(
      'verification_required', v_requires_email_verification,
      'delivery_fee', v_order.delivery_fee,
      'immediate_order', true
    )
  );
  if to_regprocedure('public.record_admin_order_notification(uuid,text)') is not null then
    perform public.record_admin_order_notification(v_order.id, 'order_created');
  end if;
  return v_order;
end;
$$;

revoke all on function public.merchant_covers_delivery_destination(uuid, jsonb) from public, anon;
grant execute on function public.merchant_covers_delivery_destination(uuid, jsonb) to authenticated;
revoke all on function public.quote_delivery(uuid, jsonb, numeric) from public, anon;
grant execute on function public.quote_delivery(uuid, jsonb, numeric) to authenticated;
revoke all on function public.create_customer_order(uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
