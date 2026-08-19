-- استعادة الحساب وتغيير رقم الهاتف: وضع OTP التجريبي الآن، مع حدود واضحة للتفعيل الفعلي لاحقاً.
-- لا يتلقى العميل رمزاً فعلياً قبل تهيئة مزوّد الرسائل من الأسرار الآمنة.

create table if not exists public.account_phone_change_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_phone text not null check (requested_phone ~ '^\+213[567][0-9]{8}$'),
  channel text not null default 'mock' check (channel in ('mock', 'whatsapp', 'viber')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz
);

alter table public.account_phone_change_requests enable row level security;

drop policy if exists account_phone_change_requests_read_self on public.account_phone_change_requests;
create policy account_phone_change_requests_read_self on public.account_phone_change_requests
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.request_my_phone_change(p_phone text, p_channel text default 'mock')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_phone !~ '^\+213[567][0-9]{8}$' then raise exception 'Invalid Algerian mobile number'; end if;
  if p_channel not in ('mock', 'whatsapp', 'viber') then raise exception 'Unsupported delivery channel'; end if;
  if exists (select 1 from public.profiles where phone = p_phone and id <> auth.uid()) then
    raise exception 'Phone number is already linked to another account';
  end if;
  insert into public.account_phone_change_requests (user_id, requested_phone, channel, status, requested_at, expires_at, confirmed_at)
  values (auth.uid(), p_phone, p_channel, 'pending', now(), now() + interval '15 minutes', null)
  on conflict (user_id) do update set requested_phone = excluded.requested_phone, channel = excluded.channel, status = 'pending', requested_at = now(), expires_at = now() + interval '15 minutes', confirmed_at = null;
end;
$$;

create or replace function public.confirm_my_phone_change(p_phone text, p_method text default 'mock')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_phone !~ '^\+213[567][0-9]{8}$' then raise exception 'Invalid Algerian mobile number'; end if;
  if p_method not in ('mock', 'whatsapp', 'viber') then raise exception 'Unsupported verification method'; end if;
  if not exists (
    select 1 from public.account_phone_change_requests
    where user_id = auth.uid() and requested_phone = p_phone and status = 'pending' and expires_at > now()
  ) then raise exception 'No active phone-change request'; end if;
  if exists (select 1 from public.profiles where phone = p_phone and id <> auth.uid()) then
    raise exception 'Phone number is already linked to another account';
  end if;
  update public.profiles set phone = p_phone where id = auth.uid();
  update public.account_phone_change_requests set status = 'confirmed', confirmed_at = now() where user_id = auth.uid();
end;
$$;

revoke all on function public.request_my_phone_change(text, text) from public;
revoke all on function public.confirm_my_phone_change(text, text) from public;
grant execute on function public.request_my_phone_change(text, text) to authenticated;
grant execute on function public.confirm_my_phone_change(text, text) to authenticated;

comment on function public.confirm_my_phone_change(text, text) is
  'Mock mode only accepts the client-side demo OTP flow. Replace mock confirmation with provider-side proof before enabling WhatsApp or Viber.';
