-- قناة Firebase SMS لتغيير رقم الهاتف. يجب تطبيق 20260826 و20260827 قبل هذا الترحيل.
alter table public.account_phone_change_requests
  drop constraint if exists account_phone_change_requests_channel_check;

alter table public.account_phone_change_requests
  add constraint account_phone_change_requests_channel_check
  check (channel in ('mock', 'whatsapp', 'viber', 'firebase_sms'));

create or replace function public.request_my_phone_change(p_phone text, p_channel text default 'firebase_sms')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_phone !~ '^\+213[567][0-9]{8}$' then raise exception 'Invalid Algerian mobile number'; end if;
  if p_channel not in ('firebase_sms') then raise exception 'Unsupported delivery channel'; end if;
  if exists (select 1 from public.profiles where phone = p_phone and id <> auth.uid()) then
    raise exception 'Phone number is already linked to another account';
  end if;
  insert into public.account_phone_change_requests (user_id, requested_phone, channel, status, requested_at, expires_at, confirmed_at)
  values (auth.uid(), p_phone, p_channel, 'pending', now(), now() + interval '15 minutes', null)
  on conflict (user_id) do update set requested_phone = excluded.requested_phone, channel = excluded.channel, status = 'pending', requested_at = now(), expires_at = now() + interval '15 minutes', confirmed_at = null;
end;
$$;

create or replace function public.confirm_my_phone_change(p_phone text, p_method text default 'firebase_sms')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_phone !~ '^\+213[567][0-9]{8}$' then raise exception 'Invalid Algerian mobile number'; end if;
  if p_method <> 'firebase_sms' then raise exception 'Unsupported verification method'; end if;
  if not exists (
    select 1 from public.account_phone_change_requests
    where user_id = auth.uid() and requested_phone = p_phone and channel = 'firebase_sms'
      and status = 'pending' and expires_at > now()
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
