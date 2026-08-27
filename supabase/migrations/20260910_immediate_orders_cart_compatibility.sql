-- Run ONCE in the Supabase SQL Editor as the database owner, after
-- 20260909_parallel_delivery_and_coverage_zones.sql.
--
-- This compatibility migration does not change or delete production accounts,
-- stores, addresses, products, orders, coverage zones, or historical schedule
-- data. It restores the RPC contracts required by immediate checkout and makes
-- every newly-created order immediate. The three legacy schedule parameters
-- remain accepted solely so already-installed application builds do not fail.

-- Some deployments applied the order functions but not the earlier lifecycle
-- tables. Bootstrap only missing prerequisites: this does not alter or delete
-- customer accounts, stores, orders, coverage areas, or historical data.
create table if not exists public.customer_blacklist (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);

alter table public.customer_blacklist enable row level security;
drop policy if exists customer_blacklist_admin_read on public.customer_blacklist;
create policy customer_blacklist_admin_read on public.customer_blacklist
  for select to authenticated using (public.is_app_admin());

-- Central distance pricing is an administrative configuration. Create its
-- compatible table and a single default configuration only when the prior
-- lifecycle migration was not applied; existing configuration is preserved.
create table if not exists public.delivery_pricing_config (
  id boolean primary key default true check (id),
  base_fee integer not null default 120 check (base_fee >= 0),
  fee_per_km numeric(10,2) not null default 18 check (fee_per_km >= 0),
  fee_per_kg numeric(10,2) not null default 35 check (fee_per_kg >= 0),
  interwilaya_surcharge integer not null default 600 check (interwilaya_surcharge >= 0),
  minimum_fee integer not null default 120 check (minimum_fee >= 0),
  average_speed_kmh numeric(6,2) not null default 45 check (average_speed_kmh > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.delivery_pricing_config (id) values (true) on conflict (id) do nothing;
alter table public.delivery_pricing_config enable row level security;
drop policy if exists delivery_pricing_config_read on public.delivery_pricing_config;
create policy delivery_pricing_config_read on public.delivery_pricing_config
  for select to authenticated using (true);
drop policy if exists delivery_pricing_config_admin_write on public.delivery_pricing_config;
create policy delivery_pricing_config_admin_write on public.delivery_pricing_config
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Keep the lifecycle audit available for a successful checkout even where the
-- older advanced-order migration was never run. No existing order is inserted
-- or updated by this definition.
create table if not exists public.order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_lifecycle_events_order_idx
  on public.order_lifecycle_events(order_id, created_at);
alter table public.order_lifecycle_events enable row level security;
drop policy if exists order_lifecycle_events_participant_read on public.order_lifecycle_events;
create policy order_lifecycle_events_participant_read on public.order_lifecycle_events
  for select to authenticated using (
    public.is_app_admin() or exists (
      select 1 from public.orders o
      where o.id = order_lifecycle_events.order_id
        and (o.customer_id = auth.uid() or o.merchant_id = auth.uid() or o.courier_id = auth.uid())
    )
  );

create or replace function public.record_order_lifecycle_event(
  p_order_id uuid,
  p_event_type text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_lifecycle_events(order_id, event_type, actor_id, actor_role, details)
  values (p_order_id, p_event_type, auth.uid(), public.current_app_role(), coalesce(p_details, '{}'::jsonb));
end;
$$;

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

create or replace function public.quote_delivery(
  p_merchant_id uuid,
  p_destination jsonb,
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
  v_merchant public.merchants;
  v_pricing record;
  v_distance numeric := 0;
  v_interwilaya boolean;
  v_is_precise boolean := false;
begin
  select * into v_merchant
  from public.merchants
  where id = p_merchant_id and status = 'approved';
  if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;

  select * into v_pricing from public.delivery_pricing_config where id = true;
  if not found then raise exception 'DELIVERY_PRICING_NOT_CONFIGURED'; end if;

  v_interwilaya := coalesce(v_merchant.wilaya <> nullif(p_destination ->> 'wilaya', ''), false);
  if v_merchant.latitude is not null and v_merchant.longitude is not null
    and nullif(p_destination ->> 'latitude', '') is not null
    and nullif(p_destination ->> 'longitude', '') is not null
  then
    v_distance := 6371 * 2 * asin(sqrt(
      power(sin(radians(((p_destination ->> 'latitude')::numeric - v_merchant.latitude) / 2)), 2)
      + cos(radians(v_merchant.latitude))
        * cos(radians((p_destination ->> 'latitude')::numeric))
        * power(sin(radians(((p_destination ->> 'longitude')::numeric - v_merchant.longitude) / 2)), 2)
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
  v_merchant public.merchants;
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

  select * into v_merchant
  from public.merchants
  where id = p_merchant_id and status = 'approved';
  if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;
  if p_delivery_choice = 'store' and not v_merchant.has_own_delivery then
    raise exception 'STORE_DELIVERY_DISABLED';
  end if;
  if p_delivery_choice = 'courier' and not v_merchant.platform_delivery_enabled then
    raise exception 'PLATFORM_DELIVERY_DISABLED';
  end if;
  if p_delivery_choice <> 'pickup' and (
    p_delivery_address is null
    or nullif(p_delivery_address ->> 'wilaya', '') is null
    or nullif(p_delivery_address ->> 'commune', '') is null
    or nullif(p_delivery_address ->> 'label', '') is null
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
    v_merchant.wilaya, v_merchant.commune,
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
  perform public.record_admin_order_notification(v_order.id, 'order_created');
  return v_order;
end;
$$;

revoke all on function public.is_customer_blacklisted(uuid) from public, anon;
grant execute on function public.is_customer_blacklisted(uuid) to authenticated;
revoke all on function public.quote_delivery(uuid, jsonb, numeric) from public, anon;
grant execute on function public.quote_delivery(uuid, jsonb, numeric) to authenticated;
revoke all on function public.create_customer_order(uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
