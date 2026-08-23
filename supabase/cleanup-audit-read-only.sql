-- سوق الجيران — تدقيق تنظيف البيانات (قراءة فقط)
-- شغّله في Supabase SQL Editor قبل أي حذف.
-- هذا الملف لا يحذف ولا يحدّث أي سجل.

-- 1) يجب أن يعرض هذا الاستعلام حساب أدمن واحداً على الأقل.
-- راجع البريد والدور قبل متابعة أي عملية تنظيف.
select
  p.id,
  p.email,
  p.role,
  p.created_at as profile_created_at,
  u.last_sign_in_at
from public.profiles p
left join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;

-- 2) ملخص حسابات المصادقة بحسب الدور؛ يجب أن يبقى حساب الأدمن فقط بعد التنظيف.
select
  coalesce(p.role, 'without_profile') as role,
  count(*) as auth_user_count
from auth.users u
left join public.profiles p on p.id = u.id
group by coalesce(p.role, 'without_profile')
order by role;

-- 3) حجم بيانات الأعمال المرتبطة بالمستخدمين.
-- ينشئ هذا الجزء جدولاً مؤقتاً في جلسة SQL Editor فقط ولا يلمس بيانات الإنتاج.
-- يسجل "missing" للجداول الاختيارية غير الموجودة بدلاً من فشل التدقيق.
create temp table cleanup_audit_counts (
  table_name text primary key,
  table_status text not null,
  row_count bigint
);

do $$
declare
  candidate_table text;
begin
  foreach candidate_table in array array[
    'profiles',
    'merchants',
    'couriers',
    'merchant_courier_approvals',
    'orders',
    'order_user_archives',
    'order_lifecycle_events',
    'order_push_events',
    'customer_phone_verifications',
    'customer_behavior_reports',
    'customer_blacklist',
    'products'
  ] loop
    if to_regclass(format('public.%I', candidate_table)) is null then
      insert into cleanup_audit_counts (table_name, table_status, row_count)
      values (candidate_table, 'missing', null);
    else
      execute format(
        'insert into cleanup_audit_counts (table_name, table_status, row_count) select %L, %L, count(*) from public.%I',
        candidate_table,
        'present',
        candidate_table
      );
    end if;
  end loop;
end $$;

select table_name, table_status, row_count
from cleanup_audit_counts
order by table_name;

-- 4) يكشف أي مفتاح أجنبي في الجداول العامة يشير إلى profiles أو auth.users.
-- راجع القائمة قبل تنفيذ سكربت الحذف؛ لا تعدّل أو تحذف القيود.
select
  conrelid::regclass as child_table,
  pg_get_constraintdef(oid) as foreign_key_definition
from pg_constraint
where contype = 'f'
  and confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
order by child_table::text, foreign_key_definition;
