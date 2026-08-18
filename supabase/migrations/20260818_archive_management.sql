-- سوق الجيران: إدارة الأرشيف المتقدمة.
-- نفّذ هذا الملف مرة واحدة بعد 20260817_admin_archives.sql في Supabase SQL Editor.

create table if not exists public.admin_archive_alert_settings (
  id boolean primary key default true check (id),
  sensitive_order_total numeric(12,2) not null default 5000 check (sensitive_order_total >= 0),
  sensitive_statuses text[] not null default array['ready', 'delivering', 'delivered']::text[],
  notify_on_message_archive boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.admin_archive_alert_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.admin_archive_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('permanent_delete_order', 'permanent_delete_message')),
  resource_type text not null check (resource_type in ('order', 'message')),
  resource_id uuid not null,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_archive_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sensitive_order_archive', 'message_archive')),
  order_id uuid references public.orders(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  priority text not null default 'high' check (priority in ('normal', 'high')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_archive_audit_logs_created_idx on public.admin_archive_audit_logs (created_at desc);
create index if not exists admin_archive_notifications_unread_idx on public.admin_archive_notifications (is_read, created_at desc);
alter table public.admin_archive_alert_settings enable row level security;
alter table public.admin_archive_audit_logs enable row level security;
alter table public.admin_archive_notifications enable row level security;

drop policy if exists archive_alert_settings_admin_only on public.admin_archive_alert_settings;
create policy archive_alert_settings_admin_only on public.admin_archive_alert_settings for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists archive_audit_logs_admin_read on public.admin_archive_audit_logs;
create policy archive_audit_logs_admin_read on public.admin_archive_audit_logs for select to authenticated using (public.is_app_admin());
drop policy if exists archive_notifications_admin_access on public.admin_archive_notifications;
create policy archive_notifications_admin_access on public.admin_archive_notifications for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.archive_order_for_user(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_role text := public.current_app_role(); v_alert_settings public.admin_archive_alert_settings;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not ((v_role = 'merchant' and v_order.merchant_id = auth.uid()) or (v_role = 'courier' and v_order.courier_id = auth.uid())) then raise exception 'FORBIDDEN_ARCHIVE'; end if;
  insert into public.order_user_archives (order_id, user_id, deleted_by_user, archived_at) values (p_order_id, auth.uid(), true, now()) on conflict (order_id, user_id) do update set deleted_by_user = true, archived_at = excluded.archived_at;
  select * into v_alert_settings from public.admin_archive_alert_settings where id = true;
  if v_order.total >= coalesce(v_alert_settings.sensitive_order_total, 5000) or v_order.status = any(coalesce(v_alert_settings.sensitive_statuses, array['ready', 'delivering', 'delivered']::text[])) then
    insert into public.admin_archive_notifications (kind, order_id, actor_id, priority, title, body, metadata)
    values ('sensitive_order_archive', p_order_id, auth.uid(), 'high', 'أرشفة طلب حساس', format('أرشَف %s طلباً بقيمة %s دج وحالته %s.', case when v_role = 'merchant' then 'تاجر' else 'موصل' end, v_order.total, v_order.status), jsonb_build_object('order_total', v_order.total, 'order_status', v_order.status, 'archived_by_role', v_role));
  end if;
end; $$;

create or replace function public.archive_message_for_user(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_message public.order_messages; v_role text := public.current_app_role(); v_alert_settings public.admin_archive_alert_settings;
begin
  if v_role not in ('merchant', 'courier') then raise exception 'FORBIDDEN_ARCHIVE'; end if;
  select * into v_message from public.order_messages where id = p_message_id;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
  if auth.uid() <> v_message.sender_id and auth.uid() <> v_message.recipient_id then raise exception 'FORBIDDEN_ARCHIVE'; end if;
  insert into public.message_user_archives (message_id, user_id, deleted_by_user, archived_at) values (p_message_id, auth.uid(), true, now()) on conflict (message_id, user_id) do update set deleted_by_user = true, archived_at = excluded.archived_at;
  select * into v_alert_settings from public.admin_archive_alert_settings where id = true;
  if coalesce(v_alert_settings.notify_on_message_archive, false) then
    insert into public.admin_archive_notifications (kind, order_id, actor_id, priority, title, body, metadata)
    values ('message_archive', v_message.order_id, auth.uid(), 'normal', 'أرشفة رسالة', format('أرشَف %s رسالة مرتبطة بطلب %s.', case when v_role = 'merchant' then 'تاجر' else 'موصل' end, left(v_message.order_id::text, 8)), jsonb_build_object('message_id', v_message.id, 'archived_by_role', v_role));
  end if;
end; $$;

create or replace function public.admin_delete_order_permanently(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_snapshot jsonb;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select jsonb_build_object('order', to_jsonb(v_order), 'items', coalesce((select jsonb_agg(to_jsonb(item)) from public.order_items item where item.order_id = p_order_id), '[]'::jsonb), 'messages', coalesce((select jsonb_agg(to_jsonb(message)) from public.order_messages message where message.order_id = p_order_id), '[]'::jsonb)) into v_snapshot;
  insert into public.admin_archive_audit_logs (actor_id, action, resource_type, resource_id, archived_by_user_id, snapshot) values (auth.uid(), 'permanent_delete_order', 'order', p_order_id, (select user_id from public.order_user_archives where order_id = p_order_id order by archived_at desc limit 1), v_snapshot);
  delete from public.orders where id = p_order_id;
end; $$;

create or replace function public.admin_delete_message_permanently(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_message public.order_messages;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  select * into v_message from public.order_messages where id = p_message_id;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
  insert into public.admin_archive_audit_logs (actor_id, action, resource_type, resource_id, archived_by_user_id, snapshot) values (auth.uid(), 'permanent_delete_message', 'message', p_message_id, (select user_id from public.message_user_archives where message_id = p_message_id order by archived_at desc limit 1), jsonb_build_object('message', to_jsonb(v_message)));
  delete from public.order_messages where id = p_message_id;
end; $$;

create or replace function public.admin_mark_archive_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  update public.admin_archive_notifications set is_read = true, read_at = coalesce(read_at, now()) where id = p_notification_id;
  if not found then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
end; $$;

grant execute on function public.archive_order_for_user(uuid) to authenticated;
grant execute on function public.archive_message_for_user(uuid) to authenticated;
grant execute on function public.admin_delete_order_permanently(uuid) to authenticated;
grant execute on function public.admin_delete_message_permanently(uuid) to authenticated;
grant execute on function public.admin_mark_archive_notification_read(uuid) to authenticated;
