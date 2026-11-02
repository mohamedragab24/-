/**
 * تسجيل الجلسات من جهاز صاحبها (تطبيق أندرويد) ورفعها إلى Cloudflare R2:
 *  - createRecordingUploadUrl: رابط رفع مؤقت بمفتاح ثابت (إعادة الرفع تستبدل الملف فلا تتكرر التسجيلات).
 *  - completeClientRecording:  يتحقق أن الملف وصل R2 فعلًا (HEAD) ثم يضع الحالة «جاهز».
 *  - failClientRecording:      يسجّل سبب الفشل ليظهر في لوحة الإدارة.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const { presignedUrl } = require('./r2');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const DAY = 24 * 60 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const reqUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  return uid;
};
const isAdminUid = async (uid) => {
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  return p.isAdmin === true || p.role === 'admin';
};

/** قاعدة بيانات تسجيل جلسة الاستفهام (موافقات الطرفين + مدد الاحتفاظ). */
function buildIstifhamRecordingBase(r, requestId, now = Date.now()) {
  const ret = r.retention || {};
  const agreed = ret.mustafhem && ret.mufhem && ret.mustafhem === ret.mufhem ? Number(ret.mustafhem) : 0;
  return {
    requestId, sessionId: requestId, mustafhemId: r.mustafhemId, mufhemId: r.mufhemId, participants: [r.mustafhemId, r.mufhemId].filter(Boolean),
    title: String(r.title || ''),
    startedAtMs: Number(r.recordingStartedAtMs || 0), endedAtMs: now, complaint: false,
    adminExpiresAt: now + 2 * DAY, // للإدارة فقط: يومان ثم حذف تلقائي (14 يومًا كحد أقصى لو فيه شكوى)
    studentSaveDays: agreed, studentExpiresAt: agreed ? now + agreed * DAY : 0,
    consent: { mustafhem: { days: ret.mustafhem || 0, at: r.retentionAt?.mustafhem || 0 }, mufhem: { days: ret.mufhem || 0, at: r.retentionAt?.mufhem || 0 } },
  };
}

/** يحدد نوع التسجيل ويتحقق من الصلاحية ويرجع { kind, key, ... }. */
async function resolveTarget(uid, data, { requireActive = false } = {}) {
  const kind = data?.kind === 'istifham' ? 'istifham' : 'group';
  if (kind === 'istifham') {
    const requestId = String(data?.requestId || '').trim();
    if (!requestId) throw new HttpsError('invalid-argument', 'الجلسة غير محددة');
    const ref = db.collection('istifhams').doc(requestId);
    const r = (await ref.get()).data();
    if (!r) throw new HttpsError('not-found', 'المحاضرة غير موجودة');
    if (uid !== r.mufhemId && uid !== r.mustafhemId && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'لست من أطراف هذه المحاضرة');
    return { kind, requestId, ref, r, key: `sessions/${requestId}/${requestId}.mp4` };
  }
  // مجموعة: من يملك صلاحية إدارة الجلسات
  const gid = String(data?.groupId || '').trim();
  const sid = String(data?.sessionId || '').trim();
  if (!gid || !sid) throw new HttpsError('invalid-argument', 'الجلسة غير محددة');
  const ref = db.collection('groups').doc(gid);
  const g = (await ref.get()).data();
  if (!g) throw new HttpsError('not-found', 'المجموعة غير موجودة');
  let allowed = g.ownerUid === uid;
  if (!allowed) {
    const m = (await ref.collection('members').doc(uid).get()).data();
    allowed = !!(m && m.role === 'editor' && m.permissions && m.permissions.manageSessions === true);
  }
  if (!allowed && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'غير مسموح برفع تسجيل هذه الجلسة');
  return { kind, gid, sid, ref, g, key: `groups/${gid}/recordings/${sid}.mp4` };
}

exports.createRecordingUploadUrl = onCall(async (request) => {
  const uid = reqUid(request);
  const t = await resolveTarget(uid, request.data);
  const size = Math.max(0, Math.floor(Number(request.data?.size || 0)));
  if (size > MAX_BYTES) throw new HttpsError('invalid-argument', 'حجم التسجيل أكبر من الحد المسموح (2 جيجابايت)');
  const signed = presignedUrl({ method: 'PUT', key: t.key, expiresSeconds: 6 * 3600, contentType: 'video/mp4' });
  const now = Date.now();
  if (t.kind === 'istifham') {
    const out = db.collection('sessionRecordings').doc(t.requestId);
    const cur = (await out.get()).data();
    if (!cur || cur.status !== 'ready') {
      await out.set({ ...buildIstifhamRecordingBase(t.r, t.requestId, now), r2Key: t.key, status: 'uploading', error: '', uploadStartedAtMs: now, createdAt: cur?.createdAt || FV.serverTimestamp() }, { merge: true });
    }
  } else {
    const rRef = t.ref.collection('recordings').doc(t.sid);
    const lRef = db.collection('lectureRecordings').doc(t.sid);
    const [r1, l1] = await Promise.all([rRef.get(), lRef.get()]);
    if (!(r1.data()?.status === 'ready')) await rRef.set({ sessionId: t.sid, title: r1.data()?.title || `جلسة ${t.sid}`, status: 'uploading', error: '', r2Key: t.key, uploadStartedAtMs: now, ...(r1.exists ? {} : { size: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
    if (!(l1.data()?.status === 'ready')) await lRef.set({ kind: 'group', groupId: t.gid, groupName: t.g.name || '', ownerUid: t.g.ownerUid || '', ownerName: t.g.ownerName || '', sessionId: t.sid, title: l1.data()?.title || r1.data()?.title || `جلسة ${t.sid}`, status: 'uploading', error: '', r2Key: t.key, uploadStartedAtMs: now, ...(l1.exists ? {} : { size: 0, durationSec: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
  }
  return { url: signed.url, key: t.key };
});

/** يتأكد أن الملف موجود في R2 فعلًا وحجمه معقول. */
async function r2Head(key) {
  try {
    const signed = presignedUrl({ method: 'HEAD', key, expiresSeconds: 120 });
    const res = await fetch(signed.url, { method: 'HEAD' });
    return { ok: res.ok, size: Number(res.headers.get('content-length') || 0) };
  } catch (_) { return { ok: false, size: 0 }; }
}

exports.completeClientRecording = onCall(async (request) => {
  const uid = reqUid(request);
  const t = await resolveTarget(uid, request.data);
  const durationSec = Math.max(0, Math.floor(Number(request.data?.durationSec || 0)));
  // لا نعتبر التسجيل جاهزًا إلا بعد التأكد أن الملف وصل التخزين بالفعل
  let head = await r2Head(t.key);
  for (let i = 0; i < 3 && (!head.ok || head.size < 1024); i++) { await new Promise((r) => setTimeout(r, 1500)); head = await r2Head(t.key); }
  if (!head.ok || head.size < 1024) throw new HttpsError('failed-precondition', 'الملف لم يصل إلى التخزين بعد، أعد المحاولة');
  const now = Date.now();
  if (t.kind === 'istifham') {
    // نقفل الموافقات الآن لتُحسب مدة حفظ نسخة المستفهم من وقت الحفظ
    await t.ref.update({ recordingStopped: true, recordingOpen: false, recordingEndedAtMs: now });
    const r = (await t.ref.get()).data() || t.r;
    await db.collection('sessionRecordings').doc(t.requestId).set({
      ...buildIstifhamRecordingBase(r, t.requestId, now), r2Key: t.key, status: 'ready', error: '', source: 'device', size: head.size, durationSec, savedAtMs: now,
    }, { merge: true });
  } else {
    const rRef = t.ref.collection('recordings').doc(t.sid);
    const lRef = db.collection('lectureRecordings').doc(t.sid);
    const prev = (await rRef.get()).data() || {};
    const prevSize = prev.status === 'ready' ? Number(prev.size || 0) : 0;
    await rRef.set({ r2Key: t.key, status: 'ready', error: '', source: 'device', size: head.size, durationSec, savedAtMs: now }, { merge: true });
    await lRef.set({ r2Key: t.key, status: 'ready', error: '', source: 'device', size: head.size, durationSec, readyAt: FV.serverTimestamp() }, { merge: true });
    // عدّاد التخزين: نضيف الفرق فقط (إعادة الرفع لا تضاعف الحجم)
    if (head.size !== prevSize) await t.ref.update({ storageBytes: FV.increment(head.size - prevSize) });
  }
  return { ok: true, size: head.size };
});

exports.failClientRecording = onCall(async (request) => {
  const uid = reqUid(request);
  const t = await resolveTarget(uid, request.data);
  const error = String(request.data?.error || 'فشل التسجيل').slice(0, 300);
  const now = Date.now();
  if (t.kind === 'istifham') {
    const out = db.collection('sessionRecordings').doc(t.requestId);
    const cur = (await out.get()).data();
    if (cur?.status === 'ready') return { ok: true, ignored: true };
    await out.set({ ...buildIstifhamRecordingBase(t.r, t.requestId, now), r2Key: '', status: 'failed', error, createdAt: cur?.createdAt || FV.serverTimestamp() }, { merge: true });
  } else {
    const rRef = t.ref.collection('recordings').doc(t.sid);
    const lRef = db.collection('lectureRecordings').doc(t.sid);
    const [r1, l1] = await Promise.all([rRef.get(), lRef.get()]);
    if (r1.data()?.status !== 'ready') await rRef.set({ sessionId: t.sid, title: r1.data()?.title || `جلسة ${t.sid}`, status: 'failed', error, ...(r1.exists ? {} : { size: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
    if (l1.data()?.status !== 'ready') await lRef.set({ kind: 'group', groupId: t.gid, groupName: t.g.name || '', ownerUid: t.g.ownerUid || '', ownerName: t.g.ownerName || '', sessionId: t.sid, title: l1.data()?.title || `جلسة ${t.sid}`, status: 'failed', error, ...(l1.exists ? {} : { size: 0, durationSec: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
  }
  return { ok: true };
});

module.exports.buildIstifhamRecordingBase = buildIstifhamRecordingBase;
