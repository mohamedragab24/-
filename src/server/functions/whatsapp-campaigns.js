'use strict';

/**
 * حملات واتساب الإعلانية (أدمن فقط).
 * الفكرة: السيرفر يبني قائمة المستلمين (whatsappCampaigns/{id}/recipients)، والجسر (bridge) هو اللي
 * بيرسل واحد واحد بتأخير عشوائي وحد يومي وإيقاف تلقائي عند تكرار الأخطاء.
 * الحملة لا تبدأ إلا بعد إرسال تجربة لرقم الأدمن نفسه.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('./shim').https;

const db = () => admin.firestore();
const MAX_RECIPIENTS = 2000;
const MAX_RAW_CHARS = 400000;

/** يطلّع الأرقام المحتملة من نص حر (لصق أو ملف): سطر سطر، وبفواصل , ; | tab */
function extractCandidates(text) {
  const out = [];
  const lines = String(text || '').slice(0, MAX_RAW_CHARS).split(/\r?\n/);
  for (const line of lines) {
    for (const piece of line.split(/[,;|\t]+/)) {
      const m = piece.match(/\+?\(?\d[\d\s().\-]{5,}\d/g);
      if (m) for (const x of m) out.push(x.trim());
    }
  }
  return out;
}

/**
 * يضبط رقم واحد على صيغة دولية بدون +.
 * القواعد: يشيل المسافات والرموز، 00 = +، الصفر الأول = رقم محلي ويتبدل بكود الدولة الافتراضي،
 * الرقم المصري من غير صفر (10 أرقام تبدأ بـ 1) يتكمل بـ 20. الأرقام المصرية لازم تكون موبايل (10/11/12/15).
 */
function normalizeNumber(raw, defaultCc) {
  const cc = String(defaultCc || '20').replace(/\D/g, '') || '20';
  let plus = String(raw || '').trim().startsWith('+');
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return { error: 'فاضي' };
  if (d.startsWith('00')) { d = d.slice(2); plus = true; }
  if (!plus) {
    if (d.startsWith('0')) d = cc + d.replace(/^0+/, '');
    else if (cc === '20' && d.length === 10 && d.startsWith('1')) d = '20' + d;
  }
  if (d.length < 10) return { error: 'قصير أوي' };
  if (d.length > 15) return { error: 'طويل أوي' };
  if (d.startsWith('20') && !/^20(10|11|12|15)\d{8}$/.test(d)) return { error: 'رقم مصري غير صالح (لازم موبايل 010/011/012/015)' };
  return { wa: d };
}

/** يحلل نص الأرقام: صالح (فريد) + مرفوض + مكرر */
function parseNumbers(text, defaultCc) {
  const valid = new Map();
  const rejected = [];
  let duplicates = 0;
  for (const raw of extractCandidates(text)) {
    const r = normalizeNumber(raw, defaultCc);
    if (r.error) { rejected.push({ raw: raw.slice(0, 40), reason: r.error }); continue; }
    if (valid.has(r.wa)) { duplicates++; continue; }
    valid.set(r.wa, { waId: r.wa, name: '', uid: null });
  }
  return { list: [...valid.values()], rejected, duplicates };
}

const AUDIENCES = { mufhem: ['mufhem'], mustafhem: ['mustafhem'], all: ['mufhem', 'mustafhem'] };
const OPT_OUT_LINE = 'لإيقاف الرسائل الدعائية ارسل: إيقاف';

async function requireAdmin(request) {
  const uid = request?.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول كأدمن');
  const me = (await db().collection('users').doc(uid).get()).data() || {};
  const isAdmin = request?.auth?.token?.admin === true || me.isAdmin === true || me.role === 'admin';
  if (!isAdmin) throw new HttpsError('permission-denied', 'الأدمن فقط');
  return { uid, me };
}

function waNumber(v) {
  return require('./whatsapp-otp').toWaNumber(v);
}

/** يبني قائمة مستلمين فريدة من المستخدمين حسب الشريحة */
async function collectAudience(audience, verifiedOnly) {
  const roles = AUDIENCES[audience];
  if (!roles) throw new HttpsError('invalid-argument', 'الشريحة غير معروفة');
  const out = new Map();
  let withoutPhone = 0;
  let invalid = 0;
  for (const role of roles) {
    const snap = await db().collection('users').where('role', '==', role).get();
    for (const d of snap.docs) {
      const u = d.data() || {};
      if (u.status && u.status !== 'active') continue;
      if (verifiedOnly && u.phoneVerified !== true) continue;
      const raw = u.phoneNumber || u.phone || '';
      if (!raw) { withoutPhone++; continue; }
      const wa = waNumber(raw);
      if (!wa || wa.length < 11 || wa.length > 15) { invalid++; continue; }
      if (!out.has(wa)) out.set(wa, { waId: wa, name: String(u.firstName || u.fullName || '').split(' ')[0] || '', uid: d.id });
    }
  }
  return { list: [...out.values()], withoutPhone, invalid };
}

function buildMessage(text, link) {
  const parts = [String(text || '').trim()];
  if (link) parts.push(String(link).trim());
  parts.push(OPT_OUT_LINE);
  return parts.filter(Boolean).join('\n\n');
}

function cleanUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const x = new URL(s);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
    return x.toString();
  } catch (_) {
    return '';
  }
}

module.exports.previewCampaignAudience = onCall(async (request) => {
  await requireAdmin(request);
  const d = request.data || {};
  if (String(d.audience) === 'custom') {
    const { list, rejected, duplicates } = parseNumbers(d.numbersText, d.defaultCc);
    const optSnap = await db().collection('whatsappOptOut').get();
    const opt = new Set(optSnap.docs.map((x) => x.id));
    const ok = list.filter((r) => !opt.has(r.waId));
    return {
      count: ok.length, total: list.length, optedOut: list.length - ok.length,
      withoutPhone: 0, invalid: rejected.length, duplicates,
      rejected: rejected.slice(0, 40), sample: ok.slice(0, 5).map((r) => r.waId.replace(/\d{4}$/, '****')),
    };
  }
  const { list, withoutPhone, invalid } = await collectAudience(String(d.audience || 'all'), d.verifiedOnly === true);
  const optSnap = await db().collection('whatsappOptOut').get();
  const opt = new Set(optSnap.docs.map((x) => x.id));
  const afterOptOut = list.filter((r) => !opt.has(r.waId)).length;
  return { count: afterOptOut, total: list.length, optedOut: list.length - afterOptOut, withoutPhone, invalid };
});

module.exports.createWhatsappCampaign = onCall(async (request) => {
  const { uid } = await requireAdmin(request);
  const d = request.data || {};
  const name = String(d.name || '').trim().slice(0, 80);
  const text = String(d.text || '').trim().slice(0, 900);
  const link = cleanUrl(d.link);
  const imageUrl = cleanUrl(d.imageUrl);
  if (!name) throw new HttpsError('invalid-argument', 'اكتب اسم للحملة');
  if (!text) throw new HttpsError('invalid-argument', 'اكتب نص الرسالة');
  if (d.link && !link) throw new HttpsError('invalid-argument', 'اللينك غير صحيح');
  const audience = String(d.audience || 'all');
  const { list } = audience === 'custom'
    ? parseNumbers(d.numbersText, d.defaultCc)
    : await collectAudience(audience, d.verifiedOnly === true);
  const optSnap = await db().collection('whatsappOptOut').get();
  const opt = new Set(optSnap.docs.map((x) => x.id));
  const recipients = list.filter((r) => !opt.has(r.waId));
  if (!recipients.length) throw new HttpsError('failed-precondition', 'مفيش مستلمين في الشريحة دي');
  if (recipients.length > MAX_RECIPIENTS) throw new HttpsError('failed-precondition', `الحد الأقصى ${MAX_RECIPIENTS} مستلم في الحملة الواحدة`);

  const dailyCap = Math.min(300, Math.max(10, Number(d.dailyCap) || 100));
  const ref = db().collection('whatsappCampaigns').doc();
  await ref.set({
    name, audience, verifiedOnly: d.verifiedOnly === true, text, link, imageUrl,
    message: buildMessage(text, link),
    status: 'draft', total: recipients.length, sent: 0, failed: 0, skipped: 0,
    dailyCap, batchSize: 10,
    testSentAt: null,
    createdBy: uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  for (let i = 0; i < recipients.length; i += 400) {
    const batch = db().batch();
    for (const r of recipients.slice(i, i + 400)) {
      batch.set(ref.collection('recipients').doc(r.waId), { waId: r.waId, name: r.name, uid: r.uid, status: 'pending' });
    }
    await batch.commit();
  }
  return { ok: true, id: ref.id, total: recipients.length };
});

/** إرسال تجربة (نفس الرسالة بالضبط) لرقم الأدمن */
module.exports.testWhatsappCampaign = onCall(async (request) => {
  await requireAdmin(request);
  const d = request.data || {};
  const phone = waNumber(d.phone);
  if (!phone || phone.length < 11) throw new HttpsError('invalid-argument', 'اكتب رقمك بشكل صحيح');
  const ref = db().collection('whatsappCampaigns').doc(String(d.id || 'x'));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الحملة غير موجودة');
  const c = snap.data() || {};
  const out = db().collection('whatsappOutbox').doc();
  await out.set({
    waId: phone, text: `${c.message}\n\n(تجربة)`, imageUrl: c.imageUrl || '',
    kind: 'campaign-test', campaignId: ref.id, status: 'pending', channel: 'web',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await ref.set({ testSentAt: admin.firestore.FieldValue.serverTimestamp(), testPhone: phone }, { merge: true });
  return { ok: true, outboxId: out.id };
});

module.exports.setWhatsappCampaignStatus = onCall(async (request) => {
  await requireAdmin(request);
  const d = request.data || {};
  const action = String(d.action || '');
  const ref = db().collection('whatsappCampaigns').doc(String(d.id || 'x'));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الحملة غير موجودة');
  const c = snap.data() || {};
  if (action === 'start') {
    if (!c.testSentAt) throw new HttpsError('failed-precondition', 'ابعت تجربة لرقمك الأول وتأكد إنها وصلت.');
    if (!['draft', 'paused'].includes(c.status)) throw new HttpsError('failed-precondition', 'الحملة مش في حالة تسمح بالبدء');
    const running = await db().collection('whatsappCampaigns').where('status', '==', 'running').limit(1).get();
    if (!running.empty && running.docs[0].id !== ref.id) throw new HttpsError('failed-precondition', 'فيه حملة تانية شغالة دلوقتي. اوقفها أو استنى تخلص.');
    await ref.set({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp(), pausedReason: null }, { merge: true });
  } else if (action === 'pause') {
    await ref.set({ status: 'paused', pausedReason: 'manual' }, { merge: true });
  } else if (action === 'stop') {
    await ref.set({ status: 'stopped', stoppedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else {
    throw new HttpsError('invalid-argument', 'إجراء غير معروف');
  }
  return { ok: true };
});
