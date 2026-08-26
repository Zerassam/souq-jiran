# مراجع تدقيق FCM

تمت مراجعة هذه المراجع في 26 أغسطس 2026 أثناء تدقيق مسار إشعارات الطلبات، من دون إرسال أي إشعار حي أو الوصول إلى بيانات مستخدمين.

| المصدر | النتيجة التشغيلية المستخدمة في التدقيق |
| --- | --- |
| [توثيق Capawesome لإضافة Firebase Messaging](https://capawesome.io/docs/sdks/capacitor/firebase/cloud-messaging/) | يستدعي Android مستمع `notificationReceived` لكل إشعار في الواجهة فقط؛ وفي الخلفية لا يستدعى إلا لرسائل البيانات. ويُستخدم `notificationActionPerformed` للتعامل مع نقر المستخدم على إشعار. كما أن `getToken` وحدث `tokenReceived` هما مسار إدارة الرمز. |
| [دليل Capacitor الرسمي لـ Firebase على Android](https://capacitorjs.com/docs/guides/push-notifications-firebase) | يجب أن يطابق معرّف الحزمة سجل Android في Firebase وأن يوجد `google-services.json` داخل `android/app/`. |

تُستخدم المراجع لتفسير سلوك المنصة فقط؛ يبقى تحقق الوصول الفعلي على جهاز Android وحسابات وطلبات حقيقية منفصلاً عن الاختبارات الآلية.
