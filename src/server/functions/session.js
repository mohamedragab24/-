/**
 * جلسات الاستفهام: تسجيل تلقائي للإدارة، حفظ اختياري عند المستفهم بموافقة الطرفين، وتقييم الجلسة،
 * بالإضافة إلى IP الحقيقي كما يراه الخادم (للعلامة المائية).
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const { presignedUrl, deleteObject } = require('./r2');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const DAY = 24 * 60 * 60 * 1000;
const ALLOWED_DAYS = [1, 10, 15, 30];

const reqUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  return uid;
};
const isAdminUid = async (uid) => {
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  return p.isAdmin === true || p.role === 'admin';
};

/** الأدمن: فحص إعدادات تسجيل Agora/R2 (المتغيرات الناقصة + اختبار acquire). */
exports.adminAgoraRecordingCheck = onCall(async (request) => {
  const uid = reqUid(request);
  if (!(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  return require('./agora-recording').checkConfig();
});

/** IP كما يراه الخادم (لا يمكن للعميل تزويره): أول عنوان في x-forwarded-for. */
exports.getMyIp = onCall(async (request) => {
  const h = request.rawRequest?.headers;
  const get = (k) => (h && typeof h.get === 'function' ? h.get(k) : h?.[k]) || '';
  const fwd = String(get('x-forwarded-for') || '').split(',')[0].trim();
  const ip = fwd || String(get('x-real-ip') || '').trim();
  // سجل للإدارة: IP + التوقيت (يُستدعى عند فتح المحتوى المحمي)
  if (request.auth?.uid && ip) {
    db.collection('ipLogs').add({ uid: request.auth.uid, ip, at: FV.serverTimestamp(), ua: String(get('user-agent') || '').slice(0, 200) }).catch(() => {});
  }
  return { ip, serverNow: Date.now() };
});

// ------------------------------------------------------------------ تقييم الجلسة
/** تقييم جودة الجلسة وتقييم المفهم (1-5). data: { requestId?, groupId?, sessionId?, mufhemId?, quality, mufhemRating, comment } */
exports.submitSessionRating = onCall(async (request) => {
  const uid = reqUid(request);
  const q = Number(request.data?.quality);
  const m = Number(request.data?.mufhemRating);
  const ok = (n) => Number.isFinite(n) && n >= 1 && n <= 5;
  if (!ok(q) || !ok(m)) throw new HttpsError('invalid-argument', 'اختر تقييمًا من 1 إلى 5');
  const requestId = String(request.data?.requestId || '').trim();
  const groupId = String(request.data?.groupId || '').trim();
  const sessionId = String(request.data?.sessionId || '').trim();
  let mufhemId = String(request.data?.mufhemId || '').trim();
  if (requestId) {
    const r = (await db.collection('istifhams').doc(requestId).get()).data();
    if (!r || (r.mustafhemId !== uid)) throw new HttpsError('permission-denied', 'التقييم للمستفهم صاحب الجلسة فقط');
    mufhemId = String(r.mufhemId || '');
  } else if (groupId) {
    const g = (await db.collection('groups').doc(groupId).get()).data();
    if (!g) throw new HttpsError('not-found', 'المجموعة غير موجودة');
    mufhemId = String(g.ownerUid || '');
  }
  if (!mufhemId) throw new HttpsError('invalid-argument', 'المفهم غير محدد');
  const key = requestId ? `r_${requestId}_${uid}` : `g_${groupId}_${sessionId}_${uid}`;
  const ref = db.collection('sessionRatings').doc(key);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new HttpsError('already-exists', 'تم إرسال تقييمك من قبل');
    const uRef = db.collection('users').doc(mufhemId);
    const u = (await tx.get(uRef)).data() || {};
    const count = Number(u.ratingCount || 0);
    const avg = Number(u.rating || 0);
    const nextCount = count + 1;
    const nextAvg = Math.round(((avg * count + m) / nextCount) * 100) / 100;
    tx.set(ref, { uid, requestId, groupId, sessionId, mufhemId, quality: q, mufhemRating: m, comment: String(request.data?.comment || '').slice(0, 500), createdAt: FV.serverTimestamp() });
    tx.set(uRef, { rating: nextAvg, ratingCount: nextCount }, { merge: true });
  });
  return { ok: true };
});

// ------------------------------------------------------------------ تسجيل جلسات الاستفهام
/** يتأكد فعليًا أن الملف موجود في R2 (HEAD) قبل اعتبار التسجيل مكتملًا. */
async function r2FileExists(key) {
  try {
    const signed = presignedUrl({ method: 'HEAD', key, expiresSeconds: 120 });
    const res = await fetch(signed.url, { method: 'HEAD' });
    const len = Number(res.headers.get('content-length') || 0);
    return res.ok && len > 1024;
  } catch (_) { return false; }
}
async function waitForFile(key, tries = 5, delayMs = 3000) {
  for (let i = 0; i < tries; i++) {
    if (await r2FileExists(key)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function loadParticipantRequest(uid, requestId) {
  const ref = db.collection('istifhams').doc(requestId);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('not-found', 'المحاضرة غير موجودة');
  const r = s.data();
  const adm = await isAdminUid(uid);
  if (uid !== r.mustafhemId && uid !== r.mufhemId && !adm) throw new HttpsError('permission-denied', 'لست من أطراف هذه المحاضرة');
  return { ref, r, adm };
}

/** يضمن بدء تسجيل الجلسة (آمن للتكرار): يُستدعى من التطبيق (startIstifhamRecording) ومن السيرفر تلقائيًا عند دخول الطرفين (getAgoraMeetingToken). */
async function ensureIstifhamRecording(requestId) {
  const ref = db.collection('istifhams').doc(requestId);
  const r = (await ref.get()).data();
  if (!r) throw new HttpsError('not-found', 'المحاضرة غير موجودة');
  // التسجيل عبر «بوت فهمت»: ينضم للقناة كمشاهد خفي ويسجّل الجلسة كاملة ثم يرفعها إلى R2 (بدون أي إجراء من المُفهم أو المستفهم)
  if (r.recordingOpen || r.recordingStopped || r.recordingJob) return { ok: true, already: true };
  const lock = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() || {};
    if (cur.recordingJob || cur.recordingStarting) return false;
    tx.update(ref, { recordingStarting: true });
    return true;
  });
  if (!lock) return { ok: true, already: true };
  try {
    const state = await require('./recorder-bot').dispatchRecording({ kind: 'istifham', requestId, title: String(r.title || '') });
    await ref.update({ recordingMode: state.mode, recordingJob: state, recordingBotJob: state.jobId || '', recordingOpen: true, recordingStarting: false, recordingStartedAtMs: Date.now(), recordingError: FV.delete() });
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 300);
    console.error('istifham bot dispatch failed', e);
    await ref.update({ recordingStarting: false, recordingError: msg });
    const out = db.collection('sessionRecordings').doc(requestId);
    await out.set({ requestId, mustafhemId: r.mustafhemId, mufhemId: r.mufhemId, title: String(r.title || ''), status: 'failed', error: msg, adminExpiresAt: Date.now() + 2 * 24 * 3600 * 1000, createdAt: FV.serverTimestamp() }, { merge: true });
    return { ok: false, error: msg };
  }
}
exports._ensureIstifhamRecording = ensureIstifhamRecording;

/** يبدأ تسجيل الجلسة تلقائيًا (آمن للاستدعاء أكثر من مرة). */
exports.startIstifhamRecording = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  await loadParticipantRequest(uid, requestId);
  return ensureIstifhamRecording(requestId);
});

/** المشاركون يختارون حفظ التسجيل عند المستفهم. data: { requestId, days: 0|1|10|15|30 } (0 = لا أريد الحفظ) */
exports.setSessionRetention = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const days = Number(request.data?.days || 0);
  if (days !== 0 && !ALLOWED_DAYS.includes(days)) throw new HttpsError('invalid-argument', 'مدة غير مسموحة');
  const { ref, r } = await loadParticipantRequest(uid, requestId);
  const side = uid === r.mustafhemId ? 'mustafhem' : uid === r.mufhemId ? 'mufhem' : null;
  if (!side) throw new HttpsError('permission-denied', 'لأطراف الجلسة فقط');
  if (r.recordingStopped) throw new HttpsError('failed-precondition', 'انتهت الجلسة ولا يمكن تغيير الاختيار الآن');
  // كل طرف يكتب اختياره فقط (مع وقت الموافقة)، ولا يملك تغيير اختيار الطرف الآخر
  await ref.update({ [`retention.${side}`]: days, [`retentionAt.${side}`]: Date.now(), [`retentionBy.${side}`]: uid });
  return { ok: true };
});

/** يغلق الجلسة (idempotent) وينشئ سجل التسجيل بحالة «بانتظار الرفع» إن لم يكن موجودًا؛ الملف نفسه يصل من جهاز المُفهم. */
async function finalizeIstifhamRecording(ref, r, requestId) {
  const won = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() || {};
    if (cur.recordingStopped) return false;
    tx.update(ref, { recordingStopped: true, recordingOpen: false, recordingEndedAtMs: Date.now() });
    return true;
  });
  if (!won) return { ok: true, already: true };
  const job = r.recordingJob || (r.recordingBotJob ? { mode: 'bot', jobId: r.recordingBotJob } : null);
  if (job) {
    try {
      const res = await require('./recorder-bot').stopRecording(job);
      if (job.mode === 'agora-web') {
        if (res.mp4) {
          const att = await require('./device-recording').attachRecordingFile({ kind: 'istifham', requestId, durationSec: Math.round((Date.now() - Number(job.startedAtMs || Date.now())) / 1000) }, res.mp4);
          if (att && !att.pending) return { ok: true, status: 'ready' };
        } else {
          await db.collection('sessionRecordings').doc(requestId).set({ requestId, mustafhemId: r.mustafhemId, mufhemId: r.mufhemId, title: String(r.title || ''), status: 'failed', error: `لم يُنتج ملف تسجيل — حالة الرفع: ${res.uploadingStatus || 'غير معروفة'}، الملفات: [${(res.files || []).join(', ') || 'لا شيء'}] | ${res.raw || ''}`.slice(0, 300), adminExpiresAt: Date.now() + 2 * 24 * 3600 * 1000, createdAt: FV.serverTimestamp() }, { merge: true });
          return { ok: false, status: 'failed' };
        }
      }
    } catch (e) { console.error('stop recording failed', e); }
  }
  const out = db.collection('sessionRecordings').doc(requestId);
  const cur = (await out.get()).data();
  if (cur && cur.status === 'ready') return { ok: true, status: 'ready' };
  const { buildIstifhamRecordingBase } = require('./device-recording');
  await out.set({
    ...buildIstifhamRecordingBase(r, requestId, Date.now()),
    r2Key: `sessions/${requestId}/${requestId}.mp4`,
    status: cur?.status === 'uploading' ? 'uploading' : 'uploading',
    error: cur?.error || 'بانتظار رفع التسجيل من جهاز المُفهم',
    createdAt: cur?.createdAt || FV.serverTimestamp(),
  }, { merge: true });
  return { ok: true, status: 'uploading' };
}

/** إنهاء التسجيل من أي طرف عند الخروج. */
exports.endIstifhamRecording = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const { ref, r } = await loadParticipantRequest(uid, requestId);
  return finalizeIstifhamRecording(ref, r, requestId);
});

/** الأدمن: إعادة فحص تسجيل لم يكتمل — هل وصل الملف إلى R2 الآن؟ */
exports.adminRetrySessionRecording = onCall(async (request) => {
  const uid = reqUid(request);
  if (!(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const requestId = String(request.data?.requestId || '').trim();
  const ref = db.collection('sessionRecordings').doc(requestId);
  const d = (await ref.get()).data();
  if (!d) throw new HttpsError('not-found', 'التسجيل غير موجود');
  const key = d.r2Key || `sessions/${requestId}/${requestId}.mp4`;
  const exists = await r2FileExists(key);
  await ref.update(exists
    ? { status: 'ready', error: '', r2Key: key, savedAtMs: Date.now() }
    : { status: d.status === 'ready' ? 'ready' : 'uploading', error: 'الملف لم يصل بعد. يُستكمل الرفع تلقائيًا من جهاز المُفهم عند فتح التطبيق وتوفر الإنترنت.' });
  return { ok: exists, status: exists ? 'ready' : 'uploading' };
});

/** رابط مشاهدة مؤقت: الأدمن دائمًا، والمستفهم فقط لو اتفق الطرفان على الحفظ ولم تنته المدة. */
exports.getSessionRecordingUrl = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const s = await db.collection('sessionRecordings').doc(requestId).get();
  if (!s.exists || !s.data().r2Key) throw new HttpsError('not-found', 'التسجيل غير موجود');
  const d = s.data();
  const adm = await isAdminUid(uid);
  const studentOk = uid === d.mustafhemId && d.studentSaveDays > 0 && Date.now() < Number(d.studentExpiresAt || 0);
  if (!adm && !studentOk) throw new HttpsError('permission-denied', 'هذا التسجيل غير متاح لك');
  const me = (await db.collection('users').doc(uid).get()).data() || {};
  // سجل مراجعة: من فتح التسجيل ومتى ولماذا
  await db.collection('sessionRecordingAccess').add({
    requestId, uid, role: adm ? 'admin' : 'student', reason: String(request.data?.reason || (adm ? 'مراجعة إدارية' : 'مشاهدة النسخة المحفوظة')).slice(0, 300),
    complaintOpen: d.complaint === true, at: FV.serverTimestamp(),
  });
  const signed = presignedUrl({ method: 'GET', key: String(d.r2Key), expiresSeconds: 900 });
  return { ...signed, watermark: { uid, name: String(me.name || me.fullName || ''), publicId: String(me.publicId || '') } };
});

/** شكوى على جلسة: تُبقي التسجيل عند الإدارة حتى 14 يومًا كحد أقصى أو حتى إنهاء الرد. */
exports.fileSessionComplaint = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const { r } = await loadParticipantRequest(uid, requestId);
  const ref = db.collection('sessionRecordings').doc(requestId);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('failed-precondition', 'لا يوجد تسجيل لهذه الجلسة (ربما انتهت مدة الاحتفاظ)');
  const d = s.data();
  if (Date.now() > Number(d.adminExpiresAt || 0)) throw new HttpsError('deadline-exceeded', 'انتهت مدة تقديم الشكوى على هذه الجلسة');
  const created = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
  await ref.update({ complaint: true, complaintBy: uid, complaintText: String(request.data?.text || '').slice(0, 800), adminExpiresAt: created + 14 * DAY });
  await db.collection('sessionComplaints').add({ requestId, uid, mufhemId: r.mufhemId, mustafhemId: r.mustafhemId, text: String(request.data?.text || '').slice(0, 800), status: 'open', createdAt: FV.serverTimestamp() });
  return { ok: true };
});

/** الأدمن: إنهاء الرد على الشكوى → يُحذف التسجيل خلال يوم (ولا يتجاوز 14 يومًا). */
exports.adminResolveSessionComplaint = onCall(async (request) => {
  const uid = reqUid(request);
  if (!(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const requestId = String(request.data?.requestId || '').trim();
  const ref = db.collection('sessionRecordings').doc(requestId);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('not-found', 'التسجيل غير موجود');
  const d = s.data();
  const created = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
  await ref.update({ complaint: false, adminExpiresAt: Math.min(Date.now() + DAY, created + 14 * DAY) });
  const c = await db.collection('sessionComplaints').where('requestId', '==', requestId).where('status', '==', 'open').get();
  await Promise.all(c.docs.map((x) => x.ref.update({ status: 'resolved', resolvedAt: FV.serverTimestamp() })));
  return { ok: true };
});

/** تنظيف المنتهي (يستدعيها الـ cron اليومي). */
async function cleanupExpiredRecordings() {
  const now = Date.now();
  try { await require('./device-recording').refreshUploadingGroupRecordings(); } catch (e) { console.error('refresh group recordings failed', e); }
  // جلسات انقطعت دون إنهاء (إغلاق التطبيق/انقطاع الإنترنت): نُنهي تسجيلها بعد 45 دقيقة من البدء
  let finalized = 0;
  const open = await db.collection('istifhams').where('recordingOpen', '==', true).get();
  for (const doc of open.docs) {
    const r = doc.data();
    if (now - Number(r.recordingStartedAtMs || 0) > 45 * 60 * 1000) {
      try { await finalizeIstifhamRecording(doc.ref, r, doc.id); finalized++; } catch (e) { console.error('finalize abandoned failed', doc.id, e); }
    }
  }
  const snap = await db.collection('sessionRecordings').get();
  let removed = 0; let trimmed = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const adminLive = now < Number(d.adminExpiresAt || 0);
    const studentLive = d.studentSaveDays > 0 && now < Number(d.studentExpiresAt || 0);
    if (d.status === 'uploading' && adminLive) {
      const age = now - (Number(d.uploadStartedAtMs) || Number(d.endedAtMs) || (d.createdAt?.toMillis ? d.createdAt.toMillis() : now));
      if (d.r2Key && await r2FileExists(d.r2Key)) await doc.ref.update({ status: 'ready', error: '', savedAtMs: now });
      else if (age > 48 * 3600 * 1000) await doc.ref.update({ status: 'failed', error: 'لم يصل التسجيل من جهاز المُفهم خلال 48 ساعة' });
      continue;
    }
    if (d.status === 'processing' && d.r2Key && adminLive) {
      if (await r2FileExists(d.r2Key)) await doc.ref.update({ status: 'ready', error: '' });
      continue;
    }
    // لا نحذف تسجيلًا مرتبطًا بشكوى مفتوحة قبل انتهاء حدّ الـ 14 يومًا
    const created = d.createdAt?.toMillis ? d.createdAt.toMillis() : 0;
    if (d.complaint === true && created && now < created + 14 * DAY) continue;
    if (!adminLive && !studentLive) {
      if (d.r2Key) { try { await deleteObject(String(d.r2Key)); } catch (e) { console.error('r2 delete failed', e); continue; } }
      await db.collection('recordingDeletionLogs').add({ requestId: doc.id, reason: d.complaint ? 'complaint_period_ended' : 'retention_expired', at: FV.serverTimestamp(), hadStudentCopy: !!d.studentSaveDays });
      await doc.ref.delete();
      removed++;
    } else if (!adminLive && studentLive) {
      trimmed++; // الإدارة انتهت مدتها لكن المستفهم لسه محتفظ بنسخة: الملف يبقى حتى انتهاء مدة المستفهم
    }
  }
  return { removed, trimmed, finalized };
}
exports._cleanupExpiredRecordings = cleanupExpiredRecordings;
