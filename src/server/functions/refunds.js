/**
 * إلغاء الاشتراك واسترداد المبلغ خلال 24 ساعة من إتمام الشراء.
 * الحالات: pending (قيد المراجعة) → approved/refunding (جارٍ الاسترداد) → refunded (مسترد) | refund_failed (فشل الاسترداد) | rejected (مرفوض + سبب).
 * - الدفع من المحفظة: يُسترد تلقائيًا لمحفظة المستخدم داخل transaction ويُسجَّل رقم العملية.
 * - الدفع بوسيلة خارجية: يُحوَّل للإدارة لتنفيذ التحويل يدويًا ثم تأكيده بإيصال/ملاحظة.
 * لا يُعتبر المبلغ مستردًا بمجرد قبول الطلب؛ تُسجَّل نتيجة التنفيذ.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const HOUR = 60 * 60 * 1000;
const WINDOW_MS = 24 * HOUR;
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
const purchaseTimeMs = (p) => {
  const n = Number(p.purchasedAtMs);
  if (Number.isFinite(n) && n > 0) return n;
  for (const k of ['completedAt', 'createdAt', 'timestamp']) {
    const v = p[k];
    if (v?.toMillis) return v.toMillis();
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return Date.parse(v);
  }
  return 0;
};

/** المستفهم يطلب إلغاء الاشتراك واسترداد المبلغ. data: { courseId, reason? } */
exports.requestCourseRefund = onCall(async (request) => {
  const uid = reqUid(request);
  const courseId = String(request.data?.courseId || '').trim();
  if (!courseId) throw new HttpsError('invalid-argument', 'الكورس غير محدد');
  const pRef = db.collection('purchases').doc(`${uid}_${courseId}`);
  const rRef = db.collection('refundRequests').doc(`${uid}_${courseId}`); // معرّف ثابت = لا طلبات مكررة لنفس عملية الشراء
  const result = await db.runTransaction(async (tx) => {
    const [p, existing] = [await tx.get(pRef), await tx.get(rRef)];
    if (!p.exists || p.data().status !== 'completed') throw new HttpsError('failed-precondition', 'لا يوجد اشتراك فعّال لهذا الكورس');
    if (existing.exists) throw new HttpsError('already-exists', 'تم تقديم طلب استرداد لهذه العملية من قبل');
    const pd = p.data();
    const boughtAt = purchaseTimeMs(pd);
    if (!boughtAt) throw new HttpsError('failed-precondition', 'تعذر تحديد وقت الشراء، تواصل مع الدعم');
    const now = Date.now(); // وقت الخادم
    if (now - boughtAt > WINDOW_MS) throw new HttpsError('deadline-exceeded', 'انتهت مهلة طلب الاسترداد (24 ساعة من الشراء)');
    let amount = Number(pd.amountPaid);
    let method = String(pd.paymentMethod || '');
    if (pd.paymentId) {
      const pay = (await tx.get(db.collection('payments').doc(String(pd.paymentId)))).data() || {};
      if (!Number.isFinite(amount)) amount = Number(pay.amount);
      if (!method) method = String(pay.paymentMethod || '');
    }
    const course = (await tx.get(db.collection('courses').doc(courseId))).data() || {};
    tx.set(rRef, {
      uid, courseId, courseTitle: String(course.title || ''), paymentId: String(pd.paymentId || ''), amount: round2(amount),
      paymentMethod: method || 'unknown', purchasedAtMs: boughtAt, requestedAtMs: now,
      reason: String(request.data?.reason || '').slice(0, 500), status: 'pending', createdAt: FV.serverTimestamp(),
    });
    return { ok: true };
  });
  return result;
});

/** الأدمن: قبول أو رفض. approve → يوقف الوصول فورًا ثم ينفّذ الاسترداد (تلقائي للمحفظة، يدوي للباقي). */
exports.adminDecideRefund = onCall(async (request) => {
  const adminUid = reqUid(request);
  if (!(await isAdminUid(adminUid))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const id = String(request.data?.requestId || '').trim();
  const approve = request.data?.approve === true;
  const reason = String(request.data?.reason || '').trim().slice(0, 300);
  const rRef = db.collection('refundRequests').doc(id);
  const r = (await rRef.get()).data();
  if (!r) throw new HttpsError('not-found', 'الطلب غير موجود');
  if (r.status !== 'pending') throw new HttpsError('failed-precondition', 'تمت معالجة هذا الطلب من قبل');
  if (!approve) {
    if (!reason) throw new HttpsError('invalid-argument', 'اكتب سبب الرفض');
    await rRef.update({ status: 'rejected', rejectionReason: reason, decidedBy: adminUid, decidedAt: FV.serverTimestamp() });
    return { ok: true, status: 'rejected' };
  }
  // 1) إيقاف الوصول فورًا (سجل الشراء يبقى محفوظًا)
  await db.collection('purchases').doc(id).set({ status: 'refunding', refundRequestedAt: FV.serverTimestamp() }, { merge: true });
  await rRef.update({ status: 'refunding', decidedBy: adminUid, decidedAt: FV.serverTimestamp() });

  const isWallet = ['wallet', 'balance'].includes(String(r.paymentMethod));
  if (!isWallet) return { ok: true, status: 'refunding', manual: true }; // يحتاج تحويل يدوي ثم adminCompleteRefund

  // 2) استرداد تلقائي لمحفظة المستخدم داخل transaction
  try {
    const walletRef = db.collection('wallets').doc(r.uid);
    const userRef = db.collection('users').doc(r.uid);
    const txRef = userRef.collection('transactions').doc();
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(rRef)).data();
      if (fresh.status !== 'refunding' || fresh.refundTxId) throw new HttpsError('failed-precondition', 'تم تنفيذ الاسترداد من قبل');
      const [w, u] = [await tx.get(walletRef), await tx.get(userRef)];
      let b = Number(w.data()?.balance);
      if (!Number.isFinite(b)) b = Number(u.data()?.balance);
      if (!Number.isFinite(b)) b = 0;
      const next = round2(b + Number(r.amount || 0));
      tx.set(walletRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
      tx.set(userRef, { balance: next, updatedAt: FV.serverTimestamp() }, { merge: true });
      tx.set(txRef, { amount: round2(r.amount), type: 'refund', status: 'completed', details: `استرداد اشتراك كورس: ${r.courseTitle || ''}`, courseId: r.courseId, timestamp: new Date().toISOString(), balanceAfter: next });
      tx.update(rRef, { status: 'refunded', refundTxId: txRef.id, refundedAt: FV.serverTimestamp(), refundMethod: 'wallet' });
      tx.set(db.collection('purchases').doc(id), { status: 'refunded' }, { merge: true });
    });
    return { ok: true, status: 'refunded' };
  } catch (e) {
    console.error('wallet refund failed', e);
    await rRef.update({ status: 'refund_failed', refundError: String(e?.message || e).slice(0, 300) });
    throw new HttpsError('internal', 'فشل الاسترداد التلقائي، الحالة: فشل الاسترداد');
  }
});

/** الأدمن: تأكيد تنفيذ الاسترداد اليدوي (إيصال/رقم عملية) أو تسجيل فشله. data: { requestId, success, receiptUrl?, note? } */
exports.adminCompleteRefund = onCall(async (request) => {
  const adminUid = reqUid(request);
  if (!(await isAdminUid(adminUid))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const id = String(request.data?.requestId || '').trim();
  const success = request.data?.success !== false;
  const receiptUrl = String(request.data?.receiptUrl || '').trim();
  const note = String(request.data?.note || '').trim().slice(0, 300);
  const rRef = db.collection('refundRequests').doc(id);
  const r = (await rRef.get()).data();
  if (!r) throw new HttpsError('not-found', 'الطلب غير موجود');
  if (!['refunding', 'refund_failed'].includes(r.status)) throw new HttpsError('failed-precondition', 'الطلب ليس في مرحلة الاسترداد');
  if (success) {
    if (!receiptUrl && !note) throw new HttpsError('invalid-argument', 'ارفق إيصال التحويل أو اكتب رقم العملية');
    await rRef.update({ status: 'refunded', refundedAt: FV.serverTimestamp(), refundMethod: 'manual', receiptUrl, refundNote: note, refundedBy: adminUid });
    await db.collection('purchases').doc(id).set({ status: 'refunded' }, { merge: true });
  } else {
    await rRef.update({ status: 'refund_failed', refundError: note || 'فشل التحويل', refundedBy: adminUid });
  }
  return { ok: true };
});
