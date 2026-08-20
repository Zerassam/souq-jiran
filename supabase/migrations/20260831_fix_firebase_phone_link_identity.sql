-- تصحيح الربط الآمن للهاتف: التحدي يُنشأ بجلسة Supabase العادية،
-- بينما إثبات الرقم يُؤخذ حصراً من Firebase JWT عند تأكيد التحدي.
-- يُطبّق بعد 20260830_secure_firebase_phone_link.sql.

create or replace function public.request_my_firebase_phone_link(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_phone text := trim(p_phone);
  v_nonce uuid := gen_random_uuid();
begin
  if v_profile_id is null then
    raise exception 'A signed-in Supabase account is required to link a phone number';
  end if;

  if v_phone !~ '^\+213(5|6|7)[0-9]{8}$' then
    raise exception 'Invalid Algerian mobile number';
  end if;

  if exists (
    select 1 from public.profiles
    where phone = v_phone and id <> v_profile_id
  ) then
    raise exception 'This phone number is already linked to another account';
  end if;

  delete from public.firebase_phone_link_challenges
  where profile_id = v_profile_id;

  insert into public.firebase_phone_link_challenges (nonce, profile_id, requested_phone, expires_at)
  values (v_nonce, v_profile_id, v_phone, now() + interval '10 minutes');

  return v_nonce;
end;
$$;

create or replace function public.confirm_my_firebase_phone_link(p_challenge uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firebase_uid text := nullif(auth.jwt() ->> 'sub', '');
  v_phone text := nullif(auth.jwt() ->> 'phone_number', '');
  v_challenge public.firebase_phone_link_challenges%rowtype;
begin
  if auth.role() <> 'authenticated' or v_firebase_uid is null or v_phone is null then
    raise exception 'A verified Firebase JWT with phone_number is required';
  end if;

  select * into v_challenge
  from public.firebase_phone_link_challenges
  where nonce = p_challenge
  for update;

  if not found then
    raise exception 'Phone-link challenge was not found';
  end if;

  if v_challenge.expires_at <= now() then
    delete from public.firebase_phone_link_challenges where nonce = p_challenge;
    raise exception 'Phone-link challenge has expired';
  end if;

  if v_phone <> v_challenge.requested_phone then
    raise exception 'Firebase phone does not match the requested number';
  end if;

  update public.profiles
  set phone = v_phone,
      phone_verified_at = now(),
      firebase_uid = v_firebase_uid,
      updated_at = now()
  where id = v_challenge.profile_id;

  if not found then
    raise exception 'Supabase account profile was not found';
  end if;

  delete from public.firebase_phone_link_challenges where nonce = p_challenge;
  return jsonb_build_object('phone', v_phone, 'firebase_uid', v_firebase_uid, 'profile_id', v_challenge.profile_id);
end;
$$;

revoke all on function public.request_my_firebase_phone_link(text) from public, anon;
revoke all on function public.confirm_my_firebase_phone_link(uuid) from public, anon;
grant execute on function public.request_my_firebase_phone_link(text) to authenticated;
grant execute on function public.confirm_my_firebase_phone_link(uuid) to authenticated;
