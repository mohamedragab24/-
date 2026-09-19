# إعداد JaaS لمحاضرات فهمت

> مهم: لا تضع Private Key داخل التطبيق أو GitHub. المفتاح الذي تم إرساله في المحادثة يجب تدويره وإنشاء مفتاح جديد.

## 1) Secrets في Firebase Functions

من مجلد `functions`:

```bash
firebase functions:secrets:set JAAS_PRIVATE_KEY
firebase functions:secrets:set JAAS_KEY_ID
firebase functions:secrets:set JAAS_WEBHOOK_SECRET
```

- `JAAS_PRIVATE_KEY`: المفتاح الخاص الجديد من JaaS.
- `JAAS_KEY_ID`: `09cb60` (تمت إضافته كقيمة افتراضية في النسخة).
- `JAAS_WEBHOOK_SECRET`: السر الموجود في JaaS Console > Webhooks > Reveal secret.

## 2) النشر

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## 3) Webhook

بعد النشر استخدم رابط Function:

`https://<region>-<project-id>.cloudfunctions.net/jaasRecordingWebhook`

وفي JaaS Console أضف Webhook بهذا الرابط، وفعل:

- `RECORDING_STARTED`
- `RECORDING_ENDED`
- `RECORDING_UPLOADED`

بعدها ضع الـWebhook Secret في Firebase Secret `JAAS_WEBHOOK_SECRET`.

## 4) ماذا يحدث؟

- التطبيق يطلب JWT قصير المدة من `getJaasMeetingToken`.
- المُفهّم يحصل على صلاحية التسجيل.
- المستفهم يدخل كمشارك ولا يحصل على صلاحية التسجيل.
- عند `RECORDING_UPLOADED` يتم تنزيل MP4 من رابط JaaS المؤقت وتخزينه في Firebase Storage.
- يتم حفظ بيانات التسجيل في `meetingRecordings`.

## 5) الإشعارات

التطبيق يسجل FCM token في:

`users/{uid}/devices/{token}`

ومن لوحة الأدمن يمكن إرسال إشعار فوري أو جدولة إشعار عبر Cloud Functions.

## 6) ملاحظة الحماية

Android يستخدم `FLAG_SECURE` لمنع Screenshot وتسجيل الشاشة المدعوم من النظام. لا يمكن منع تصوير الشاشة بكاميرا خارجية.

## بيانات JaaS المضافة للنسخة

- App ID: `vpaas-magic-cookie-4ddd1f4050174a1b89a6ce9a82ade034`
- Key ID: `09cb60`

لا يتم تضمين Private Key داخل التطبيق أو ملفات المصدر. يجب وضعه كـFirebase Secret باسم `JAAS_PRIVATE_KEY`.
