-- Live order notifications for Souq Jiran.
-- Apply in the Supabase SQL Editor after storing the two webhook values in Vault:
--   select vault.create_secret('https://YOUR-PUBLISHED-DOMAIN/api/hooks/orders/push', 'souq_jiran_order_push_url');
--   select vault.create_secret('A-LONG-RANDOM-SHARED-SECRET', 'souq_jiran_order_push_secret');
-- The shared secret must also be configured only as ORDER_PUSH_WEBHOOK_SECRET in the web app's secrets.

create extension if not exists pg_net;

create table if not exists public.order_push_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  previous_status text,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  dispatch_state text not null default 'queued' check (dispatch_state in ('queued', 'disabled')),
  webhook_request_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists order_push_events_order_created_idx
  on public.order_push_events(order_id, created_at desc);

alter table public.order_push_events enable row level security;

drop policy if exists order_push_events_admin_read on public.order_push_events;
create policy order_push_events_admin_read on public.order_push_events
  for select to authenticated using (public.is_app_admin());

-- A device token is tied to the active account on this device. It must be
-- removed on sign-out so a subsequent account cannot receive stale alerts.
create or replace function public.clear_my_fcm_token()
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
  set fcm_token = null,
      fcm_updated_at = now(),
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.clear_my_fcm_token() from public;
grant execute on function public.clear_my_fcm_token() to authenticated;

-- Queue one signed webhook request. Device tokens are read only inside this
-- SECURITY DEFINER function and never persisted in the event/audit table.
create or replace function public.queue_order_push_event(
  p_order_id uuid,
  p_status text,
  p_previous_status text,
  p_recipient_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_event_id uuid;
  v_url text;
  v_secret text;
  v_recipients jsonb := '[]'::jsonb;
  v_request_id bigint;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', recipient.id,
    'role', recipient.role,
    'token', recipient.fcm_token
  )), '[]'::jsonb)
  into v_recipients
  from (
    select distinct p.id, p.role, p.fcm_token
    from public.profiles p
    where p.id = any(array_remove(coalesce(p_recipient_ids, '{}'::uuid[]), null))
      and p.role in ('customer', 'merchant', 'courier')
      and nullif(trim(coalesce(p.fcm_token, '')), '') is not null
  ) recipient;

  insert into public.order_push_events(order_id, status, previous_status, recipient_count)
  values (p_order_id, p_status, nullif(p_previous_status, ''), jsonb_array_length(v_recipients))
  returning id into v_event_id;

  if jsonb_array_length(v_recipients) = 0 then
    update public.order_push_events set dispatch_state = 'disabled' where id = v_event_id;
    return v_event_id;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'souq_jiran_order_push_url'
  limit 1;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'souq_jiran_order_push_secret'
  limit 1;

  if nullif(trim(coalesce(v_url, '')), '') is null or nullif(trim(coalesce(v_secret, '')), '') is null then
    update public.order_push_events set dispatch_state = 'disabled' where id = v_event_id;
    return v_event_id;
  end if;

  v_request_id := net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-souq-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'event_id', v_event_id,
      'order_id', p_order_id,
      'status', p_status,
      'previous_status', nullif(p_previous_status, ''),
      'recipients', v_recipients
    ),
    timeout_milliseconds := 8000
  );

  update public.order_push_events set webhook_request_id = v_request_id where id = v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.dispatch_order_status_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_ids uuid[];
  v_previous_status text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  v_recipient_ids := case
    when tg_op = 'INSERT' then array[new.merchant_id]
    when new.status in ('accepted', 'preparing', 'declined', 'cancelled') then array[new.customer_id]
    when new.status = 'ready' then array[new.customer_id, new.courier_id]
    when new.status = 'assigned' then array[new.customer_id, new.courier_id]
    when new.status in ('picked_up', 'out_for_delivery', 'delivered') then array[new.customer_id, new.merchant_id]
    when new.status = 'customer_confirmed' then array[new.merchant_id, new.courier_id]
    when new.status = 'remittance_confirmed' then array[new.merchant_id]
    when new.status = 'settled' then array[new.customer_id, new.courier_id]
    else array[new.customer_id]
  end;

  perform public.queue_order_push_event(new.id, new.status, v_previous_status, v_recipient_ids);
  return new;
end;
$$;

drop trigger if exists orders_dispatch_push_notification on public.orders;
create trigger orders_dispatch_push_notification
after insert or update of status on public.orders
for each row execute function public.dispatch_order_status_push();

-- Enables foreground data refresh through Supabase Realtime. Row visibility
-- remains protected by the existing orders RLS policies.
do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists(
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

revoke all on function public.queue_order_push_event(uuid, text, text, uuid[]) from public;
revoke all on function public.dispatch_order_status_push() from public;
