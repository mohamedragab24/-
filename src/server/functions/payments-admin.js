/**
 * شحن المحفظة عبر بوابة الدفع + مراجعة عمليات الدفع (للأدمن) + الاستعلام عن حالة العملية.
 * نفس مسار شراء الكورس: طلب pending_verification ← رسالة من تطبيق بوابة الدفع ← مطابقة ← تأكيد.
 */
const { onCall, HttpsError } = require('./shim').https;
const admin = require('firebase-admin');
const pv = require('./payment-verify');

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
const accountsOf = (m) => {
  const list = Array.isArray(m?.accounts) ? m.accounts : [];
  const out = list.map((a) => ({ label: String(a?.label || ''), number: String(a?.number || '') })).filter((a) => a.number);
  if (!out.length && m?.accountNumber) out.push({ label: String(m.name || ''), number: String(m.accountNumber) });
  return out;
};

/** طلب شحن محفظة: المستخدم يحوّل المبلغ لرقم المنصة، ويُضاف الرصيد تلقائيًا بعد وصول رسالة العملية المطابقة. */
exports.createWalletTopup = onCall(async (request) => {
  const uid = reqUid(request);
  const amount = Math.round(Number(request.data?.amount) * 100) / 100;
  const paymentMethod = String(request.data?.paymentMethod || '').trim();
  const phone = String(request.data?.phone || '').trim();
  if (!Number.isFinite(amount) || amount < 10 || amount > 100000) throw new HttpsError('invalid-argument', 'المبلغ يجب أن يكون بين 10 و100000 جنيه');
  if (!paymentMethod || paymentMethod === 'balance') throw new HttpsError('invalid-argument', 'اختر طريقة الدفع');
  if (phone.replace(/[^\d+]/g, '').length < 8) throw new HttpsError('invalid-argument', 'اكتب رقم الحساب أو الهاتف الذي سيتم التحويل منه');
  const methodSnap = await db.collection('paymentMethods').doc(paymentMethod).get();
  const method = methodSnap.exists ? (methodSnap.data() || {}) : null;
  if (!method || method.active === false) throw new HttpsError('invalid-argument', 'طريقة الدفع غير مدعومة أو غير مفعلة');

  const open = await db.collection('payments').where('uid', '==', uid).where('type', '==', 'wallet_topup').where('status', '==', 'pending_verification').get();
  if (open.size >= 3) throw new HttpsError('resource-exhausted', 'لديك طلبات شحن معلّقة كثيرة. انتظر تأكيدها أو انتهاء مهلتها.');

  const user = (await db.collection('users').doc(uid).get()).data() || {};
  const ref = db.collection('payments').doc();
  const orderNumber = `TP-${Date.now().toString(36).toUpperCase()}-${ref.id.slice(0, 6).toUpperCase()}`;
  await ref.set({
    type: 'wallet_topup', orderNumber, uid, courseId: '', courseName: 'شحن المحفظة', amount,
    userName: String(user.fullName || user.name || request.auth.token?.name || ''),
    email: String(request.auth.token?.email || user.email || ''), phone: String(user.phone || ''),
    paymentPhone: phone, paymentPhoneKey: pv.phoneKey(phone), publicId: String(user.publicId || ''),
    status: 'pending_verification', paymentMethod, paymentMethodName: String(method.name || paymentMethod),
    paymentAccounts: accountsOf(method), providerKey: String(method.providerKey || ''), providerName: String(method.providerName || ''), serviceName: String(method.name || ''), paymentGroup: String(method.group || ''), source: String(request.data?.source || 'web'), createdAt: FV.serverTimestamp(),
  });
  let status = 'pending_verification';
  try { status = (await pv.tryConfirmPayment(ref.id)).status; } catch (e) { console.error('instant topup verify failed', e); }
  return { ok: true, pending: status !== 'completed', status, paymentId: ref.id, orderNumber, amount };
});

/**
 * مراجعة يدوية لعملية وصلت من بوابة الدفع (للأدمن):
 *  accept  → ربطها بطلب معلّق (paymentId) وتفعيله (يتجاوز مطابقة الرقم/الوقت فقط، ولا يتجاوز منع التكرار)
 *  reject  → رفضها
 */
exports.adminReviewPayment = onCall(async (request) => {
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const txDocId = String(request.data?.txDocId || '').trim();
  const action = String(request.data?.action || '').trim();
  const note = String(request.data?.note || '').trim().slice(0, 300);
  if (!txDocId || !['accept', 'reject'].includes(action)) throw new HttpsError('invalid-argument', 'بيانات غير صحيحة');
  const txRef = db.collection('telegramTransactions').doc(txDocId);
  const txSnap = await txRef.get();
  if (!txSnap.exists) throw new HttpsError('not-found', 'العملية غير موجودة');
  const tx = txSnap.data() || {};
  if (tx.reviewStatus === 'accepted') throw new HttpsError('failed-precondition', 'العملية مقبولة بالفعل');

  if (action === 'reject') {
    await txRef.update({ used: true, reviewStatus: 'rejected', rejectReason: note || 'admin_rejected', reviewedBy: request.auth.uid, reviewedAt: FV.serverTimestamp() });
    await db.collection('adminLogs').add({ action: 'payment_review_reject', txDocId, adminUid: request.auth.uid, reason: note, timestamp: FV.serverTimestamp() });
    return { ok: true, reviewStatus: 'rejected' };
  }
  const paymentId = String(request.data?.paymentId || '').trim();
  if (!paymentId) throw new HttpsError('invalid-argument', 'اختر الطلب المراد ربط العملية به');
  if (tx.used) throw new HttpsError('failed-precondition', 'هذه العملية مستخدمة أو مرفوضة ولا يمكن قبولها');
  const r = await pv.confirmPaymentWithTx(paymentId, txDocId, { force: true, adminUid: request.auth.uid });
  if (r.duplicate) throw new HttpsError('failed-precondition', 'رقم العملية مستخدم من قبل لنفس طريقة الدفع — تم رفض الطلب كعملية مكررة');
  if (!r.ok) throw new HttpsError('failed-precondition', 'تعذر الربط: تأكد أن الطلب ما زال بانتظار التحقق');
  await db.collection('adminLogs').add({ action: 'payment_review_accept', txDocId, paymentId, adminUid: request.auth.uid, timestamp: FV.serverTimestamp() });
  return { ok: true, reviewStatus: 'accepted' };
});

/** طلبات معلّقة يمكن ربط عملية بها (لقائمة الاختيار في صفحة المراجعة). */
exports.adminListPendingPayments = onCall(async (request) => {
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const snap = await db.collection('payments').where('status', '==', 'pending_verification').limit(100).get();
  return { items: snap.docs.map((d) => { const p = d.data(); return { id: d.id, orderNumber: p.orderNumber || '', amount: p.amount, courseName: p.courseName || '', type: p.type || 'course', paymentPhone: p.paymentPhone || '', userName: p.userName || '' }; }) };
});

/** الاستعلام عن حالة عملية (تمت / لم تتم / قيد التنفيذ / غير موجودة). */
exports.adminCheckTransactionStatus = onCall(async (request) => {
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const txId = String(request.data?.txId || '').trim();
  const orderNumber = String(request.data?.orderNumber || '').trim();
  if (!txId && !orderNumber) throw new HttpsError('invalid-argument', 'اكتب رقم العملية أو رقم الطلب');
  let providerKey = String(request.data?.providerKey || '').trim();
  if (!providerKey && request.data?.provider) {
    const p = pv.matchProvider(await pv.loadProviders(), '', String(request.data.provider));
    providerKey = p?.key || '';
  }
  return pv.checkTransactionStatus({ txId, providerKey, orderNumber, amount: request.data?.amount });
});


/* ---------- بوابات الدفع (إدارة المحافظ): تُحفظ مع مزود الخدمة المطابق لتطبيق البوابة/البوت ---------- */
const GROUPS = ['wallet', 'instapay', 'telda', 'card', 'bank'];

/** يعيد حساب مزود الدفع (paymentProviders) من البوابات الحالية: مفعّل لو فيه بوابة مفعّلة بنفس المزود. */
async function resyncProvider(providerKey) {
  if (!providerKey) return;
  const snap = await db.collection('paymentMethods').where('providerKey', '==', providerKey).get();
  const ref = db.collection('paymentProviders').doc(providerKey);
  if (snap.empty) { await ref.delete().catch(() => {}); return; }
  const docs = snap.docs.map((d) => d.data());
  const aliases = Array.from(new Set(docs.flatMap((m) => [m.providerName, m.name, ...(Array.isArray(m.senderAliases) ? m.senderAliases : [])]).map((x) => String(x || '').trim()).filter(Boolean)));
  await ref.set({ key: providerKey, name: String(docs[0].providerName || ''), aliases, active: docs.some((m) => m.active !== false), updatedAt: FV.serverTimestamp() }, { merge: true });
  pv.loadProviders(true).catch(() => {});
}

exports.adminSaveGateway = onCall(async (request) => {
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const d = request.data || {};
  const id = String(d.id || '').trim();
  const group = String(d.group || '').trim();
  const name = String(d.name || '').trim().slice(0, 80);
  const providerName = String(d.providerName || '').trim().slice(0, 80);
  const providerKey = String(d.providerKey || '').trim();
  const number = String(d.number || '').trim().slice(0, 40);
  const logoUrl = String(d.logoUrl || '');
  if (!GROUPS.includes(group)) throw new HttpsError('invalid-argument', 'اختر مجموعة الدفع');
  if (!name) throw new HttpsError('invalid-argument', 'اكتب اسم الخدمة');
  if (providerName.length < 3 || !/^[A-Za-z0-9_]+$/.test(providerKey)) throw new HttpsError('invalid-argument', 'اكتب اسم مزود الخدمة (3 أحرف على الأقل)');
  if (number.replace(/[^\d+]/g, '').length < 5) throw new HttpsError('invalid-argument', 'اكتب الرقم الذي سيتم التحويل عليه');
  if (logoUrl && (!/^data:image\/(png|jpeg|webp);base64,/.test(logoUrl) || logoUrl.length > 150000)) throw new HttpsError('invalid-argument', 'صورة المزود غير صالحة أو كبيرة');

  const data = {
    group, name, providerName, providerKey, accountNumber: number, accounts: [{ label: name, number }],
    logoUrl, sortOrder: Number(d.sortOrder) || 1, active: d.active !== false, updatedAt: FV.serverTimestamp(),
  };
  let oldKey = '';
  let ref;
  if (id) {
    ref = db.collection('paymentMethods').doc(id);
    const old = await ref.get();
    if (!old.exists) throw new HttpsError('not-found', 'البوابة غير موجودة');
    oldKey = String(old.data()?.providerKey || '');
    await ref.set(data, { merge: true });
  } else {
    ref = db.collection('paymentMethods').doc();
    await ref.set({ ...data, createdAt: FV.serverTimestamp() });
  }
  await resyncProvider(providerKey);
  if (oldKey && oldKey !== providerKey) await resyncProvider(oldKey);
  return { ok: true, id: ref.id };
});

exports.adminDeleteGateway = onCall(async (request) => {
  if (!(await isAdminReq(request))) throw new HttpsError('permission-denied', 'للأدمن فقط');
  const id = String(request.data?.id || '').trim();
  if (!id) throw new HttpsError('invalid-argument', 'بيانات غير صحيحة');
  const ref = db.collection('paymentMethods').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const key = String(snap.data()?.providerKey || '');
  await ref.delete();
  await resyncProvider(key);
  return { ok: true };
});
