# إعداد مطالبة الدور `authenticated` في Firebase

## الغرض

يستعمل مسار ربط الهاتف الآمن في التطبيق رمز Firebase الموثوق للوصول إلى Supabase. لهذا الغرض يجب أن يحتوي رمز Firebase للمستخدم على المطالبة التالية:

```json
{ "role": "authenticated" }
```

> لا يمكن تعيين **Custom Claims** من تطبيق الويب أو الـAPK، ولا من وحدة Firebase Authentication نفسها. يجب تنفيذها فقط عبر **Firebase Admin SDK** في بيئة إدارية موثوقة؛ لا تضع ملف مفتاح خدمة أو أي سر في المستودع أو في التطبيق.

## الطريقة الآمنة لمستخدم حالي

### 1. الحصول على Firebase UID

من **Firebase Console → Authentication → Users**، افتح المستخدم الذي تريد تفعيل الربط له، ثم انسخ حقل **User UID**.

### 2. تشغيل Firebase Admin SDK في بيئة إدارية

افتح **Google Cloud Shell** وأضف مجلد عمل خاصاً، ثم ثبّت الحزمة:

```bash
mkdir -p ~/souq-jiran-firebase-admin
cd ~/souq-jiran-firebase-admin
npm init -y
npm install firebase-admin
```

أنشئ ملفاً باسم `set-authenticated-role.mjs` بالمحتوى الآتي. لا تنفّذه على جهاز غير موثوق:

```js
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "souq-jiran",
});

const uid = process.argv[2];
if (!uid) {
  throw new Error("Usage: node set-authenticated-role.mjs <FIREBASE_UID>");
}

const user = await admin.auth().getUser(uid);
await admin.auth().setCustomUserClaims(uid, {
  ...(user.customClaims ?? {}),
  role: "authenticated",
});

console.log(`Authenticated role assigned to ${uid}`);
```

إذا طلب Cloud Shell اعتماداً افتراضياً للتطبيق، نفّذ:

```bash
gcloud config set project souq-jiran
gcloud auth application-default login
```

ثم عيّن المطالبة للمستخدم المطلوب:

```bash
node set-authenticated-role.mjs FIREBASE_UID_HERE
```

ينبغي أن تملك الهوية الإدارية المستخدمة صلاحية **Firebase Authentication Admin** على مشروع `souq-jiran`. إذا لم تملكها، يمنحها مالك المشروع من **Google Cloud IAM** للحساب الإداري فقط. لا تنشئ أو تشارك ملف Service Account JSON ما لم يكن ذلك ضرورياً، وعند إنشائه احفظه خارج المشروع واحذفه بعد العملية.

## تطبيقها على المستخدمين الحاليين

كرر الأمر لكل UID موجود في صفحة المستخدمين. لا تعيّن المطالبة من بيانات يرسلها العميل؛ قيمة الدور ثابتة في الأمر أعلاه وتُعيّن من بيئة إدارية موثوقة فقط.

| حالة الحساب | الإجراء |
|---|---|
| مستخدم لديه رقم هاتف مؤكد | عيّن المطالبة ثم اطلب منه تسجيل الخروج والدخول مجدداً |
| مستخدم جديد لا يملك Firebase UID | لا تُنشئ مطالبة له؛ تُنشأ بعد أول تحقق هاتف ناجح |
| حساب تجريبي أو غير مستخدم | لا تمنحه مطالبة قبل التحقق من هويته واستخدامه |

## المستخدمون الجدد وتجديد الرمز

تظهر المطالبة في رمز ID بعد إصدار رمز جديد. بعد تنفيذ الأمر، على المستخدم **تسجيل الخروج ثم الدخول برقم الهاتف مجدداً**؛ أو يمكن للتطبيق طلب رمز جديد من Firebase. لا تعتمد على رمز قديم في اختبار الربط.

للمستخدمين الجدد، كرر التعيين الإداري مباشرة بعد أول تحقق هاتف إلى أن تضيف مستقبلاً عملية خلفية موثوقة تستخدم Firebase Admin SDK. لا تنفذ هذه العملية في React أو Capacitor، ولا في قاعدة بيانات Supabase.

لأتمتة الإسناد، يدعم التوثيق الرسمي حدث إنشاء مستخدم Firebase في Cloud Functions من الجيل الأول. أما Blocking Functions فهي بديل مختلف يتطلب الترقية إلى Firebase Authentication with Identity Platform ويؤثر مباشرة في مسار إنشاء الحساب أو تسجيل الدخول؛ لذلك لا تُفعّل قبل تقييم أثرها التشغيلي.

## اختبار التحقق

بعد تسجيل دخول المستخدم مجدداً:

1. افتح صفحة الحساب في التطبيق واختر **تغيير رقم الهاتف**.
2. اطلب رمز SMS للرقم الجزائري الجديد وأدخله.
3. يتوقع أن ينجح تأكيد Firebase ثم يحفظ Supabase الرقم ومعرّف Firebase من الرمز الموثوق فقط.
4. إذا ظهرت رسالة تفيد غياب الدور أو رفض JWT، تحقق من إسناد المطالبة ثم اطلب من المستخدم تسجيل الخروج والدخول مرة أخرى.

## التراجع

لإزالة المطالبة من مستخدم محدد، نفّذ في البيئة الإدارية نفسها:

```js
const user = await admin.auth().getUser("FIREBASE_UID_HERE");
const claims = { ...(user.customClaims ?? {}) };
delete claims.role;
await admin.auth().setCustomUserClaims("FIREBASE_UID_HERE", claims);
```

## مراجع رسمية

- [Firebase Admin: Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Supabase: Firebase Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
- [Firebase Authentication triggers (Cloud Functions, الجيل الأول)](https://firebase.google.com/docs/functions/1st-gen/auth-events)
- [Firebase Authentication blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions)
