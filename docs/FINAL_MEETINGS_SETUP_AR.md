# تكملة نظام المحاضرات

المنصة تستخدم نفس `istifhams/{requestId}` و`meetingTime`، والتطبيق يدخل إلى `fahmny://meeting/{requestId}`.

لا تضع JaaS Private Key في الويب. توليد JWT يتم في Firebase Cloud Functions.

بعد نشر Functions، يجب أن تكون وظيفة `getJaasMeetingToken` متاحة للتطبيق والمنصة.
