/**
 * صلاحية الكورس: المفهم يحدد مدة (1–100) + وحدة (يوم/شهر/سنة) أو «مدى الحياة».
 * عند الشراء تُختم نسخة من المدة على سجل الشراء (expiresAt بالمللي ثانية؛ null = مدى الحياة).
 */
const admin = require('firebase-admin');

const MS_DAY = 24 * 60 * 60 * 1000;

/** يرجّع expiresAt (ms) أو null لو مدى الحياة / غير محدد. */
function computeExpiry(course, fromMs = Date.now()) {
  if (!course || course.lifetime === true || course.validityLifetime === true) return null;
  const n = Math.floor(Number(course.validityValue));
  const unit = String(course.validityUnit || '');
  if (!Number.isFinite(n) || n < 1 || n > 100) return null; // كورسات قديمة بلا مدة = مدى الحياة
  const d = new Date(fromMs);
  if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  else if (unit === 'month') d.setMonth(d.getMonth() + n);
  else if (unit === 'day') return fromMs + n * MS_DAY;
  else return null;
  return d.getTime();
}

/** يختم مدة الصلاحية على سجل الشراء لو لم تُختم من قبل. */
async function stampPurchaseExpiry(db, uid, courseId) {
  try {
    const pRef = db.collection('purchases').doc(`${uid}_${courseId}`);
    const [p, c] = [await pRef.get(), await db.collection('courses').doc(courseId).get()];
    if (!p.exists || p.data().expiresAtStamped === true) return;
    const exp = computeExpiry(c.data() || {}, Date.now());
    await pRef.set({ expiresAt: exp, expiresAtStamped: true }, { merge: true });
  } catch (e) { console.error('stampPurchaseExpiry failed', e); }
}

module.exports = { computeExpiry, stampPurchaseExpiry };
