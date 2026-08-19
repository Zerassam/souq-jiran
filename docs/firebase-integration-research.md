# مراجع ومتطلبات تكامل Firebase

## Firebase Phone Authentication

مصادقة الهاتف عبر الويب تتطلب تفعيل مزود **Phone** في Firebase Authentication، وضبط سياسة مناطق SMS، وإضافة نطاقات التطبيق المسموح بها. كما تستخدم `RecaptchaVerifier` قبل إرسال الرمز ثم `signInWithPhoneNumber` لإرسال SMS و`confirmationResult.confirm(code)` لتأكيده. ينبغي إعلام المستخدم بأن رقم الهاتف يُرسل إلى Google لأغراض منع إساءة الاستخدام وطلب الموافقة المناسبة.

المصدر: [Firebase: Authenticate with a Phone Number Using JavaScript](https://firebase.google.com/docs/auth/web/phone-auth).

## Firebase Cloud Messaging على Android

تتطلب FCM إعداد تطبيق Android في مشروع Firebase وإضافة ملف `google-services.json` في `android/app/`. تحتاج التطبيقات التي تستهدف Android 13 أو أحدث إلى طلب إذن الإشعارات وقت التشغيل. يتغير رمز FCM دورياً، لذلك يجب مزامنته مع Supabase عند الحصول عليه أو تغيّره.

المصدر: [Firebase: Get started with Firebase Cloud Messaging in Android apps](https://firebase.google.com/docs/cloud-messaging/android/get-started).

## الحزمة المطلوبة للمراسلة في Capacitor

الحزمة المطلوبة هي `@capacitor-firebase/messaging` من Capawesome. إصدار 8.x يتطلب Capacitor 8.x أو أحدث، ويثبت مع Firebase عبر `pnpm add @capacitor-firebase/messaging firebase` ثم `npx cap sync`. توفر الحزمة طلب الإذن، قراءة رمز FCM، الاستماع لتغيّر الرمز، وإشعارات الاستلام والتفاعل. يجب ألا تُستخدم معها إضافة Push أخرى متداخلة.

المصادر: [حزمة npm](https://www.npmjs.com/package/@capacitor-firebase/messaging) و[مستودع Capawesome](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/messaging).

## قرار التنفيذ

- اعتماد Supabase كقاعدة البيانات المرجعية للملفات الشخصية والرموز المسجلة.
- اعتماد Firebase Authentication لتأكيد ملكية رقم الهاتف عبر SMS.
- اعتماد FCM للتنبيهات الأصلية على Android مع اسم الحزمة `com.souqjiran.app`.
- حفظ ملف `google-services.json` الخاص بتطبيق Android في `android/app/` لأن ملف المشروع المقدّم من المالك جزء من إعداد البناء الأصلي. تظل قيم البيئة السرية وإعدادات الويب محكومة بالأسرار الآمنة ولا تُسجّل في ملفات `.env`.

## Supabase Third-party Auth

يدعم Supabase الوثوق برموز Firebase ID مباشرةً بعد تسجيل مشروع Firebase من **Authentication → Third-party Auth** داخل لوحة Supabase. ويتطلب هذا المسار تضمين المطالبة المخصصة `role: "authenticated"` في رموز Firebase؛ ولهذا يوفّر التطبيق عميلاً منفصلاً باسم `firebaseSupabase` يمرر الرمز في `accessToken`. يبقى عميل `supabase` الأساسي محافظاً على جلسات البريد الإلكتروني/كلمة المرور المرتبطة بجداول المشروع ذات المعرّفات UUID أثناء ترحيل الحسابات تدريجياً.

المصدر: [Supabase: Firebase Auth as Third-party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth).
