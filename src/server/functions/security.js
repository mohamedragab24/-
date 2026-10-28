/**
 * أمان الحساب:
 *  - كود تأكيد تغيير كلمة المرور (إيميل أو رقم الهاتف) لمن نسي كلمته الحالية.
 *  - قفل الجهاز: الحساب يعمل على جهاز واحد فقط داخل التطبيق (والأدمن يقدر يفك القفل).
 * أسرار الإرسال تأتي من متغيرات البيئة في Vercel (لا تُكتب في الكود):
 *   INFOBIP_API_KEY (يبدأ بـ "App ...") ، INFOBIP_BASE_URL (مثال: xxxx.api.infobip.com)
 *   INFOBIP_EMAIL_FROM ، INFOBIP_WHATSAPP_FROM
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const reqUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  return uid;
};
const isAdminReq = async (request) => {
  const uid = request.auth?.uid;
  if (!uid) return false;
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  return request.auth.token?.admin === true || p.isAdmin === true || p.role === 'admin';
};
/** IP العام كما يصل للخادم (من x-forwarded-for الذي تضيفه Vercel)؛ لا نعتمد على IP يرسله التطبيق. */
const serverIp = (request) => {
  const h = request.rawRequest?.headers;
  const get = (k) => (h && typeof h.get === 'function' ? h.get(k) : h?.[k]) || '';
  return String(get('x-forwarded-for') || '').split(',')[0].trim() || String(get('x-real-ip') || '').trim();
};
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ---------------------------------------------------------------- إرسال الأكواد
async function sendViaInfobip({ channel, to, text, subject }) {
  const key = String(process.env.INFOBIP_API_KEY || '').trim();
  const base = String(process.env.INFOBIP_BASE_URL || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!key || !base) {
    throw new HttpsError('failed-precondition', 'خدمة إرسال الأكواد غير مضبوطة على الخادم', {
      cause: 'ناقص في Vercel: ' + [!key && 'INFOBIP_API_KEY', !base && 'INFOBIP_BASE_URL'].filter(Boolean).join(', ') + '.',
      fix: 'أضف المتغيرات في Vercel ← Settings ← Environment Variables ثم Redeploy.',
    });
  }
  const auth = key.startsWith('App ') ? key : `App ${key}`;
  if (channel === 'email') {
    const form = new FormData();
    form.append('from', String(process.env.INFOBIP_EMAIL_FROM || '').trim());
    form.append('to', to);
    form.append('subject', subject);
    form.append('text', text);
    const res = await fetch(`https://${base}/email/3/send`, { method: 'POST', headers: { Authorization: auth, Accept: 'application/json' }, body: form });
    if (!res.ok) throw new HttpsError('unavailable', 'تعذر إرسال البريد الآن، حاول بعد قليل');
    return;
  }
  const res = await fetch(`https://${base}/whatsapp/1/message/text`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ from: String(process.env.INFOBIP_WHATSAPP_FROM || '').trim(), to: to.replace(/\D/g, ''), content: { text } }),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  const rejected = data?.messages?.[0]?.status?.groupName === 'REJECTED';
  if (!res.ok || rejected) throw new HttpsError('unavailable', 'تعذر إرسال الرسالة على الرقم، حاول بعد قليل');
}

const maskEmail = (e) => { const [u, d] = String(e).split('@'); return u && d ? `${u.slice(0, 2)}***@${d}` : '***'; };
const maskPhone = (p) => { const s = String(p).replace(/\D/g, ''); return s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : '****'; };

/** يرسل كود تأكيد (6 أرقام) لتغيير كلمة المرور. data: { channel: 'email' | 'phone' } */
exports.requestPasswordChangeCode = onCall(async (request) => {
  const uid = reqUid(request);
  const channel = request.data?.channel === 'phone' ? 'phone' : 'email';
  const u = (await db.collection('users').doc(uid).get()).data() || {};
  const authUser = await admin.auth().getUser(uid);
  const email = String(u.email || authUser.email || '').trim().toLowerCase();
  const phone = String(u.phone || u.phoneNumber || authUser.phoneNumber || '').trim();
  const to = channel === 'email' ? email : phone;
  if (!to) throw new HttpsError('failed-precondition', channel === 'email' ? 'لا يوجد بريد إلكتروني على حسابك' : 'لا يوجد رقم هاتف على حسابك');

  const ref = db.collection('passwordChangeCodes').doc(uid);
  const prev = (await ref.get()).data() || {};
  if (prev.sentAtMs && Date.now() - prev.sentAtMs < 60 * 1000) throw new HttpsError('resource-exhausted', 'انتظر دقيقة قبل طلب كود جديد');

  const code = String(crypto.randomInt(100000, 1000000));
  await sendViaInfobip({
    channel,
    to,
    subject: 'كود تغيير كلمة المرور - فهمت',
    text: `كود تأكيد تغيير كلمة المرور في منصة فهمت: ${code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
  });
  // نخزّن الـ hash فقط (لا نخزّن الكود نفسه ولا نرجعه للعميل)
  await ref.set({ hash: sha(`${uid}:${code}`), expiresAtMs: Date.now() + 10 * 60 * 1000, attempts: 0, channel, sentAtMs: Date.now() });
  return { ok: true, channel, sentTo: channel === 'email' ? maskEmail(to) : maskPhone(to) };
});

/** يتحقق من الكود ثم يغيّر كلمة المرور. data: { code, newPassword } */
exports.confirmPasswordChangeWithCode = onCall(async (request) => {
  const uid = reqUid(request);
  const code = String(request.data?.code || '').trim();
  const newPassword = String(request.data?.newPassword || '');
  if (newPassword.length < 6) throw new HttpsError('invalid-argument', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  const ref = db.collection('passwordChangeCodes').doc(uid);
  const d = (await ref.get()).data();
  if (!d) throw new HttpsError('failed-precondition', 'اطلب كود تأكيد أولًا');
  if (Date.now() > Number(d.expiresAtMs || 0)) { await ref.delete(); throw new HttpsError('deadline-exceeded', 'انتهت صلاحية الكود، اطلب كودًا جديدًا'); }
  if (Number(d.attempts || 0) >= 5) { await ref.delete(); throw new HttpsError('resource-exhausted', 'محاولات كثيرة خاطئة، اطلب كودًا جديدًا'); }
  const okCode = d.hash && crypto.timingSafeEqual(Buffer.from(String(d.hash)), Buffer.from(sha(`${uid}:${code}`)));
  if (!okCode) {
    await ref.update({ attempts: FV.increment(1) });
    throw new HttpsError('permission-denied', 'الكود غير صحيح');
  }
  await admin.auth().updateUser(uid, { password: newPassword });
  await ref.delete();
  return { ok: true };
});

// ---------------------------------------------------------------- قفل الجهاز الواحد
/**
 * data: { deviceId, fingerprint, deviceName }
 * - أول جهاز يسجّل الدخول يُحجز له الحساب.
 * - جهاز آخر → يُرفض بكود device-locked (التطبيق يخرّج المستخدم ويعرض الرسالة).
 * - نفس الجهاز يُعرَف بالمعرّف المحفوظ أو ببصمة الجهاز (تسمح بإعادة تثبيت التطبيق على نفس الهاتف).
 */
exports.claimDeviceSession = onCall(async (request) => {
  const uid = reqUid(request);
  const deviceId = String(request.data?.deviceId || '').slice(0, 80);
  const fingerprint = String(request.data?.fingerprint || '').slice(0, 200);
  const deviceName = String(request.data?.deviceName || '').slice(0, 80);
  if (!deviceId) throw new HttpsError('invalid-argument', 'معرّف الجهاز مفقود');
  const ip = serverIp(request);
  const ref = db.collection('deviceLocks').doc(uid);
  let result = 'ok';
  let blocked = null;
  try {
    const out = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) {
        t.set(ref, { deviceId, fingerprint, deviceName, lockedAt: FV.serverTimestamp(), lastSeenAt: FV.serverTimestamp(), lastIp: ip });
        return { ok: true, first: true };
      }
      const d = snap.data() || {};
      const same = d.deviceId === deviceId || (fingerprint && d.fingerprint && d.fingerprint === fingerprint);
      if (!same) { blocked = d; return null; }
      t.update(ref, { deviceId, lastSeenAt: FV.serverTimestamp(), lastIp: ip });
      return { ok: true, first: false };
    });
    if (out) {
      // آخر IP رصده الخادم + تاريخه ضمن بيانات الأمان
      await db.collection('users').doc(uid).set({ security: { lastIp: ip, lastIpAt: FV.serverTimestamp(), lastDeviceName: deviceName } }, { merge: true });
    }
    if (!out) result = 'blocked';
    if (out) { await db.collection('loginAttempts').add({ uid, deviceId, deviceName, ip, result, at: FV.serverTimestamp() }); return out; }
  } catch (e) { throw e; }
  await db.collection('loginAttempts').add({ uid, deviceId, deviceName, ip, result: 'blocked', at: FV.serverTimestamp() });
  // كود مخصص device-locked: التطبيق يعرض شاشة «طلب تغيير الجهاز»
  throw new HttpsError('device-locked', `هذا الحساب مسجّل على جهاز آخر (${blocked?.deviceName || 'جهاز آخر'}). يمكنك إرسال طلب لنقل الحساب لجهازك الجديد وستراجعه الإدارة.`);
});

/** المستخدم (مسجّل دخول لكنه محجوب) يرسل طلبًا رسميًا لاعتماد جهازه الجديد. data: { deviceId, fingerprint, deviceName, reason } */
exports.requestDeviceChange = onCall(async (request) => {
  const uid = reqUid(request);
  const deviceId = String(request.data?.deviceId || '').slice(0, 80);
  const fingerprint = String(request.data?.fingerprint || '').slice(0, 200);
  const deviceName = String(request.data?.deviceName || '').slice(0, 80);
  const reason = String(request.data?.reason || '').trim().slice(0, 500);
  if (!deviceId) throw new HttpsError('invalid-argument', 'معرّف الجهاز مفقود');
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'اكتب سبب طلب تغيير الجهاز (فقدان الجهاز، تغيير الهاتف...)');
  const open = await db.collection('deviceChangeRequests').where('uid', '==', uid).where('status', '==', 'pending').get();
  if (!open.empty) throw new HttpsError('already-exists', 'لديك طلب قيد المراجعة بالفعل');
  const u = (await db.collection('users').doc(uid).get()).data() || {};
  const lock = (await db.collection('deviceLocks').doc(uid).get()).data() || {};
  const ref = await db.collection('deviceChangeRequests').add({
    uid, name: String(u.name || u.fullName || ''), email: String(u.email || ''), phone: String(u.phone || ''), publicId: String(u.publicId || ''),
    newDeviceId: deviceId, newFingerprint: fingerprint, newDeviceName: deviceName, currentDeviceName: String(lock.deviceName || ''),
    reason, ip: serverIp(request), status: 'pending', createdAt: FV.serverTimestamp(),
  });
  return { ok: true, requestId: ref.id };
});

/** حالة آخر طلب لتغيير الجهاز (للمستخدم). */
exports.getDeviceRequestStatus = onCall(async (request) => {
  const uid = reqUid(request);
  const snap = await db.collection('deviceChangeRequests').where('uid', '==', uid).get(); // بدون orderBy لتفادي فهرس مركّب
  if (snap.empty) return { status: 'none' };
  const latest = snap.docs.map((x) => x.data()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];
  return { status: latest.status, note: latest.decisionNote || '' };
});

/** الأدمن: قبول/رفض طلب جهاز جديد. القبول يعتمد الجهاز الجديد (ويُسجَّل القرار والتاريخ والجهاز المعتمد). */
exports.adminDecideDeviceRequest = onCall(async (request) => {
  const adminUid = reqUid(request);
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const id = String(request.data?.requestId || '').trim();
  const approve = request.data?.approve === true;
  const note = String(request.data?.note || '').trim().slice(0, 300);
  const rRef = db.collection('deviceChangeRequests').doc(id);
  const r = (await rRef.get()).data();
  if (!r) throw new HttpsError('not-found', 'الطلب غير موجود');
  if (r.status !== 'pending') throw new HttpsError('failed-precondition', 'تمت معالجة الطلب من قبل');
  if (!approve && !note) throw new HttpsError('invalid-argument', 'اكتب سبب الرفض');
  const batch = db.batch();
  batch.update(rRef, { status: approve ? 'approved' : 'rejected', decisionNote: note, decidedBy: adminUid, decidedAt: FV.serverTimestamp() });
  if (approve) {
    batch.set(db.collection('deviceLocks').doc(r.uid), {
      deviceId: r.newDeviceId, fingerprint: r.newFingerprint, deviceName: r.newDeviceName,
      approvedBy: adminUid, approvedAt: FV.serverTimestamp(), requestId: id, lastSeenAt: FV.serverTimestamp(),
    });
  }
  batch.set(db.collection('deviceEvents').doc(), { uid: r.uid, type: approve ? 'device_approved' : 'device_rejected', requestId: id, deviceName: r.newDeviceName, adminUid, note, at: FV.serverTimestamp() });
  await batch.commit();
  return { ok: true };
});

/** للأدمن: فك ربط الحساب بالجهاز (عند تغيير الهاتف). data: { uid } */
exports.adminResetDeviceLock = onCall(async (request) => {
  reqUid(request);
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const target = String(request.data?.uid || '').trim();
  if (!target) throw new HttpsError('invalid-argument', 'المستخدم غير محدد');
  await db.collection('deviceLocks').doc(target).delete();
  try { await admin.auth().revokeRefreshTokens(target); } catch (e) { console.error('revoke tokens failed', e); } // إلغاء الجلسات الحالية
  await db.collection('deviceEvents').add({ uid: target, type: 'device_revoked', adminUid: request.auth.uid, at: FV.serverTimestamp() });
  await db.collection('adminLogs').add({ action: 'device_lock_reset', targetUid: target, adminUid: request.auth.uid, timestamp: FV.serverTimestamp() });
  return { ok: true };
});

/** تحويل الحساب بين مُفهم ومُستفهم: يُحدّث role وmode وaccountType معًا. data: { role: 'mufhem' | 'mustafhem' } */
exports.switchAccountMode = onCall(async (request) => {
  const uid = reqUid(request);
  const role = request.data?.role === 'mufhem' ? 'mufhem' : 'mustafhem';
  const ref = db.collection('users').doc(uid);
  const cur = (await ref.get()).data() || {};
  if (cur.role === 'admin') throw new HttpsError('failed-precondition', 'حساب الأدمن لا يُحوَّل');
  await ref.set({ role, mode: role === 'mufhem' ? 'mofahhem' : 'mostafhem', accountType: role === 'mufhem' ? 'mofahhem' : 'mostafhem', updatedAt: FV.serverTimestamp() }, { merge: true });
  return { ok: true, role };
});
