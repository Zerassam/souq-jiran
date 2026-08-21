-- نطاقات التسجيل والتغطية الموسعة للتاجر والموصل.
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor بصلاحية postgres.

alter table public.merchants
  add column if not exists delivery_wilayas text[] not null default '{}',
  add column if not exists nationwide_coverage boolean not null default false;

-- يحتفظ النطاق المحلي باسم البلدية الرئيسة في communes،
-- والنطاق الولائي يساوي جميع بلديات الولاية،
-- وبين الولايات يتضمن الولايات المجاورة في adjacent_wilayas.
alter table public.couriers
  add column if not exists coverage_level text not null default 'local',
  add column if not exists adjacent_wilayas text[] not null default '{}';

alter table public.couriers
  drop constraint if exists couriers_coverage_level_check;

alter table public.couriers
  add constraint couriers_coverage_level_check
  check (coverage_level in ('local', 'wilaya', 'inter_wilaya'));

-- تهيئة البيانات القائمة بلا فقدها: ولاية مقر التاجر هي نطاقه الافتراضي.
update public.merchants
set delivery_wilayas = array[wilaya]
where coalesce(array_length(delivery_wilayas, 1), 0) = 0
  and nationwide_coverage = false;

create index if not exists merchants_delivery_wilayas_idx
  on public.merchants using gin (delivery_wilayas);

create index if not exists couriers_adjacent_wilayas_idx
  on public.couriers using gin (adjacent_wilayas);
