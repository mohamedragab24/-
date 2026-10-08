/** تسجيلات المحاضرات (lectureRecordings): مشاهدة وحذف من لوحة الأدمن في التطبيق. */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const { presignedUrl, deleteObject } = require('./r2');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const R2_SECRETS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

const requireAdmin = async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  if (!(request.auth.token?.admin === true || p.isAdmin === true || p.role === 'admin')) throw new HttpsError('permission-denied', 'للأدمن فقط');
  return { uid, profile: p };
};

exports.getLectureRecordingUrl = onCall({ secrets: R2_SECRETS }, async (request) => {
  const { uid, profile } = await requireAdmin(request);
  const id = String(request.data?.id || '').trim();
  const snap = await db.collection('lectureRecordings').doc(id).get();
  if (!snap.exists || !snap.data()?.r2Key) throw new HttpsError('not-found', 'التسجيل غير متاح بعد');
  const signed = presignedUrl({ method: 'GET', key: String(snap.data().r2Key), expiresSeconds: 1800 });
  return { ...signed, watermark: { uid, name: String(profile.name || profile.fullName || ''), publicId: String(profile.publicId || '') } };
});

exports.adminDeleteLectureRecording = onCall({ secrets: R2_SECRETS }, async (request) => {
  const { uid } = await requireAdmin(request);
  const id = String(request.data?.id || '').trim();
  const ref = db.collection('lectureRecordings').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'التسجيل غير موجود');
  const d = snap.data() || {};
  if (d.r2Key) { try { await deleteObject(String(d.r2Key)); } catch (e) { console.error('r2 delete', e); } }
  if (d.kind === 'group' && d.groupId && d.sessionId) {
    const gRef = db.collection('groups').doc(String(d.groupId));
    try {
      await gRef.collection('recordings').doc(String(d.sessionId)).delete();
      if (Number(d.size) > 0) await gRef.update({ storageBytes: FV.increment(-Number(d.size)) });
    } catch (e) { console.error('group recording cleanup', e); }
  }
  await ref.delete();
  await db.collection('adminLogs').add({ action: 'lecture_recording_delete', recordingId: id, title: d.title || '', adminUid: uid, timestamp: FV.serverTimestamp() });
  return { ok: true };
});
