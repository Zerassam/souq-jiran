-- سوق الجيران: أرشفة مستقلة للتاجر والموصل وأرشيف مشرف غير قابل للتأثر بالإخفاء الشخصي.
-- نفّذ هذا الملف مرة واحدة في Supabase SQL Editor بعد المخطط الأساسي.

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

create index if not exists order_user_archives_user_idx on public.order_user_archives (user_id, archived_at desc);
create index if not exists order_messages_order_created_idx on public.order_messages (order_id, created_at desc);
create index if not exists message_user_archives_user_idx on public.message_user_archives (user_id, archived_at desc);

alter table public.order_user_archives enable row level security;
alter table public.order_messages enable row level security;
alter table public.message_user_archives enable row level security;

drop policy if exists order_archives_read_owner_or_admin on public.order_user_archives;
create policy order_archives_read_owner_or_admin on public.order_user_archives
  for select to authenticated using (auth.uid() = user_id or public.is_app_admin());

drop policy if exists message_archives_read_owner_or_admin on public.message_user_archives;
create policy message_archives_read_owner_or_admin on public.message_user_archives
  for select to authenticated using (auth.uid() = user_id or public.is_app_admin());

drop policy if exists order_messages_read_participants_or_admin on public.order_messages;
create policy order_messages_read_participants_or_admin on public.order_messages
  for select to authenticated using (
    public.is_app_admin()
    or (
      (auth.uid() = sender_id or auth.uid() = recipient_id)
      and not exists (
        select 1 from public.message_user_archives archive
        where archive.message_id = order_messages.id
          and archive.user_id = auth.uid()
          and archive.deleted_by_user
      )
    )
  );

drop policy if exists orders_read_participants on public.orders;
create policy orders_read_participants on public.orders
  for select using (
    public.is_app_admin()
    or (
      not exists (
        select 1 from public.order_user_archives archive
        where archive.order_id = orders.id
          and archive.user_id = auth.uid()
          and archive.deleted_by_user
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
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (
    (v_role = 'merchant' and v_order.merchant_id = auth.uid())
    or (v_role = 'courier' and v_order.courier_id = auth.uid())
  ) then raise exception 'FORBIDDEN_ARCHIVE'; end if;

  insert into public.order_user_archives (order_id, user_id, deleted_by_user, archived_at)
  values (p_order_id, auth.uid(), true, now())
  on conflict (order_id, user_id)
  do update set deleted_by_user = true, archived_at = excluded.archived_at;
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
end;
$$;

create or replace function public.create_order_message(p_order_id uuid, p_recipient_id uuid, p_body text)
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
  if auth.uid() not in (v_order.merchant_id, v_order.customer_id, v_order.courier_id) then raise exception 'FORBIDDEN_MESSAGE'; end if;
  if p_recipient_id not in (v_order.merchant_id, v_order.customer_id, v_order.courier_id) or p_recipient_id = auth.uid() then raise exception 'INVALID_RECIPIENT'; end if;

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
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  delete from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_delete_message_permanently(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN_ADMIN'; end if;
  delete from public.order_messages where id = p_message_id;
  if not found then raise exception 'MESSAGE_NOT_FOUND'; end if;
end;
$$;

grant execute on function public.archive_order_for_user(uuid) to authenticated;
grant execute on function public.archive_message_for_user(uuid) to authenticated;
grant execute on function public.create_order_message(uuid, uuid, text) to authenticated;
grant execute on function public.admin_delete_order_permanently(uuid) to authenticated;
grant execute on function public.admin_delete_message_permanently(uuid) to authenticated;
