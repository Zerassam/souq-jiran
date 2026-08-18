-- يعرض هذا التحديث آخر تسجيل دخول لحسابات الاختبار المؤهلة فقط.
-- لا يوسّع الوصول إلى auth.users؛ تبقى دالة RPC مقيدة بدور المشرف.

drop function if exists public.admin_list_test_accounts();

create function public.admin_list_test_accounts()
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

revoke all on function public.admin_list_test_accounts() from public;
grant execute on function public.admin_list_test_accounts() to authenticated;
