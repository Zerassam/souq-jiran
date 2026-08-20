-- إتاحة طلبات الموصلين للمشرف دون توسيع الرؤية لبقية الحسابات.
-- يصلح حالة نجاح التسجيل مع اختفاء صف couriers المعلق من لوحة الإدارة بسبب RLS.

drop policy if exists couriers_admin_read on public.couriers;
create policy couriers_admin_read on public.couriers
  for select to authenticated
  using (public.is_app_admin());

drop policy if exists couriers_admin_update on public.couriers;
create policy couriers_admin_update on public.couriers
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
