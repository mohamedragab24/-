# Cloudflare Worker — فهمت / Fahmny

هذا الـWorker يربط المنصة وJaaS بــ Cloudflare R2 بدون وضع مفاتيح R2 داخل الموقع أو التطبيق.

## المسارات
- `GET /` فحص الاتصال.
- `PUT /courses/...` رفع صورة/فيديو الكورس.
- `GET /courses/...` قراءة/تشغيل الملف.
- `POST /__jaas/recording` استقبال Webhook التسجيل من JaaS وحفظ MP4 في `meetings/{requestId}/...`.
- `DELETE /...` حذف ملف؛ إذا تم ضبط `DELETE_SECRET` يجب إرسال `X-R2-Delete-Secret`.

## الربط
يجب أن يكون R2 binding باسم `R2_BUCKET` ومربوطًا بالـbucket `fahmny-videos`.

## JaaS
إذا كان JaaS قادرًا على استدعاء Webhook مباشرة، استخدم:
`https://fahmny-r2.mohamedragabewiess.workers.dev/__jaas/recording`

إذا كنت تستخدم Firebase Function كـWebhook، النسخة المعدلة من المنصة تمرر الحدث إلى نفس المسار ولا تحتاج R2 S3 secrets.

> ملاحظة أمنية: مسار PUT الحالي مفتوح. قبل فتح الرفع للعامة، يجب إضافة طبقة تحقق للمستخدم/المدير أو جعل Worker يقبل الرفع من مسار موثوق فقط. لا تضع R2 Secret Access Key في المتصفح.
