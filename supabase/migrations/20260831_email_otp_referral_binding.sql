-- إحالة العميل بعد اعتماد Email OTP كآلية التحقق الوحيدة.
-- يحافظ هذا الترحيل على منع الإحالة الذاتية وعلى اشتراط المطالبة قبل أول طلب مؤهل.

begin;

create or replace function public.claim_customer_referral(p_referral_code text)
returns public.customer_referrals
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_referrer uuid;
  v_referral public.customer_referrals;
  v_existing_orders integer;
begin
  if public.current_app_role() <> 'customer' then
    raise exception 'CUSTOMER_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  ) then
    raise exception 'EMAIL_OTP_VERIFICATION_REQUIRED';
  end if;

  if nullif(trim(p_referral_code), '') is null then
    raise exception 'REFERRAL_CODE_REQUIRED';
  end if;

  select id into v_referrer
  from public.profiles
  where role = 'customer'
    and upper(referral_code) = upper(trim(p_referral_code));

  if v_referrer is null then
    raise exception 'REFERRAL_CODE_INVALID';
  end if;
  if v_referrer = auth.uid() then
    raise exception 'REFERRAL_SELF_NOT_ALLOWED';
  end if;

  select count(*) into v_existing_orders
  from public.orders
  where customer_id = auth.uid()
    and status not in ('cancelled', 'declined');

  if v_existing_orders > 0 then
    raise exception 'REFERRAL_MUST_BE_CLAIMED_BEFORE_FIRST_ORDER';
  end if;

  insert into public.customer_referrals(referrer_id, referred_customer_id, referral_code)
  values (v_referrer, auth.uid(), upper(trim(p_referral_code)))
  on conflict(referred_customer_id) do update
    set referral_code = excluded.referral_code
  returning * into v_referral;

  return v_referral;
end;
$$;

revoke all on function public.claim_customer_referral(text) from public;
grant execute on function public.claim_customer_referral(text) to authenticated;

commit;
