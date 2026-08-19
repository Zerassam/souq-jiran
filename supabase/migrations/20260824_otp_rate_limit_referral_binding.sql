-- شغّل هذا الملف بعد 20260823_qr_referrals_rewards.sql.
-- يبقى الإرسال الخارجي معطلاً: هذا السجل يفرض حدوداً قبل تفعيل WhatsApp أو Viber.

create table if not exists public.customer_otp_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  requested_channel text not null check (requested_channel in ('whatsapp', 'viber', 'mock')),
  delivered_channel text not null check (delivered_channel in ('whatsapp', 'viber', 'mock')),
  is_fallback boolean not null default false,
  requested_at timestamptz not null default now()
);

create index if not exists customer_otp_delivery_attempts_rate_idx
  on public.customer_otp_delivery_attempts(customer_id, requested_at desc);

alter table public.customer_otp_delivery_attempts enable row level security;
drop policy if exists customer_otp_delivery_attempts_self_read on public.customer_otp_delivery_attempts;
create policy customer_otp_delivery_attempts_self_read on public.customer_otp_delivery_attempts
  for select to authenticated using (customer_id = auth.uid() or public.is_app_admin());

create or replace function public.request_customer_phone_verification(p_phone text, p_channel text default 'whatsapp')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s', '', 'g');
  v_last_requested_at timestamptz;
  v_recent_attempts integer;
  v_delivered_channel text;
  v_wait_seconds integer;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if v_phone !~ '^\+?[0-9]{8,16}$' then raise exception 'PHONE_INVALID'; end if;
  if p_channel not in ('whatsapp', 'viber', 'mock') then raise exception 'OTP_CHANNEL_INVALID'; end if;

  select max(requested_at), count(*) filter (where requested_at > now() - interval '15 minutes')
    into v_last_requested_at, v_recent_attempts
  from public.customer_otp_delivery_attempts
  where customer_id = auth.uid();

  if v_last_requested_at is not null and v_last_requested_at > now() - interval '60 seconds' then
    v_wait_seconds := ceil(extract(epoch from (v_last_requested_at + interval '60 seconds' - now())))::integer;
    raise exception 'OTP_RESEND_COOLDOWN:%', greatest(v_wait_seconds, 1);
  end if;
  if coalesce(v_recent_attempts, 0) >= 3 then
    raise exception 'OTP_RATE_LIMIT_15_MINUTES';
  end if;

  -- لا توجد مفاتيح مزود في هذه المرحلة؛ المحاولة محفوظة على أنها محاكاة معلنة.
  -- تبقى القناة المطلوبة في السجل كي يظهر التدرج WhatsApp → Viber → Mock في الواجهة.
  v_delivered_channel := 'mock';
  insert into public.customer_otp_delivery_attempts(customer_id, phone, requested_channel, delivered_channel, is_fallback)
  values (auth.uid(), v_phone, p_channel, v_delivered_channel, p_channel <> 'mock');

  return jsonb_build_object(
    'mode', 'mock',
    'requested_channel', p_channel,
    'delivered_channel', v_delivered_channel,
    'fallback_available', p_channel = 'whatsapp',
    'cooldown_seconds', 60,
    'message', 'الإرسال الخارجي غير مفعّل؛ استُخدم وضع الاختبار المعلن.'
  );
end; $$;

create or replace function public.confirm_customer_phone_verification(p_phone text, p_method text default 'otp')
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_auth_phone text;
  v_method text := case when p_method in ('mock_otp', 'whatsapp', 'viber') then 'otp' else p_method end;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if v_method not in ('otp', 'voice_call') then raise exception 'INVALID_VERIFICATION_METHOD'; end if;
  select phone into v_auth_phone from auth.users where id = auth.uid();
  if v_auth_phone is null or regexp_replace(v_auth_phone, '\s', '', 'g') <> regexp_replace(p_phone, '\s', '', 'g') then raise exception 'PHONE_OTP_NOT_CONFIRMED'; end if;
  insert into public.customer_phone_verifications(customer_id, phone, verified_at, verification_method, updated_at)
  values(auth.uid(), p_phone, now(), v_method, now())
  on conflict(customer_id) do update set phone=excluded.phone, verified_at=excluded.verified_at, verification_method=excluded.verification_method, updated_at=now();
  update public.profiles set phone = p_phone, updated_at = now() where id = auth.uid();
end; $$;

create or replace function public.claim_customer_referral(p_referral_code text)
returns public.customer_referrals language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_referral public.customer_referrals; v_existing_orders integer;
begin
  if public.current_app_role() <> 'customer' then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  if not exists(select 1 from public.customer_phone_verifications where customer_id = auth.uid() and verified_at is not null) then
    raise exception 'PHONE_VERIFICATION_REQUIRED_FOR_REFERRAL';
  end if;
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

revoke all on table public.customer_otp_delivery_attempts from public;
revoke all on function public.request_customer_phone_verification(text,text) from public;
grant execute on function public.request_customer_phone_verification(text,text), public.confirm_customer_phone_verification(text,text), public.claim_customer_referral(text) to authenticated;
