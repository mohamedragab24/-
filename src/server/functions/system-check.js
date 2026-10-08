/**
 * فحص النظام (للأدمن فقط): يختبر فعليًا كل اتصال مهم ويرجع لكل فحص: الحالة + السبب + المطلوب للحل.
 * لا يرجع أي قيمة سرية (فقط أسماء المتغيرات وحالتها).
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { putObject, deleteObject } = require('./r2');
const { diagnose, envReport } = require('../diagnostics');

const isAdmin = async (request) => {
  const uid = request.auth?.uid;
  if (!uid) return false;
  const p = (await admin.firestore().collection('users').doc(uid).get()).data() || {};
  return request.auth.token?.admin === true || p.isAdmin === true || p.role === 'admin';
};

const run = async (checks, id, label, fn) => {
  const started = Date.now();
  try {
    const r = (await fn()) || {};
    checks.push({ id, label, status: r.status || 'ok', message: r.message || 'يعمل', cause: r.cause || '', fix: r.fix || '', ms: Date.now() - started });
  } catch (e) {
    const d = diagnose(e);
    checks.push({ id, label, status: 'fail', message: d.message, cause: d.cause, fix: d.fix, technical: d.technical, ms: Date.now() - started });
  }
};

exports.systemCheck = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'سجّل الدخول أولًا');
  if (!(await isAdmin(request))) throw new HttpsError('permission-denied', 'فحص النظام للمسؤول فقط');
  const checks = [];

  await run(checks, 'env', 'متغيرات البيئة في Vercel', async () => {
    const rep = envReport();
    const bad = rep.filter((r) => !r.present && !r.usesDefault);
    if (bad.length) return { status: 'fail', message: `ناقص: ${bad.map((b) => b.name).join(', ')}`, cause: 'هذه المتغيرات غير موجودة في Vercel (أو لم تعمل Redeploy بعد إضافتها).', fix: 'Vercel ← Settings ← Environment Variables ← أضفها واختر Production، ثم Deployments ← Redeploy.' };
    const dflt = rep.filter((r) => r.usesDefault);
    return { message: 'كل المتغيرات الإلزامية موجودة' + (dflt.length ? ` (تستخدم الافتراضي: ${dflt.map((d) => d.name).join(', ')})` : '') };
  });

  await run(checks, 'firebase', 'الاتصال بـ Firebase / Firestore', async () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
    let pid = '';
    try { pid = JSON.parse(raw).project_id || ''; } catch (_) {}
    await admin.firestore().collection('_health').doc('ping').get();
    return { message: `متصل بالمشروع ${pid || '(غير معروف)'}` };
  });

  await run(checks, 'r2', 'رفع/حذف ملف تجريبي في R2', async () => {
    const key = `_healthcheck/${Date.now()}.txt`;
    await putObject(key, Buffer.from('ok'), 'text/plain');
    await deleteObject(key);
    return { message: `الرفع والحذف يعملان على الـ bucket ${process.env.R2_BUCKET || 'fahmny-videos'}` };
  });

  await run(checks, 'jaas', 'مفتاح JaaS وإنشاء توكن الاجتماع', async () => {
    const appId = process.env.JAAS_APP_ID || 'vpaas-magic-cookie-4ddd1f4050174a1b89a6ce9a82ade034';
    const keyId = process.env.JAAS_KEY_ID || '09cb60';
    const pk = process.env.JAAS_PRIVATE_KEY;
    if (!pk) return { status: 'fail', message: 'JAAS_PRIVATE_KEY غير موجود', cause: 'المتغير غير مضبوط.', fix: 'JaaS Console ← API Keys ← أنشئ مفتاحًا وألصق ملف .pk كاملًا في JAAS_PRIVATE_KEY ثم Redeploy.' };
    const pem = pk.replace(/\\n/g, '\n');
    crypto.createPrivateKey(pem); // يرمي خطأ لو غير صالح
    jwt.sign({ aud: 'jitsi', iss: 'chat', sub: appId, room: '*' }, pem, { algorithm: 'RS256', keyid: keyId, expiresIn: 60 });
    if (!/^vpaas-magic-cookie-[0-9a-f]{32}$/i.test(appId)) return { status: 'warn', message: 'المفتاح سليم لكن JAAS_APP_ID شكله غير معتاد', cause: 'قيمة appId لا تطابق الصيغة vpaas-magic-cookie-<32 حرفًا>.', fix: 'انسخ App ID من JaaS Console بدون مسافات.' };
    return { message: `المفتاح صالح (Key ID: ${keyId})، ويمكن إنشاء توكن. تذكّر أن الـ Key ID يجب أن يكون لنفس المفتاح.` };
  });

  await run(checks, 'webhook', 'سر Webhook التسجيلات', async () => {
    const s = process.env.JAAS_WEBHOOK_SECRET || '';
    if (!s) return { status: 'fail', message: 'JAAS_WEBHOOK_SECRET غير موجود', cause: 'لن يقبل السيرفر أي حدث تسجيل.', fix: 'أضف قيمة عشوائية طويلة (openssl rand -hex 32) وضعها في رابط Webhook داخل JaaS Console.' };
    if (s.length < 16) return { status: 'warn', message: 'السر قصير', cause: 'سر أقصر من 16 حرفًا سهل التخمين.', fix: 'استبدله بقيمة عشوائية من 32 حرفًا أو أكثر.' };
    return { message: 'مضبوط (تأكد أن نفس القيمة في رابط JaaS Console)' };
  });

  await run(checks, 'payments', 'مزودو الدفع المقبولون', async () => {
    const snap = await admin.firestore().collection('paymentProviders').get();
    const active = snap.docs.filter((d) => d.data()?.enabled !== false);
    if (!snap.size) return { status: 'warn', message: 'لا يوجد مزودون بعد', cause: 'الجدول فارغ (يُزرع تلقائيًا عند أول فتح لتبويب المزودين المقبولين).', fix: 'افتح /admin/payment-review ← تبويب «المزودون المقبولون» مرة واحدة.' };
    if (!active.length) return { status: 'fail', message: 'كل المزودين معطّلون', cause: 'أي رسالة دفع ستُرفض.', fix: 'فعّل مزودًا واحدًا على الأقل من تبويب «المزودون المقبولون».' };
    return { message: `${active.length} مزود مفعّل من ${snap.size}` };
  });

  await run(checks, 'vercel', 'بيئة التشغيل', async () => {
    const env = process.env.VERCEL_ENV || 'غير Vercel';
    return { message: `البيئة: ${env}. ملاحظة: الخطة المجانية تقطع أي عملية بعد 60 ثانية (يؤثر على رفع التسجيلات الكبيرة).` };
  });

  const failed = checks.filter((c) => c.status === 'fail').length;
  return { ok: failed === 0, failed, warnings: checks.filter((c) => c.status === 'warn').length, checks, at: Date.now() };
});
