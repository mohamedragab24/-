# إصلاح HTTP 308 لدوال المجموعات

تم ضبط `vercel.json` على `trailingSlash: false`، مع الإبقاء على `trailingSlash: false` و`skipTrailingSlashRedirect: true` في `next.config.ts`. مسار API المعتمد هو `POST /api/fn/<name>` بدون شرطة مائلة في النهاية.

## إعدادات النشر المطلوبة
1. في Vercel، اجعل `fahemt.online` هو **Primary Domain** أو اجعل التطبيق يستخدم الدومين الأساسي المعروض في إعدادات Domains. لا تترك الدومين الأساسي يعيد توجيه طلبات API إلى Preview.
2. في Firestore، افتح `settings` ثم المستند `app`، واجعل الحقل `apiBaseUrl` نصًا يساوي بالضبط `https://fahemt.online` (من دون مسار `/api` ومن دون `/` في النهاية).
3. أعد نشر منصة Next.js من هذا المشروع.
4. أعد بناء ونشر تطبيق Flutter المحدّث. أصبح يتبع تحويل `308/307` يدويًا مع الحفاظ على طريقة POST والبيانات، فقط إلى `fahemt.online` أو `www.fahemt.online` عبر HTTPS.

## الدوال المتأثرة
- `getGroupMediaUrl`
- `getGroupMeetingToken`

إذا استمر 308 بعد النشر، فهذا غالبًا تحويل على مستوى إعدادات Domains في Vercel قبل وصول الطلب إلى Next.js؛ راجع عنوان `Location` في الاستجابة واجعل التطبيق يستخدم الدومين الذي لا يعيد التوجيه.
