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

drop policy if exists couriers_register_self on public.couriers;
create policy couriers_register_self on public.couriers
  for insert to authenticated
  with check (
    auth.uid() = id
    and public.current_app_role() = 'courier'
    and status = 'pending'
  );

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
