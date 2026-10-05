/**
 * بديل محلي لـ firebase-functions: يسمح بتشغيل نفس كود الدوال (onCall) داخل Vercel
 * بدون خطة Blaze. الـ triggers والجداول الزمنية لا تعمل هنا (تُسجَّل فقط).
 */
class HttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
const onCall = (a, b) => ({ __callable: true, handler: typeof a === 'function' ? a : b });
const trigger = () => ({ __trigger: true });
const schedule = () => ({ __schedule: true });
module.exports = {
  https: { onCall, HttpsError, onRequest: trigger },
  firestore: { onDocumentCreated: trigger, onDocumentUpdated: trigger, onDocumentWritten: trigger },
  scheduler: { onSchedule: schedule },
};
