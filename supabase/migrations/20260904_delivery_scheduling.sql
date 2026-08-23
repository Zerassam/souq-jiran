-- Delivery scheduling v1: merchant-configured 90-minute delivery windows.
-- Run ONCE in the Supabase SQL Editor as the database owner, after the prior migrations.
-- This migration never deletes existing data and keeps pickup orders backward-compatible.

create table if not exists public.merchant_delivery_schedule_settings (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  scheduling_enabled boolean not null default false,
  preparation_minutes integer not null default 30 check (preparation_minutes between 0 and 720),
  -- PostgreSQL extract(dow): 0=Sunday … 6=Saturday; every item is {"start":"HH24:MI","end":"HH24:MI"}.
  weekly_schedule jsonb not null default '{}'::jsonb,
  -- Every item is {"start":"ISO-8601 timestamptz","end":"ISO-8601 timestamptz","reason":"optional"}.
  blackout_windows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(weekly_schedule) = 'object'),
  check (jsonb_typeof(blackout_windows) = 'array')
);

alter table public.orders
  add column if not exists delivery_schedule_mode text not null default 'none',
  add column if not exists delivery_schedule_status text not null default 'not_requested',
  add column if not exists requested_delivery_window_start timestamptz,
  add column if not exists requested_delivery_window_end timestamptz,
  add column if not exists delivery_schedule_responded_at timestamptz,
  add column if not exists delivery_schedule_responded_by uuid references public.profiles(id) on delete set null;

alter table public.orders drop constraint if exists orders_delivery_schedule_mode_check;
alter table public.orders add constraint orders_delivery_schedule_mode_check
  check (delivery_schedule_mode in ('none', 'next_available', 'selected_window'));
alter table public.orders drop constraint if exists orders_delivery_schedule_status_check;
alter table public.orders add constraint orders_delivery_schedule_status_check
  check (delivery_schedule_status in ('not_requested', 'requested', 'confirmed', 'declined', 'cancelled'));
alter table public.orders drop constraint if exists orders_delivery_schedule_window_check;
alter table public.orders add constraint orders_delivery_schedule_window_check
  check (
    (requested_delivery_window_start is null and requested_delivery_window_end is null)
    or (
      requested_delivery_window_start is not null
      and requested_delivery_window_end = requested_delivery_window_start + interval '90 minutes'
    )
  );

create index if not exists orders_merchant_requested_delivery_window_idx
  on public.orders (merchant_id, requested_delivery_window_start)
  where delivery_schedule_status = 'requested';

alter table public.merchant_delivery_schedule_settings enable row level security;
drop policy if exists merchant_delivery_schedule_settings_participant_read on public.merchant_delivery_schedule_settings;
create policy merchant_delivery_schedule_settings_participant_read
  on public.merchant_delivery_schedule_settings for select to authenticated
  using (merchant_id = auth.uid() or public.is_app_admin());

-- The public availability RPC is intentionally not table-readable: customers receive only eligible slots.
create or replace function public.validate_delivery_schedule_settings(
  p_preparation_minutes integer,
  p_weekly_schedule jsonb,
  p_blackout_windows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_day text; v_ranges jsonb; v_range jsonb; v_start time; v_end time; v_blackout jsonb; v_blackout_start timestamptz; v_blackout_end timestamptz;
begin
  if p_preparation_minutes is null or p_preparation_minutes < 0 or p_preparation_minutes > 720 then
    raise exception 'INVALID_PREPARATION_MINUTES';
  end if;
  if jsonb_typeof(p_weekly_schedule) <> 'object' then raise exception 'INVALID_WEEKLY_SCHEDULE'; end if;
  foreach v_day in array array['0','1','2','3','4','5','6'] loop
    v_ranges := coalesce(p_weekly_schedule -> v_day, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' then raise exception 'INVALID_WEEKLY_SCHEDULE'; end if;
    for v_range in select value from jsonb_array_elements(v_ranges) loop
      begin
        v_start := (v_range ->> 'start')::time;
        v_end := (v_range ->> 'end')::time;
      exception when others then raise exception 'INVALID_WEEKLY_TIME_RANGE';
      end;
      if v_start >= v_end then raise exception 'INVALID_WEEKLY_TIME_RANGE'; end if;
    end loop;
  end loop;
  if jsonb_typeof(p_blackout_windows) <> 'array' then raise exception 'INVALID_BLACKOUT_WINDOWS'; end if;
  for v_blackout in select value from jsonb_array_elements(p_blackout_windows) loop
    begin
      v_blackout_start := (v_blackout ->> 'start')::timestamptz;
      v_blackout_end := (v_blackout ->> 'end')::timestamptz;
    exception when others then raise exception 'INVALID_BLACKOUT_WINDOW';
    end;
    if v_blackout_start >= v_blackout_end then raise exception 'INVALID_BLACKOUT_WINDOW'; end if;
  end loop;
end; $$;

create or replace function public.merchant_save_delivery_schedule(
  p_scheduling_enabled boolean,
  p_preparation_minutes integer,
  p_weekly_schedule jsonb,
  p_blackout_windows jsonb default '[]'::jsonb
) returns public.merchant_delivery_schedule_settings
language plpgsql
security definer
set search_path = public
as $$
declare v_result public.merchant_delivery_schedule_settings;
begin
  if public.current_app_role() <> 'merchant' then raise exception 'MERCHANT_ROLE_REQUIRED'; end if;
  if not exists (select 1 from public.merchants where id = auth.uid() and status = 'approved') then raise exception 'MERCHANT_NOT_APPROVED'; end if;
  perform public.validate_delivery_schedule_settings(p_preparation_minutes, p_weekly_schedule, p_blackout_windows);
  insert into public.merchant_delivery_schedule_settings(merchant_id, scheduling_enabled, preparation_minutes, weekly_schedule, blackout_windows, updated_at)
  values (auth.uid(), coalesce(p_scheduling_enabled, false), p_preparation_minutes, p_weekly_schedule, p_blackout_windows, now())
  on conflict (merchant_id) do update set
    scheduling_enabled = excluded.scheduling_enabled,
    preparation_minutes = excluded.preparation_minutes,
    weekly_schedule = excluded.weekly_schedule,
    blackout_windows = excluded.blackout_windows,
    updated_at = now()
  returning * into v_result;
  return v_result;
end; $$;

-- A courier is eligible only when approved by the merchant, geographically compatible,
-- and configured for the slot period (morning/afternoon/evening or custom hours).
create or replace function public.has_scheduling_eligible_courier(
  p_merchant_id uuid,
  p_destination jsonb,
  p_window_start timestamptz,
  p_window_end timestamptz
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchant_courier_approvals a
    join public.couriers c on c.id = a.courier_id
    where a.merchant_id = p_merchant_id
      and c.status = 'approved'
      and (
        (c.coverage_level = 'local' and c.wilaya = nullif(p_destination ->> 'wilaya','') and (coalesce(array_length(c.communes, 1), 0) = 0 or nullif(p_destination ->> 'commune','') = any(c.communes)))
        or (c.coverage_level = 'wilaya' and c.wilaya = nullif(p_destination ->> 'wilaya',''))
        or (c.coverage_level = 'inter_wilaya' and (c.wilaya = nullif(p_destination ->> 'wilaya','') or nullif(p_destination ->> 'wilaya','') = any(c.adjacent_wilayas)))
      )
      and (
        coalesce(array_length(c.availability, 1), 0) = 0
        or (extract(hour from p_window_start at time zone 'Africa/Algiers') between 6 and 11 and 'morning' = any(c.availability))
        or (extract(hour from p_window_start at time zone 'Africa/Algiers') between 12 and 17 and 'afternoon' = any(c.availability))
        or (extract(hour from p_window_start at time zone 'Africa/Algiers') >= 18 and 'evening' = any(c.availability))
      )
  );
$$;

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
declare m public.merchants; s public.merchant_delivery_schedule_settings; v_range jsonb; v_local_start time; v_local_end time; v_window_local_start time; v_window_local_end time; v_day text;
begin
  if p_delivery_choice = 'pickup' then return p_window_start is null and p_window_end is null; end if;
  if p_delivery_choice not in ('store','courier') or p_window_start is null or p_window_end is distinct from p_window_start + interval '90 minutes' or p_window_start < now() then return false; end if;
  if nullif(p_delivery_address ->> 'wilaya','') is null or nullif(p_delivery_address ->> 'commune','') is null then return false; end if;
  select * into m from public.merchants where id = p_merchant_id and status = 'approved';
  if not found or (not m.nationwide_coverage and not (nullif(p_delivery_address ->> 'wilaya','') = any(m.delivery_wilayas))) then return false; end if;
  if coalesce(array_length(m.delivery_communes, 1), 0) > 0 and not (nullif(p_delivery_address ->> 'commune','') = any(m.delivery_communes)) then return false; end if;
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
end; $$;

create or replace function public.delivery_schedule_options(
  p_merchant_id uuid,
  p_delivery_choice text,
  p_delivery_address jsonb
) returns table(window_start timestamptz, window_end timestamptz, schedule_mode text)
language plpgsql
security definer
set search_path = public
as $$
declare v_candidate timestamptz; v_end timestamptz; v_first_available boolean := true; v_limit timestamptz := date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers' + interval '2 days';
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if p_delivery_choice not in ('store','courier') then return; end if;
  -- Generate on exact 90-minute boundaries in Algeria time for today and tomorrow.
  v_candidate := date_trunc('hour', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  while v_candidate < v_limit loop
    v_end := v_candidate + interval '90 minutes';
    if public.is_requested_delivery_window_available(p_merchant_id, p_delivery_choice, p_delivery_address, v_candidate, v_end) then
      window_start := v_candidate;
      window_end := v_end;
      schedule_mode := case when v_first_available then 'next_available' else 'selected_window' end;
      v_first_available := false;
      return next;
    end if;
    v_candidate := v_candidate + interval '90 minutes';
  end loop;
end; $$;

-- Replaces the existing function only after prior lifecycle migration. Existing callers remain valid.
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
declare v_items jsonb; v_subtotal integer; v_weight numeric; v_order public.orders; v_quote record; v_requires boolean; v_verified boolean; v_schedule_status text := 'not_requested';
begin
  if public.current_app_role() <> 'customer' then raise exception 'Only customer accounts can create orders'; end if;
  if public.is_customer_blacklisted(auth.uid()) then raise exception 'CUSTOMER_ACCOUNT_BLOCKED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'An order needs at least one product'; end if;
  if p_delivery_choice not in ('pickup','store','courier') then raise exception 'Invalid delivery options'; end if;
  if p_delivery_choice = 'pickup' and (p_delivery_schedule_mode <> 'none' or p_requested_delivery_window_start is not null or p_requested_delivery_window_end is not null) then raise exception 'PICKUP_CANNOT_BE_SCHEDULED'; end if;
  if p_delivery_choice <> 'pickup' and p_delivery_schedule_mode not in ('next_available','selected_window') then raise exception 'DELIVERY_SCHEDULE_REQUIRED'; end if;
  if p_delivery_choice <> 'pickup' and not public.is_requested_delivery_window_available(p_merchant_id, p_delivery_choice, p_delivery_address, p_requested_delivery_window_start, p_requested_delivery_window_end) then raise exception 'DELIVERY_WINDOW_UNAVAILABLE'; end if;
  if p_delivery_choice <> 'pickup' then v_schedule_status := 'requested'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'unit',p.unit,'department',p.department,'qty',line.qty,'weight_kg',p.weight_kg) order by p.name),'[]'::jsonb), coalesce(sum(p.price*line.qty),0), coalesce(sum(p.weight_kg*line.qty),0)
    into v_items,v_subtotal,v_weight from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id where p.merchant_id=p_merchant_id and p.available and line.qty between 1 and 100;
  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'One or more selected products are unavailable'; end if;
  if p_delivery_choice = 'courier' and (p_delivery_address is null or nullif(p_delivery_address ->> 'wilaya','') is null or nullif(p_delivery_address ->> 'commune','') is null or nullif(p_delivery_address ->> 'label','') is null) then raise exception 'PRECISE_DELIVERY_ADDRESS_REQUIRED'; end if;
  select * into v_quote from public.quote_delivery(p_merchant_id,coalesce(p_delivery_address,'{}'::jsonb),v_weight);
  v_requires := p_delivery_choice = 'courier' and (v_subtotal >= 10000 or v_quote.is_interwilaya);
  -- Email OTP verification is the only live account verification; no phone-OTP gate is introduced here.
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) into v_verified;
  if v_requires and not v_verified then raise exception 'EMAIL_OTP_VERIFICATION_REQUIRED'; end if;
  insert into public.orders(customer_id,merchant_id,status,items,delivery_address,delivery_choice,subtotal,delivery_fee,total,requires_phone_verification,is_interwilaya,total_weight_kg,delivery_distance_km,estimated_delivery_minutes,origin_wilaya,origin_commune,destination_wilaya,destination_commune,delivery_schedule_mode,delivery_schedule_status,requested_delivery_window_start,requested_delivery_window_end)
  select auth.uid(),p_merchant_id,'pending',v_items,p_delivery_address,p_delivery_choice,v_subtotal,case when p_delivery_choice='pickup' then 0 else v_quote.fee end,v_subtotal+case when p_delivery_choice='pickup' then 0 else v_quote.fee end,false,v_quote.is_interwilaya,v_weight,v_quote.distance_km,v_quote.eta_minutes,m.wilaya,m.commune,p_delivery_address->>'wilaya',p_delivery_address->>'commune',p_delivery_schedule_mode,v_schedule_status,p_requested_delivery_window_start,p_requested_delivery_window_end from public.merchants m where m.id=p_merchant_id returning * into v_order;
  insert into public.order_items(order_id,product_id,product_name,unit,unit_price,quantity) select v_order.id,p.id,p.name,p.unit,p.price,line.qty from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id;
  perform public.record_order_lifecycle_event(v_order.id,'customer_order_confirmed',jsonb_build_object('verification_required',v_requires,'delivery_fee',v_order.delivery_fee,'delivery_schedule_status',v_schedule_status));
  perform public.record_admin_order_notification(v_order.id,'order_created');
  return v_order;
end; $$;

create or replace function public.merchant_respond_delivery_schedule(p_order_id uuid, p_confirm boolean)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders;
begin
  if public.current_app_role() <> 'merchant' then raise exception 'MERCHANT_ROLE_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id and merchant_id = auth.uid() for update;
  if not found or v_order.delivery_schedule_status <> 'requested' then raise exception 'DELIVERY_SCHEDULE_RESPONSE_NOT_ALLOWED'; end if;
  update public.orders
  set delivery_schedule_status = case when p_confirm then 'confirmed' else 'declined' end,
      delivery_schedule_responded_at = now(),
      delivery_schedule_responded_by = auth.uid(),
      updated_at = now()
  where id = p_order_id returning * into v_order;
  perform public.record_order_lifecycle_event(v_order.id, case when p_confirm then 'merchant_confirmed_delivery_schedule' else 'merchant_declined_delivery_schedule' end);
  return v_order;
end; $$;

revoke all on function public.validate_delivery_schedule_settings(integer,jsonb,jsonb), public.has_scheduling_eligible_courier(uuid,jsonb,timestamptz,timestamptz), public.is_requested_delivery_window_available(uuid,text,jsonb,timestamptz,timestamptz), public.delivery_schedule_options(uuid,text,jsonb), public.merchant_save_delivery_schedule(boolean,integer,jsonb,jsonb), public.merchant_respond_delivery_schedule(uuid,boolean), public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.delivery_schedule_options(uuid,text,jsonb), public.merchant_save_delivery_schedule(boolean,integer,jsonb,jsonb), public.merchant_respond_delivery_schedule(uuid,boolean), public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) to authenticated;
