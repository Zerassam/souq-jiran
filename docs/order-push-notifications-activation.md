# تفعيل إشعارات الطلبات الفورية

**الغرض.** يرسل التطبيق تحديثات طلبات سوق الجيران من Supabase إلى مسار خادمي موثوق، ثم إلى Firebase Cloud Messaging. لا يظهر رمز جهاز المستخدم ولا مفتاح حساب خدمة Firebase في المتصفح أو في لوحات التحليل. يتطلب مسار FCM HTTP v1 اعتماد حساب خدمة على خادم موثوق، ولذلك يبقى `FIREBASE_SERVICE_ACCOUNT_JSON` سراً خادمياً فقط.[1]

| الطبقة | ما نُفذ | الضمان الأساسي |
|---|---|---|
| تطبيق Android | طلب الصلاحية، إنشاء قناة `order_updates` عالية الأهمية، استقبال التنبيه والنقر عليه | يظهر تنبيه بصوت وعلى شاشة القفل عند منح الإذن، ويُفتح الطلب المقصود عند الضغط |
| Supabase | Trigger على `orders.status` وجدول تدقيق `order_push_events` | لا يُنشأ حدث عند تحديث الطلب من دون انتقال حالة |
| Webhook | مسار `POST /api/hooks/orders/push` مع سر مشترك | يرفض أي طلب لا يحمل `x-souq-webhook-secret` الصحيح |
| خادم التطبيق | يطلب OAuth قصير الأجل من حساب خدمة Firebase ثم يستدعي FCM HTTP v1 | لا يمر اعتماد Firebase أو رمز جهاز عبر العميل |

## تطبيق الترحيل

بعد نشر نسخة التطبيق الجديدة على عنوان HTTPS عام، افتح **Supabase SQL Editor** ونفّذ محتوى الملف التالي كاملاً:

```text
supabase/migrations/20260901_order_push_notifications.sql
```

يعتمد الترحيل على Trigger في PostgreSQL وامتداد `pg_net` لإرسال طلب HTTPS غير متزامن عند تغيّر حالة الطلب. يدعم Supabase ذلك صراحةً عبر Database Webhooks وPostgres Triggers و`pg_net`.[2] [3] [4]

## إعداد Supabase Vault

قبل تنفيذ الترحيل، استبدل قيم المثال أدناه بالقيم الفعلية. يجب أن يشير العنوان إلى المجال المنشور للتطبيق، وليس عنوان المعاينة المؤقت، وأن يطابق السر قيمة `ORDER_PUSH_WEBHOOK_SECRET` في إعدادات المشروع.

```sql
select vault.create_secret(
  'https://YOUR-PUBLISHED-DOMAIN/api/hooks/orders/push',
  'souq_jiran_order_push_url'
);

select vault.create_secret(
  'A-LONG-UNIQUE-SHARED-SECRET',
  'souq_jiran_order_push_secret'
);
```

> لا تضع قيمة السر في ملف SQL محفوظ أو في GitHub. أنشئ قيمة طويلة وعشوائية، واحفظ النسخة نفسها في إعدادات المشروع باسم `ORDER_PUSH_WEBHOOK_SECRET` ثم في Supabase Vault فقط.

## اختبار تشغيلي مختصر

| الخطوة | النتيجة المتوقعة |
|---|---|
| سجّل الدخول على Android بحساب مرتبط بملف `profiles` | تظهر نافذة إذن الإشعارات مرة واحدة عند أول فتح، ثم يُحدّث رمز FCM لهذا الحساب |
| أنشئ طلباً | يُسجل صف في `order_push_events` وتصل رسالة للتاجر إذا كان لديه رمز جهاز محدث |
| غيّر حالة الطلب إلى `ready` ثم `out_for_delivery` | تصل رسالة مرئية للعميل، مع نغمة وقناة «تحديثات الطلبات» |
| اضغط الإشعار | تفتح نافذة تفاصيل الطلب الذي يحمل `order_id` نفسه |
| سجّل الخروج | يُبطل رمز FCM من ملف الحساب لمنع وصول إشعار لحساب سابق على الجهاز نفسه |

يتطلب Android 13 فحص الإذن وطلبه قبل التسليم، كما تعتمد قنوات الإشعار على Android 8 أو أحدث؛ لهذا ينشئ التطبيق القناة برمجياً ويستخدم حمولة مرئية مع بيانات `order_id`.[5] [6]

## حدود النشر والخصوصية

تسجل `order_push_events` **معرف الحدث وحالة الطلب وعدد المستلمين فقط**. لا تخزن رموز FCM في هذا الجدول. يمكن للمشرف مراجعة السجل، بينما لا يمنح الترحيل أي وصول عام للأجهزة أو أسرار Vault. إذا رفض FCM رمزاً منتهياً، يبقى الحدث قابلاً للمراجعة عبر معرف طلب الشبكة في Supabase؛ وتكون الخطوة التالية إبطال الرمز من الحساب عند المزامنة المقبلة.

## المراجع

[1]: https://firebase.google.com/docs/cloud-messaging/send/v1-api "Firebase Cloud Messaging HTTP v1 API"
[2]: https://supabase.com/docs/guides/database/webhooks "Supabase Database Webhooks"
[3]: https://supabase.com/docs/guides/database/postgres/triggers "Supabase Postgres Triggers"
[4]: https://supabase.com/docs/guides/database/extensions/pg_net "Supabase pg_net"
[5]: https://www.npmjs.com/package/@capacitor-firebase/messaging "Capacitor Firebase Messaging"
[6]: https://capacitorjs.com/docs/apis/push-notifications "Capacitor Push Notifications"
