-- اختيار وسائل توصيل متعددة، وصور وملفات اختيارية خاصة بالتاجر والموصل.
-- شغّل هذا الملف في Supabase SQL Editor بعد ترحيل 20260903.

alter table public.couriers
  add column if not exists vehicles text[] not null default '{}';

update public.couriers
set vehicles = case vehicle
  when 'دراجة هوائية' then array['bicycle']::text[]
  when 'دراجة نارية' then array['motorcycle']::text[]
  when 'سيارة' then array['car']::text[]
  when 'شاحنة' then array['truck']::text[]
  else '{}'::text[]
end
where cardinality(vehicles) = 0 and coalesce(vehicle, '') <> '';

alter table public.couriers drop constraint if exists couriers_vehicles_allowed;
alter table public.couriers add constraint couriers_vehicles_allowed
  check (vehicles <@ array['bicycle', 'motorcycle', 'car', 'truck']::text[]);

create table if not exists public.provider_media (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  provider_role text not null check (provider_role in ('merchant', 'courier')),
  kind text not null check (kind in ('store_photo', 'merchant_identity', 'merchant_business', 'vehicle_photo', 'vehicle_ownership')),
  vehicle_type text check (vehicle_type is null or vehicle_type in ('bicycle', 'motorcycle', 'car', 'truck')),
  storage_path text not null unique,
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  created_at timestamptz not null default now(),
  check (
    (provider_role = 'merchant' and kind in ('store_photo', 'merchant_identity', 'merchant_business') and vehicle_type is null)
    or (provider_role = 'courier' and kind in ('vehicle_photo', 'vehicle_ownership') and vehicle_type is not null)
  )
);

create unique index if not exists provider_media_one_per_slot_idx
  on public.provider_media (provider_id, kind, coalesce(vehicle_type, 'general'))
  where kind <> 'store_photo';

create or replace function public.enforce_provider_media_limits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.kind = 'store_photo' and (
    select count(*) from public.provider_media
    where provider_id = new.provider_id and kind = 'store_photo'
  ) >= 3 then
    raise exception 'STORE_PHOTO_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists provider_media_limits_before_insert on public.provider_media;
create trigger provider_media_limits_before_insert
  before insert on public.provider_media
  for each row execute procedure public.enforce_provider_media_limits();

alter table public.provider_media enable row level security;

drop policy if exists provider_media_read_owner_or_admin on public.provider_media;
create policy provider_media_read_owner_or_admin on public.provider_media
  for select to authenticated
  using (auth.uid() = provider_id or public.is_app_admin());

drop policy if exists provider_media_create_owner on public.provider_media;
create policy provider_media_create_owner on public.provider_media
  for insert to authenticated
  with check (
    auth.uid() = provider_id
    and provider_role = public.current_app_role()
    and (kind <> 'store_photo' or exists (
      select 1 from public.merchants where id = auth.uid() and status = 'approved'
    ))
  );

drop policy if exists provider_media_delete_owner on public.provider_media;
create policy provider_media_delete_owner on public.provider_media
  for delete to authenticated
  using (auth.uid() = provider_id or public.is_app_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-media', 'provider-media', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists provider_media_object_read on storage.objects;
create policy provider_media_object_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'provider-media'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_app_admin())
  );

drop policy if exists provider_media_object_insert on storage.objects;
create policy provider_media_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists provider_media_object_delete on storage.objects;
create policy provider_media_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'provider-media'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_app_admin())
  );

grant execute on function public.enforce_provider_media_limits() to authenticated;
