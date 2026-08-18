-- مراجعة إدارية آمنة لحسابات الاختبار فقط.
-- حسابات الاختبار المنشأة من الواجهة تستخدم بريداً بالبادئة qa-
-- والنطاق example.com، ولا تُدرج إن كانت مرتبطة بطلبات أو مقدماً معتمداً.

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
  for select to authenticated using (public.is_admin(auth.uid()));

create or replace function public.admin_list_test_accounts()
returns table (
  user_id uuid,
  email text,
  role text,
  name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin access required';
  end if;

  return query
  select p.id, u.email, p.role, p.name, p.created_at
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
  if not public.is_admin(auth.uid()) then
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
