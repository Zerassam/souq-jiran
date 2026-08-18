-- Advanced order lifecycle, customer verification and inter-wilaya delivery.
-- Run once in Supabase SQL Editor as the project database owner.

alter table public.products add column if not exists weight_kg numeric(8,3) not null default 0.250 check (weight_kg > 0 and weight_kg <= 100);
alter table public.merchants add column if not exists address_label text;
alter table public.merchants add column if not exists latitude numeric(10,7) check (latitude between -90 and 90);
alter table public.merchants add column if not exists longitude numeric(10,7) check (longitude between -180 and 180);
alter table public.couriers add column if not exists interwilaya_enabled boolean not null default false;
alter table public.couriers add column if not exists max_interwilaya_km numeric(8,2) check (max_interwilaya_km is null or max_interwilaya_km > 0);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending', 'accepted', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery',
  'delivered', 'customer_confirmed', 'remittance_confirmed', 'settled', 'declined', 'cancelled'
));
alter table public.orders add column if not exists requires_phone_verification boolean not null default false;
alter table public.orders add column if not exists is_interwilaya boolean not null default false;
alter table public.orders add column if not exists total_weight_kg numeric(10,3) not null default 0;
alter table public.orders add column if not exists delivery_distance_km numeric(10,2) not null default 0;
alter table public.orders add column if not exists estimated_delivery_minutes integer;
alter table public.orders add column if not exists origin_wilaya text;
alter table public.orders add column if not exists origin_commune text;
alter table public.orders add column if not exists destination_wilaya text;
alter table public.orders add column if not exists destination_commune text;
alter table public.orders add column if not exists courier_picked_up_at timestamptz;
alter table public.orders add column if not exists customer_received_at timestamptz;
alter table public.orders add column if not exists courier_remitted_at timestamptz;
alter table public.orders add column if not exists merchant_settled_at timestamptz;

create table if not exists public.customer_phone_verifications (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null,
  verified_at timestamptz,
  verification_method text not null default 'otp' check (verification_method in ('otp', 'voice_call')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_behavior_reports (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  related_order_id uuid references public.orders(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.customer_blacklist (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);

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

create table if not exists public.order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_lifecycle_events_order_idx on public.order_lifecycle_events(order_id, created_at);

alter table public.customer_phone_verifications enable row level security;
alter table public.customer_behavior_reports enable row level security;
alter table public.customer_blacklist enable row level security;
alter table public.delivery_pricing_config enable row level security;
alter table public.order_lifecycle_events enable row level security;

drop policy if exists customer_phone_verifications_self_read on public.customer_phone_verifications;
create policy customer_phone_verifications_self_read on public.customer_phone_verifications for select to authenticated using (customer_id = auth.uid() or public.is_app_admin());
drop policy if exists customer_behavior_reports_reporter_or_admin_read on public.customer_behavior_reports;
create policy customer_behavior_reports_reporter_or_admin_read on public.customer_behavior_reports for select to authenticated using (reporter_id = auth.uid() or public.is_app_admin());
drop policy if exists customer_blacklist_admin_read on public.customer_blacklist;
create policy customer_blacklist_admin_read on public.customer_blacklist for select to authenticated using (public.is_app_admin());
drop policy if exists delivery_pricing_config_read on public.delivery_pricing_config;
create policy delivery_pricing_config_read on public.delivery_pricing_config for select to authenticated using (true);
drop policy if exists delivery_pricing_config_admin_write on public.delivery_pricing_config;
create policy delivery_pricing_config_admin_write on public.delivery_pricing_config for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists order_lifecycle_events_participant_read on public.order_lifecycle_events;
create policy order_lifecycle_events_participant_read on public.order_lifecycle_events for select to authenticated using (
  public.is_app_admin() or exists (select 1 from public.orders o where o.id = order_lifecycle_events.order_id and (o.customer_id = auth.uid() or o.merchant_id = auth.uid() or o.courier_id = auth.uid()))
);

create or replace function public.is_customer_blacklisted(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.customer_blacklist b where b.customer_id = p_customer_id and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()));
$$;

create or replace function public.record_order_lifecycle_event(p_order_id uuid, p_event_type text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_lifecycle_events(order_id, event_type, actor_id, actor_role, details)
  values (p_order_id, p_event_type, auth.uid(), public.current_app_role(), coalesce(p_details, '{}'::jsonb));
end; $$;

create or replace function public.confirm_customer_phone_verification(p_phone text, p_method text default 'otp')
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_auth_phone text;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if p_method not in ('otp', 'voice_call') then raise exception 'INVALID_VERIFICATION_METHOD'; end if;
  select phone into v_auth_phone from auth.users where id = auth.uid();
  if v_auth_phone is null or regexp_replace(v_auth_phone, '\\s', '', 'g') <> regexp_replace(p_phone, '\\s', '', 'g') then raise exception 'PHONE_OTP_NOT_CONFIRMED'; end if;
  insert into public.customer_phone_verifications(customer_id, phone, verified_at, verification_method, updated_at)
  values(auth.uid(), p_phone, now(), p_method, now())
  on conflict(customer_id) do update set phone=excluded.phone, verified_at=excluded.verified_at, verification_method=excluded.verification_method, updated_at=now();
  update public.profiles set phone = p_phone, updated_at = now() where id = auth.uid();
end; $$;

create or replace function public.report_customer_account(p_customer_id uuid, p_reason text, p_order_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_app_role() not in ('merchant', 'admin') then raise exception 'REPORTER_ROLE_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_customer_id and role='customer') then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if public.current_app_role()='merchant' and not exists(select 1 from public.orders where id=p_order_id and merchant_id=auth.uid() and customer_id=p_customer_id) then raise exception 'RELATED_ORDER_REQUIRED'; end if;
  insert into public.customer_behavior_reports(customer_id, reporter_id, reason, related_order_id) values (p_customer_id, auth.uid(), p_reason, p_order_id);
end; $$;

create or replace function public.admin_set_customer_blacklist(p_customer_id uuid, p_reason text, p_is_blocked boolean, p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  if p_is_blocked then
    insert into public.customer_blacklist(customer_id, reason, created_by, expires_at) values(p_customer_id, p_reason, auth.uid(), p_expires_at)
    on conflict(customer_id) do update set reason=excluded.reason, created_by=auth.uid(), created_at=now(), expires_at=excluded.expires_at, revoked_at=null, revoked_by=null;
  else
    update public.customer_blacklist set revoked_at=now(), revoked_by=auth.uid() where customer_id=p_customer_id and revoked_at is null;
  end if;
end; $$;

create or replace function public.haversine_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns numeric language sql immutable as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(($3-$1)/2)),2) + cos(radians($1))*cos(radians($3))*power(sin(radians(($4-$2)/2)),2)));
$$;

create or replace function public.quote_delivery(p_merchant_id uuid, p_destination jsonb, p_weight_kg numeric default 0.25)
returns table(distance_km numeric, fee integer, eta_minutes integer, is_interwilaya boolean, is_precise boolean)
language plpgsql security definer set search_path = public as $$
declare m public.merchants; c public.delivery_pricing_config; d numeric := 0; interstate boolean; precise boolean := false;
begin
  select * into m from public.merchants where id=p_merchant_id and status='approved'; if not found then raise exception 'MERCHANT_NOT_AVAILABLE'; end if;
  select * into c from public.delivery_pricing_config where id=true;
  interstate := coalesce(m.wilaya <> nullif(p_destination->>'wilaya',''), false);
  if m.latitude is not null and m.longitude is not null and (p_destination ? 'latitude') and (p_destination ? 'longitude') then
    d := public.haversine_km(m.latitude, m.longitude, (p_destination->>'latitude')::numeric, (p_destination->>'longitude')::numeric); precise := true;
  end if;
  return query select round(d,2), greatest(c.minimum_fee, round(c.base_fee + d*c.fee_per_km + greatest(coalesce(p_weight_kg,0.25),0.05)*c.fee_per_kg + case when interstate then c.interwilaya_surcharge else 0 end)::integer), greatest(20, ceil((d/c.average_speed_kmh)*60 + 25)::integer), interstate, precise;
end; $$;

create or replace function public.create_customer_order(p_merchant_id uuid, p_items jsonb, p_delivery_choice text default 'pickup', p_delivery_address jsonb default null, p_delivery_fee integer default 0)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_items jsonb; v_subtotal integer; v_weight numeric; v_order public.orders; v_quote record; v_requires boolean; v_verified boolean;
begin
  if public.current_app_role() <> 'customer' then raise exception 'Only customer accounts can create orders'; end if;
  if public.is_customer_blacklisted(auth.uid()) then raise exception 'CUSTOMER_ACCOUNT_BLOCKED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'An order needs at least one product'; end if;
  if p_delivery_choice not in ('pickup','store','courier') then raise exception 'Invalid delivery options'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'unit',p.unit,'department',p.department,'qty',line.qty,'weight_kg',p.weight_kg) order by p.name),'[]'::jsonb), coalesce(sum(p.price*line.qty),0), coalesce(sum(p.weight_kg*line.qty),0)
  into v_items,v_subtotal,v_weight from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id where p.merchant_id=p_merchant_id and p.available and line.qty between 1 and 100;
  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'One or more selected products are unavailable'; end if;
  if p_delivery_choice='courier' and (p_delivery_address is null or nullif(p_delivery_address->>'wilaya','') is null or nullif(p_delivery_address->>'commune','') is null or nullif(p_delivery_address->>'label','') is null) then raise exception 'PRECISE_DELIVERY_ADDRESS_REQUIRED'; end if;
  select * into v_quote from public.quote_delivery(p_merchant_id,coalesce(p_delivery_address,'{}'::jsonb),v_weight);
  v_requires := p_delivery_choice='courier' and (v_subtotal >= 10000 or v_quote.is_interwilaya);
  select exists(select 1 from public.customer_phone_verifications where customer_id=auth.uid() and verified_at is not null) into v_verified;
  if v_requires and not v_verified then raise exception 'PHONE_VERIFICATION_REQUIRED'; end if;
  insert into public.orders(customer_id,merchant_id,status,items,delivery_address,delivery_choice,subtotal,delivery_fee,total,requires_phone_verification,is_interwilaya,total_weight_kg,delivery_distance_km,estimated_delivery_minutes,origin_wilaya,origin_commune,destination_wilaya,destination_commune)
  select auth.uid(),p_merchant_id,'pending',v_items,p_delivery_address,p_delivery_choice,v_subtotal,case when p_delivery_choice='pickup' then 0 else v_quote.fee end,v_subtotal+case when p_delivery_choice='pickup' then 0 else v_quote.fee end,v_requires,v_quote.is_interwilaya,v_weight,v_quote.distance_km,v_quote.eta_minutes,m.wilaya,m.commune,p_delivery_address->>'wilaya',p_delivery_address->>'commune' from public.merchants m where m.id=p_merchant_id returning * into v_order;
  insert into public.order_items(order_id,product_id,product_name,unit,unit_price,quantity) select v_order.id,p.id,p.name,p.unit,p.price,line.qty from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id;
  perform public.record_order_lifecycle_event(v_order.id,'customer_order_confirmed',jsonb_build_object('verification_required',v_requires,'delivery_fee',v_order.delivery_fee));
  perform public.record_admin_order_notification(v_order.id,'order_created'); return v_order;
end; $$;

create or replace function public.courier_confirm_pickup(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.courier_id<>auth.uid() or v.status<>'assigned' then raise exception 'COURIER_PICKUP_NOT_ALLOWED'; end if;
  update public.orders set status='picked_up',courier_picked_up_at=now(),updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'courier_confirmed_pickup'); return v; end; $$;
create or replace function public.courier_start_delivery(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.courier_id<>auth.uid() or v.status<>'picked_up' then raise exception 'COURIER_DELIVERY_NOT_ALLOWED'; end if;
  update public.orders set status='out_for_delivery',updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'courier_started_delivery'); return v; end; $$;
create or replace function public.courier_confirm_delivery(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.courier_id<>auth.uid() or v.status<>'out_for_delivery' then raise exception 'COURIER_DELIVERY_CONFIRMATION_NOT_ALLOWED'; end if;
  update public.orders set status='delivered',updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'courier_confirmed_delivery'); perform public.record_admin_order_notification(v.id,'order_delivered'); return v; end; $$;
create or replace function public.customer_confirm_delivery(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.customer_id<>auth.uid() or v.status<>'delivered' then raise exception 'CUSTOMER_CONFIRMATION_NOT_ALLOWED'; end if;
  update public.orders set status='customer_confirmed',customer_received_at=now(),updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'customer_confirmed_receipt_and_payment'); return v; end; $$;
create or replace function public.courier_confirm_remittance(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.courier_id<>auth.uid() or v.status<>'customer_confirmed' then raise exception 'COURIER_REMITTANCE_NOT_ALLOWED'; end if;
  update public.orders set status='remittance_confirmed',courier_remitted_at=now(),updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'courier_confirmed_remittance'); return v; end; $$;
create or replace function public.merchant_confirm_settlement(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$ declare v public.orders; begin
  select * into v from public.orders where id=p_order_id for update; if not found or v.merchant_id<>auth.uid() or v.status<>'remittance_confirmed' then raise exception 'MERCHANT_SETTLEMENT_NOT_ALLOWED'; end if;
  update public.orders set status='settled',merchant_settled_at=now(),updated_at=now() where id=p_order_id returning * into v; perform public.record_order_lifecycle_event(v.id,'merchant_confirmed_settlement'); return v; end; $$;

revoke all on function public.is_customer_blacklisted(uuid), public.record_order_lifecycle_event(uuid,text,jsonb), public.confirm_customer_phone_verification(text,text), public.report_customer_account(uuid,text,uuid), public.admin_set_customer_blacklist(uuid,text,boolean,timestamptz), public.quote_delivery(uuid,jsonb,numeric), public.courier_confirm_pickup(uuid), public.courier_start_delivery(uuid), public.courier_confirm_delivery(uuid), public.customer_confirm_delivery(uuid), public.courier_confirm_remittance(uuid), public.merchant_confirm_settlement(uuid) from public;
grant execute on function public.is_customer_blacklisted(uuid), public.confirm_customer_phone_verification(text,text), public.report_customer_account(uuid,text,uuid), public.quote_delivery(uuid,jsonb,numeric), public.courier_confirm_pickup(uuid), public.courier_start_delivery(uuid), public.courier_confirm_delivery(uuid), public.customer_confirm_delivery(uuid), public.courier_confirm_remittance(uuid), public.merchant_confirm_settlement(uuid), public.create_customer_order(uuid,jsonb,text,jsonb,integer) to authenticated;
grant execute on function public.admin_set_customer_blacklist(uuid,text,boolean,timestamptz) to authenticated;
