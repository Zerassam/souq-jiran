-- إشعارات المشرف للطلبات الجديدة والطلبات المسلّمة.
-- شغّل هذا الترحيل في Supabase SQL Editor بعد الترحيلات السابقة.

create table if not exists public.admin_order_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('order_created', 'order_delivered')),
  order_id uuid not null references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  order_total integer not null check (order_total >= 0),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (order_id, event_type)
);

create index if not exists admin_order_notifications_unread_idx
  on public.admin_order_notifications (is_read, created_at desc);
create index if not exists admin_order_notifications_order_idx
  on public.admin_order_notifications (order_id, created_at desc);

alter table public.admin_order_notifications enable row level security;

drop policy if exists admin_order_notifications_admin_access on public.admin_order_notifications;
create policy admin_order_notifications_admin_access on public.admin_order_notifications
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create or replace function public.record_admin_order_notification(
  p_order_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_store_name text;
  v_title text;
  v_body text;
begin
  if p_event_type not in ('order_created', 'order_delivered') then
    raise exception 'INVALID_ORDER_NOTIFICATION_EVENT';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select store_name into v_store_name from public.merchants where id = v_order.merchant_id;
  v_title := case p_event_type when 'order_created' then 'طلب جديد' else 'تم تسليم طلب' end;
  v_body := case p_event_type
    when 'order_created' then format('طلب جديد #%s بقيمة %s دج من «%s».', left(v_order.id::text, 8), v_order.total, coalesce(v_store_name, 'محل الحي'))
    else format('تم تسليم الطلب #%s بنجاح بقيمة %s دج من «%s».', left(v_order.id::text, 8), v_order.total, coalesce(v_store_name, 'محل الحي'))
  end;

  insert into public.admin_order_notifications (event_type, order_id, merchant_id, order_total, title, body, metadata)
  values (
    p_event_type, v_order.id, v_order.merchant_id, v_order.total, v_title, v_body,
    jsonb_build_object('order_status', v_order.status, 'delivery_choice', v_order.delivery_choice, 'store_name', coalesce(v_store_name, 'محل الحي'))
  ) on conflict (order_id, event_type) do nothing;
end;
$$;

create or replace function public.admin_mark_order_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  update public.admin_order_notifications
  set is_read = true, read_at = coalesce(read_at, now())
  where id = p_notification_id;
  if not found then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_mark_all_order_notifications_read()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  update public.admin_order_notifications
  set is_read = true, read_at = coalesce(read_at, now())
  where is_read = false;
end;
$$;

create or replace function public.create_customer_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_choice text default 'pickup',
  p_delivery_address jsonb default null,
  p_delivery_fee integer default 0
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_items jsonb;
  v_subtotal integer;
  v_order public.orders;
begin
  if public.current_app_role() <> 'customer' then raise exception 'Only customer accounts can create orders'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'An order needs at least one product'; end if;
  if p_delivery_choice not in ('pickup', 'store', 'courier') or p_delivery_fee < 0 then raise exception 'Invalid delivery options'; end if;
  if not exists (select 1 from public.merchants where id = p_merchant_id and status = 'approved') then raise exception 'The merchant is not available'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'unit', p.unit, 'department', p.department, 'qty', line.qty) order by p.name), '[]'::jsonb), coalesce(sum(p.price * line.qty), 0)
  into v_items, v_subtotal
  from jsonb_to_recordset(p_items) as line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id
  where p.merchant_id = p_merchant_id and p.available = true and line.qty between 1 and 100;

  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'One or more selected products are unavailable'; end if;
  insert into public.orders (customer_id, merchant_id, status, items, delivery_address, delivery_choice, subtotal, delivery_fee, total)
  values (auth.uid(), p_merchant_id, 'pending', v_items, p_delivery_address, p_delivery_choice, v_subtotal, p_delivery_fee, v_subtotal + p_delivery_fee)
  returning * into v_order;
  insert into public.order_items (order_id, product_id, product_name, unit, unit_price, quantity)
  select v_order.id, p.id, p.name, p.unit, p.price, line.qty
  from jsonb_to_recordset(p_items) as line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id;
  perform public.record_admin_order_notification(v_order.id, 'order_created');
  return v_order;
end;
$$;

create or replace function public.complete_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.courier_id <> auth.uid() or v_order.status <> 'assigned' then
    raise exception 'Only the assigned courier can complete this delivery';
  end if;
  update public.orders set status = 'delivered', updated_at = now() where id = p_order_id returning * into v_order;
  perform public.record_admin_order_notification(v_order.id, 'order_delivered');
  return v_order;
end;
$$;

revoke all on function public.record_admin_order_notification(uuid, text) from public;
revoke all on function public.admin_mark_order_notification_read(uuid) from public;
revoke all on function public.admin_mark_all_order_notifications_read() from public;
grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer) to authenticated;
grant execute on function public.complete_delivery(uuid) to authenticated;
grant execute on function public.admin_mark_order_notification_read(uuid) to authenticated;
grant execute on function public.admin_mark_all_order_notifications_read() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'admin_order_notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.admin_order_notifications';
  end if;
end;
$$;
