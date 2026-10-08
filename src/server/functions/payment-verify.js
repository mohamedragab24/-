/**
 * التحقق التلقائي من الدفع عبر رسائل بوت تليجرام (أو أي مصدر يرسل نص رسالة التحويل).
 *
 * الفكرة:
 *  1) كل رسالة تحويل تصل للبوت تُحفظ في telegramTransactions بعد استخراج: رقم المحوِّل، المبلغ، رقم العملية، التاريخ والوقت.
 *  2) الطلب (payments) يُنشأ بحالة pending_verification.
 *  3) عندما يتطابق: رقم الهاتف + المبلغ + (وقت العملية >= وقت إنشاء الطلب بالدقيقة) → يُؤكَّد الطلب فورًا ويُفعَّل الكورس.
 *  4) كل عملية تليجرام تُستخدم مرة واحدة فقط، ورقم العملية + طريقة الدفع لا يُقبلان مرتين أبدًا (paymentTxKeys).
 *  5) تُقبل فقط رسائل مزودي الدفع المضافين والمفعّلين من لوحة التحكم (paymentProviders).
 */
const admin = require('firebase-admin');

const getDb = () => admin.firestore();
const FV = () => admin.firestore.FieldValue;

// نافذة القبول: تُقبل العملية حتى 10 دقائق قبل وقت الطلب (بالدقيقة، لتحمل فرق ساعة الجوال)، وترفض إذا سبقته بـ 11 دقيقة أو أكثر
const GRACE_MINUTES = Number(process.env.PAYMENT_MATCH_GRACE_MINUTES || 10);
// مدة صلاحية الطلب المعلّق بالدقائق
const ORDER_TTL_MINUTES = Number(process.env.PAYMENT_ORDER_TTL_MINUTES || 180);


/* ---------- مزودو الدفع المسموح بهم (يُدارون من لوحة التحكم: paymentProviders) ---------- */
const DEFAULT_PROVIDERS = [
  { key: 'vodafone_cash', name: 'فودافون كاش', aliases: ['vodafone cash', 'vodafone', 'فودافون', 'vf-cash', 'vfcash'] },
  { key: 'orange_cash', name: 'أورنج كاش', aliases: ['orange cash', 'orange', 'اورنج', 'أورنج'] },
  { key: 'etisalat_cash', name: 'اتصالات كاش', aliases: ['etisalat cash', 'etisalat', 'اتصالات'] },
  { key: 'we_pay', name: 'وي باي', aliases: ['we pay', 'wepay', 'وي باي'] },
];
/** تطبيع النص العربي/الإنجليزي للمقارنة (بدون مسافات/تشكيل/همزات) */
const normProv = (s) => String(s || '').toLowerCase()
  .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^a-z0-9\u0621-\u064A]/g, '');
let providersCache = { at: 0, list: null };
/** يقرأ المزودين من paymentProviders؛ لو الجدول فارغ يزرع المزودين الافتراضيين مرة واحدة. */
async function loadProviders(force = false) {
  if (!force && providersCache.list && Date.now() - providersCache.at < 30000) return providersCache.list;
  const db = getDb();
  let snap = await db.collection('paymentProviders').get();
  if (snap.empty) {
    const batch = db.batch();
    DEFAULT_PROVIDERS.forEach((p, i) => batch.set(db.collection('paymentProviders').doc(p.key), { ...p, active: true, sortOrder: i + 1, createdAt: FV().serverTimestamp() }));
    await batch.commit();
    snap = await db.collection('paymentProviders').get();
  }
  const list = snap.docs.map((d) => ({ key: d.id, ...d.data() }));
  providersCache = { at: Date.now(), list };
  return list;
}
/**
 * يحدد مزود الرسالة. لو الرسالة تحمل سطر "طريقة الدفع: X" (تطبيق بوابة الدفع) يجب أن يطابق X مزودًا مفعّلًا،
 * وإلا نبحث عن اسم/لقب المزود داخل النص. أي رسالة لا تطابق مزودًا مفعّلًا تُرفض ولا تتحول لعملية دفع.
 */
function matchProvider(providers, text, explicitName) {
  const active = (providers || []).filter((p) => p.active !== false);
  const namesOf = (p) => [p.key, p.name, ...(Array.isArray(p.aliases) ? p.aliases : [])].map(normProv).filter((x) => x.length >= 3);
  if (explicitName) {
    const e = normProv(explicitName);
    if (e.length < 3) return null;
    return active.find((p) => namesOf(p).some((n) => e === n || e.includes(n) || n.includes(e))) || null;
  }
  const hay = normProv(text);
  return active.find((p) => namesOf(p).some((n) => hay.includes(n))) || null;
}
/** مفتاح منع التكرار: رقم العملية + طريقة الدفع (المزود) */
const txKeyId = (providerKey, txId) => `${String(providerKey).replace(/[^A-Za-z0-9_-]/g, '')}__${String(txId).replace(/[^A-Za-z0-9]/g, '')}`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------- أدوات النص ---------- */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function normalizeDigits(s) {
  return String(s || '')
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٫]/g, '.')
    .replace(/[٬]/g, ',');
}

/** آخر 10 أرقام من رقم الهاتف (يوحّد 010... و +2010... و 2010...) */
function phoneKey(raw) {
  const digits = normalizeDigits(raw).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/* ---------- توقيت القاهرة ---------- */
function cairoOffsetMinutes(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}
function cairoLocalToUtcMs(y, mo, d, h, mi) {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = naive - 2 * 3600000;
  for (let i = 0; i < 2; i++) guess = naive - cairoOffsetMinutes(guess) * 60000;
  return guess;
}

/* ---------- استخراج بيانات الرسالة ---------- */
/**
 * يدعم صيغًا مثل:
 *  "تم استلام مبلغ 150.00 جنيه من 01012345678 ... رقم العملية 123456789 ... 05-10-26 13:10"
 *  "You have received EGP 150 from 01012345678. Transaction ID: ABC123456 on 05/10/2026 13:10"
 * إذا كانت صيغة رسائلك مختلفة، أرسل لي نموذجًا وأعدّل الـ regex هنا فقط.
 */
function parsePaymentMessage(text, fallbackDateMs) {
  const raw = String(text || '');
  const t = normalizeDigits(raw);
  const out = { amount: null, phone: '', phoneKey: '', txId: '', timeMs: null, providerName: '' };

  // المبلغ
  const amountPatterns = [
    /(?:مبلغ|amount|قيمة|received|استلام|تحويل)\D{0,12}?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:جنيه|ج\.?\s?م|EGP|LE|L\.E)?/i,
    /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:جنيه|ج\.?\s?م|EGP|LE|L\.E)/i,
    /(?:EGP|LE|L\.E|جنيه)\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/i,
  ];
  for (const re of amountPatterns) {
    const m = t.match(re);
    if (m) { const n = Number(String(m[1]).replace(/,/g, '')); if (Number.isFinite(n) && n > 0) { out.amount = n; break; } }
  }

  // رقم الهاتف المحوِّل (موبايل مصري). نفضّل الرقم بعد كلمة "من/from"
  const mobileRe = /(?:\+?20|0)?1[0125]\d{8}/g;
  const fromMatch = t.match(/(?:من|from|المحول|sender)\D{0,25}?((?:\+?20|0)?1[0125]\d{8})/i);
  if (fromMatch) out.phone = fromMatch[1];
  else { const all = t.match(mobileRe); if (all && all.length) out.phone = all[0]; }
  out.phoneKey = phoneKey(out.phone);

  // رقم العملية
  const idMatch = t.match(/(?:رقم\s*(?:العملية|المعاملة|المرجع|العمليه)|المرجع|transaction\s*(?:id|no\.?|number)?|trx\s*(?:id)?|txn\s*(?:id)?|ref(?:erence)?(?:\s*(?:no\.?|number|id))?|id)\s*[:：#\-]?\s*([A-Za-z0-9]{6,})/i);
  if (idMatch) out.txId = idMatch[1];

  // طريقة الدفع/المزود (يرسلها تطبيق بوابة الدفع في سطر "طريقة الدفع: ...")
  const provMatch = t.match(/(?:طريقة\s*الدفع|payment\s*method|provider|المزود)\s*[:：]\s*([^\n\r]+)/i);
  if (provMatch) out.providerName = provMatch[1].trim();

  // التاريخ والوقت  (dd-mm-yy HH:mm) أو (dd/mm/yyyy HH:mm) أو (yyyy-mm-dd HH:mm)
  // ملاحظة: علامة ص/م تُقرأ فقط إذا كانت ملاصقة للوقت وليست بداية كلمة (مثل "من") وإلا تتحول الساعة خطأً إلى PM
  const MER = '(?::\\d{2})?\\s*(ص|م|AM|PM|am|pm)?(?![\\u0621-\\u064AA-Za-z])';
  let m = t.match(new RegExp('(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})[\\sT,،]+(\\d{1,2}):(\\d{2})' + MER));
  let y, mo, d, h, mi, mer = '';
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +m[4]; mi = +m[5]; mer = m[6] || ''; }
  else {
    m = t.match(new RegExp('(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{2,4})[\\sT,،]+(\\d{1,2}):(\\d{2})' + MER));
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; h = +m[4]; mi = +m[5]; mer = m[6] || ''; }
  }
  if (y) {
    // صيغة 12 ساعة
    const pm = /^(م|PM|pm)$/.test(mer), am = /^(ص|AM|am)$/.test(mer);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    out.timeMs = cairoLocalToUtcMs(y, mo, d, h, mi);
  } else if (fallbackDateMs) {
    out.timeMs = fallbackDateMs;
  }
  return out;
}

/* ---------- مطابقة وتأكيد ---------- */
const floorMinute = (ms) => Math.floor(ms / 60000) * 60000;
const toMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : (ts ? new Date(ts).getTime() : 0));

function isMatch(payment, tx) {
  if (!payment || !tx) return false;
  if (payment.status !== 'pending_verification' || tx.used) return false;
  if (!tx.phoneKey || phoneKey(payment.paymentPhone) !== tx.phoneKey) return false;
  if (!Number.isFinite(tx.amount) || Math.abs(Number(payment.amount) - Number(tx.amount)) > 0.01) return false;
  if (!tx.timeMs) return false;
  const orderMs = toMs(payment.createdAt);
  if (!orderMs) return false;
  // المقارنة بالدقيقة (مثل ما يظهر للمستخدم HH:mm):
  //  - قبل الطلب بـ 10 دقائق أو أقل: مقبولة   | قبل الطلب بـ 11 دقيقة أو أكثر: مرفوضة
  //  - بعد الطلب: مقبولة طالما الطلب لم تنتهِ صلاحيته (ORDER_TTL_MINUTES)
  const tMin = floorMinute(tx.timeMs), oMin = floorMinute(orderMs);
  return tMin >= oMin - GRACE_MINUTES * 60000 && tMin <= oMin + ORDER_TTL_MINUTES * 60000;
}

/** رصيد المحفظة الحالي داخل transaction (نفس منطق adminAdjustWallet). كل القراءات هنا قبل أي كتابة. */
async function readWalletState(t, uid) {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const walletRef = db.collection('wallets').doc(uid);
  const [walletSnap, userSnap] = await Promise.all([t.get(walletRef), t.get(userRef)]);
  let balance = Number(walletSnap.data()?.balance);
  if (!Number.isFinite(balance)) balance = Number(userSnap.data()?.balance);
  if (!Number.isFinite(balance)) {
    balance = 0;
    const ledger = await t.get(userRef.collection('transactions'));
    ledger.forEach((d) => {
      const x = d.data() || {};
      if (['rejected', 'pending', 'cancelled'].includes(String(x.status || ''))) return;
      const n = Number(x.amount || 0);
      if (['deposit', 'earning', 'refund'].includes(String(x.type || ''))) balance += n; else balance -= n;
    });
  }
  return { balance: round2(balance), userRef, walletRef };
}

/**
 * يؤكد الطلب بشكل ذري: يفعّل الكورس أو يشحن المحفظة.
 * - منع التكرار: مفتاح (طريقة الدفع + رقم العملية) في paymentTxKeys؛ لو مستخدم من قبل يُرفض الطلب كعملية مكررة.
 * - opts.force: مراجعة يدوية من الأدمن (يتجاوز مطابقة الرقم/الوقت لكن لا يتجاوز منع التكرار).
 * يرجع { ok, duplicate }.
 */
async function confirmPaymentWithTx(paymentId, txDocId, opts = {}) {
  const db = getDb();
  const payRef = db.collection('payments').doc(paymentId);
  const txRef = db.collection('telegramTransactions').doc(txDocId);
  let outcome = null; // 'confirmed' | 'duplicate'
  let confirmed = null;

  await db.runTransaction(async (t) => {
    outcome = null; confirmed = null;
    const [paySnap, txSnap] = await Promise.all([t.get(payRef), t.get(txRef)]);
    if (!paySnap.exists || !txSnap.exists) return;
    const payment = paySnap.data(); const tx = txSnap.data();
    if (opts.force) { if (payment.status !== 'pending_verification' || tx.used) return; }
    else if (!isMatch(payment, tx)) return;

    const keyRef = tx.txId && tx.providerKey ? db.collection('paymentTxKeys').doc(txKeyId(tx.providerKey, tx.txId)) : null;
    const keySnap = keyRef ? await t.get(keyRef) : null;
    const used = !!(keySnap && keySnap.exists && keySnap.data()?.paymentId !== paymentId);
    const isTopup = payment.type === 'wallet_topup';
    const wallet = (isTopup && !used) ? await readWalletState(t, payment.uid) : null;
    const now = FV().serverTimestamp();

    if (used) {
      t.update(payRef, { status: 'rejected', rejectReason: 'duplicate_transaction', rejectNote: 'رقم العملية مستخدم من قبل لنفس طريقة الدفع', rejectedAt: now });
      t.update(txRef, { used: true, reviewStatus: 'duplicate', duplicateOfPaymentId: String(keySnap.data()?.paymentId || ''), rejectedPaymentId: paymentId, reviewedAt: now });
      outcome = 'duplicate';
      return;
    }

    t.update(payRef, {
      status: 'completed', completedAt: now, verifiedBy: opts.force ? 'admin' : 'telegram',
      providerTxId: tx.txId || '', providerTxTime: admin.firestore.Timestamp.fromMillis(tx.timeMs || Date.now()),
      telegramTxDocId: txDocId, verifiedAmount: tx.amount ?? null,
      providerKey: tx.providerKey || '', providerName: tx.providerName || '',
    });
    t.update(txRef, {
      used: true, usedByPaymentId: paymentId, usedAt: now, reviewStatus: 'accepted',
      paymentId, uid: payment.uid, courseId: String(payment.courseId || ''), orderNumber: String(payment.orderNumber || ''),
      kind: isTopup ? 'wallet_topup' : 'course', reviewedAt: now,
      userName: String(payment.userName || ''), courseName: String(payment.courseName || ''), email: String(payment.email || ''), orderAmount: Number(payment.amount || 0),
      ...(opts.force ? { manualReview: true, reviewedBy: String(opts.adminUid || '') } : {}),
    });
    if (keyRef) t.set(keyRef, { providerKey: tx.providerKey, txId: String(tx.txId), paymentId, txDocId, uid: payment.uid, createdAt: now });

    if (isTopup) {
      const amount = round2(payment.amount);
      const next = round2(wallet.balance + amount);
      t.set(wallet.walletRef, { balance: next, updatedAt: now }, { merge: true });
      t.set(wallet.userRef, { balance: next, updatedAt: now }, { merge: true });
      t.set(wallet.userRef.collection('transactions').doc(`topup_${paymentId}`), {
        amount, type: 'deposit', status: 'completed', details: `شحن المحفظة عبر ${tx.providerName || payment.paymentMethodName || 'بوابة الدفع'}`,
        source: 'payment_gateway', paymentId, orderNumber: String(payment.orderNumber || ''), providerTxId: tx.txId || '',
        paymentMethod: String(payment.paymentMethod || ''), timestamp: now, balanceAfter: next,
      });
    } else {
      t.set(db.collection('purchases').doc(`${payment.uid}_${payment.courseId}`), {
        uid: payment.uid, courseId: payment.courseId, status: 'completed', amountPaid: Number(payment.amount || 0),
        paymentId, orderNumber: String(payment.orderNumber || ''), paymentMethod: String(payment.paymentMethod || ''),
        paymentPhone: String(payment.paymentPhone || ''), source: String(payment.source || 'web'),
        purchasedAt: now, updatedAt: now,
      }, { merge: true });
    }
    confirmed = payment; outcome = 'confirmed';
  });

  if (outcome === 'duplicate') return { ok: false, duplicate: true };
  if (!confirmed) return { ok: false, duplicate: false };

  // إشعار داخل التطبيق (الـ triggers لا تعمل على Vercel، لذا نكتب الإشعار هنا)
  try {
    const isTopup = confirmed.type === 'wallet_topup';
    let title = 'الكورس';
    if (!isTopup) { const courseSnap = await db.collection('courses').doc(confirmed.courseId).get(); title = courseSnap.data()?.title || confirmed.courseName || 'الكورس'; }
    await db.collection('users').doc(confirmed.uid).collection('notifications').doc(`purchase_${paymentId}`).set({
      title: isTopup ? 'تم شحن المحفظة' : 'تم تأكيد شراء الكورس',
      body: isTopup ? `تمت إضافة ${round2(confirmed.amount)} جنيه إلى محفظتك.` : `تم تفعيل ${title} في حسابك ويمكنك بدء المشاهدة الآن.`,
      type: isTopup ? 'wallet_topup' : 'purchase_completed', courseId: String(confirmed.courseId || ''), read: false, createdAt: FV().serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.error('payment notification failed', e); }
  return { ok: true, duplicate: false };
}

/** يبحث عن عملية تليجرام مطابقة لهذا الطلب ويؤكده. */
async function tryConfirmPayment(paymentId) {
  const db = getDb();
  const paySnap = await db.collection('payments').doc(paymentId).get();
  if (!paySnap.exists) return { status: 'not_found' };
  const payment = paySnap.data();
  if (payment.status === 'completed') return { status: 'completed' };
  if (payment.status !== 'pending_verification') return { status: payment.status };

  const ageMin = (Date.now() - toMs(payment.createdAt)) / 60000;
  if (ageMin > ORDER_TTL_MINUTES) {
    await paySnap.ref.update({ status: 'expired', expiredAt: FV().serverTimestamp() });
    return { status: 'expired' };
  }
  const key = phoneKey(payment.paymentPhone);
  if (!key) return { status: 'pending_verification' };
  const txs = await db.collection('telegramTransactions').where('phoneKey', '==', key).where('used', '==', false).get();
  for (const d of txs.docs) {
    if (!isMatch(payment, d.data())) continue;
    const r = await confirmPaymentWithTx(paymentId, d.id);
    if (r.ok) return { status: 'completed' };
    if (r.duplicate) return { status: 'rejected', reason: 'duplicate_transaction' };
  }
  return { status: 'pending_verification' };
}

/** يحفظ رسالة التحويل (من مزود مضاف فقط) ثم يحاول مطابقتها مع الطلبات المعلّقة. */
async function ingestPaymentMessage({ text, docId, dateMs, source }) {
  const db = getDb();
  const ref = db.collection('telegramTransactions').doc(docId);
  if ((await ref.get()).exists) return { duplicate: true };
  const parsed = parsePaymentMessage(text, dateMs);
  const parseOk = Boolean(parsed.amount && parsed.phoneKey && parsed.timeMs);
  const provider = matchProvider(await loadProviders(), text, parsed.providerName);
  const base = {
    rawText: String(text || '').slice(0, 2000), source: source || 'telegram',
    amount: parsed.amount, phone: parsed.phone, phoneKey: parsed.phoneKey, txId: parsed.txId, timeMs: parsed.timeMs, parseOk,
    providerKey: provider?.key || '', providerName: provider?.name || parsed.providerName || '', receivedAt: FV().serverTimestamp(),
  };

  // 1) مزود غير مضاف/غير مفعّل: لا تتحول لعملية دفع (تُحفظ للمراجعة فقط كمرفوضة)
  if (!provider) {
    await ref.set({ ...base, used: true, reviewStatus: 'rejected', rejectReason: 'provider_not_allowed' });
    return { parseOk, ignored: true, reason: 'provider_not_allowed', parsed };
  }

  // 2) منع التكرار: نفس رقم العملية + نفس طريقة الدفع
  if (parsed.txId) {
    const keySnap = await db.collection('paymentTxKeys').doc(txKeyId(provider.key, parsed.txId)).get();
    let dupOf = keySnap.exists ? String(keySnap.data()?.paymentId || '') : null;
    if (dupOf === null) {
      const same = await db.collection('telegramTransactions').where('txId', '==', parsed.txId).where('providerKey', '==', provider.key).limit(3).get();
      const other = same.docs.find((d) => d.id !== docId && d.data().reviewStatus !== 'rejected');
      if (other) dupOf = String(other.data()?.paymentId || '');
    }
    if (dupOf !== null) {
      await ref.set({ ...base, used: true, reviewStatus: 'duplicate', rejectReason: 'duplicate_transaction', duplicateOfPaymentId: dupOf });
      return { duplicate: true, duplicateTx: true, reason: 'duplicate_transaction', parsed };
    }
  }

  await ref.set({ ...base, used: false, reviewStatus: 'pending_review' });
  if (!parseOk) return { parseOk: false, parsed, provider: provider.name };

  const pending = await db.collection('payments').where('paymentPhoneKey', '==', parsed.phoneKey).where('status', '==', 'pending_verification').get();
  const txData = { ...parsed, providerKey: provider.key, providerName: provider.name, used: false };
  const results = []; const orders = []; let rejectedDuplicate = false;
  for (const p of pending.docs) {
    if (!isMatch(p.data(), txData)) continue;
    const r = await confirmPaymentWithTx(p.id, docId);
    if (r.ok) { results.push(p.id); orders.push(String(p.data().orderNumber || '')); break; }
    if (r.duplicate) { rejectedDuplicate = true; break; }
  }
  return { parseOk: true, parsed, provider: provider.name, confirmed: results, orders, rejectedDuplicate };
}

const STATUS_LABELS = { done: 'تمت', not_done: 'لم تتم', pending: 'قيد التنفيذ', not_found: 'غير موجودة' };
const STATUS_RANK = { done: 4, pending: 3, not_done: 2, not_found: 1 };

/**
 * الاستعلام عن حالة عملية: بالطلب (paymentId/orderNumber) و/أو برقم العملية (+ المزود).
 * المصدر الأساسي سجلات النظام نفسها. ولو مزود الدفع يوفّر واجهة رسمية، اضبط PAYMENT_STATUS_ENDPOINTS
 * كـ JSON: {"vodafone_cash":"https://.../status"} فيُستعلم منها أيضًا (POST {txId, amount} ← {status}).
 */
async function checkTransactionStatus(q = {}) {
  const db = getDb();
  const txId = String(q.txId || '').trim();
  const providerKey = String(q.providerKey || '').trim();
  const best = { status: 'not_found', source: 'internal', details: {} };
  const consider = (status, extra = {}) => { if (STATUS_RANK[status] > STATUS_RANK[best.status]) { best.status = status; Object.assign(best.details, extra); } };

  // 1) من جهة الطلب
  let payDoc = null;
  if (q.paymentId) { const s = await db.collection('payments').doc(String(q.paymentId)).get(); if (s.exists) payDoc = s; }
  else if (q.orderNumber) { const s = await db.collection('payments').where('orderNumber', '==', String(q.orderNumber).trim()).limit(1).get(); if (!s.empty) payDoc = s.docs[0]; }
  if (payDoc) {
    let p = payDoc.data();
    if (p.status === 'pending_verification') { await tryConfirmPayment(payDoc.id); p = (await payDoc.ref.get()).data(); }
    const order = { paymentId: payDoc.id, orderNumber: p.orderNumber || '', status: p.status, amount: p.amount, type: p.type || 'course', courseName: p.courseName || '', uid: p.uid };
    if (p.status === 'completed') consider('done', { order });
    else if (p.status === 'pending_verification') consider('pending', { order, note: 'الطلب مسجّل ولم تصل رسالة عملية مطابقة له بعد' });
    else consider('not_done', { order, note: p.rejectReason === 'duplicate_transaction' ? 'رُفضت العملية لأن رقمها مستخدم من قبل' : 'الطلب منتهي أو مرفوض' });
  }

  // 2) من جهة رقم العملية
  if (txId) {
    let docs = [];
    if (providerKey) {
      const k = await db.collection('paymentTxKeys').doc(txKeyId(providerKey, txId)).get();
      if (k.exists) consider('done', { usedByPaymentId: k.data()?.paymentId || '' });
    }
    let qy = db.collection('telegramTransactions').where('txId', '==', txId);
    if (providerKey) qy = qy.where('providerKey', '==', providerKey);
    docs = (await qy.limit(5).get()).docs;
    docs.forEach((d) => {
      const x = d.data();
      const brief = { txDocId: d.id, reviewStatus: x.reviewStatus || '', amount: x.amount, provider: x.providerName || '', from: x.phone || '' };
      if (x.reviewStatus === 'accepted') consider('done', { tx: brief, paymentId: x.paymentId || '' });
      else if (x.reviewStatus === 'pending_review') consider('pending', { tx: brief, note: 'وصلت رسالة العملية وهي قيد المراجعة/لم تُربط بطلب' });
      else consider('not_done', { tx: brief, note: x.reviewStatus === 'duplicate' ? 'عملية مكررة' : 'عملية مرفوضة' });
    });
  }

  // 3) واجهة رسمية للمزود (اختيارية)
  try {
    const endpoints = JSON.parse(process.env.PAYMENT_STATUS_ENDPOINTS || '{}');
    const url = providerKey && endpoints[providerKey];
    if (url && txId) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId, amount: q.amount ?? null }) });
      const j = await r.json().catch(() => ({}));
      if (STATUS_LABELS[j?.status]) { best.details.provider = { status: j.status }; if (STATUS_RANK[j.status] >= STATUS_RANK[best.status]) { best.status = j.status; best.source = 'provider'; } }
    }
  } catch (e) { console.error('provider status api failed', e); }

  return { ok: true, status: best.status, label: STATUS_LABELS[best.status], source: best.source, details: best.details };
}

/** رد اختياري على تليجرام (يتطلب TELEGRAM_BOT_TOKEN). */
async function telegramReply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) { console.error('telegram reply failed', e); }
}

module.exports = { isMatch, parsePaymentMessage, phoneKey, normalizeDigits, tryConfirmPayment, confirmPaymentWithTx, ingestPaymentMessage, telegramReply, ORDER_TTL_MINUTES, loadProviders, matchProvider, txKeyId, checkTransactionStatus, DEFAULT_PROVIDERS, normProv };
