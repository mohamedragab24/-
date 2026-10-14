/** إرسال إشعارات Push (شريط الهاتف) وإشعارات داخل التطبيق لكل المستخدمين — مساعد مشترك (ليس دالة onCall). */
const admin = require('firebase-admin');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;

async function allTokens() {
  const snap = await db.collectionGroup('fcmTokens').get();
  const seen = new Set();
  const out = [];
  for (const d of snap.docs) {
    const token = d.data()?.token;
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push({ token, ref: d.ref });
  }
  return out;
}

/** Push لكل الأجهزة المسجلة: عنوان + وصف + صورة (تظهر في شريط إشعارات الهاتف). */
async function pushToAll({ title, body, imageUrl = '', data = {} }) {
  const tokens = await allTokens();
  let sent = 0, failed = 0, lastError = '';
  const strData = Object.fromEntries(Object.entries({ type: 'admin_campaign', ...data }).map(([k, v]) => [k, String(v ?? '')]));
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));
  for (let i = 0; i < chunks.length; i += 4) {
    await Promise.all(chunks.slice(i, i + 4).map(async (chunk) => {
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: chunk.map((t) => t.token),
          notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
          android: { priority: 'high', notification: { ...(imageUrl ? { imageUrl } : {}), sound: 'default' } },
          apns: { payload: { aps: { sound: 'default', 'mutable-content': 1 } }, ...(imageUrl ? { fcmOptions: { imageUrl } } : {}) },
          data: strData,
        });
        sent += res.successCount; failed += res.failureCount;
        await Promise.all(res.responses.map(async (r, idx) => {
          if (r.success) return;
          lastError = String(r.error?.message || r.error?.code || lastError);
          if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
            try { await chunk[idx].ref.delete(); } catch (_) {}
          }
        }));
      } catch (e) { failed += chunk.length; lastError = String(e?.message || e).slice(0, 300); }
    }));
  }
  return { devices: tokens.length, sent, failed, lastError };
}

/** إشعار داخل التطبيق لكل المستخدمين (يظهر في شاشة الإشعارات). */
async function inAppToAll({ title, body, imageUrl = '', campaign = '', description = '', type = 'admin_campaign', docId }) {
  const users = await db.collection('users').select().get();
  for (let s = 0; s < users.docs.length; s += 200) {
    const batch = db.batch();
    for (const u of users.docs.slice(s, s + 200)) {
      const payload = { title, body, imageUrl, campaign, description, type, deliveryMode: 'in_app', userId: u.id, createdAt: FV.serverTimestamp(), read: false };
      const id = docId || db.collection('_').doc().id;
      batch.set(u.ref.collection('notifications').doc(id), payload, { merge: true });
    }
    await batch.commit();
  }
  return { users: users.size };
}

module.exports = { pushToAll, inAppToAll };
