# Firebase Phone Auth + Supabase

## القرار المعماري

يستخدم التطبيق **Firebase Authentication** كمصدر إثبات رقم الهاتف عبر SMS و**Supabase** كقاعدة البيانات الرئيسية. تتصل واجهة Supabase برمز Firebase ID للمستخدم بدلاً من استبدال قاعدة البيانات أو فتح وصول غير موثّق.

## ربط Supabase

توفر Supabase دعماً رسمياً لـ Firebase Auth كموفّر مصادقة طرف ثالث. يلزم إضافة تكامل Firebase من إعدادات Authentication في مشروع Supabase وتسجيل Firebase Project ID. يمرّر عميل Supabase رمز Firebase ID من المستخدم الحالي عبر دالة `accessToken`.

تحتاج رموز Firebase إلى مطالبة مخصصة `role: authenticated` حتى تعاملها Supabase بصلاحية المستخدمين الموثقين في سياسات RLS. يجب تنفيذ المطالبة عبر Firebase Authentication Function أو Cloud Function عند إنشاء المستخدم، ثم تجديد الرمز بعد إنشائها.

## Capacitor على Android

اسم الحزمة المعتمد هو `com.souqjiran.app`. يستخدم التطبيق الحزمتين `@capacitor-firebase/authentication` للتحقق الأصلي برقم الهاتف و`@capacitor-firebase/messaging` للتنبيهات، إلى جانب `firebase` وCapacitor. يتطلب التفعيل النهائي وضع ملف `google-services.json` في `android/app/` ثم تشغيل مزامنة Capacitor.

## المصادر

- [Supabase: Firebase Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
- [Supabase: Third-party auth](https://supabase.com/docs/guides/auth/third-party/overview)
- [Capawesome: Firebase Authentication](https://capawesome.io/plugins/firebase/authentication/)
