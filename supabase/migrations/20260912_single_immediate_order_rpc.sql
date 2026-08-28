-- Run manually ONCE in the Supabase SQL Editor after
-- 20260910_immediate_orders_cart_compatibility.sql and
-- 20260911_delivery_rpc_contract_repair.sql.
--
-- This repair only replaces RPC definitions. It never inserts, updates, or
-- deletes production users, stores, products, delivery settings, addresses,
-- couriers, or orders.
--
-- The Android evidence showed two candidates for the same immediate request:
-- a five-parameter function and a legacy eight-parameter scheduling function
-- with three default arguments. PostgREST cannot choose reliably between them.
-- Scheduling is retired, so remove the old typed signature entirely. The
-- five-parameter signature is also dropped first: PostgreSQL does not allow
-- CREATE OR REPLACE to remove defaults that a previous version may carry.
drop function if exists public.create_customer_order(
  uuid, jsonb, text, jsonb, integer, text, timestamptz, timestamptz
);
drop function if exists public.create_customer_order(
  uuid, jsonb, text, jsonb, integer
);

-- Keep exactly one public checkout contract. The application always submits
-- these five named fields, and the server calculates delivery pricing again
-- instead of trusting p_delivery_fee from the client.
create or replace function public.create_customer_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_choice text,
  p_delivery_address jsonb,
  p_delivery_fee integer
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

revoke all on function public.create_customer_order(uuid, jsonb, text, jsonb, integer) from public, anon;
grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer) to authenticated;

notify pgrst, 'reload schema';
