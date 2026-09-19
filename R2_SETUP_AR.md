# ربط Cloudflare R2 — فهمت / مسار

## التخزين
- R2 Account ID: `1201d096b2a689a6a247b53403b45bc0`
- Endpoint: `https://1201d096b2a689a6a247b53403b45bc0.r2.cloudflarestorage.com`
- Bucket: `fahmny-videos`

## مهم
التوكن الذي يبدأ بـ `cfat_` هو Cloudflare API Token وليس R2 S3 Access Key/Secret، لذلك لا يوضع في Flutter أو في كود الموقع.

أنشئ R2 API Token/Access Key بصلاحية Object Read & Write على bucket `fahmny-videos`، ثم استخدم:
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

ولا تضع Secret Access Key داخل التطبيق أو GitHub.

## Firebase Functions secrets
من مجلد `functions`/مشروع Firebase:

```bash
firebase functions:secrets:set R2_ACCOUNT_ID
firebase functions:secrets:set R2_ACCESS_KEY_ID
firebase functions:secrets:set R2_SECRET_ACCESS_KEY
firebase functions:secrets:set R2_BUCKET
```

القيم:
```text
R2_ACCOUNT_ID=1201d096b2a689a6a247b53403b45bc0
R2_BUCKET=fahmny-videos
```

ثم:
```bash
firebase deploy --only functions
```

## ماذا يفعل الربط؟
- صورة الغلاف: `courses/{courseId}/cover/...`
- فيديوهات الدروس: `courses/{courseId}/lessons/01/...`
- تسجيلات المحاضرات: `meetings/{requestId}/...mp4`
- Firebase Firestore يحتفظ ببيانات الكورس و`r2Key`.
- التطبيق لا يحصل على مفاتيح R2؛ يطلب رابط GET مؤقتًا من Firebase Function.
- رفع المتصفح يتم مباشرة إلى R2 بواسطة Presigned PUT URL.
- تسجيل JaaS يصل إلى webhook ثم يحفظ في R2 بدل Firebase Storage.

## بعد النشر
اختبر:
1. إنشاء كورس.
2. رفع صورة الغلاف.
3. رفع فيديو الدرس 1 و2.
4. حفظ الكورس.
5. التأكد من ظهور الملفات داخل `fahmny-videos`.
6. فتح الكورس من التطبيق وتشغيل الفيديو.
7. تشغيل محاضرة JaaS وتأكد أن التسجيل يظهر في `meetings/...`.

