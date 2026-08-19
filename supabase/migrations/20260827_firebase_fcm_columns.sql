-- Firebase Phone Authentication and FCM metadata for Souq Jiran.
-- Apply this migration in Supabase SQL Editor after enabling the Firebase
-- Third-party Auth integration for project `souq-jiran`.

alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists fcm_token text,
  add column if not exists fcm_updated_at timestamptz,
  add column if not exists firebase_uid text;

create unique index if not exists profiles_firebase_uid_unique
  on public.profiles (firebase_uid)
  where firebase_uid is not null;

-- The caller is already authenticated by Supabase Auth or a trusted Firebase
-- JWT. This function only ever updates the caller's profile row and therefore
-- never exposes a phone number or notification token through analytics views.
create or replace function public.update_my_fcm_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set fcm_token = nullif(trim(p_token), ''),
      fcm_updated_at = now(),
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.record_my_firebase_phone(
  p_firebase_uid text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_firebase_uid), '') is null then
    raise exception 'Firebase user identifier is required';
  end if;

  update public.profiles
  set firebase_uid = trim(p_firebase_uid),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      phone_verified_at = now(),
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.update_my_fcm_token(text) from public;
revoke all on function public.record_my_firebase_phone(text, text) from public;
grant execute on function public.update_my_fcm_token(text) to authenticated;
grant execute on function public.record_my_firebase_phone(text, text) to authenticated;
