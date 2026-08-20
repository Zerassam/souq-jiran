# تحقق إعدادات Firebase وSupabase

تمت مراجعة لقطات شاشة قدّمها مالك المشروع في 20 أغسطس 2026. تؤكد اللقطات ما يلي:

- تكامل **Firebase** مفعّل في صفحة **Supabase Auth > Third-Party Auth** لمشروع `souq-jiran`.
- تنفيذ الترحيل `20260830_secure_firebase_phone_link.sql` أعاد النتيجة: `Success. No rows returned`.
- موفّر **Phone Authentication** ظاهر بالحالة `Activé` في Firebase Authentication.
- نطاق المعاينة `3000-i3197jyeazyssqhiaw41i-2adb3ce6.us4.manus.computer` مضاف إلى قائمة **Authorized domains** في Firebase.
- Firebase يعرض سقفاً افتراضياً للمشاريع الجديدة قدره 10 رسائل SMS يومياً؛ هذا قيد تشغيلي خارجي وليس خطأً في التطبيق.

يبقى مفتاح VAPID غير مطلوب إلى حين تفعيل استقبال FCM للويب. كما يجب تطبيق أي ترحيل Firebase لاحق يظهر في `supabase/migrations/` قبل اختباره على الحسابات الحية.

لإكمال وصول Firebase JWT إلى إجراءات Supabase التي تمنحها صلاحية `authenticated`، راجع الدليل الإداري: [`firebase-custom-claims-guide.md`](./firebase-custom-claims-guide.md). هذا التعيين يتم حصراً عبر Firebase Admin SDK في بيئة موثوقة، ولا يوضع في تطبيق الويب أو الـAPK.
