# متطلبات Firebase الأصلية ذات الصلة

تاريخ المراجعة: 2026-08-25

راجعنا دليل [Capawesome Firebase Authentication](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/) ودليل إعداد [Google Sign-In](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md)، إضافة إلى [دليل Firebase Cloud Messaging على Android](https://firebase.google.com/docs/cloud-messaging/android/client).

## Google على Android

يتطلب الإعداد إضافة `google.com` إلى قائمة `providers`، وتفعيل دعم Google في إعدادات Firebase Authentication، وإضافة بصمة SHA-1 للشهادة التي وُقّع بها التطبيق. يجب إعادة تنزيل `google-services.json` بعد تحديث البصمات. بالنسبة لتوزيع Google Play، يلزم أيضاً إضافة بصمة Play App Signing لأن الشهادة تختلف عن مفتاح الرفع. دليل Firebase/Capawesome يؤكد أن التطبيق المحلي قد يفشل إذا كانت البصمة أو إعداد Google غير متطابقين.

## FCM على Android

يتطلب FCM جهاز Android 6 أو أحدث مع Google Play Store/Google APIs، وتفعيل إذن `POST_NOTIFICATIONS` وقت التشغيل على Android 13 أو أحدث. تحتاج الإشعارات إلى قناة Android ذات أهمية مناسبة، ويجب منح الإذن قبل توقع ظهور التنبيهات. هذا المرجع لا يثبت وصول FCM في جهاز المشروع؛ التحقق النهائي ما زال ميدانياً.

## ملاحظة تشخيصية

هذه المصادر تشرح المتطلبات العامة فقط. لا تحتوي على أسرار المشروع ولا تُثبت صلاحية إعداد Firebase الحالي أو وصول إشعار فعلي إلى جهاز بعينه.

## تفاصيل إعداد Google التي نتحقق منها

يذكر الدليل الرسمي للإضافة أن إعداد Android يحتاج إلى `google.com` ضمن `FirebaseAuthentication.providers`، وإضافة `rgcfaIncludeGoogle = true` و`androidxCredentialsVersion = '1.3.0'` إلى `android/variables.gradle`، ثم مزامنة Capacitor. كما يلزم تسجيل SHA-1 لشهادة التطبيق في Firebase Console وتفعيل Google ضمن Firebase Authentication. عند استخدام Google Play يجب إضافة بصمة Play App Signing وإعادة تنزيل `google-services.json`. عدم توفر جهاز Android أو بصمات Firebase الحية هنا يعني أن البناء لا يثبت نجاح تسجيل Google ميدانياً.

## نتيجة التحقق من عقد الإضافة

المصدر الحالي للإضافة يذكر أن إعداد Android يتطلب `google.com` ضمن `FirebaseAuthentication.providers`، والمتغيرين `rgcfaIncludeGoogle = true` و`androidxCredentialsVersion = '1.3.0'` في `android/variables.gradle`، ثم تشغيل مزامنة Capacitor، مع تسجيل SHA-1 المناسبة وتفعيل Google من Firebase Console. صفحة إعداد الإضافة لا توصي بتمرير `webClientId` إلى استدعاء `signInWithGoogle`؛ لذلك لا ينبغي اختراع وسيط غير موجود في عقد النسخة المثبتة، بل يجب الاعتماد على `google-services.json` وإعداد Android الأصلي.

المراجع: [Capawesome Firebase Authentication](https://capawesome.io/docs/sdks/capacitor/firebase/authentication/) و[Capawesome Google setup](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md).

## تحقق خارجي إضافي — 25 أغسطس 2026

راجعت وثائق Capawesome الرسمية الحالية:

- Google Android: يجب أن يحتوي `capacitor.config.ts` على `providers: ['google.com']`، ويجب إضافة `rgcfaIncludeGoogle = true` و`androidxCredentialsVersion = '1.3.0'` إلى `android/variables.gradle`، ثم تشغيل `npx cap update`. يلزم تسجيل SHA-1 لشهادة البناء في Firebase، وإضافة SHA-1 لشهادة Play App Signing لاحقاً عند النشر عبر Google Play، مع تفعيل Google من Firebase Authentication.
  المصدر: https://raw.githubusercontent.com/capawesome-team/capacitor-firebase/main/packages/authentication/docs/setup-google.md

- FCM Android: المسار الرسمي هو طلب `FirebaseMessaging.checkPermissions()` ثم `requestPermissions()` عند الحالة `prompt`، وبعد الموافقة استدعاء `getToken()`؛ مستمع `tokenReceived` متاح لتحديث الرمز عند تغيّره. الإضافة لا تحتاج `register()` في العقد الحالي المعروض.
  المصدر: https://raw.githubusercontent.com/capawesome-team/capacitor-firebase/main/packages/messaging/README.md

- لا توثق واجهة `signInWithGoogle()` الحالية خياراً باسم `webClientId`؛ لذلك لا ينبغي تمرير خيار غير مدعوم. يعتمد Google Sign-In الأصلي على `google-services.json` وإعداد Firebase وشهادة SHA-1، بينما إعداد الويب يتطلب إعداد Firebase Web منفصلاً.
  المصدر: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md

## نتيجة إصلاحات جلسة 25 أغسطس 2026

أُعيد تنظيم دورة FCM بحيث لا تُطلب صلاحية الإشعارات ولا يُجلب الرمز قبل وجود جلسة Supabase صالحة. يُسجّل مستمع `tokenReceived` قبل الجلب الأولي، ثم تُحفظ الرموز الجديدة عبر `update_my_fcm_token` بعد تهيئة الحساب، مع إزالة المستمع عند تغيّر الجلسة. هذا يمنع حفظ رمز مجهول أو ضياع تدوير الرمز أثناء تسجيل الدخول.

أُضيفت متغيرات Android المطلوبة (`rgcfaIncludeGoogle = true` و`androidxCredentialsVersion = '1.3.0'`) وتمت مزامنة Capacitor. كما تم التحقق محلياً من تطابق `applicationId` مع `com.souqjiran.app` ومن تطابق بصمة شهادة Debug مع البصمة الموجودة في `google-services.json`. يظل اختبار Google على جهاز فعلي مرتبطاً بإعداد Firebase Console وبصمة الشهادة التي سيُوقّع بها الإصدار الموزّع؛ أما Google Play فيحتاج بصمة Play App Signing منفصلة.

في جدولة التوصيل، أصبحت الواجهة تمرر `schedule_mode` وحقلي بداية/نهاية النافذة كما يعرّفهما الترحيل، وتمنع إنشاء طلب توصيل إذا لم تكن النافذة صالحة أو لم تكن مدتها 90 دقيقة. لا يُطلب موعد عند الاستلام الذاتي. لم تُنشأ أي بيانات إنتاجية اصطناعية، ولم يُجرَ تعديل مباشر على قاعدة البيانات خلال هذه الجلسة.

### حالة التحقق

| المجال | النتيجة المحلية | الحد المتبقي |
|---|---|---|
| اختبارات Vitest | 75 اختباراً ناجحاً | لا تغني عن جهاز Android حقيقي |
| بناء الويب الإنتاجي | ناجح | يلزم اختبار المسارات بحسابات حقيقية عند التحقق الميداني |
| Android Debug وLint | ناجحان بعد مزامنة Capacitor | لا يثبتان وصول FCM أو نجاح Google ميدانياً |
| SHA-1 Debug | متطابقة محلياً مع `google-services.json` | يجب إضافة Play App Signing للإصدار المنشور |
| Supabase الإنتاجي | لم يُعدّل | يلزم تشغيل ترحيل الجدولة مسبقاً والتحقق بحسابات تشغيلية |

> ملاحظة: رفض فحص REST المحلي بسبب مفتاح API غير صالح في بيئة البناء لا يُعد دليلاً على حالة Supabase الإنتاجية، لذلك لم تُتخذ أي إجراءات اعتماداً على ذلك الفحص ولم تُطبع أي مفاتيح.
