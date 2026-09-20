# إعداد CORS لـ Cloudflare R2

خطأ رفع الصورة/الفيديو من المتصفح غالبًا يظهر إذا كان Bucket الخاص بـR2 لا يسمح بطلبات PUT من دومين المنصة.

## الإعداد

في Cloudflare Dashboard افتح:

**R2 → Buckets → fahmny-videos → Settings → CORS Policy**

ضع محتوى الملف `r2-cors.json` الموجود في جذر المشروع، أو أضف نفس القيم يدويًا.

يجب أن يكون دومين المنصة الحالي موجودًا ضمن `AllowedOrigins`، ويمكن إضافة دومين Vercel الجديد إذا تغير رابط النشر.

بعد حفظ CORS، أعد تجربة رفع صورة غلاف ثم فيديو.

## مهم

لا تضع R2 Access Key أو Secret Access Key داخل Flutter أو JavaScript المتصفح. الـBrowser يحصل فقط على Presigned PUT URL من Firebase Function.

يجب أن تكون Firebase Functions منشورة ومعها Secrets التالية:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` = `fahmny-videos`
