# استعادة النشر بعد عدم تطابق ملف القفل

**التاريخ:** 21 أغسطس 2026  
**المشروع:** سوق الجيران

## ملخص العطل

فشلت محاولة النشر ذات المعرّف `3eb6b721-beb5-4442-9b7a-f6ee269dd06f` أثناء خطوة `pnpm install` الصارمة في بيئة البناء. أظهر السجل أن مواصفات الحزم في `package.json` تتضمن تبعيات Firebase وCapacitor وSupabase وغيرها، بينما كان قسم المستورد الجذري في `pnpm-lock.yaml` لا يتضمنها؛ لذلك رفضت بيئة النشر التثبيت المجمد.

> رسالة العطل الأساسية: «importers in the lockfile don't match specs in package.json».

## الإصلاح المطبق

أُنشئ ملف قفل نظيف في بيئة معزولة باستخدام إصدار pnpm الموافق للمشروع، مع الاحتفاظ بتجاوز `tailwindcss>nanoid` وتصحيح `wouter@3.7.1`. ثم استُبدل `pnpm-lock.yaml` في جذر المشروع بالنسخة التي تسجل جميع تبعيات `package.json`، بما فيها `@capacitor-firebase/authentication` و`@capacitor-firebase/messaging` و`firebase`.

## التحقق

نجح التثبيت الصارم عبر:

```bash
CI=true pnpm install --frozen-lockfile --prefer-offline --prod=false
```

كما اجتازت النسخة 48 اختبار Vitest وبناء الإنتاج بنجاح. يجب إعادة النشر من أحدث نقطة حفظ بعد هذا الإصلاح؛ لا حاجة لتعديل أسرار البيئة أو إنشاء Dockerfile مخصص.
