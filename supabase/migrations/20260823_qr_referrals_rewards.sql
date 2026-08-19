-- سوق الجيران: QR للمحلات، إحالات العملاء، وقسائم المكافآت.
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor بعد 20260822_advanced_order_lifecycle.sql.
-- لا يخزن هذا الامتداد أرقام الهواتف داخل روابط الدعوة أو QR.

alter table public.profiles add column if not exists referral_code text;
alter table public.orders add column if not exists reward_discount_amount integer not null default 0 check (reward_discount_amount >= 0);
alter table public.orders add column if not exists reward_coupon_id uuid;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (upper(referral_code)) where referral_code is not null;

create table if not exists public.referral_reward_config (
  id boolean primary key default true check (id),
  invited_customer_discount integer not null default 150 check (invited_customer_discount > 0),
  referrer_reward_amount integer not null default 200 check (referrer_reward_amount > 0),
  minimum_order_total integer not null default 800 check (minimum_order_total >= 0),
  coupon_valid_days integer not null default 90 check (coupon_valid_days between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.referral_reward_config(id) values (true) on conflict (id) do nothing;

create table if not exists public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete restrict,
  referred_customer_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','awarded','invalid')),
  first_qualified_order_id uuid unique references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  awarded_at timestamptz,
  invalidated_at timestamptz,
  check (referrer_id <> referred_customer_id)
);
create index if not exists customer_referrals_referrer_idx on public.customer_referrals(referrer_id, created_at desc);
create index if not exists customer_referrals_status_idx on public.customer_referrals(status, created_at desc);

create table if not exists public.reward_coupons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid references public.customer_referrals(id) on delete set null,
  code text not null unique,
  kind text not null check (kind in ('invited_first_order','referrer_success')),
  amount integer not null check (amount > 0),
  minimum_order_total integer not null default 0 check (minimum_order_total >= 0),
  status text not null default 'available' check (status in ('available','redeemed','expired','cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_order_id uuid unique references public.orders(id) on delete set null
);
create unique index if not exists reward_coupons_referral_kind_once
  on public.reward_coupons(referral_id, kind) where referral_id is not null;
create index if not exists reward_coupons_customer_idx on public.reward_coupons(customer_id, status, expires_at);

alter table public.orders
  add constraint orders_reward_coupon_fk
  foreign key (reward_coupon_id) references public.reward_coupons(id) on delete set null;

alter table public.referral_reward_config enable row level security;
alter table public.customer_referrals enable row level security;
alter table public.reward_coupons enable row level security;

drop policy if exists referral_reward_config_read on public.referral_reward_config;
create policy referral_reward_config_read on public.referral_reward_config for select to authenticated using (true);
drop policy if exists referral_reward_config_admin_write on public.referral_reward_config;
create policy referral_reward_config_admin_write on public.referral_reward_config for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists customer_referrals_participant_read on public.customer_referrals;
create policy customer_referrals_participant_read on public.customer_referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_customer_id = auth.uid() or public.is_app_admin());
drop policy if exists reward_coupons_owner_read on public.reward_coupons;
create policy reward_coupons_owner_read on public.reward_coupons for select to authenticated
  using (customer_id = auth.uid() or public.is_app_admin());

create or replace function public.generate_referral_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists(select 1 from public.profiles where upper(referral_code) = v_code);
  end loop;
  return v_code;
end; $$;

create or replace function public.ensure_my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  select referral_code into v_code from public.profiles where id = auth.uid() for update;
  if v_code is null then
    v_code := public.generate_referral_code();
    update public.profiles set referral_code = v_code, updated_at = now() where id = auth.uid();
  end if;
  return v_code;
end; $$;

create or replace function public.claim_customer_referral(p_referral_code text)
returns public.customer_referrals language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_referral public.customer_referrals; v_existing_orders integer;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if nullif(trim(p_referral_code), '') is null then raise exception 'REFERRAL_CODE_REQUIRED'; end if;
  select id into v_referrer from public.profiles where role = 'customer' and upper(referral_code) = upper(trim(p_referral_code));
  if v_referrer is null then raise exception 'REFERRAL_CODE_INVALID'; end if;
  if v_referrer = auth.uid() then raise exception 'REFERRAL_SELF_NOT_ALLOWED'; end if;
  select count(*) into v_existing_orders from public.orders where customer_id = auth.uid() and status not in ('cancelled','declined');
  if v_existing_orders > 0 then raise exception 'REFERRAL_MUST_BE_CLAIMED_BEFORE_FIRST_ORDER'; end if;
  insert into public.customer_referrals(referrer_id, referred_customer_id, referral_code)
    values(v_referrer, auth.uid(), upper(trim(p_referral_code)))
    on conflict(referred_customer_id) do update set referral_code = excluded.referral_code
    returning * into v_referral;
  return v_referral;
end; $$;

create or replace function public.issue_referral_coupon(p_customer_id uuid, p_referral_id uuid, p_kind text, p_amount integer, p_minimum integer, p_valid_days integer)
returns public.reward_coupons language plpgsql security definer set search_path = public as $$
declare v_coupon public.reward_coupons; v_code text;
begin
  loop
    v_code := 'SJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists(select 1 from public.reward_coupons where code = v_code);
  end loop;
  insert into public.reward_coupons(customer_id, referral_id, code, kind, amount, minimum_order_total, expires_at)
    values (p_customer_id, p_referral_id, v_code, p_kind, p_amount, p_minimum, now() + make_interval(days => p_valid_days))
    on conflict (referral_id, kind) where referral_id is not null do update set customer_id = excluded.customer_id
    returning * into v_coupon;
  return v_coupon;
end; $$;

create or replace function public.redeem_reward_coupon(p_order_id uuid, p_coupon_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_coupon public.reward_coupons; v_discount integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id <> auth.uid() then raise exception 'ORDER_NOT_OWNED'; end if;
  if v_order.status <> 'pending' then raise exception 'REWARD_ONLY_ON_PENDING_ORDER'; end if;
  select * into v_coupon from public.reward_coupons where code = upper(trim(p_coupon_code)) for update;
  if not found or v_coupon.customer_id <> auth.uid() then raise exception 'COUPON_NOT_FOUND'; end if;
  if v_coupon.status <> 'available' or (v_coupon.expires_at is not null and v_coupon.expires_at <= now()) then raise exception 'COUPON_NOT_AVAILABLE'; end if;
  if v_order.subtotal < v_coupon.minimum_order_total then raise exception 'COUPON_MINIMUM_NOT_MET'; end if;
  v_discount := least(v_coupon.amount, v_order.subtotal + v_order.delivery_fee);
  update public.reward_coupons set status='redeemed', redeemed_at=now(), redeemed_order_id=p_order_id where id=v_coupon.id;
  update public.orders set reward_coupon_id=v_coupon.id, reward_discount_amount=v_discount, total=greatest(0, subtotal + delivery_fee - v_discount), updated_at=now() where id=p_order_id;
  return v_discount;
end; $$;

create or replace function public.award_referral_for_settled_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_referral public.customer_referrals; v_config public.referral_reward_config; v_prior_settled integer;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status <> 'settled' then return; end if;
  select * into v_referral from public.customer_referrals where referred_customer_id=v_order.customer_id and status='pending' for update;
  if not found then return; end if;
  select count(*) into v_prior_settled from public.orders where customer_id=v_order.customer_id and status='settled' and id <> v_order.id;
  if v_prior_settled > 0 then return; end if;
  select * into v_config from public.referral_reward_config where id=true;
  update public.customer_referrals set status='qualified', first_qualified_order_id=v_order.id, qualified_at=now() where id=v_referral.id;
  perform public.issue_referral_coupon(v_order.customer_id, v_referral.id, 'invited_first_order', v_config.invited_customer_discount, v_config.minimum_order_total, v_config.coupon_valid_days);
  perform public.issue_referral_coupon(v_referral.referrer_id, v_referral.id, 'referrer_success', v_config.referrer_reward_amount, v_config.minimum_order_total, v_config.coupon_valid_days);
  update public.customer_referrals set status='awarded', awarded_at=now() where id=v_referral.id;
  perform public.record_order_lifecycle_event(v_order.id, 'referral_rewards_awarded', jsonb_build_object('referral_id', v_referral.id));
end; $$;

-- استبدال إجراء التسوية فقط لإطلاق منح المكافآت بعد تأكيد التاجر.
create or replace function public.merchant_confirm_settlement(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v public.orders;
begin
  select * into v from public.orders where id=p_order_id for update;
  if not found or v.merchant_id<>auth.uid() or v.status<>'remittance_confirmed' then raise exception 'MERCHANT_SETTLEMENT_NOT_ALLOWED'; end if;
  update public.orders set status='settled',merchant_settled_at=now(),updated_at=now() where id=p_order_id returning * into v;
  perform public.record_order_lifecycle_event(v.id,'merchant_confirmed_settlement');
  perform public.award_referral_for_settled_order(v.id);
  return v;
end; $$;

revoke all on function public.generate_referral_code(), public.issue_referral_coupon(uuid,uuid,text,integer,integer,integer), public.redeem_reward_coupon(uuid,text), public.award_referral_for_settled_order(uuid) from public;
grant execute on function public.ensure_my_referral_code(), public.claim_customer_referral(text), public.redeem_reward_coupon(uuid,text) to authenticated;
grant execute on function public.merchant_confirm_settlement(uuid) to authenticated;
