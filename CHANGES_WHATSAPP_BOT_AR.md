# بوت واتساب — 27 نوفمبر 2026

## اللي اتعمل
1) **بوت واتساب كامل** على WhatsApp Cloud API (ميتا مباشرة، بدون Twilio):
   - `src/server/functions/whatsapp.js`: التحقق من توقيع ميتا، إرسال الرسائل، منطق الردود،
     التحويل لموظف، حفظ المحادثات في Firestore.
   - `src/app/api/whatsapp/webhook/route.ts`: استقبال رسائل ميتا (تحقق GET + رسائل وحالات POST).
   - `src/app/api/whatsapp/send/route.ts`: رد الأدمن من اللوحة (توكن Firebase + فحص صلاحية أدمن).
   - `src/app/api/whatsapp/setup/route.ts`: فحص الإعداد واشتراك التطبيق في الـ WABA.
2) **صفحة جديدة في لوحة التحكم**: «بوت واتساب» (/admin/whatsapp):
   - قائمة المحادثات + بحث + فلتر (الكل / تحتاج موظف / البوت) + عدّاد غير مقروء.
   - محادثة كاملة مع الرد المباشر، وإيقاف/تشغيل البوت لكل محادثة على حدة.
   - إعدادات: تشغيل البوت، نصوص كل الردود، أسئلة إضافية، كلمات التحويل لموظف.
   - تاب «طريقة الربط» فيه خطوات ميتا والمتغيرات وزر فحص الإعداد.
3) **إشعارات**: التحويل لموظف والرد من الأدمن بيتسجلوا في `adminLogs` ويظهروا في صفحة إشعارات الأدمن.
4) **قواعد Firestore**: مجموعة `whatsappConversations` ورسائلها للأدمن فقط، والكتابة من السيرفر.
5) **دليل كامل بالعربي**: `WHATSAPP_BOT_SETUP_AR.md`.

## الردود الجاهزة
ترحيب + قائمة (كورسات/أسعار، حجز محاضرة، الدفع والمحفظة، مشاكل المحاضرات، الحساب، التحدث مع موظف)،
وكلمات مفتاحية عربي/مصري (سعر، بكام، حجز، محاضرة، دفع، محفظة، صوت، تسجيل، باسورد، موظف، شكوى...).

## النشر
1) ارفع النسخة على Vercel (فيها API routes جديدة فمحتاجة redeploy كامل).
2) ضيف متغيرات البيئة: WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID /
   WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_VERIFY_TOKEN / WHATSAPP_APP_SECRET.
3) افحص: /api/whatsapp/setup?key=<VERIFY_TOKEN>&subscribe=1
4) من ميتا: Webhook = https://fahemt.online/api/whatsapp/webhook + اشتراك في حقل messages.

## ملاحظات
- رقم واتساب ميتسجلش على Cloud API مش هيشتغل في تطبيق واتساب العادي.
- الردود من اللوحة مسموحة داخل 24 ساعة من آخر رسالة للعميل (قاعدة ميتا).

## إضافة (27 نوفمبر — بعد طلب المستخدم)
**كود تحقق OTP عبر واتساب**: `src/server/functions/whatsapp-otp.js`
- توليد 6 أرقام بـ crypto، تخزين هاش فقط، صلاحية 5 دقائق، 5 محاولات، 5 إرسالات/ساعة.
- إرسال بقالب معتمد (Utility أو Authentication) مع fallback لرسالة نصية.
- `sendWhatsappOtp` / `verifyWhatsappOtp` / `sendWhatsappOtpTest` على /api/fn،
  والتحقق بيرجّع `customToken` لدخول بدون SMS.
- تاب جديد في اللوحة «كود التحقق OTP» فيه شرح القالب وزر إرسال كود تجريبي.
- القالب المطلوب على ميتا ونصه بالعربي في WHATSAPP_BOT_SETUP_AR.md.
