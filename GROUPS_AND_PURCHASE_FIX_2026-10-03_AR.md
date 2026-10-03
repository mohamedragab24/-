# إصلاح مشاكل الشراء وإنشاء المجموعات — 3 أكتوبر 2026

## ما تم إصلاحه
1. صفحة المجموعات كانت تعرض زر إنشاء المجموعة فقط عندما `role === mufhem`، بينما الخادم يقبل أيضًا `mode === mofahhem` وحسابات الأدمن. تم توحيد الشرط.
2. دالة `createGroup` أصبحت تتحقق بوضوح من وجود ملف `users/{uid}` ومن صلاحية الحساب قبل الإنشاء، مع رسائل خطأ أوضح.
3. صفحة الشراء أصبحت تميز بين الدالة غير المنشورة، انتهاء تسجيل الدخول، وخطأ داخلي في Cloud Functions بدل عرض رسالة عامة فقط.
4. المشروع يحتوي أصلًا على `purchaseCourse` و`groups.js` ويتم تصدير دوال المجموعات من `functions/index.js` عبر `Object.assign(exports, require('./groups'))`.

## مهم جدًا بعد رفع النسخة
يجب نشر Cloud Functions من نفس نسخة المشروع، لأن تعديل الواجهة وحده لن ينشئ الدوال على Firebase.

الدوال الأساسية:
- purchaseCourse
- createGroup
- ensurePublicId
- sendGroupInvite
- respondGroupInvite
- registerGroupContent
- createGroupQuiz
- startGroupSession
- getGroupMeetingToken
- createGroupUploadUrl
- deleteGroup

المنطقة المستخدمة من الواجهة: `us-central1`.

## لو ظهر الخطأ بعد النشر
افتح Firebase Functions logs وابحث عن:
- `purchaseCourse`
- `createGroup`

لا تعتمد على رسالة المتصفح وحدها؛ سجل الدالة يعطي السبب الحقيقي.
