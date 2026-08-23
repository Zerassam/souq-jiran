-- سوق الجيران: تنظيف بيانات الإنتاج غير الإدارية بعد مراجعة التدقيق.
--
-- نتائج التدقيق المعتمدة لهذه العملية:
--   * يوجد ملف أدمن واحد فقط.
--   * عدد الحسابات/الملفات قبل التنفيذ: 52، منها 51 غير إداري.
--   * توجد 5 طلبات و13 منتجاً و12 متجراً و14 موصلاً.
--
-- هذا السكربت يمسح الحسابات غير الإدارية وكل بيانات التجارة والرسائل
-- والإشعارات والأرشيفات المرتبطة بعملية التشغيل. لا يحذف حساب الأدمن ولا
-- إعدادات النظام التالية: delivery_pricing_config وreferral_reward_config
-- وadmin_archive_alert_settings.
--
-- الحماية المقصودة: القيمة أدناه false. تشغيل الملف كما هو لا يحذف شيئاً.
-- لا تغيّرها إلى true إلا بعد مراجعة هذا الملف والحصول على موافقة المالك
-- النهائية، ثم نفّذ الملف كاملاً مرة واحدة من Supabase SQL Editor بصلاحية postgres.

begin;

create temporary table cleanup_admin_ids on commit drop as
select id
from public.profiles
where role = 'admin';

create temporary table cleanup_non_admin_ids on commit drop as
select p.id
from public.profiles p
where p.role <> 'admin';

create temporary table cleanup_targets (
  execution_order integer primary key,
  table_name text not null unique
) on commit drop;

insert into cleanup_targets (execution_order, table_name) values
  (10, 'admin_order_notifications'),
  (20, 'admin_archive_notifications'),
  (30, 'admin_archive_audit_logs'),
  (40, 'test_account_review_audit_logs'),
  (50, 'message_user_archives'),
  (60, 'order_user_archives'),
  (70, 'order_messages'),
  (80, 'order_lifecycle_events'),
  (90, 'order_push_events'),
  (100, 'order_items'),
  (110, 'orders'),
  (120, 'customer_behavior_reports'),
  (130, 'customer_blacklist'),
  (140, 'customer_phone_verifications'),
  (150, 'customer_otp_delivery_attempts'),
  (160, 'customer_referrals'),
  (170, 'reward_coupons'),
  (180, 'merchant_courier_approvals'),
  (190, 'products'),
  (200, 'merchants'),
  (210, 'couriers'),
  (220, 'firebase_phone_link_challenges'),
  (230, 'account_phone_change_requests');

create temporary table cleanup_preserved_config_counts (
  table_name text primary key,
  expected_row_count bigint not null
) on commit drop;

create temporary table cleanup_execution_log (
  execution_order integer,
  target text not null,
  action text not null,
  affected_rows bigint,
  details text
) on commit drop;

do $$
declare
  v_operator_confirmation boolean := false;
  v_admin_count bigint;
  v_non_admin_count bigint;
  v_auth_count bigint;
  v_profile_count bigint;
  v_orphan_profile_count bigint;
  v_profileless_auth_count bigint;
  v_row_count bigint;
  v_actual_count bigint;
  r record;
begin
  select count(*) into v_admin_count from cleanup_admin_ids;
  select count(*) into v_non_admin_count from cleanup_non_admin_ids;
  select count(*) into v_auth_count from auth.users;
  select count(*) into v_profile_count from public.profiles;

  select count(*) into v_orphan_profile_count
  from public.profiles p
  left join auth.users u on u.id = p.id
  where u.id is null;

  select count(*) into v_profileless_auth_count
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;

  if v_admin_count <> 1 then
    raise exception 'CLEANUP_ABORTED: expected exactly one admin profile, found %', v_admin_count;
  end if;

  if v_non_admin_count < 1 then
    raise exception 'CLEANUP_ABORTED: no non-admin profiles are available to clean';
  end if;

  if v_auth_count <> v_profile_count then
    raise exception 'CLEANUP_ABORTED: auth.users (%) and public.profiles (%) do not match', v_auth_count, v_profile_count;
  end if;

  if v_orphan_profile_count <> 0 or v_profileless_auth_count <> 0 then
    raise exception 'CLEANUP_ABORTED: found orphan profiles (%) or auth users without profiles (%)', v_orphan_profile_count, v_profileless_auth_count;
  end if;

  if not v_operator_confirmation then
    raise exception 'CLEANUP_NOT_CONFIRMED: leave the default false until the owner explicitly authorizes deletion';
  end if;

  for r in
    select table_name
    from (values
      ('delivery_pricing_config'::text),
      ('referral_reward_config'::text),
      ('admin_archive_alert_settings'::text)
    ) as config(table_name)
  loop
    if to_regclass(format('public.%I', r.table_name)) is not null then
      execute format('select count(*) from public.%I', r.table_name) into v_row_count;
      insert into cleanup_preserved_config_counts (table_name, expected_row_count)
      values (r.table_name, v_row_count);
    end if;
  end loop;

  insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
  values (0, 'auth/users', 'preflight_verified', v_non_admin_count,
    format('admin_profiles=%s; auth_users=%s; profiles=%s', v_admin_count, v_auth_count, v_profile_count));

  for r in select * from cleanup_targets order by execution_order loop
    if to_regclass(format('public.%I', r.table_name)) is not null then
      execute format('select count(*) from public.%I', r.table_name) into v_row_count;
      execute format('truncate table public.%I restart identity cascade', r.table_name);
      insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
      values (r.execution_order, 'public.' || r.table_name, 'truncated', v_row_count, 'transactional or account-linked data');
    else
      insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
      values (r.execution_order, 'public.' || r.table_name, 'skipped_missing_table', null, 'optional migration is not applied');
    end if;
  end loop;

  with deleted_users as (
    delete from auth.users
    where id in (select id from cleanup_non_admin_ids)
    returning id
  )
  select count(*) into v_row_count from deleted_users;

  if v_row_count <> v_non_admin_count then
    raise exception 'CLEANUP_ABORTED: expected to delete % non-admin auth users, deleted %', v_non_admin_count, v_row_count;
  end if;

  insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
  values (240, 'auth.users', 'deleted_non_admin_users', v_row_count, 'profiles are removed through the existing cascade');

  for r in select * from cleanup_targets order by execution_order loop
    if to_regclass(format('public.%I', r.table_name)) is not null then
      execute format('select count(*) from public.%I', r.table_name) into v_actual_count;
      if v_actual_count <> 0 then
        raise exception 'CLEANUP_ABORTED: expected public.% to be empty, found % rows', r.table_name, v_actual_count;
      end if;
    end if;
  end loop;

  select count(*) filter (where role = 'admin'), count(*)
  into v_admin_count, v_profile_count
  from public.profiles;

  select count(*) into v_auth_count from auth.users;

  if v_admin_count <> 1 or v_profile_count <> 1 or v_auth_count <> 1 then
    raise exception 'CLEANUP_ABORTED: final counts are admin_profiles=%, profiles=%, auth_users=%', v_admin_count, v_profile_count, v_auth_count;
  end if;

  for r in select * from cleanup_preserved_config_counts order by table_name loop
    execute format('select count(*) from public.%I', r.table_name) into v_actual_count;
    if v_actual_count <> r.expected_row_count then
      raise exception 'CLEANUP_ABORTED: preserved configuration public.% changed from % to % rows', r.table_name, r.expected_row_count, v_actual_count;
    end if;
  end loop;

  insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
  values (250, 'verification', 'all_post_checks_passed', 1, 'one admin profile and one auth user remain');
end
$$;

select execution_order, target, action, affected_rows, details
from cleanup_execution_log
order by execution_order, target;

select
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from public.profiles) as profile_count,
  (select count(*) from public.profiles where role = 'admin') as admin_profile_count;

commit;
