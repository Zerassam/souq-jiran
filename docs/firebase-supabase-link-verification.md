# تحقق سلامة ربط Firebase مع Supabase

## النتيجة

نجحت فحوص المشروع البرمجية في التحقق من أن مسار ربط الهاتف لا يقبل رقم هاتف أو Firebase UID من المتصفح كمصدر حقيقة. في النسخة الحالية، تنشئ جلسة Supabase العادية تحدياً مؤقتاً مرتبطاً بـ`profile_id`، ثم يستدعي العميل المخصص لـFirebase إجراء التأكيد باستخدام Firebase ID token فقط.

| طبقة الحماية | الدليل في التطبيق | النتيجة |
|---|---|---|
| مصدر رقم الهاتف وFirebase UID | `confirm_my_firebase_phone_link` يقرأ `phone_number` و`sub` من Firebase JWT | لا تُقبل القيم المرسلة من واجهة الويب |
| ربط التحدي بالحساب | التحدي يحفظ `profile_id` عند إنشائه بجلسة Supabase التقليدية | لا يختلط Firebase UID مع معرّف ملف Supabase |
| صلاحية التحدي | مدة التحدي عشر دقائق ويُحذف بعد نجاح التأكيد | تقل نافذة إعادة الاستخدام |
| تفويض Firebase | عميل `firebaseSupabase` يرسل Firebase ID token عبر `accessToken` | الإجراء لا يعتمد على جلسة Supabase بديلة |
| الفحص الآلي | 34 اختبار Vitest وبناء الإنتاج | اجتازت في آخر تحقق بتاريخ 20 أغسطس 2026 |

## ما تم التحقق منه ميدانياً

أنشأ المالك أول Firebase UID وعين له المطالبة `role=authenticated` بنجاح بواسطة Firebase Admin SDK. كما أكد وصول Firebase Auth SMS إلى APK Android في اختبار سابق. ويثبت ذلك تفعيل قناة المصادقة الأصلية وإتاحة المطالبة للمستخدم الأول بعد تجديد Firebase ID token.

## ما لم يكتمل بعد

لم يُنفذ الاختبار التفاعلي الكامل من متصفح الويب لإدخال SMS ثم استدعاء `confirm_my_firebase_phone_link`؛ أُجل لتفادي تكرار تحديات reCAPTCHA واستهلاك رسائل إضافية. لذلك لا يُسجل هذا المستند نجاحاً حياً لكتابة `phone_verified_at` و`firebase_uid` في ملف Supabase لهذا المستخدم.

حتى تتم أتمتة تعيين المطالبة لكل UID جديد، يبقى الإجراء الإداري في `firebase-custom-claims-guide.md` مطلوباً فور كل تحقق Firebase جديد. لا يجوز نقل Firebase Admin SDK أو مفاتيح الخدمة إلى React أو Capacitor أو Supabase.

## الخطوات الموصى بها عند استئناف الاختبار

بعد تخصيص جلسة متصفح مستقلة، يسجل المستخدم دخوله من جديد كي يحصل على Firebase ID token متجدد يتضمن المطالبة، ثم يفتح **تغيير رقم الهاتف** ويكمل SMS. عند النجاح، يراجع المشرف `profiles.phone_verified_at` و`profiles.firebase_uid` في Supabase وفق سياسات RLS المطبقة.

## المراجع

[1] [Firebase Admin: Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)

[2] [Supabase: Firebase Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
