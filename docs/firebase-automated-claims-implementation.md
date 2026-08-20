# إسناد مطالبة Firebase تلقائياً للمستخدمين الجدد

## القرار المعتمد

يعتمد المشروع وظيفة Firebase إدارية موثوقة تُنفّذ عند إنشاء مستخدم Firebase جديد وتمنحه المطالبة التالية:

```json
{ "role": "authenticated" }
```

تعمل الوظيفة خارج React وAPK، ولا تتلقى UID أو المطالبة من المتصفح. تستدعي Firebase Admin SDK مباشرة باستخدام UID الذي يوفره حدث إنشاء المستخدم.

## الملفات المضافة

| الملف | الغرض |
|---|---|
| `firebase-functions/index.cjs` | مشغّل Firebase Auth من الجيل الأول باسم `assignAuthenticatedRoleOnCreate`؛ يعين `role: "authenticated"` فور إنشاء المستخدم ويحافظ على أي مطالبات إدارية موجودة. |
| `firebase-functions/package.json` | حزمة مستقلة للوظيفة باستخدام `firebase-admin` و`firebase-functions` وNode.js 22. |
| `firebase.json` | يعرّف مجلد الوظيفة وبيئة `nodejs22` للنشر. |
| `.firebaserc` | يربط إعداد النشر بمشروع Firebase `souq-jiran` فقط؛ لا يتضمن أسراراً. |

المشغّل **Idempotent**: إذا أعيد تنفيذ الحدث بعد فشل عابر وكان الدور موجوداً، يسجل الحالة ويخرج من دون تغيير آخر. ولا يسجل رقم هاتف أو رمز SMS أو محتوى Claims كامل في السجل.

## النشر الآمن

1. تأكد في Firebase Console أن المشروع على خطة تسمح بنشر Cloud Functions، وأن الحساب يملك صلاحية النشر.
2. ثبت Firebase CLI أو استخدم الأمر المؤقت من جذر المشروع: `pnpm dlx firebase-tools login`.
3. ثبّت حزم الوظيفة: `pnpm --dir firebase-functions install`.
4. انشر الوظيفة وحدها: `pnpm dlx firebase-tools deploy --only functions:assignAuthenticatedRoleOnCreate --project souq-jiran`.
5. راقب السجل بعد أول مستخدم جديد: `pnpm dlx firebase-tools functions:log --only assignAuthenticatedRoleOnCreate --project souq-jiran`.
6. اطلب من المستخدم الجديد تجديد Firebase ID token عبر إعادة تسجيل الدخول أو `getIdToken(true)` قبل محاولة الربط مع Supabase.

> لا تُضف مفتاح حساب خدمة أو ملف JSON إداري إلى المستودع. أثناء التشغيل تستخدم الوظيفة هوية Cloud Functions الموثوقة وتهيئة `initializeApp()` الافتراضية.

## حالة النشر في هذه الجلسة

تحقق بيئة التطوير من Firebase CLI ولم تجد أي حساب Google مفوّضاً للنشر (`No authorized accounts`). كما أن Firebase Console فتحت صفحة تسجيل دخول Google عند الوصول إلى صفحة مشروع `souq-jiran` بتاريخ 2026-08-20. لذلك يتوقف النشر فقط على مصادقة مالك المشروع في Firebase Console أو Firebase CLI؛ لا توجد بيانات اعتماد مخزنة في المشروع أو مطلوبة منه.

## الأساس التقني الموثق

توضح Firebase أن Custom Claims لا يجوز تعيينها إلا من بيئة خادمية ذات امتيازات عبر Admin SDK، وأن التغيير يصل إلى المستخدم عند تسجيل الدخول التالي أو عند فرض تجديد ID token. كما أن `setCustomUserClaims` يستبدل كائن المطالبات الحالي، ولذلك يجب قراءة المطالبات القائمة ودمجها قبل إضافة الدور.[1]

وتوفر Firebase مشغّل إنشاء مستخدم Firebase Auth عبر `functions.auth.user().onCreate()` في Cloud Functions للجيل الأول. وتوضح الوثائق أن هذا النوع من مشغلات Auth غير متاح في الجيل الثاني، لكن يمكن تشغيل وظيفتي الجيلين معاً في المصدر نفسه.[2]

تدعم وظائف Firebase من الجيل الأول Node.js 22، ويُضبط ذلك في حقل `engines` الخاص بحزمة الوظيفة. يتطلب نشر Cloud Functions مشروع Firebase على خطة Blaze وFirebase CLI؛ لا يتطلب التنفيذ داخل الوظيفة ملف مفتاح خدمة لأن Admin SDK يستخدم هوية وقت التشغيل الموثوقة.[3] [4]

## المصدران الرسميان

[1]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase: Control Access with Custom Claims and Security Rules"
[2]: https://firebase.google.com/docs/functions/1st-gen/auth-events "Firebase: Authentication triggers"
[3]: https://firebase.google.com/docs/functions/1st-gen/manage-functions-1st "Firebase: Manage functions (1st gen)"
[4]: https://firebase.google.com/docs/functions/get-started "Firebase: Get started with Cloud Functions"
