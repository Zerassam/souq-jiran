-- Secure Firebase phone linking.
-- Prerequisite: enable Firebase Third-party Auth in Supabase so auth.jwt() is a
-- verified Firebase ID token for calls made through firebaseSupabase.

create table if not exists public.firebase_phone_link_challenges (
  nonce uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

alter table public.firebase_phone_link_challenges enable row level security;

create or replace function public.request_my_firebase_phone_link(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_phone !~ '^\+213[567][0-9]{8}$' then
    raise exception 'Invalid Algerian mobile number';
  end if;
  delete from public.firebase_phone_link_challenges where profile_id = auth.uid();
  insert into public.firebase_phone_link_challenges (profile_id, phone)
  values (auth.uid(), p_phone)
  returning nonce into v_nonce;
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
  v_challenge public.firebase_phone_link_challenges%rowtype;
  v_firebase_uid text;
  v_phone text;
begin
  v_firebase_uid := auth.jwt() ->> 'sub';
  v_phone := auth.jwt() ->> 'phone_number';
  if v_firebase_uid is null or v_phone is null then
    raise exception 'A verified Firebase token with phone_number is required';
  end if;
  select * into v_challenge from public.firebase_phone_link_challenges
  where nonce = p_challenge and expires_at > now()
  for update;
  if not found then
    raise exception 'Phone link challenge is invalid or expired';
  end if;
  if v_challenge.phone <> v_phone then
    raise exception 'Firebase phone does not match the requested phone';
  end if;
  if exists (select 1 from public.profiles where firebase_uid = v_firebase_uid and id <> v_challenge.profile_id) then
    raise exception 'Firebase identity is already linked to another account';
  end if;
  if exists (select 1 from public.profiles where phone = v_phone and id <> v_challenge.profile_id) then
    raise exception 'Phone number is already linked to another account';
  end if;
  update public.profiles
  set phone = v_phone,
      firebase_uid = v_firebase_uid,
      phone_verified_at = now(),
      updated_at = now()
  where id = v_challenge.profile_id;
  delete from public.firebase_phone_link_challenges where nonce = p_challenge;
  return jsonb_build_object('phone', v_phone, 'firebase_uid', v_firebase_uid);
end;
$$;

revoke all on function public.record_my_firebase_phone(text, text) from public, anon, authenticated;
grant execute on function public.request_my_firebase_phone_link(text) to authenticated;
grant execute on function public.confirm_my_firebase_phone_link(uuid) to authenticated;
