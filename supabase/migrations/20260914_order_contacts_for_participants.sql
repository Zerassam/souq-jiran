-- =====================================================================
-- 20260914_order_contacts_for_participants.sql
--
-- المشكلة: التاجر والموصل كانا يريان النص الثابت "عميل" بدل اسم/هاتف
-- الزبون الحقيقيين، لأن الواجهة الأمامية لم تكن تجلب هذه البيانات إطلاقاً
-- (وليس بسبب صلاحيات RLS كما افتُرض سابقاً — لم تكن هناك أي محاولة جلب).
--
-- الحل: دالة آمنة (security definer) تُعيد اسم وهاتف الزبون *فقط* للطلبات
-- التي يكون المستخدم الحالي طرفاً فعلياً فيها (تاجر المحل، الموصل المُعيَّن،
-- أو المشرف) — لا كشف عام لجدول profiles.
-- =====================================================================

create or replace function public.get_my_order_contacts()
returns table (order_id uuid, name text, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select o.id as order_id, p.name, p.phone
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  where o.merchant_id = auth.uid()
     or o.courier_id = auth.uid()
     or public.is_app_admin();
$$;

revoke all on function public.get_my_order_contacts() from public;
grant execute on function public.get_my_order_contacts() to authenticated;

-- بعد أي إنشاء/تعديل دالة، أجبر PostgREST على إعادة قراءة المخطط:
notify pgrst, 'reload schema';
