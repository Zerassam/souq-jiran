-- Souq Jiran / سوق الجيران
-- Supabase schema: identities, merchants, couriers, approvals and orders.
-- Run this file in Supabase SQL Editor while connected as postgres.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('merchant', 'courier', 'customer')),
  name text,
  phone text,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchants (
  id uuid primary key references public.profiles(id) on delete cascade,
  store_name text not null check (char_length(trim(store_name)) >= 2),
  wilaya text not null,
  commune text not null,
  phone text,
  delivery_communes text[] not null default '{}',
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couriers (
  id uuid primary key references public.profiles(id) on delete cascade,
  vehicle text,
  wilaya text not null,
  communes text[] not null default '{}',
  availability text[] not null default '{}',
  store_mode text not null default 'all' check (store_mode in ('all', 'selected')),
  selected_store_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_courier_approvals (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  courier_id uuid not null references public.couriers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (merchant_id, courier_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  courier_id uuid references public.couriers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'preparing', 'ready', 'assigned', 'delivered', 'declined', 'cancelled')),
  items jsonb not null default '[]'::jsonb,
  delivery_address jsonb,
  delivery_choice text not null default 'pickup' check (delivery_choice in ('pickup', 'store', 'courier')),
  subtotal integer not null default 0 check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  total integer not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchants_location_status_idx on public.merchants (wilaya, commune, status);
create index if not exists couriers_location_status_idx on public.couriers (wilaya, status);
create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_merchant_created_idx on public.orders (merchant_id, created_at desc);
create index if not exists orders_courier_created_idx on public.orders (courier_id, created_at desc);

-- Authentication is the source of identity. Signup metadata seeds a fixed role in profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, phone, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'customer'),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_app_role() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.couriers enable row level security;
alter table public.merchant_courier_approvals enable row level security;
alter table public.orders enable row level security;

-- Profiles are created only by the trigger. Users can only read their own identity.
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select using (auth.uid() = id);

-- Allows a signed-in account created before this migration to complete its own profile.
drop policy if exists profiles_create_self on public.profiles;
create policy profiles_create_self on public.profiles
  for insert to authenticated
  with check (
    auth.uid() = id
    and role in ('merchant', 'courier', 'customer')
  );

-- Anyone can browse approved merchants; an owner can see their own registration.
drop policy if exists merchants_read_approved_or_self on public.merchants;
create policy merchants_read_approved_or_self on public.merchants
  for select using (status = 'approved' or auth.uid() = id);

drop policy if exists merchants_register_self on public.merchants;
create policy merchants_register_self on public.merchants
  for insert to authenticated
  with check (
    auth.uid() = id
    and public.current_app_role() = 'merchant'
    and status = 'pending_review'
  );

-- Couriers see their own record. Merchants can discover approved couriers for their coverage area.
drop policy if exists couriers_read_self_or_merchant on public.couriers;
create policy couriers_read_self_or_merchant on public.couriers
  for select using (
    auth.uid() = id
    or (status = 'approved' and public.current_app_role() = 'merchant')
  );

-- لا يرى المشرف بيانات الموصلين (ومنها طلبات pending) إلا داخل لوحة الإدارة.
drop policy if exists couriers_admin_read on public.couriers;
create policy couriers_admin_read on public.couriers
  for select to authenticated using (public.is_app_admin());

drop policy if exists couriers_register_self on public.couriers;
create policy couriers_register_self on public.couriers
  for insert to authenticated
  with check (
    auth.uid() = id
    and public.current_app_role() = 'courier'
    and status = 'pending'
  );

drop policy if exists couriers_admin_update on public.couriers;
create policy couriers_admin_update on public.couriers
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Only the merchant chooses approved couriers; couriers may only view their approvals.
drop policy if exists approvals_read_owner_or_courier on public.merchant_courier_approvals;
create policy approvals_read_owner_or_courier on public.merchant_courier_approvals
  for select using (auth.uid() = merchant_id or auth.uid() = courier_id);

drop policy if exists approvals_manage_merchant on public.merchant_courier_approvals;
create policy approvals_manage_merchant on public.merchant_courier_approvals
  for all to authenticated
  using (auth.uid() = merchant_id)
  with check (auth.uid() = merchant_id and public.current_app_role() = 'merchant');

-- A customer creates and reads their own orders. A merchant reads their store orders.
-- A courier reads an assigned order or an unassigned ready order only.
drop policy if exists orders_read_participants on public.orders;
create policy orders_read_participants on public.orders
  for select using (
    auth.uid() = customer_id
    or auth.uid() = merchant_id
    or auth.uid() = courier_id
    or (courier_id is null and status = 'ready' and public.current_app_role() = 'courier')
  );

drop policy if exists orders_customer_create_self on public.orders;
create policy orders_customer_create_self on public.orders
  for insert to authenticated
  with check (auth.uid() = customer_id and public.current_app_role() = 'customer');

-- No direct UPDATE policy is granted. Status changes should go through reviewed RPC functions.

-- ============================================================================
-- Commerce and administration extension
-- Run this section again after the account listportail@gmail.com has signed up
-- once in the application. Only the database owner can grant the admin role.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('merchant', 'courier', 'customer', 'admin'));

-- Never trust raw sign-up metadata for an administrator role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'customer');
begin
  insert into public.profiles (id, role, name, phone, email)
  values (
    new.id,
    case when requested_role in ('merchant', 'courier', 'customer') then requested_role else 'customer' end,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    new.email
  );
  return new;
end;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

grant execute on function public.is_app_admin() to anon, authenticated;

-- This command promotes only an application profile that exists at the time this
-- script is run. If listportail@gmail.com signs up later, run only this UPDATE
-- again in SQL Editor, then sign out and back in so the client refreshes its role.
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'listportail@gmail.com';

-- ============================================================================
-- أرشفة مستقلة وحذف إداري نهائي
-- يحتفظ كل سجل أرشفة بهوية صاحبه، لذلك يستطيع التاجر والموصل إخفاء السجل من
-- قائمتهما فقط، بينما يبقى الطلب الأصلي كاملاً ومرئياً للمشرف.
-- ============================================================================

create table if not exists public.order_user_archives (
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_by_user boolean not null default true,
  archived_at timestamptz not null default now(),
  primary key (order_id, user_id)
);

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.message_user_archives (
  message_id uuid not null references public.order_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_by_user boolean not null default true,
  archived_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- إعداد واحد قابل للضبط لتحديد متى يُنبه المشرف إلى أرشفة طلب.
-- الحالة حساسة عند تجاوز الحد المالي أو الوصول إلى إحدى حالات المعالجة المدرجة.
create table if not exists public.admin_archive_alert_settings (
  id boolean primary key default true check (id),
  sensitive_order_total numeric(12,2) not null default 5000 check (sensitive_order_total >= 0),
  sensitive_statuses text[] not null default array['ready', 'delivering', 'delivered']::text[],
  notify_on_message_archive boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.admin_archive_alert_settings (id)
values (true)
on conflict (id) do nothing;

-- يبقى أثر الحذف النهائي محفوظاً حتى بعد زوال السجل الأصلي ورسائله التابعة.
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

create index if not exists order_user_archives_user_idx on public.order_user_archives (user_id, archived_at desc);
create index if not exists order_messages_order_created_idx on public.order_messages (order_id, created_at desc);
create index if not exists message_user_archives_user_idx on public.message_user_archives (user_id, archived_at desc);
create index if not exists admin_archive_audit_logs_created_idx on public.admin_archive_audit_logs (created_at desc);
create index if not exists admin_archive_notifications_unread_idx on public.admin_archive_notifications (is_read, created_at desc);

alter table public.order_user_archives enable row level security;
alter table public.order_messages enable row level security;
alter table public.message_user_archives enable row level security;
alter table public.admin_archive_alert_settings enable row level security;
alter table public.admin_archive_audit_logs enable row level security;
alter table public.admin_archive_notifications enable row level security;

drop policy if exists order_archives_read_owner_or_admin on public.order_user_archives;
create policy order_archives_read_owner_or_admin on public.order_user_archives
  for select to authenticated using (auth.uid() = user_id or public.is_app_admin());

drop policy if exists message_archives_read_owner_or_admin on public.message_user_archives;
create policy message_archives_read_owner_or_admin on public.message_user_archives
  for select to authenticated using (auth.uid() = user_id or public.is_app_admin());

drop policy if exists archive_alert_settings_admin_only on public.admin_archive_alert_settings;
create policy archive_alert_settings_admin_only on public.admin_archive_alert_settings
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists archive_audit_logs_admin_read on public.admin_archive_audit_logs;
create policy archive_audit_logs_admin_read on public.admin_archive_audit_logs
  for select to authenticated using (public.is_app_admin());

drop policy if exists archive_notifications_admin_access on public.admin_archive_notifications;
create policy archive_notifications_admin_access on public.admin_archive_notifications
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists order_messages_read_participants_or_admin on public.order_messages;
create policy order_messages_read_participants_or_admin on public.order_messages
  for select to authenticated using (
    public.is_app_admin()
    or (
      (auth.uid() = sender_id or auth.uid() = recipient_id)
      and not exists (
        select 1 from public.message_user_archives a
        where a.message_id = order_messages.id
          and a.user_id = auth.uid()
          and a.deleted_by_user
      )
    )
  );

-- The archive row is intentionally consulted only for non-admin viewers.
-- This preserves a complete administrative archive without copying order data.
drop policy if exists orders_read_participants on public.orders;
create policy orders_read_participants on public.orders
  for select using (
    public.is_app_admin()
    or (
      not exists (
        select 1 from public.order_user_archives a
        where a.order_id = orders.id
          and a.user_id = auth.uid()
          and a.deleted_by_user
      )
      and (
        auth.uid() = customer_id
        or auth.uid() = merchant_id
        or auth.uid() = courier_id
        or (courier_id is null and status = 'ready' and public.current_app_role() = 'courier')
      )
    )
  );

create or replace function public.archive_order_for_user(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_role text := public.current_app_role();
  v_alert_settings public.admin_archive_alert_settings;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (
    (v_role = 'merchant' and v_order.merchant_id = auth.uid())
    or (v_role = 'courier' and v_order.courier_id = auth.uid())
  ) then
    raise exception 'FORBIDDEN_ARCHIVE';
  end if;

  insert into public.order_user_archives (order_id, user_id, deleted_by_user, archived_at)
  values (p_order_id, auth.uid(), true, now())
  on conflict (order_id, user_id)
  do update set deleted_by_user = true, archived_at = excluded.archived_at;

  select * into v_alert_settings from public.admin_archive_alert_settings where id = true;
  if v_order.total >= coalesce(v_alert_settings.sensitive_order_total, 5000)
     or v_order.status = any(coalesce(v_alert_settings.sensitive_statuses, array['ready', 'delivering', 'delivered']::text[])) then
    insert into public.admin_archive_notifications (kind, order_id, actor_id, priority, title, body, metadata)
    values (
      'sensitive_order_archive', p_order_id, auth.uid(), 'high', 'أرشفة طلب حساس',
      format('أرشَف %s طلباً بقيمة %s دج وحالته %s.', case when v_role = 'merchant' then 'تاجر' else 'موصل' end, v_order.total, v_order.status),
      jsonb_build_object('order_total', v_order.total, 'order_status', v_order.status, 'archived_by_role', v_role)
    );
  end if;
end;
$$;

create or replace function public.archive_message_for_user(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_message public.order_messages;
  v_role text := public.current_app_role();
  v_alert_settings public.admin_archive_alert_settings;
begin
  if v_role not in ('merchant', 'courier') then raise exception 'FORBIDDEN_ARCHIVE'; end if;
  select * into v_message from public.order_messages where id = p_message_id;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
  if auth.uid() <> v_message.sender_id and auth.uid() <> v_message.recipient_id then
    raise exception 'FORBIDDEN_ARCHIVE';
  end if;

  insert into public.message_user_archives (message_id, user_id, deleted_by_user, archived_at)
  values (p_message_id, auth.uid(), true, now())
  on conflict (message_id, user_id)
  do update set deleted_by_user = true, archived_at = excluded.archived_at;

  select * into v_alert_settings from public.admin_archive_alert_settings where id = true;
  if coalesce(v_alert_settings.notify_on_message_archive, false) then
    insert into public.admin_archive_notifications (kind, order_id, actor_id, priority, title, body, metadata)
    values (
      'message_archive', v_message.order_id, auth.uid(), 'normal', 'أرشفة رسالة',
      format('أرشَف %s رسالة مرتبطة بطلب %s.', case when v_role = 'merchant' then 'تاجر' else 'موصل' end, left(v_message.order_id::text, 8)),
      jsonb_build_object('message_id', v_message.id, 'archived_by_role', v_role)
    );
  end if;
end;
$$;

create or replace function public.create_order_message(
  p_order_id uuid,
  p_recipient_id uuid,
  p_body text
)
returns public.order_messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_message public.order_messages;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() not in (v_order.merchant_id, v_order.customer_id, v_order.courier_id) then
    raise exception 'FORBIDDEN_MESSAGE';
  end if;
  if p_recipient_id not in (v_order.merchant_id, v_order.customer_id, v_order.courier_id) then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if p_recipient_id = auth.uid() then raise exception 'INVALID_RECIPIENT'; end if;

  insert into public.order_messages (order_id, sender_id, recipient_id, body)
  values (p_order_id, auth.uid(), p_recipient_id, trim(p_body))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.admin_delete_order_permanently(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_snapshot jsonb;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select jsonb_build_object(
    'order', to_jsonb(v_order),
    'items', coalesce((select jsonb_agg(to_jsonb(item)) from public.order_items item where item.order_id = p_order_id), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(message)) from public.order_messages message where message.order_id = p_order_id), '[]'::jsonb)
  ) into v_snapshot;
  insert into public.admin_archive_audit_logs (actor_id, action, resource_type, resource_id, archived_by_user_id, snapshot)
  values (auth.uid(), 'permanent_delete_order', 'order', p_order_id,
    (select user_id from public.order_user_archives where order_id = p_order_id order by archived_at desc limit 1), v_snapshot);
  delete from public.orders where id = p_order_id;
end;
$$;

create or replace function public.admin_delete_message_permanently(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_message public.order_messages;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  select * into v_message from public.order_messages where id = p_message_id;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
  insert into public.admin_archive_audit_logs (actor_id, action, resource_type, resource_id, archived_by_user_id, snapshot)
  values (auth.uid(), 'permanent_delete_message', 'message', p_message_id,
    (select user_id from public.message_user_archives where message_id = p_message_id order by archived_at desc limit 1),
    jsonb_build_object('message', to_jsonb(v_message)));
  delete from public.order_messages where id = p_message_id;
end;
$$;

create or replace function public.admin_mark_archive_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  update public.admin_archive_notifications set is_read = true, read_at = coalesce(read_at, now()) where id = p_notification_id;
  if not found then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
end;
$$;

grant execute on function public.archive_order_for_user(uuid) to authenticated;
grant execute on function public.archive_message_for_user(uuid) to authenticated;
grant execute on function public.create_order_message(uuid, uuid, text) to authenticated;
grant execute on function public.admin_delete_order_permanently(uuid) to authenticated;
grant execute on function public.admin_delete_message_permanently(uuid) to authenticated;
grant execute on function public.admin_mark_archive_notification_read(uuid) to authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  price integer not null check (price >= 0),
  unit text not null default 'الوحدة',
  department text not null default 'pantry',
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists products_merchant_available_idx on public.products (merchant_id, available, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.products enable row level security;
alter table public.order_items enable row level security;

-- An administrator can read every registration; regular users retain their
-- previous least-privilege access rules.
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.is_app_admin());

drop policy if exists merchants_read_approved_or_self on public.merchants;
create policy merchants_read_approved_or_self on public.merchants
  for select using (status = 'approved' or auth.uid() = id or public.is_app_admin());

drop policy if exists couriers_read_self_or_merchant on public.couriers;
create policy couriers_read_self_or_merchant on public.couriers
  for select to authenticated using (
    auth.uid() = id
    or public.is_app_admin()
    or (status = 'approved' and public.current_app_role() = 'merchant')
  );

drop policy if exists orders_read_participants on public.orders;
create policy orders_read_participants on public.orders
  for select using (
    public.is_app_admin()
    or (
      not exists (
        select 1 from public.order_user_archives a
        where a.order_id = orders.id
          and a.user_id = auth.uid()
          and a.deleted_by_user
      )
      and (
        auth.uid() = customer_id
        or auth.uid() = merchant_id
        or auth.uid() = courier_id
        or (courier_id is null and status = 'ready' and public.current_app_role() = 'courier')
      )
    )
  );

drop policy if exists products_read_available_or_owner on public.products;
create policy products_read_available_or_owner on public.products
  for select using (
    public.is_app_admin()
    or merchant_id = auth.uid()
    or (
      available = true and exists (
        select 1 from public.merchants m
        where m.id = products.merchant_id and m.status = 'approved'
      )
    )
  );

drop policy if exists products_manage_owner_or_admin on public.products;
create policy products_manage_owner_or_admin on public.products
  for all to authenticated
  using (merchant_id = auth.uid() or public.is_app_admin())
  with check (merchant_id = auth.uid() or public.is_app_admin());

drop policy if exists order_items_read_participants on public.order_items;
create policy order_items_read_participants on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          public.is_app_admin()
          or o.customer_id = auth.uid()
          or o.merchant_id = auth.uid()
          or o.courier_id = auth.uid()
        )
    )
  );

-- Product prices and order totals are calculated inside this function; clients
-- submit product IDs and quantities only.
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
  if public.current_app_role() <> 'customer' then
    raise exception 'Only customer accounts can create orders';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one product';
  end if;
  if p_delivery_choice not in ('pickup', 'store', 'courier') or p_delivery_fee < 0 then
    raise exception 'Invalid delivery options';
  end if;
  if not exists (select 1 from public.merchants where id = p_merchant_id and status = 'approved') then
    raise exception 'The merchant is not available';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'price', p.price,
      'unit', p.unit,
      'department', p.department,
      'qty', line.qty
    ) order by p.name), '[]'::jsonb),
    coalesce(sum(p.price * line.qty), 0)
  into v_items, v_subtotal
  from jsonb_to_recordset(p_items) as line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id
  where p.merchant_id = p_merchant_id
    and p.available = true
    and line.qty between 1 and 100;

  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then
    raise exception 'One or more selected products are unavailable';
  end if;

  insert into public.orders (
    customer_id, merchant_id, status, items, delivery_address,
    delivery_choice, subtotal, delivery_fee, total
  ) values (
    auth.uid(), p_merchant_id, 'pending', v_items, p_delivery_address,
    p_delivery_choice, v_subtotal, p_delivery_fee, v_subtotal + p_delivery_fee
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit, unit_price, quantity)
  select v_order.id, p.id, p.name, p.unit, p.price, line.qty
  from jsonb_to_recordset(p_items) as line(product_id uuid, qty integer)
  join public.products p on p.id = line.product_id;

  return v_order;
end;
$$;

create or replace function public.set_merchant_order_status(
  p_order_id uuid,
  p_status text
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.merchant_id <> auth.uid() then
    raise exception 'Only the owning merchant can update this order';
  end if;
  if not (
    (v_order.status = 'pending' and p_status in ('accepted', 'declined'))
    or (v_order.status = 'accepted' and p_status = 'preparing')
    or (v_order.status = 'preparing' and p_status = 'ready')
  ) then
    raise exception 'Invalid merchant order transition';
  end if;
  update public.orders set status = p_status, updated_at = now() where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.claim_ready_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_courier public.couriers;
  v_merchant public.merchants;
begin
  if public.current_app_role() <> 'courier' then
    raise exception 'Only couriers can claim orders';
  end if;
  select * into v_courier from public.couriers where id = auth.uid() and status = 'approved';
  if not found then raise exception 'Approved courier profile required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'ready' or v_order.courier_id is not null or v_order.delivery_choice <> 'courier' then
    raise exception 'This order is no longer available';
  end if;
  select * into v_merchant from public.merchants where id = v_order.merchant_id;
  if v_merchant.wilaya <> v_courier.wilaya
     or (cardinality(v_courier.communes) > 0 and not v_merchant.commune = any(v_courier.communes)) then
    raise exception 'The order is outside your coverage';
  end if;
  update public.orders set courier_id = auth.uid(), status = 'assigned', updated_at = now()
  where id = p_order_id returning * into v_order;
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
  return v_order;
end;
$$;

create or replace function public.admin_set_provider_status(
  p_provider_type text,
  p_provider_id uuid,
  p_status text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Administrator role required';
  end if;
  if p_provider_type = 'merchant' and p_status in ('pending_review', 'approved', 'suspended') then
    update public.merchants set status = p_status, updated_at = now() where id = p_provider_id;
  elsif p_provider_type = 'courier' and p_status in ('pending', 'approved', 'suspended') then
    update public.couriers set status = p_status, updated_at = now() where id = p_provider_id;
  else
    raise exception 'Invalid provider type or status';
  end if;
end;
$$;

grant execute on function public.create_customer_order(uuid, jsonb, text, jsonb, integer) to authenticated;
grant execute on function public.set_merchant_order_status(uuid, text) to authenticated;
grant execute on function public.claim_ready_order(uuid) to authenticated;
grant execute on function public.complete_delivery(uuid) to authenticated;
grant execute on function public.admin_set_provider_status(text, uuid, text) to authenticated;

-- Direct order creation is intentionally removed: totals must use the RPC above.
drop policy if exists orders_customer_create_self on public.orders;

-- ============================================================================
-- مراجعة إدارية آمنة لحسابات الاختبار
-- تُعرض فقط حسابات qa- غير التشغيلية، ولا تكشف آخر نشاط إلا للمشرف.
-- ============================================================================

create table if not exists public.test_account_review_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null,
  target_email text not null,
  action text not null check (action = 'delete_confirmed'),
  created_at timestamptz not null default now()
);

alter table public.test_account_review_audit_logs enable row level security;
drop policy if exists test_account_review_audit_admin_read on public.test_account_review_audit_logs;
create policy test_account_review_audit_admin_read on public.test_account_review_audit_logs
  for select to authenticated using (public.is_app_admin());

create or replace function public.admin_list_test_accounts()
returns table (
  user_id uuid,
  email text,
  role text,
  name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_app_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select p.id, u.email::text, p.role::text, p.name::text, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.merchants m on m.id = p.id
  left join public.couriers c on c.id = p.id
  where u.email ~ E'^qa-(merchant|courier)-[a-z0-9-]+@example\\.com$'
    and p.role in ('merchant', 'courier')
    and not exists (
      select 1 from public.orders o
      where o.customer_id = p.id or o.merchant_id = p.id or o.courier_id = p.id
    )
    and (m.id is null or m.status <> 'approved')
    and (c.id is null or c.status <> 'approved')
  order by p.created_at asc;
end;
$$;

create or replace function public.admin_delete_test_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if not public.is_app_admin() then
    raise exception 'admin access required';
  end if;

  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.merchants m on m.id = p.id
  left join public.couriers c on c.id = p.id
  where u.id = p_user_id
    and u.email ~ E'^qa-(merchant|courier)-[a-z0-9-]+@example\\.com$'
    and p.role in ('merchant', 'courier')
    and not exists (
      select 1 from public.orders o
      where o.customer_id = p.id or o.merchant_id = p.id or o.courier_id = p.id
    )
    and (m.id is null or m.status <> 'approved')
    and (c.id is null or c.status <> 'approved');

  if v_email is null then
    raise exception 'test account is not eligible for deletion';
  end if;

  insert into public.test_account_review_audit_logs (admin_id, target_user_id, target_email, action)
  values (auth.uid(), p_user_id, v_email, 'delete_confirmed');

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_list_test_accounts() from public;
revoke all on function public.admin_delete_test_account(uuid) from public;
grant execute on function public.admin_list_test_accounts() to authenticated;
grant execute on function public.admin_delete_test_account(uuid) to authenticated;

-- ============================================================================
-- إشعارات إدارية دائمة للطلبات الجديدة والطلبات المسلّمة
-- ============================================================================

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

create index if not exists admin_order_notifications_unread_idx on public.admin_order_notifications (is_read, created_at desc);
create index if not exists admin_order_notifications_order_idx on public.admin_order_notifications (order_id, created_at desc);
alter table public.admin_order_notifications enable row level security;

drop policy if exists admin_order_notifications_admin_access on public.admin_order_notifications;
create policy admin_order_notifications_admin_access on public.admin_order_notifications
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.record_admin_order_notification(p_order_id uuid, p_event_type text)
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
  if p_event_type not in ('order_created', 'order_delivered') then raise exception 'INVALID_ORDER_NOTIFICATION_EVENT'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select store_name into v_store_name from public.merchants where id = v_order.merchant_id;
  v_title := case p_event_type when 'order_created' then 'طلب جديد' else 'تم تسليم طلب' end;
  v_body := case p_event_type
    when 'order_created' then format('طلب جديد #%s بقيمة %s دج من «%s».', left(v_order.id::text, 8), v_order.total, coalesce(v_store_name, 'محل الحي'))
    else format('تم تسليم الطلب #%s بنجاح بقيمة %s دج من «%s».', left(v_order.id::text, 8), v_order.total, coalesce(v_store_name, 'محل الحي'))
  end;
  insert into public.admin_order_notifications (event_type, order_id, merchant_id, order_total, title, body, metadata)
  values (p_event_type, v_order.id, v_order.merchant_id, v_order.total, v_title, v_body, jsonb_build_object('order_status', v_order.status, 'delivery_choice', v_order.delivery_choice, 'store_name', coalesce(v_store_name, 'محل الحي')))
  on conflict (order_id, event_type) do nothing;
end;
$$;

create or replace function public.admin_mark_order_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  update public.admin_order_notifications set is_read = true, read_at = coalesce(read_at, now()) where id = p_notification_id;
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
  update public.admin_order_notifications set is_read = true, read_at = coalesce(read_at, now()) where is_read = false;
end;
$$;

create or replace function public.create_customer_order(
  p_merchant_id uuid, p_items jsonb, p_delivery_choice text default 'pickup', p_delivery_address jsonb default null, p_delivery_fee integer default 0
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
  select v_order.id, p.id, p.name, p.unit, p.price, line.qty from jsonb_to_recordset(p_items) as line(product_id uuid, qty integer) join public.products p on p.id = line.product_id;
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
  if not found or v_order.courier_id <> auth.uid() or v_order.status <> 'assigned' then raise exception 'Only the assigned courier can complete this delivery'; end if;
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
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_order_notifications') then
    execute 'alter publication supabase_realtime add table public.admin_order_notifications';
  end if;
end;
$$;

-- Advanced verification, inter-wilaya delivery and closed-loop delivery protocol.
-- The authoritative executable migration is kept in:
-- supabase/migrations/20260822_advanced_order_lifecycle.sql
-- Run that file after this schema when upgrading an existing Supabase project.
