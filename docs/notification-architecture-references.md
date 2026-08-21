# مراجع هندسة إشعارات الطلبات

## Supabase Database Webhooks

توثق Supabase أن **Database Webhooks** تستجيب لأحداث الجداول، ومنها `UPDATE`، وتستطيع إرسال بيانات الحدث إلى نظام خارجي. كما توثق أن Postgres Triggers تنفذ إجراءات تلقائياً عند أحداث `INSERT` و`UPDATE` و`DELETE`، وأن امتداد `pg_net` ينفذ طلبات HTTP/HTTPS بصورة غير متزامنة. لذلك سيعتمد مسار الإشعارات على Trigger يكتشف انتقال حالة الطلب، وسجل أحداث قابل للمراجعة، ثم استدعاء خادمي موثوق لإرسال FCM؛ ولن يحمل المتصفح أي مفتاح إداري.

| المصدر | الرابط |
|---|---|
| Supabase Database Webhooks | https://supabase.com/docs/guides/database/webhooks |
| Supabase Postgres Triggers | https://supabase.com/docs/guides/database/postgres/triggers |
| Supabase pg_net | https://supabase.com/docs/guides/database/extensions/pg_net |

## Firebase Cloud Messaging وCapacitor

توثق Firebase أن إرسال رسائل **FCM HTTP v1** يتطلب اعتماد حساب خدمة على خادم موثوق، لذلك لن يُخزَّن مفتاح الإرسال في تطبيق React أو Android. وتوضح وثائق Capacitor أن Android 13 يحتاج إلى فحص الصلاحية وطلبها قبل استقبال الإشعارات. سيحفظ التطبيق بيانات التنقل في حمولة الإشعار ويعالج النقر لتوجيه المستخدم إلى الطلب المعني.

يمكن أن تستهدف رسالة FCM HTTP v1 رمز تسجيل جهاز بعينه، وأن تحتوي على بيانات مخصصة إلى جانب عنوان ونص الإشعار. وتوضح وثائق Capacitor أن Android يعتمد قنوات إشعار منذ Android 8، مع إنشاء القناة برمجياً عند تحديد معرّفها، وأن خيارات العرض الأمامي تدعم التنبيه والصوت. لذلك ستستخدم الرسائل حمولة مرئية ذات أولوية مناسبة، مع بيانات `order_id` للتوجيه، بدلاً من رسائل بيانات فقط التي قد لا يعالجها التطبيق إذا كان مغلقاً.

| المصدر | الرابط |
|---|---|
| Firebase Cloud Messaging HTTP v1 API | https://firebase.google.com/docs/cloud-messaging/send/v1-api |
| Capacitor Firebase Messaging | https://www.npmjs.com/package/@capacitor-firebase/messaging |
| Capacitor Push Notifications | https://capacitorjs.com/docs/apis/push-notifications |
