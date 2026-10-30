/**
 * تشخيص «الكورسات/المجموعات لا تظهر»: غالبًا المحتوى مسجّل على حساب آخر (uid مختلف) لنفس الشخص.
 * - diagnoseMyContent: عدّاد ما يملكه حسابك الحالي + حسابات أخرى بنفس البريد وعدّاد محتواها.
 * - transferContentToMe: نقل ملكية محتوى حساب آخر بنفس البريد (أو بأمر الأدمن) إلى حسابك الحالي.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const reqUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  return uid;
};
const isAdminUid = async (uid) => {
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  return p.isAdmin === true || p.role === 'admin';
};
const count = async (q) => { try { return (await q.count().get()).data().count; } catch (_) { return (await q.get()).size; } };

async function countsFor(uid) {
  const [groups, coursesOwner, coursesInstr, memberships, purchases] = await Promise.all([
    count(db.collection('groups').where('ownerUid', '==', uid)),
    count(db.collection('courses').where('ownerUid', '==', uid)),
    count(db.collection('courses').where('instructorId', '==', uid)),
    count(db.collection('users').doc(uid).collection('groupMemberships')),
    count(db.collection('purchases').where('uid', '==', uid)),
  ]);
  return { groups, courses: Math.max(coursesOwner, coursesInstr), memberships, purchases };
}

exports.diagnoseMyContent = onCall(async (request) => {
  const uid = reqUid(request);
  const me = (await db.collection('users').doc(uid).get()).data() || {};
  const email = String(me.email || (await admin.auth().getUser(uid)).email || '').toLowerCase();
  const mine = await countsFor(uid);
  const others = [];
  if (email) {
    const q = await db.collection('users').where('email', '==', email).get();
    for (const d of q.docs) {
      if (d.id === uid) continue;
      const u = d.data() || {};
      others.push({ uid: d.id, name: String(u.name || u.fullName || ''), role: String(u.role || ''), ...(await countsFor(d.id)) });
    }
  }
  return { uid, email, mine, others };
});

/** data: { fromUid } — يُسمح لو الحساب الآخر بنفس بريد حسابك، أو لو أنت أدمن. */
exports.transferContentToMe = onCall(async (request) => {
  const to = reqUid(request);
  const from = String(request.data?.fromUid || '').trim();
  if (!from || from === to) throw new HttpsError('invalid-argument', 'الحساب المصدر غير صالح');
  const [toU, fromU] = [(await db.collection('users').doc(to).get()).data() || {}, (await db.collection('users').doc(from).get()).data() || {}];
  const toMail = String(toU.email || '').toLowerCase();
  const sameEmail = toMail && toMail === String(fromU.email || '').toLowerCase();
  if (!sameEmail && !(await isAdminUid(to))) throw new HttpsError('permission-denied', 'لا يمكن نقل محتوى حساب ببريد مختلف');
  const moved = { groups: 0, courses: 0, memberships: 0, purchases: 0 };

  for (const d of (await db.collection('groups').where('ownerUid', '==', from).get()).docs) {
    await d.ref.update({ ownerUid: to }); moved.groups++;
  }
  const seen = new Set();
  for (const f of ['ownerUid', 'instructorId']) {
    for (const d of (await db.collection('courses').where(f, '==', from).get()).docs) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      await d.ref.update({ ownerUid: to, instructorId: to }); moved.courses++;
    }
  }
  for (const m of (await db.collection('users').doc(from).collection('groupMemberships').get()).docs) {
    await db.collection('users').doc(to).collection('groupMemberships').doc(m.id).set(m.data(), { merge: true });
    const memberRef = db.collection('groups').doc(m.id).collection('members');
    const old = await memberRef.doc(from).get();
    if (old.exists) { await memberRef.doc(to).set({ ...old.data(), uid: to }, { merge: true }); await old.ref.delete(); }
    await m.ref.delete(); moved.memberships++;
  }
  for (const p of (await db.collection('purchases').where('uid', '==', from).get()).docs) {
    const d = p.data();
    await db.collection('purchases').doc(`${to}_${d.courseId}`).set({ ...d, uid: to, transferredFrom: from }, { merge: true });
    await p.ref.delete(); moved.purchases++;
  }
  await db.collection('adminLogs').add({ action: 'content_transfer', fromUid: from, toUid: to, moved, at: FV.serverTimestamp() });
  return { ok: true, moved };
});
