/**
 * تحديثات التطبيق (APK): رفع من لوحة التحكم إلى R2، ونشر التحديث، وتنزيله داخل التطبيق.
 * المستند: appUpdates/{id} = { versionName, versionCode, title, description, mandatory, active,
 *   apkKey, apkSize, apkName, createdAt, createdBy }
 * التطبيق يقارن versionCode (رقم الـ build) بأعلى تحديث مفعّل.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const { presignedUrl, deleteObject } = require('./r2');
const { pushToAll } = require('./push');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const R2_SECRETS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const MAX_APK = 500 * 1024 * 1024; // 500MB
const APK_TYPE = 'application/vnd.android.package-archive';
// نسخة APK لكل معمارية معالج: يحمّل الجهاز النسخة المناسبة له فقط (أصغر بكثير من APK الشامل)
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'universal'];
const validKey = (k) => typeof k === 'string' && k.startsWith('app-updates/') && !k.includes('..');

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  if (!(request.auth.token?.admin === true || p.isAdmin === true || p.role === 'admin')) {
    throw new HttpsError('permission-denied', 'ليس لديك صلاحية الأدمن');
  }
  return uid;
}

/** رابط رفع مؤقت (PUT) مباشر إلى R2 لملف APK — للأدمن فقط. */
exports.createAppUpdateUploadUrl = onCall({ secrets: R2_SECRETS }, async (request) => {
  await requireAdmin(request);
  const fileName = String(request.data?.fileName || 'app.apk');
  const size = Number(request.data?.size || 0);
  if (!/\.apk$/i.test(fileName)) throw new HttpsError('invalid-argument', 'الملف لازم يكون بصيغة APK');
  if (size > MAX_APK) throw new HttpsError('invalid-argument', 'الحد الأقصى لحجم الـ APK هو 500 ميجا');
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'app.apk';
  const key = `app-updates/${Date.now()}_${safe}`;
  const signed = presignedUrl({ method: 'PUT', key, expiresSeconds: 3600, contentType: APK_TYPE });
  return { ...signed, key, contentType: APK_TYPE };
});

/** نشر تحديث بعد اكتمال رفع الـ APK. */
exports.publishAppUpdate = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const d = request.data || {};
  const versionName = String(d.versionName || '').trim().slice(0, 30);
  const versionCode = Math.floor(Number(d.versionCode));
  const title = String(d.title || '').trim().slice(0, 120);
  const description = String(d.description || '').trim().slice(0, 3000);
  // apks: [{ abi, key, name, size }]  (أو apkKey القديم لملف واحد)
  const apks = {};
  for (const a of Array.isArray(d.apks) ? d.apks : []) {
    const abi = String(a?.abi || '');
    if (!ABIS.includes(abi) || !validKey(String(a?.key || ''))) throw new HttpsError('invalid-argument', 'ملف APK غير صحيح');
    apks[abi] = { key: String(a.key), name: String(a.name || '').slice(0, 120), size: Math.max(0, Math.floor(Number(a.size || 0))) };
  }
  if (!Object.keys(apks).length && validKey(String(d.apkKey || ''))) {
    apks.universal = { key: String(d.apkKey), name: String(d.apkName || '').slice(0, 120), size: Math.max(0, Math.floor(Number(d.apkSize || 0))) };
  }
  if (!Object.keys(apks).length) throw new HttpsError('invalid-argument', 'ارفع ملف APK واحدًا على الأقل');
  const primary = apks['arm64-v8a'] || apks.universal || Object.values(apks)[0];
  const apkKey = primary.key;
  if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) throw new HttpsError('invalid-argument', 'اكتب اسم الإصدار ورقم الإصدار (build) بشكل صحيح');
  if (!title) throw new HttpsError('invalid-argument', 'اكتب عنوان التحديث');
  const dup = await db.collection('appUpdates').where('versionCode', '==', versionCode).limit(1).get();
  if (!dup.empty) throw new HttpsError('already-exists', `يوجد تحديث بنفس رقم الإصدار ${versionCode} بالفعل`);
  const ref = db.collection('appUpdates').doc();
  await ref.set({
    versionName, versionCode, title, description,
    mandatory: d.mandatory === true, active: true,
    imageUrl: String(d.imageUrl || '').trim().slice(0, 1000),
    apks, apkKey, apkName: primary.name, apkSize: primary.size,
    createdBy: uid, createdAt: FV.serverTimestamp(),
  });
  // إشعار Push لكل المستخدمين في شريط الهاتف: العنوان + الوصف + الصورة (لا يفشل النشر لو فشل الإرسال)
  let push = null;
  if (d.notify !== false) {
    const firstLines = description.replace(/\s+/g, ' ').trim();
    const body = firstLines ? firstLines.slice(0, 180) : `الإصدار ${versionName} متاح الآن، افتح التطبيق للتحديث.`;
    try {
      push = await pushToAll({
        title, body, imageUrl: String(d.imageUrl || '').trim(),
        data: { type: 'app_update', updateId: ref.id, mandatory: d.mandatory === true, versionCode },
      });
      await ref.update({ pushSent: push.sent, pushFailed: push.failed, pushDevices: push.devices, pushAt: FV.serverTimestamp() });
    } catch (e) { console.error('update push failed', e); push = { error: String(e?.message || e).slice(0, 200) }; }
  }
  return { ok: true, id: ref.id, push };
});

/** حذف تحديث + ملف الـ APK من R2. */
exports.deleteAppUpdate = onCall({ secrets: R2_SECRETS }, async (request) => {
  await requireAdmin(request);
  const id = String(request.data?.id || '').trim();
  if (!id) throw new HttpsError('invalid-argument', 'معرف التحديث مطلوب');
  const ref = db.collection('appUpdates').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'التحديث غير موجود');
  const data = snap.data() || {};
  const keys = new Set([String(data.apkKey || ''), ...Object.values(data.apks || {}).map((a) => String(a?.key || ''))]);
  for (const key of keys) {
    if (validKey(key)) { try { await deleteObject(key); } catch (e) { console.error('delete apk failed', e); } }
  }
  await ref.delete();
  return { ok: true };
});

/** رابط تنزيل مؤقت للـ APK — بدون تسجيل دخول (التحديث الإجباري يظهر قبل الدخول). */
exports.getAppUpdateDownloadUrl = onCall({ secrets: R2_SECRETS }, async (request) => {
  const id = String(request.data?.id || '').trim();
  if (!id) throw new HttpsError('invalid-argument', 'معرف التحديث مطلوب');
  const snap = await db.collection('appUpdates').doc(id).get();
  if (!snap.exists || snap.data()?.active !== true) throw new HttpsError('not-found', 'التحديث غير متاح');
  const data = snap.data() || {};
  const apks = data.apks || {};
  const wanted = (Array.isArray(request.data?.abis) ? request.data.abis : []).map(String);
  // أول معمارية يدعمها الجهاز وعندنا لها ملف، ثم الشامل، ثم الملف القديم
  const hit = wanted.find((a) => apks[a]?.key) || (apks.universal?.key ? 'universal' : '');
  const key = hit ? String(apks[hit].key) : String(data.apkKey || '');
  if (!validKey(key)) throw new HttpsError('failed-precondition', 'ملف التحديث غير متاح لهذا الجهاز');
  const size = hit ? Number(apks[hit].size || 0) : Number(data.apkSize || 0);
  const signed = presignedUrl({ method: 'GET', key, expiresSeconds: 3600 });
  return { url: signed.url, expiresAtMs: signed.expiresAtMs, abi: hit || 'universal', size };
});
