-- عروض المتاجر: ينشئ التاجر المعتمد العرض ويرسله للمراجعة، ولا يظهر للزوار
-- إلا العرض الموافق عليه خلال نافذته الزمنية. لا يحتوي هذا الترحيل على بيانات
-- تجريبية أو تغييرات في حسابات وبيانات الإنتاج الحالية.

create table if not exists public.merchant_store_offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(btrim(description)) between 1 and 280),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (
    (discount_type = 'percent' and discount_value between 1 and 100)
    or (discount_type = 'fixed' and discount_value between 1 and 100000)
  ),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'paused', 'expired')),
  admin_note text check (admin_note is null or char_length(btrim(admin_note)) <= 500),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_store_offers_window_check check (ends_at > starts_at)
);

create index if not exists merchant_store_offers_merchant_status_idx
  on public.merchant_store_offers (merchant_id, status, updated_at desc);
create index if not exists merchant_store_offers_public_window_idx
  on public.merchant_store_offers (starts_at, ends_at, created_at desc)
  where status = 'approved';
create index if not exists merchant_store_offers_review_queue_idx
  on public.merchant_store_offers (status, submitted_at asc, created_at asc)
  where status in ('pending', 'approved', 'paused');

alter table public.merchant_store_offers enable row level security;

-- لا تعتمد الواجهة على سياسة INSERT/UPDATE مباشرة، بل تستعمل الدوال أدناه حتى
-- لا يستطيع التاجر اعتماد عرضه ذاتياً أو الكتابة في حقول مراجعة الإدارة.
drop policy if exists merchant_store_offers_public_read_active_approved on public.merchant_store_offers;
create policy merchant_store_offers_public_read_active_approved
  on public.merchant_store_offers
  for select to anon, authenticated
  using (
    status = 'approved'
    and starts_at <= now()
    and ends_at > now()
    and exists (
      select 1 from public.merchants merchant
      where merchant.id = merchant_store_offers.merchant_id
        and merchant.status = 'approved'
    )
  );

drop policy if exists merchant_store_offers_owner_or_admin_read on public.merchant_store_offers;
create policy merchant_store_offers_owner_or_admin_read
  on public.merchant_store_offers
  for select to authenticated
  using (merchant_id = auth.uid() or public.is_app_admin());

revoke insert, update, delete on public.merchant_store_offers from anon, authenticated;
grant select on public.merchant_store_offers to anon, authenticated;

create or replace function public.merchant_save_store_offer(
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_discount_type text,
  p_discount_value integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_submit boolean default true
)
returns public.merchant_store_offers
language plpgsql
security definer set search_path = public
as $$
declare
  v_offer public.merchant_store_offers;
  v_status text := case when coalesce(p_submit, true) then 'pending' else 'draft' end;
begin
  if public.current_app_role() <> 'merchant' then
    raise exception 'MERCHANT_ROLE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.merchants
    where id = auth.uid() and status = 'approved'
  ) then
    raise exception 'APPROVED_MERCHANT_REQUIRED';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 80 then
    raise exception 'INVALID_OFFER_TITLE';
  end if;
  if p_description is not null and (char_length(btrim(p_description)) < 1 or char_length(btrim(p_description)) > 280) then
    raise exception 'INVALID_OFFER_DESCRIPTION';
  end if;
  if p_discount_type not in ('percent', 'fixed') then
    raise exception 'INVALID_DISCOUNT_TYPE';
  end if;
  if (p_discount_type = 'percent' and p_discount_value not between 1 and 100)
     or (p_discount_type = 'fixed' and p_discount_value not between 1 and 100000) then
    raise exception 'INVALID_DISCOUNT_VALUE';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_OFFER_WINDOW';
  end if;

  if p_offer_id is null then
    insert into public.merchant_store_offers (
      merchant_id, title, description, discount_type, discount_value,
      starts_at, ends_at, status, submitted_at
    ) values (
      auth.uid(), btrim(p_title), nullif(btrim(p_description), ''), p_discount_type, p_discount_value,
      p_starts_at, p_ends_at, v_status, case when v_status = 'pending' then now() else null end
    ) returning * into v_offer;
  else
    select * into v_offer
    from public.merchant_store_offers
    where id = p_offer_id and merchant_id = auth.uid()
    for update;
    if not found then
      raise exception 'OFFER_NOT_FOUND_OR_FORBIDDEN';
    end if;
    if v_offer.status = 'expired' then
      raise exception 'EXPIRED_OFFER_REQUIRES_NEW_SUBMISSION';
    end if;
    update public.merchant_store_offers
    set title = btrim(p_title),
        description = nullif(btrim(p_description), ''),
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        status = v_status,
        submitted_at = case when v_status = 'pending' then now() else null end,
        admin_note = null,
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
    where id = v_offer.id
    returning * into v_offer;
  end if;

  return v_offer;
end;
$$;

create or replace function public.merchant_pause_store_offer(p_offer_id uuid)
returns public.merchant_store_offers
language plpgsql
security definer set search_path = public
as $$
declare
  v_offer public.merchant_store_offers;
begin
  if public.current_app_role() <> 'merchant' then
    raise exception 'MERCHANT_ROLE_REQUIRED';
  end if;
  select * into v_offer
  from public.merchant_store_offers
  where id = p_offer_id and merchant_id = auth.uid()
  for update;
  if not found then
    raise exception 'OFFER_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if v_offer.status not in ('draft', 'pending', 'approved') then
    raise exception 'OFFER_CANNOT_BE_PAUSED';
  end if;
  update public.merchant_store_offers
  set status = 'paused', updated_at = now()
  where id = v_offer.id
  returning * into v_offer;
  return v_offer;
end;
$$;

create or replace function public.admin_review_store_offer(
  p_offer_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.merchant_store_offers
language plpgsql
security definer set search_path = public
as $$
declare
  v_offer public.merchant_store_offers;
begin
  if not public.is_app_admin() then
    raise exception 'FORBIDDEN_ADMIN';
  end if;
  if p_status not in ('approved', 'rejected', 'paused') then
    raise exception 'INVALID_ADMIN_OFFER_STATUS';
  end if;
  if p_admin_note is not null and char_length(btrim(p_admin_note)) > 500 then
    raise exception 'ADMIN_NOTE_TOO_LONG';
  end if;
  select * into v_offer from public.merchant_store_offers where id = p_offer_id for update;
  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if p_status = 'approved' and v_offer.ends_at <= now() then
    raise exception 'OFFER_WINDOW_HAS_EXPIRED';
  end if;
  update public.merchant_store_offers
  set status = p_status,
      admin_note = nullif(btrim(p_admin_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = v_offer.id
  returning * into v_offer;
  return v_offer;
end;
$$;

grant execute on function public.merchant_save_store_offer(uuid, text, text, text, integer, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.merchant_pause_store_offer(uuid) to authenticated;
grant execute on function public.admin_review_store_offer(uuid, text, text) to authenticated;
