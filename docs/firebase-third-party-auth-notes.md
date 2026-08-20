# ملاحظات تحقق Firebase وSupabase

مسار الربط الآمن يجب أن يعتمد على **مطالبات JWT الموثقة** التي يثق بها Supabase بعد تفعيل Firebase Third-party Auth، لا على رقم هاتف أو معرّف Firebase نصي ترسله الواجهة. تستعمل إجراءات SQL `auth.jwt()` لاستخراج المطالبات الموثوقة، مع ربط طلب التغيير المعلّق بـ nonce غير قابل للتخمين.

توضح وثائق Supabase أن عميل طلبات Firebase يجب أن يمرّر Firebase ID token من `accessToken`، وأن تكامل Third-party Auth يجب أن يكون مفعلاً في مشروع Supabase. كما يلزم أن تحمل رموز Firebase مطالبة `role: authenticated` كي تحصل على دور PostgreSQL المصادق. لذلك يقبل الترحيل الآمن فقط توكناً يحمل `iss` الخاص بمشروع Firebase المسجل و`aud` المطابق، ثم يأخذ `sub` و`phone_number` منه بدلاً من أي مدخلات هاتف أو UID من المتصفح.

يتكون المسار من مرحلتين: تنشئ جلسة Supabase الحالية تحدياً عشوائياً قصير الصلاحية ومقيداً بمعرفها، ثم تستبدله جلسة Firebase (عبر عميل `firebaseSupabase`) بتأكيد واحد فقط. عند التأكيد، يستخرج الإجراء الخادمي `sub` و`phone_number` من Firebase JWT ويتحقق من عدم ارتباط أي منهما بملف آخر قبل تحديث الملف. يمنع ذلك أن يرسل المتصفح رقم هاتف أو Firebase UID مصنوعين، كما يمنع إعادة استخدام التحدي.

المراجع التي تحكم هذا التصميم:

1. [Supabase: Firebase Auth كموفر مصادقة طرف ثالث](https://supabase.com/docs/guides/auth/third-party/firebase-auth).
2. [Supabase: نظرة عامة على Third-party Auth](https://supabase.com/docs/guides/auth/third-party/overview).
3. [Supabase: مرجع مطالبات JWT](https://supabase.com/docs/guides/auth/jwt-fields).
