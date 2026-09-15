# نظام كورسات Firebase ومراجعة الأدمن

## Firestore
- `courses/{courseId}`: بيانات الكورس وحالته `pending | published | rejected | withdrawn`.
- `courses/{courseId}/lessons/{lessonId}`: `storagePath`, `videoFileName`, `durationSeconds`, `lessonNumber`, `order`, `isPreview`.
- `courses/{courseId}/reviews/{reviewId}`: سجل المراجعة: المراجع، الوقت، القرار، وسبب الرفض.
- `purchases/{uid_courseId}`: سجل شراء لا يكتبه الطالب مباشرة.

## Storage
الملفات ترفع إلى:
- `courses/{courseId}/cover/...`
- `courses/{courseId}/lessons/01/...`

يجب نشر `storage.rules` مع قواعد Firestore.

## Cloud Functions
مشروع الـPlayer يحتوي على `purchaseCourse` و`getSignedVideoUrl`. انشر Functions من مشروع الـPlayer إلى نفس Firebase project، لأن `google-services.json` و`firebaseConfig` يشيران إلى المشروع نفسه.

## ملاحظات الأمان
- الكورس لا يصبح `published` إلا بقرار الأدمن.
- الدرس الأول فقط Preview.
- الدروس الأخرى تحتاج سجل شراء مكتمل.
- الفيديوهات في الـPlayer لا تُفتح برابط Storage دائم؛ يتم إصدار Signed URL قصيرة العمر من Cloud Function.
- `FLAG_SECURE` الحالي في Android لم يتم حذفه أو استبداله.
