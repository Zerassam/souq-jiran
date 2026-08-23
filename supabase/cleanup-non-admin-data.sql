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
-- هذه النسخة مفعّلة للتشغيل مرة واحدة بعد موافقة المالك الصريحة في هذه الجلسة.
-- لا تُشغّلها ثانية؛ احفظ نتيجة التنفيذ أولاً، واحتفظ بنقطة التحقق السابقة
-- كمرجع تدقيقي بدلاً من إعادة استخدام هذه النسخة.
-- حارس الهوية يطابق البريد الإداري المعتمد، ويتحقق من بصمة رقم الهاتف بعد
-- توحيد صيغته الجزائرية. لا يظهر الرقم ولا يُخزّن بصورته الصريحة في هذا الملف.

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
  (210, 'couriers');

create temporary table cleanup_preserved_config_counts (
  table_name text primary key,
  expected_row_count bigint not null,
  expected_content_hash text not null
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
  v_operator_confirmation boolean := true;
  v_admin_count bigint;
  v_non_admin_count bigint;
  v_auth_count bigint;
  v_profile_count bigint;
  v_orphan_profile_count bigint;
  v_profileless_auth_count bigint;
  v_row_count bigint;
  v_actual_count bigint;
  v_config_content_hash text;
  v_admin_email text;
  v_admin_phone_before text;
  v_admin_phone_after text;
  v_admin_phone_normalized text;
  v_admin_profile_before jsonb;
  v_admin_profile_after jsonb;
  v_admin_auth_before jsonb;
  v_admin_auth_after jsonb;
  v_has_admin_related_data boolean;
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

  select lower(coalesce(u.email, '')), p.phone, to_jsonb(p), to_jsonb(u)
  into v_admin_email, v_admin_phone_before, v_admin_profile_before, v_admin_auth_before
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin';

  if v_admin_email <> 'listportail@gmail.com' then
    raise exception 'CLEANUP_ABORTED: the sole admin is not the approved primary admin account';
  end if;

  if nullif(btrim(v_admin_phone_before), '') is null then
    raise exception 'CLEANUP_ABORTED: the approved primary admin account has no linked phone number';
  end if;

  v_admin_phone_normalized := regexp_replace(v_admin_phone_before, '[^0-9]', '', 'g');
  if left(v_admin_phone_normalized, 1) = '0' then
    v_admin_phone_normalized := '213' || substr(v_admin_phone_normalized, 2);
  end if;

  if v_admin_phone_normalized !~ '^213[567][0-9]{8}$'
     or md5(v_admin_phone_normalized) <> '10c07cd3b4a1aa4240d4b4a5c13d95e9' then
    raise exception 'CLEANUP_ABORTED: the linked phone does not match the approved primary admin account';
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
    raise exception 'CLEANUP_NOT_CONFIRMED: this script must only run after the owner explicitly authorizes deletion';
  end if;

  -- أي سجل تشغيلي يشارك فيه الأدمن يوقف العملية بكاملها، فلا تُمس بياناته.
  if to_regclass('public.merchants') is not null then
    execute 'select exists(select 1 from public.merchants where id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-owned merchant record detected'; end if;
  end if;
  if to_regclass('public.couriers') is not null then
    execute 'select exists(select 1 from public.couriers where id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-owned courier record detected'; end if;
  end if;
  if to_regclass('public.orders') is not null then
    execute 'select exists(select 1 from public.orders where customer_id in (select id from cleanup_admin_ids) or merchant_id in (select id from cleanup_admin_ids) or courier_id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-participating order detected'; end if;
  end if;
  if to_regclass('public.order_messages') is not null then
    execute 'select exists(select 1 from public.order_messages where sender_id in (select id from cleanup_admin_ids) or recipient_id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-participating message detected'; end if;
  end if;
  if to_regclass('public.order_user_archives') is not null then
    execute 'select exists(select 1 from public.order_user_archives where user_id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin order archive detected'; end if;
  end if;
  if to_regclass('public.message_user_archives') is not null then
    execute 'select exists(select 1 from public.message_user_archives where user_id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin message archive detected'; end if;
  end if;
  if to_regclass('public.customer_blacklist') is not null then
    execute 'select exists(select 1 from public.customer_blacklist where created_by in (select id from cleanup_admin_ids) or revoked_by in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-authored blacklist record detected'; end if;
  end if;
  if to_regclass('public.customer_referrals') is not null then
    execute 'select exists(select 1 from public.customer_referrals where referrer_id in (select id from cleanup_admin_ids) or referred_customer_id in (select id from cleanup_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: admin-linked referral record detected'; end if;
  end if;
  if to_regclass('public.admin_archive_audit_logs') is not null then
    execute 'select exists(select 1 from public.admin_archive_audit_logs where actor_id in (select id from cleanup_admin_ids) and archived_by_user_id in (select id from cleanup_non_admin_ids))' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: deleting a non-admin would modify an admin archive audit row'; end if;
  end if;
  if to_regclass('public.admin_archive_notifications') is not null then
    execute 'select exists(select 1 from public.admin_archive_notifications where actor_id in (select id from cleanup_admin_ids) and order_id is not null)' into v_has_admin_related_data;
    if v_has_admin_related_data then raise exception 'CLEANUP_ABORTED: deleting orders would modify an admin archive notification'; end if;
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
      execute format(
        'select count(*), md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) from public.%I t',
        r.table_name
      ) into v_row_count, v_config_content_hash;
      insert into cleanup_preserved_config_counts (table_name, expected_row_count, expected_content_hash)
      values (r.table_name, v_row_count, v_config_content_hash);
    end if;
  end loop;

  insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
  values (0, 'auth/users', 'preflight_verified', v_non_admin_count,
    format('admin_profiles=%s; auth_users=%s; profiles=%s', v_admin_count, v_auth_count, v_profile_count));

  if to_regclass('public.admin_archive_audit_logs') is not null then
    execute 'select count(*) from public.admin_archive_audit_logs where actor_id in (select id from cleanup_non_admin_ids)' into v_row_count;
    delete from public.admin_archive_audit_logs where actor_id in (select id from cleanup_non_admin_ids);
    insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
    values (20, 'public.admin_archive_audit_logs', 'deleted_non_admin_actor_rows', v_row_count, 'all rows attributed to the admin are preserved');
  end if;

  if to_regclass('public.admin_archive_notifications') is not null then
    execute 'select count(*) from public.admin_archive_notifications where actor_id in (select id from cleanup_non_admin_ids)' into v_row_count;
    delete from public.admin_archive_notifications where actor_id in (select id from cleanup_non_admin_ids);
    insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
    values (30, 'public.admin_archive_notifications', 'deleted_non_admin_actor_rows', v_row_count, 'all rows attributed to the admin are preserved');
  end if;

  if to_regclass('public.test_account_review_audit_logs') is not null then
    execute 'select count(*) from public.test_account_review_audit_logs' into v_row_count;
    insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
    values (40, 'public.test_account_review_audit_logs', 'preserved_admin_audit_rows', v_row_count, 'admin audit history is retained intact');
  end if;

  if to_regclass('public.firebase_phone_link_challenges') is not null then
    execute 'select count(*) from public.firebase_phone_link_challenges where profile_id in (select id from cleanup_non_admin_ids)' into v_row_count;
    delete from public.firebase_phone_link_challenges where profile_id in (select id from cleanup_non_admin_ids);
    insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
    values (220, 'public.firebase_phone_link_challenges', 'deleted_non_admin_rows', v_row_count, 'admin-linked challenges are preserved');
  end if;

  if to_regclass('public.account_phone_change_requests') is not null then
    execute 'select count(*) from public.account_phone_change_requests where user_id in (select id from cleanup_non_admin_ids)' into v_row_count;
    delete from public.account_phone_change_requests where user_id in (select id from cleanup_non_admin_ids);
    insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
    values (230, 'public.account_phone_change_requests', 'deleted_non_admin_rows', v_row_count, 'admin-linked phone request is preserved');
  end if;

  for r in select * from cleanup_targets order by execution_order loop
    if to_regclass(format('public.%I', r.table_name)) is not null then
      execute format('select count(*) from public.%I', r.table_name) into v_row_count;
      execute format('delete from public.%I', r.table_name);
      insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
      values (r.execution_order, 'public.' || r.table_name, 'deleted', v_row_count, 'transactional or account-linked data');
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

  select lower(coalesce(u.email, '')), p.phone, to_jsonb(p), to_jsonb(u)
  into v_admin_email, v_admin_phone_after, v_admin_profile_after, v_admin_auth_after
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin';

  if v_admin_email <> 'listportail@gmail.com'
     or v_admin_phone_after is distinct from v_admin_phone_before
     or v_admin_profile_after is distinct from v_admin_profile_before
     or v_admin_auth_after is distinct from v_admin_auth_before then
    raise exception 'CLEANUP_ABORTED: the approved primary admin account or profile changed unexpectedly';
  end if;

  for r in select * from cleanup_preserved_config_counts order by table_name loop
    execute format(
      'select count(*), md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) from public.%I t',
      r.table_name
    ) into v_actual_count, v_config_content_hash;
    if v_actual_count <> r.expected_row_count or v_config_content_hash <> r.expected_content_hash then
      raise exception 'CLEANUP_ABORTED: preserved configuration public.% changed unexpectedly', r.table_name;
    end if;
  end loop;

  insert into cleanup_execution_log (execution_order, target, action, affected_rows, details)
  values (250, 'verification', 'all_post_checks_passed', 1, 'one admin profile and one auth user remain');
end;
$$;

select execution_order, target, action, affected_rows, details
from cleanup_execution_log
order by execution_order, target;

select
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from public.profiles) as profile_count,
  (select count(*) from public.profiles where role = 'admin') as admin_profile_count;

commit;
