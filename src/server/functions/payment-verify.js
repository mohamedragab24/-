/**
 * التحقق التلقائي من الدفع عبر رسائل بوت تليجرام (أو أي مصدر يرسل نص رسالة التحويل).
 *
 * الفكرة:
 *  1) كل رسالة تحويل تصل للبوت تُحفظ في telegramTransactions بعد استخراج: رقم المحوِّل، المبلغ، رقم العملية، التاريخ والوقت.
 *  2) الطلب (payments) يُنشأ بحالة pending_verification.
 *  3) عندما يتطابق: رقم الهاتف + المبلغ + (وقت العملية >= وقت إنشاء الطلب بالدقيقة) → يُؤكَّد الطلب فورًا ويُفعَّل الكورس.
 *  4) كل عملية تليجرام تُستخدم مرة واحدة فقط (منع إعادة استخدام نفس الرسالة لطلب آخر).
 */
const admin = require('firebase-admin');

const getDb = () => admin.firestore();
const FV = () => admin.firestore.FieldValue;

// عدد دقائق السماح قبل وقت الطلب (الافتراضي 10: يتحمل فرق ساعة الجوال عن الخادم ويمنع رسائل قديمة جدًا)
const GRACE_MINUTES = Number(process.env.PAYMENT_MATCH_GRACE_MINUTES || 10);
// مدة صلاحية الطلب المعلّق بالدقائق
const ORDER_TTL_MINUTES = Number(process.env.PAYMENT_ORDER_TTL_MINUTES || 180);

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
  const out = { amount: null, phone: '', phoneKey: '', txId: '', timeMs: null };

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
  // العملية يجب ألا تسبق وقت الطلب (بالدقيقة) — مع سماح اختياري
  return floorMinute(tx.timeMs) >= floorMinute(orderMs) - GRACE_MINUTES * 60000;
}

/** يؤكد الطلب بشكل ذري ويفعّل الكورس. يرجع true لو تم التأكيد. */
async function confirmPaymentWithTx(paymentId, txDocId) {
  const db = getDb();
  const payRef = db.collection('payments').doc(paymentId);
  const txRef = db.collection('telegramTransactions').doc(txDocId);
  let confirmed = null;

  await db.runTransaction(async (t) => {
    const [paySnap, txSnap] = await Promise.all([t.get(payRef), t.get(txRef)]);
    if (!paySnap.exists || !txSnap.exists) return;
    const payment = paySnap.data(); const tx = txSnap.data();
    if (!isMatch(payment, tx)) return;
    const now = FV().serverTimestamp();
    const purchaseRef = db.collection('purchases').doc(`${payment.uid}_${payment.courseId}`);
    t.update(payRef, {
      status: 'completed', completedAt: now, verifiedBy: 'telegram',
      providerTxId: tx.txId || '', providerTxTime: admin.firestore.Timestamp.fromMillis(tx.timeMs),
      telegramTxDocId: txDocId, verifiedAmount: tx.amount,
    });
    t.update(txRef, { used: true, usedByPaymentId: paymentId, usedAt: now });
    t.set(purchaseRef, {
      uid: payment.uid, courseId: payment.courseId, status: 'completed', amountPaid: Number(payment.amount || 0),
      paymentId, orderNumber: String(payment.orderNumber || ''), paymentMethod: String(payment.paymentMethod || ''),
      paymentPhone: String(payment.paymentPhone || ''), source: String(payment.source || 'web'),
      purchasedAt: now, updatedAt: now,
    }, { merge: true });
    confirmed = payment;
  });

  if (!confirmed) return false;

  // إشعار داخل التطبيق (الـ triggers لا تعمل على Vercel، لذا نكتب الإشعار هنا)
  try {
    const courseSnap = await db.collection('courses').doc(confirmed.courseId).get();
    const title = courseSnap.data()?.title || confirmed.courseName || 'الكورس';
    await db.collection('users').doc(confirmed.uid).collection('notifications').doc(`purchase_${paymentId}`).set({
      title: 'تم تأكيد شراء الكورس', body: `تم تفعيل ${title} في حسابك ويمكنك بدء المشاهدة الآن.`,
      type: 'purchase_completed', courseId: confirmed.courseId, read: false, createdAt: FV().serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.error('purchase notification failed', e); }
  return true;
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
    if (isMatch(payment, d.data()) && await confirmPaymentWithTx(paymentId, d.id)) return { status: 'completed' };
  }
  return { status: 'pending_verification' };
}

/** يحفظ رسالة التحويل ثم يحاول مطابقتها مع الطلبات المعلّقة. */
async function ingestPaymentMessage({ text, docId, dateMs, source }) {
  const db = getDb();
  const parsed = parsePaymentMessage(text, dateMs);
  const ref = db.collection('telegramTransactions').doc(docId);
  const exists = await ref.get();
  if (exists.exists) return { duplicate: true };
  const parseOk = Boolean(parsed.amount && parsed.phoneKey && parsed.timeMs);
  await ref.set({
    rawText: String(text || '').slice(0, 2000), source: source || 'telegram',
    amount: parsed.amount, phone: parsed.phone, phoneKey: parsed.phoneKey, txId: parsed.txId,
    timeMs: parsed.timeMs, parseOk, used: false, receivedAt: FV().serverTimestamp(),
  });
  if (!parseOk) return { parseOk: false, parsed };

  const pending = await db.collection('payments').where('paymentPhoneKey', '==', parsed.phoneKey).where('status', '==', 'pending_verification').get();
  const txData = { ...parsed, used: false };
  const results = [];
  for (const p of pending.docs) {
    if (isMatch(p.data(), txData) && await confirmPaymentWithTx(p.id, docId)) { results.push(p.id); break; }
  }
  return { parseOk: true, parsed, confirmed: results };
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

module.exports = { parsePaymentMessage, phoneKey, normalizeDigits, tryConfirmPayment, ingestPaymentMessage, telegramReply, ORDER_TTL_MINUTES };
