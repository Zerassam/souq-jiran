-- سوق الجيران: تدقيق قراءة فقط بعد تنظيف بيانات غير الأدمن.
-- لا يحذف أو يعدل أي بيانات دائمة؛ أي جدول مؤقت ينتهي بـ ROLLBACK.

begin;

create temporary table cleanup_post_verification_counts (
  table_name text primary key,
  table_status text not null,
  row_count bigint
) on commit drop;

do $$
declare
  candidate_table text;
  candidate_tables text[] := array[
    'orders',
    'order_items',
    'order_messages',
    'order_lifecycle_events',
    'order_push_events',
    'order_user_archives',
    'message_user_archives',
    'products',
    'merchants',
    'couriers',
    'merchant_courier_approvals',
    'customer_behavior_reports',
    'customer_blacklist',
    'customer_phone_verifications',
    'customer_otp_delivery_attempts',
    'customer_referrals',
    'reward_coupons',
    'firebase_phone_link_challenges',
    'account_phone_change_requests'
  ];
  observed_count bigint;
begin
  foreach candidate_table in array candidate_tables loop
    if to_regclass(format('public.%I', candidate_table)) is null then
      insert into cleanup_post_verification_counts (table_name, table_status, row_count)
      values (candidate_table, 'missing_optional_table', null);
    else
      execute format('select count(*) from public.%I', candidate_table) into observed_count;
      insert into cleanup_post_verification_counts (table_name, table_status, row_count)
      values (candidate_table, 'present', observed_count);
    end if;
  end loop;
end
$$;

-- كل جدول موجود في هذا التقرير يجب أن يساوي صفر صفوف.
select
  table_name,
  table_status,
  row_count,
  case
    when table_status = 'missing_optional_table' then 'not_applicable'
    when row_count = 0 then 'empty_verified'
    else 'unexpected_rows_remaining'
  end as verification
from cleanup_post_verification_counts
order by table_name;

-- يجب أن تظهر النتيجة النهائية: 1 مستخدم Auth، 1 ملف، 1 أدمن، و0 غير أدمن.
select
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from public.profiles) as profile_count,
  (select count(*) from public.profiles where role = 'admin') as admin_profile_count,
  (select count(*) from public.profiles where role <> 'admin') as non_admin_profile_count;

rollback;
