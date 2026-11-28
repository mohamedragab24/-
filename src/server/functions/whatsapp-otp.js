'use strict';

/**
 * رموز التحقق (OTP) عبر واتساب — منصة فهمت.
 *
 * الفكرة:
 *  - السيرفر يولّد كود من 6 أرقام عشوائيًا (crypto)، ويخزّن هاش الكود فقط في Firestore
 *    (مجموعة whatsappOtps) مع مدة صلاحية 5 دقائق وحد أقصى 5 محاولات.
 *  - الإرسال عبر WhatsApp Cloud API: قالب معتمد (Template) عشان يشتغل في أي وقت،
 *    ولو القالب مش مضبوط أو مرفوض بنرجع لرسالة نصية عادية (بتشتغل جوه نافذة الـ24 ساعة بس).
 *  - التحقق بيتم على السيرفر فقط، ومفيش أي رد بيرجّع الكود نفسه.
 *  - بعد التحقق الناجح بنرجّع Custom Token من Firebase عشان العميل يسجّل دخول
 *    من غير ما يحتاج SMS من Firebase.
 *
 * متغيرات البيئة (كلها اختيارية إلا لو هتستخدم القوالب):
 *  WHATSAPP_OTP_TEMPLATE_NAME   (افتراضي: fahemt_otp)
 *  WHATSAPP_OTP_TEMPLATE_LANG   (افتراضي: ar)
 *  WHATSAPP_OTP_TEMPLATE_MODE   utility | auth  (افتراضي: auth)
 *  WHATSAPP_DEFAULT_COUNTRY_CODE (افتراضي: 20 لمصر)
 *  WHATSAPP_OTP_TTL_MINUTES     (افتراضي: 5)
 */

const crypto = require('crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('./shim').https;

const OTP_COLLECTION = 'whatsappOtps';
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const MIN_SECONDS_BETWEEN_SENDS = 60;

const env = (k) => String(process.env[k] || '').trim();
const db = () => admin.firestore();

function ttlMs() {
  const m = Number(env('WHATSAPP_OTP_TTL_MINUTES') || 5);
  return (Number.isFinite(m) && m > 0 ? m : 5) * 60 * 1000;
}

/** 01027093025 → 201027093025 (صيغة واتساب الدولية بدون +) */
function toWaNumber(input) {
  let digits = String(input || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  const cc = env('WHATSAPP_DEFAULT_COUNTRY_CODE') || '20';
  if (digits.startsWith(cc)) return digits;
  if (digits.startsWith('0')) return cc + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('1')) return cc + digits;
  return digits;
}

/** أشكال الرقم اللي ممكن تكون متخزنة في users.phoneNumber */
function phoneVariants(waNumber) {
  const out = new Set([waNumber]);
  const cc = env('WHATSAPP_DEFAULT_COUNTRY_CODE') || '20';
  if (waNumber.startsWith(cc)) {
    out.add('0' + waNumber.slice(cc.length));
    out.add('+' + waNumber);
  }
  return [...out];
}

async function findUserByPhone(waNumber) {
  for (const v of phoneVariants(waNumber)) {
    for (const field of ['phoneNumber', 'phone']) {
      try {
        const snap = await db().collection('users').where(field, '==', v).limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const u = doc.data() || {};
          return { uid: doc.id, name: u.fullName || u.name || '', role: u.role || '' };
        }
      } catch (e) {
        /* حقل غير موجود أو غير مفهرس: نكمل */
      }
    }
  }
  return null;
}

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : 0);

const hash = (salt, waNumber, code) =>
  crypto.createHash('sha256').update(`${salt}:${waNumber}:${code}`).digest('hex');

function httpError(code, message, cause, fix) {
  return new HttpsError(code, message, { cause: cause || '', fix: fix || '' });
}

async function graphSend(payload) {
  const token = env('WHATSAPP_ACCESS_TOKEN');
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  const version = env('WHATSAPP_GRAPH_VERSION') || 'v25.0';
  if (!token || !phoneId) throw httpError('failed-precondition', 'إعدادات واتساب على السيرفر ناقصة (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Graph API ${res.status}`);
    err.graph = json?.error || null;
    err.status = res.status;
    throw err;
  }
  return json;
}

/** إرسال الكود كقالب معتمد (بيشتغل في أي وقت، مش محتاج نافذة 24 ساعة) */
async function sendViaTemplate(waNumber, code) {
  const name = env('WHATSAPP_OTP_TEMPLATE_NAME') || 'fahemt_otp';
  const lang = env('WHATSAPP_OTP_TEMPLATE_LANG') || 'ar';
  const mode = (env('WHATSAPP_OTP_TEMPLATE_MODE') || 'auth').toLowerCase();

  const components = [{ type: 'body', parameters: [{ type: 'text', text: code }] }];
  // قوالب التحقق (Authentication) بتحتاج الكود مرتين: في النص وفي زر النسخ
  if (mode === 'auth') {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] });
  }
  const res = await graphSend({
    to: waNumber,
    type: 'template',
    template: { name, language: { code: lang }, components },
  });
  return { via: 'template', template: name, lang, mode, messageId: res?.messages?.[0]?.id || null };
}

/** رسالة نصية عادية (بتشتغل جوه 24 ساعة من آخر رسالة للعميل) */
async function sendViaText(waNumber, code, minutes) {
  const body = `كود التحقق الخاص بك على منصة فهمت هو: ${code}\nصالح لمدة ${minutes} دقائق، ولا تشاركه مع أي شخص.`;
  const res = await graphSend({ to: waNumber, type: 'text', text: { preview_url: false, body } });
  return { via: 'text', messageId: res?.messages?.[0]?.id || null };
}

// ===== الإرسال عبر الجسر (واتساب غير رسمي) =====
// الكود بيتكتب في طابور whatsappOutbox (kind:'otp') والجسر بيبعته ويمسح النص بعد الإرسال.
const BRIDGE_HEARTBEAT_DOC = 'bridgeStatus/main';
const BRIDGE_STALE_MS = 90 * 1000;
const BRIDGE_WAIT_MS = 15 * 1000;
const GLOBAL_MAX_PER_HOUR = Number(env('OTP_GLOBAL_MAX_PER_HOUR') || 30);

function transport() {
  const t = env('OTP_TRANSPORT').toLowerCase();
  if (t === 'bridge' || t === 'cloud') return t;
  return env('WHATSAPP_ACCESS_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') ? 'cloud' : 'bridge';
}

async function bridgeIsUp() {
  try {
    const snap = await db().doc(BRIDGE_HEARTBEAT_DOC).get();
    const d = snap.exists ? snap.data() || {} : {};
    return d.ready === true && Date.now() - ms(d.at) < BRIDGE_STALE_MS;
  } catch (_) {
    return false;
  }
}

/** حد أقصى عام للأكواد في الساعة (حماية رقم البوت من الحظر) */
async function reserveGlobalSlot() {
  const key = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const ref = db().collection('whatsappOtpStats').doc(key);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const n = snap.exists ? Number(snap.data().count || 0) : 0;
    if (n >= GLOBAL_MAX_PER_HOUR) return false;
    tx.set(ref, { count: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

async function sendViaBridge(waNumber, code, minutes) {
  if (!(await bridgeIsUp())) {
    throw httpError('unavailable', 'خدمة واتساب مش متاحة دلوقتي. جرّب كمان شوية، ولو المشكلة مستمرة كلم الدعم.');
  }
  if (!(await reserveGlobalSlot())) {
    throw httpError('resource-exhausted', 'ضغط كبير على إرسال الأكواد دلوقتي. جرّب بعد شوية.');
  }
  const text = `كود التحقق الخاص بك على منصة فهمت هو: ${code}\nصالح لمدة ${minutes} دقائق، ولا تشاركه مع أي شخص.`;
  const ref = db().collection('whatsappOutbox').doc();
  await ref.set({
    waId: waNumber,
    text,
    kind: 'otp',
    status: 'pending',
    channel: 'web',
    createdAt: admin.firestore.Timestamp.now(),
  });
  const deadline = Date.now() + BRIDGE_WAIT_MS;
  let last = 'pending';
  let error = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const d = (await ref.get()).data() || {};
    last = d.status || 'pending';
    error = d.error || '';
    if (last === 'sent' || last === 'failed') break;
  }
  if (last === 'sent') return { via: 'bridge', messageId: ref.id };
  // لو لسه pending نلغيه عشان ما يتبعتش متأخر بعد ما نكون رجّعنا خطأ
  if (last === 'pending') {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data().status === 'pending') tx.set(ref, { status: 'cancelled', text: '[cancelled]' }, { merge: true });
    }).catch(() => {});
  }
  if (error === 'not_on_whatsapp') {
    throw httpError('failed-precondition', 'الرقم ده مش عليه واتساب. تأكد من الرقم.');
  }
  throw httpError('unavailable', 'مقدرناش نبعت الكود على واتساب دلوقتي. جرّب بعد شوية.');
}

async function deliver(waNumber, code) {
  const minutes = Math.round(ttlMs() / 60000);
  if (transport() === 'bridge') return sendViaBridge(waNumber, code, minutes);
  try {
    return await sendViaTemplate(waNumber, code);
  } catch (e) {
    // قالب مش موجود/مرفوض/غير معتمد → نرجع للنص العادي
    console.warn('whatsapp OTP template failed, falling back to text:', e?.message);
    const out = await sendViaText(waNumber, code, minutes);
    return { ...out, templateError: String(e?.message || e) };
  }
}

/** إثبات موقّع إن الرقم اتأكد فعلاً (يُستخدم بعد إنشاء الحساب مباشرة) */
function proofSecret() {
  return env('OTP_PROOF_SECRET') || env('WHATSAPP_APP_SECRET') || env('FIREBASE_SERVICE_ACCOUNT') || 'fahemt-otp';
}
function makeProof(waNumber) {
  const exp = Date.now() + 15 * 60 * 1000;
  const payload = `${waNumber}.${exp}`;
  const sig = crypto.createHmac('sha256', proofSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function checkProof(proof, waNumber) {
  const parts = String(proof || '').split('.');
  if (parts.length !== 3) return false;
  const [phone, exp, sig] = parts;
  if (phone !== waNumber) return false;
  if (!Number(exp) || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', proofSecret()).update(`${phone}.${exp}`).digest('base64url');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** إنشاء وإرسال كود */
async function sendOtp(request) {
  const data = request?.data || {};
  const waNumber = toWaNumber(data.phone);
  const purpose = String(data.purpose || 'login');

  if (!waNumber || waNumber.length < 11) throw httpError('invalid-argument', 'رقم الموبايل غير صحيح');
  if (!['login', 'verify', 'register', 'test'].includes(purpose)) throw httpError('invalid-argument', 'نوع الطلب غير معروف');

  const user = await findUserByPhone(waNumber);
  if (!user && purpose !== 'register' && purpose !== 'test') {
    throw httpError('not-found', 'الرقم ده مش مسجل على المنصة. سجّل حساب الأول أو استخدم رقمك المسجل.');
  }

  const ref = db().collection(OTP_COLLECTION).doc(waNumber);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() || {} : {};
  const nowMs = Date.now();

  const lastSent = ms(prev.lastSentAt);
  if (lastSent && nowMs - lastSent < MIN_SECONDS_BETWEEN_SENDS * 1000) {
    const wait = Math.ceil((MIN_SECONDS_BETWEEN_SENDS * 1000 - (nowMs - lastSent)) / 1000);
    throw httpError('resource-exhausted', `استنى ${wait} ثانية قبل ما تطلب كود جديد.`);
  }
  const hourStart = ms(prev.hourStart);
  const sameHour = hourStart && nowMs - hourStart < 60 * 60 * 1000;
  const hourCount = sameHour ? Number(prev.hourCount || 0) : 0;
  if (hourCount >= MAX_SENDS_PER_HOUR) {
    throw httpError('resource-exhausted', 'طلبت كود كتير في آخر ساعة. جرب بعد شوية.');
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + ttlMs());

  await ref.set(
    {
      phone: waNumber,
      codeHash: hash(salt, waNumber, code),
      salt,
      purpose,
      uid: user?.uid || null,
      attempts: 0,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      hourStart: sameHour ? prev.hourStart : admin.firestore.Timestamp.fromMillis(nowMs),
      hourCount: hourCount + 1,
    },
    { merge: true }
  );

  let delivered;
  try {
    delivered = await deliver(waNumber, code);
  } catch (e) {
    await ref.delete().catch(() => {});
    throw httpError('unavailable', `مقدرناش نبعت الكود على واتساب: ${e?.message || e}`);
  }

  await ref.set({ lastSentAt: admin.firestore.FieldValue.serverTimestamp(), lastChannel: delivered.via }, { merge: true });

  return {
    ok: true,
    phone: waNumber,
    expiresInSeconds: Math.round(ttlMs() / 1000),
    channel: delivered.via,
    template: delivered.template || null,
    warning: delivered.templateError ? 'القالب المعتمد مش متاح، الكود اتبعت كرسالة عادية (لازم تكون بتحادث البوت أولاً).' : null,
  };
}

/** التحقق من الكود. عند النجاح: يمسح الكود ويرجّع Custom Token لو الرقم ليه حساب. */
async function verifyOtp(request) {
  const data = request?.data || {};
  const waNumber = toWaNumber(data.phone);
  const code = String(data.code || '').replace(/[^\d]/g, '');

  if (!waNumber || !code) throw httpError('invalid-argument', 'الرقم أو الكود ناقص');
  if (code.length !== 6) throw httpError('invalid-argument', 'الكود 6 أرقام');

  const ref = db().collection(OTP_COLLECTION).doc(waNumber);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'مفيش كود مطلوب للرقم ده. اطلب كود جديد.');
  const doc = snap.data() || {};

  const expiresMs = ms(doc.expiresAt);
  if (!expiresMs || Date.now() > expiresMs) {
    await ref.delete().catch(() => {});
    throw httpError('deadline-exceeded', 'الكود انتهت صلاحيته. اطلب كود جديد.');
  }

  const attempts = Number(doc.attempts || 0);
  if (attempts >= MAX_ATTEMPTS) {
    await ref.delete().catch(() => {});
    throw httpError('resource-exhausted', 'عدد المحاولات خلص. اطلب كود جديد.');
  }

  const expected = String(doc.codeHash || '');
  const actual = hash(String(doc.salt || ''), waNumber, code);
  const ok = expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

  if (!ok) {
    await ref.set({ attempts: attempts + 1, lastAttemptAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    throw httpError('invalid-argument', `الكود غلط. فاضل ${MAX_ATTEMPTS - attempts - 1} محاولات.`);
  }

  await ref.delete().catch(() => {});

  let customToken = null;
  let uid = doc.uid || null;
  if (!uid) {
    const user = await findUserByPhone(waNumber);
    uid = user?.uid || null;
  }
  if (uid) {
    try {
      customToken = await admin.auth().createCustomToken(uid, { phoneVerified: true, otpChannel: 'whatsapp' });
    } catch (e) {
      console.warn('createCustomToken failed', e?.message);
    }
  }

  return { ok: true, phone: waNumber, uid, customToken, purpose: doc.purpose || 'login', proof: makeProof(waNumber) };
}

/** إرسال كود تجريبي من لوحة التحكم (أدمن فقط — الفحص في index.js) */
async function sendTestOtp(request) {
  return sendOtp({ ...request, data: { ...(request?.data || {}), purpose: 'test' } });
}

/** حالة إعداد OTP (تظهر في /api/whatsapp/setup) */
function otpConfig() {
  return {
    templateName: env('WHATSAPP_OTP_TEMPLATE_NAME') || 'fahemt_otp',
    templateLang: env('WHATSAPP_OTP_TEMPLATE_LANG') || 'ar',
    templateMode: (env('WHATSAPP_OTP_TEMPLATE_MODE') || 'auth').toLowerCase(),
    transport: transport(),
    globalMaxPerHour: GLOBAL_MAX_PER_HOUR,
    ttlMinutes: Math.round(ttlMs() / 60000),
    maxAttempts: MAX_ATTEMPTS,
    maxSendsPerHour: MAX_SENDS_PER_HOUR,
  };
}

module.exports = { sendOtp, verifyOtp, sendTestOtp, otpConfig, toWaNumber };

// ===== الدوال القابلة للاستدعاء من الموقع/التطبيق عبر /api/fn/<name> =====
/** بعد إنشاء الحساب: تثبيت إن رقم الموبايل متأكد (بيتحقق من الإثبات الموقّع) */
async function markPhoneVerified(request) {
  const uid = request?.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول');
  const data = request?.data || {};
  const waNumber = toWaNumber(data.phone);
  if (!waNumber) throw new HttpsError('invalid-argument', 'رقم الموبايل غير صحيح');
  if (!checkProof(data.proof, waNumber)) {
    throw new HttpsError('permission-denied', 'إثبات التحقق غير صالح أو انتهت صلاحيته. أكد الرقم تاني.');
  }
  const ref = db().collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'الحساب غير موجود');
  const profile = snap.data() || {};
  const stored = toWaNumber(profile.phoneNumber || profile.phone || '');
  if (stored && stored !== waNumber) {
    throw new HttpsError('failed-precondition', 'الرقم المؤكد مختلف عن الرقم المسجل في الحساب.');
  }
  await ref.set(
    {
      phoneNumber: profile.phoneNumber || waNumber,
      phoneVerified: true,
      phoneVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      phoneVerifiedChannel: 'whatsapp',
    },
    { merge: true }
  );
  return { ok: true, phone: waNumber };
}

/** سياسة التسجيل: هل مطلوب OTP؟ وهل البريدج شغال؟ (متاحة بدون تسجيل دخول، ما بترجّعش غير قيمتين) */
module.exports.getOtpPolicy = onCall(async () => {
  let requireOtpOnSignup = false;
  try {
    const snap = await db().doc('settings/whatsappBot').get();
    requireOtpOnSignup = !!(snap.exists && (snap.data() || {}).requireOtpOnSignup === true);
  } catch (_) {}
  const bridgeUp = transport() === 'bridge' ? await bridgeIsUp() : true;
  return { requireOtpOnSignup, bridgeUp };
});
module.exports.sendWhatsappOtp = onCall(async (request) => sendOtp(request));
module.exports.markPhoneVerified = onCall(async (request) => markPhoneVerified(request));
module.exports.verifyWhatsappOtp = onCall(async (request) => verifyOtp(request));
module.exports.sendWhatsappOtpTest = onCall(async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'لازم تسجل الدخول كأدمن');
  const me = (await db().collection('users').doc(uid).get()).data() || {};
  const isAdmin = request?.auth?.token?.admin === true || me.isAdmin === true || me.role === 'admin';
  if (!isAdmin) throw new HttpsError('permission-denied', 'الأدمن فقط');
  return sendTestOtp(request);
});

// حملات واتساب (ملف منفصل)
Object.assign(module.exports, require('./whatsapp-campaigns'));
