/**
 * دفع الاستفهام (محاضرة) وتقسيم الأرباح:
 *  - المستفهم يدفع السعر الذي اختاره (50 جنيه كحد أدنى) من محفظته.
 *  - 20% للمنصة و80% كاملة للمفهم، ويُضاف للمفهم عند اكتمال الجلسة.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const MIN_PRICE = 50;
const PLATFORM_RATE = 0.2;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const reqUid = (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول أولاً');
  return uid;
};
const isAdminUid = async (uid) => {
  const p = (await db.collection('users').doc(uid).get()).data() || {};
  return p.isAdmin === true || p.role === 'admin';
};

async function walletInTx(tx, uid) {
  const userRef = db.collection('users').doc(uid);
  const walletRef = db.collection('wallets').doc(uid);
  const w = await tx.get(walletRef);
  const u = await tx.get(userRef);
  let b = Number(w.data()?.balance);
  if (!Number.isFinite(b)) b = Number(u.data()?.balance);
  if (!Number.isFinite(b)) {
    const txs = await tx.get(userRef.collection('transactions'));
    b = txs.docs.reduce((acc, d) => {
      const t = d.data() || {};
      if (['rejected', 'pending', 'cancelled'].includes(String(t.status || ''))) return acc;
      const n = Number(t.amount || 0);
      return ['deposit', 'earning', 'refund'].includes(String(t.type || '')) ? acc + n : acc - n;
    }, 0);
  }
  return { b: Number.isFinite(b) ? b : 0, userRef, walletRef };
}

/** المستفهم يقبل عرضًا ويدفع من محفظته. data: { requestId, offerId } */
exports.payIstifham = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const offerId = String(request.data?.offerId || '').trim();
  if (!requestId || !offerId) throw new HttpsError('invalid-argument', 'بيانات الدفع ناقصة');
  const reqRef = db.collection('istifhams').doc(requestId);
  const offerRef = reqRef.collection('offers').doc(offerId);
  const result = await db.runTransaction(async (tx) => {
    const [rs, os] = [await tx.get(reqRef), await tx.get(offerRef)];
    if (!rs.exists || !os.exists) throw new HttpsError('not-found', 'الاستفهام أو العرض غير موجود');
    const r = rs.data();
    const o = os.data();
    if (r.mustafhemId !== uid) throw new HttpsError('permission-denied', 'هذا الاستفهام ليس لك');
    if (['paid', 'completed'].includes(r.status)) throw new HttpsError('failed-precondition', 'تم دفع هذا الاستفهام من قبل');
    const amount = round2(r.amount);
    if (!Number.isFinite(amount) || amount < MIN_PRICE) throw new HttpsError('failed-precondition', `أقل سعر ${MIN_PRICE} جنيه`);
    const { b, userRef, walletRef } = await walletInTx(tx, uid);
    if (b + 0.0001 < amount) throw new HttpsError('failed-precondition', `رصيد المحفظة غير كافٍ (${b.toFixed(2)} جنيه). اشحن محفظتك أولًا`);
    const platformFee = round2(amount * PLATFORM_RATE);
    const mufhemShare = round2(amount - platformFee);
    const next = round2(b - amount);
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    tx.set(walletRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
    tx.set(userRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
    tx.set(userRef.collection('transactions').doc(), { amount, type: 'payment', status: 'completed', details: `دفع محاضرة: ${r.title || ''}`, requestId, timestamp: new Date().toISOString(), balanceAfter: next });
    tx.update(reqRef, {
      status: 'paid', invoiceNumber, paidAt: new Date().toISOString(),
      acceptedOfferId: offerId, mufhemId: o.mufhemId, mufhemName: o.mufhemName || '',
      meetingTime: o.readyAt || r.meetingTime || '',
      amountPaid: amount, platformFee, mufhemShare, escrowReleased: false,
    });
    tx.update(offerRef, { status: 'accepted' });
    return { amount, platformFee, mufhemShare, invoiceNumber };
  });
  return { ok: true, ...result };
});

/** تأكيد اكتمال الجلسة: يضيف 80% لمحفظة المفهم (المستفهم أو الأدمن). data: { requestId } */
exports.completeIstifham = onCall(async (request) => {
  const uid = reqUid(request);
  const requestId = String(request.data?.requestId || '').trim();
  const reqRef = db.collection('istifhams').doc(requestId);
  const adminCaller = await isAdminUid(uid);
  await db.runTransaction(async (tx) => {
    const rs = await tx.get(reqRef);
    if (!rs.exists) throw new HttpsError('not-found', 'الاستفهام غير موجود');
    const r = rs.data();
    if (r.mustafhemId !== uid && !adminCaller) throw new HttpsError('permission-denied', 'غير مسموح');
    if (r.status !== 'paid' || r.escrowReleased === true) throw new HttpsError('failed-precondition', 'لا يمكن إكمال هذا الطلب');
    const share = round2(r.mufhemShare);
    const { b, userRef, walletRef } = await walletInTx(tx, r.mufhemId);
    const next = round2(b + share);
    tx.set(walletRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
    tx.set(userRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
    tx.set(userRef.collection('transactions').doc(), { amount: share, type: 'earning', status: 'completed', details: `أرباح محاضرة (80% من ${r.amountPaid} ج.م): ${r.title || ''}`, requestId, timestamp: new Date().toISOString(), balanceAfter: next });
    tx.update(reqRef, { status: 'completed', escrowReleased: true, completedAt: new Date().toISOString() });
  });
  return { ok: true };
});
