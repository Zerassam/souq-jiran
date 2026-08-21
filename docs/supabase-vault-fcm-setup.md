# تفعيل Vault لإشعارات FCM الحية

تُخزن إعدادات إرسال إشعارات الطلبات في Supabase Vault تحت الاسمين `souq_jiran_order_push_url` و`souq_jiran_order_push_secret`. تستخدم الدالة `public.queue_order_push_event` هاتين القيمتين داخلياً عند تغير حالة الطلب، ولا تعرض رمز FCM أو السر إلى العميل.

> يتطلب الإدخال امتيازات مالك مشروع Supabase. لا يجوز إدراج قيمة السر في مستودع GitHub أو ملفات المشروع أو سجلات الاختبار.

يُنشأ أو يُدوّر السر عبر `vault.create_secret` و`vault.update_secret` وفق مرجع [Supabase Vault](https://supabase.com/docs/guides/database/vault). بعد التنفيذ، يكفي فحص أسماء الأسرار وتواريخها في `vault.secrets`؛ لا تستخدم `vault.decrypted_secrets` لعرض القيم يدوياً.

عنوان Webhook المنشور للتطبيق هو:

```text
https://jiranapp-km95ryzi.manus.space/api/hooks/orders/push
```

التحقق الحي يقتضي وجود حساب مستلم له رمز FCM نشط، ثم تغيير حالة طلب مخصّص لذلك الحساب. يكتب Trigger حدثاً في `public.order_push_events` ويوثق معرف طلب HTTP وحالة الإرسال من دون حفظ الرموز أو السر.
