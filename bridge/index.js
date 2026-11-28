'use strict';

/**
 * جسر واتساب غير رسمي (Baileys) لبوت فهمت.
 *
 * ليه Baileys مش whatsapp-web.js؟
 *   whatsapp-web.js بيشغّل كروميوم كامل (500 ميجا رام+) — مش بيدخل في استضافة مجانية 256 ميجا.
 *   Baileys بيتكلم مع واتساب WebSocket مباشرة من غير أي متصفح، ووزنه في التشغيل حوالي 110 ميجا.
 *   نفس الفكرة: جهاز مرتبط على رقم مخصص، وبيستخدم نفس منطق البوت على Vercel.
 *
 * طريقة الشغل:
 *   رسالة واردة → POST {PLATFORM_URL}/api/whatsapp/bridge (هيدر x-bridge-secret) → ردود → إرسال من هنا.
 *   ردود الأدمن من اللوحة → Firestore (whatsappOutbox) → هنا يبعتها ويعلّمها sent.
 *   الجلسة على القرص + نسخة احتياطية في Firestore (bridgeAuth/whatsapp) لو القرص اتمسح.
 *
 * تحذير: الطريقة دي غير رسمية ومخالفة لشروط واتساب، والرقم ممكن يتحظر في أي وقت.
 *
 * متغيرات البيئة:
 *   PLATFORM_URL              https://www.fahemt.online
 *   BRIDGE_SECRET             نفس القيمة اللي على Vercel
 *   FIREBASE_SERVICE_ACCOUNT  محتوى ملف الخدمة كـ JSON في سطر واحد
 *   AUTH_DIR                  مجلد الجلسة (افتراضي ./auth)
 *   PAIR_PHONE                رقم البوت بالصيغة الدولية بدون + (مثال 201203867635) — ربط بكود
 *   PORT                      بورت فحص الصحة (افتراضي 8080)
 *   BRIDGE_ALLOW_GROUPS       1 = يرد في الجروبات كمان (افتراضي 0)
 *   BRIDGE_PREFIX             اختياري: بادئة لازم تكون في أول الرسالة في الجروبات
 *   AUTH_BACKUP               off = اقفل النسخة الاحتياطية (افتراضي on)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const admin = require('firebase-admin');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
// Baileys v7 ESM فقط: بنحمّله بـ import() ديناميكي قبل التشغيل
let makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason;
async function loadBaileys() {
  const b = await import('@whiskeysockets/baileys');
  makeWASocket = b.default || b.makeWASocket;
  ({ useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = b);
}
const map = require('./lib/map');

const PLATFORM_URL = (process.env.PLATFORM_URL || 'https://www.fahemt.online').replace(/\/+$/, '');
const BRIDGE_SECRET = String(process.env.BRIDGE_SECRET || '').trim();
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth');
const PORT = Number(process.env.PORT || 8080);
const ALLOW_GROUPS = String(process.env.BRIDGE_ALLOW_GROUPS || '0') === '1';
const PREFIX = String(process.env.BRIDGE_PREFIX || '').trim();
const PAIR_PHONE = String(process.env.PAIR_PHONE || '').replace(/[^\d]/g, '');
const AUTH_BACKUP = String(process.env.AUTH_BACKUP || 'on') !== 'off';

// ===== حد إرسال عام (حماية الرقم من الحظر) =====
// كل الرسائل الصادرة بتعدي من هنا: OTP له أولوية، والحملات بتستنى لو فيه OTP مستني.
const LIMITS = {
  otp: { perMin: Number(process.env.LIM_OTP_MIN || 10), perHour: Number(process.env.LIM_OTP_HOUR || 150), gap: 1500 },
  admin: { perMin: Number(process.env.LIM_ADMIN_MIN || 15), perHour: Number(process.env.LIM_ADMIN_HOUR || 300), gap: 2500 },
  campaign: { perMin: Number(process.env.LIM_CAMP_MIN || 4), perHour: Number(process.env.LIM_CAMP_HOUR || 60), gap: 6000 },
};
const sentTimes = [];
let lastSendAt = 0;
let otpWaiting = 0;
async function acquireSlot(kind) {
  const lim = LIMITS[kind] || LIMITS.admin;
  if (kind === 'otp') otpWaiting++;
  try {
    for (;;) {
      const now = Date.now();
      while (sentTimes.length && now - sentTimes[0] > 3600000) sentTimes.shift();
      const lastMin = sentTimes.filter((t) => now - t < 60000).length;
      const blockedByOtp = kind === 'campaign' && otpWaiting > 0;
      if (!blockedByOtp && lastMin < lim.perMin && sentTimes.length < lim.perHour && now - lastSendAt >= lim.gap) {
        lastSendAt = now;
        sentTimes.push(now);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 1500)));
    }
  } finally {
    if (kind === 'otp') otpWaiting--;
  }
}

const OUTBOX_MAX_AGE_MS = 15 * 60 * 1000;
const OTP_MAX_AGE_MS = 60 * 1000; // الكود القديم ما يتبعتش
const AUTH_DOC = 'whatsapp-v7'; // مستند جديد لجلسة Baileys v7 (الجلسة القديمة v6 مش متوافقة)

const log = (...args) => console.log(new Date().toISOString(), ...args);
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

// ===== Firebase =====
let db = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const sa = JSON.parse(raw);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    db = admin.firestore();
    log('firebase: ok');
  } else {
    log('firebase: FIREBASE_SERVICE_ACCOUNT غير موجود — ردود الأدمن من اللوحة مش هتشتغل');
  }
} catch (e) {
  log('firebase init failed:', e.message);
}

// ===== نسخة احتياطية للجلسة (لو القرص اتمسح) =====
const authBackupRef = () => (db ? db.collection('bridgeAuth').doc(AUTH_DOC) : null);

async function restoreAuth() {
  if (!db || !AUTH_BACKUP) return false;
  const dirHasFiles = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).some((f) => f.endsWith('.json'));
  if (dirHasFiles) return false; // الجلسة على القرص أحدث — منستعدهاش
  try {
    const snap = await authBackupRef().get();
    if (!snap.exists) return false;
    const files = snap.data()?.files || {};
    const names = Object.keys(files);
    if (!names.length) return false;
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    for (const name of names) {
      fs.writeFileSync(path.join(AUTH_DIR, name), Buffer.from(String(files[name]), 'base64'), { mode: 0o600 });
    }
    log('auth restored from firestore:', names.length, 'ملف');
    return true;
  } catch (e) {
    log('auth restore failed:', e.message);
    return false;
  }
}

let backupTimer = null;
let backupBusy = false;

function scheduleAuthBackup(reason) {
  if (!db || !AUTH_BACKUP) return;
  if (backupTimer) return;
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    if (backupBusy) return;
    backupBusy = true;
    try {
      const files = fs.existsSync(AUTH_DIR) ? fs.readdirSync(AUTH_DIR).filter((f) => f.endsWith('.json')) : [];
      const out = {};
      let total = 0;
      for (const name of files) {
        const buf = fs.readFileSync(path.join(AUTH_DIR, name));
        total += buf.length;
        if (total > 700 * 1024) break; // حد مستند Firestore 1 ميجا
        out[name] = buf.toString('base64');
      }
      if (!Object.keys(out).length) return;
      await authBackupRef().set({ files: out, count: Object.keys(out).length, updatedAt: admin.firestore.FieldValue.serverTimestamp(), reason: reason || '' });
      log('auth backup ok:', Object.keys(out).length, 'ملف');
    } catch (e) {
      log('auth backup failed:', e.message);
    } finally {
      backupBusy = false;
    }
  }, 20000);
}

// ===== حالة الاتصال =====
let sock = null;
let ready = false;
let connecting = false;
let reconnectTimer = null;
const lastMenu = new Map();
const lidJids = new Map(); // waId (رقم LID) -> jid الأصلي، عشان الرد من اللوحة يروح للمعرّف الصح

async function start() {
  if (connecting) return;
  connecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (_) {
      version = undefined;
    }

    sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      version,
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      scheduleAuthBackup('creds.update');
    });

    // الربط بكود بدل QR (أسهل بكتير على سيرفر)
    if (PAIR_PHONE && !state.creds.registered) {
      const thisSock = sock;
      const askCode = async () => {
        if (thisSock !== sock || ready || state.creds.registered) return;
        try {
          const code = await thisSock.requestPairingCode(PAIR_PHONE);
          log('=== كود الربط:', code, '=== من موبايل رقم البوت: الإعدادات → الأجهزة المرتبطة → الربط برقم الهاتف');
        } catch (e) {
          log('pairing code failed:', e.message);
        }
      };
      setTimeout(askCode, 3000);
      const pairTimer = setInterval(() => {
        if (thisSock !== sock || ready || state.creds.registered) { clearInterval(pairTimer); return; }
        askCode();
      }, 90000);
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !PAIR_PHONE) {
        log('=== امسح الكود من واتساب: الأجهزة المرتبطة → ربط جهاز ===');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        ready = true;
        connecting = false;
        try { fs.unlinkSync(path.join(__dirname, 'pair-code.txt')); } catch (_) {}
        log('ready — البوت متصل. الرقم:', sock?.user?.id || '؟');
        scheduleAuthBackup('connected');
        sweepOutbox();
      }

      if (connection === 'close') {
        ready = false;
        connecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        log('connection closed:', code || '؟', loggedOut ? '(اتعمل logout — محتاج ربط جديد)' : '— إعادة اتصال بعد 10 ثواني');
        if (loggedOut) {
          log('الجلسة اتلغت. بمسح الجلسة القديمة (القرص + النسخة الاحتياطية) وبدء ربط جديد.');
          try {
            for (const f of fs.existsSync(AUTH_DIR) ? fs.readdirSync(AUTH_DIR) : []) fs.rmSync(path.join(AUTH_DIR, f), { recursive: true, force: true });
          } catch (e) { log('wipe failed:', e.message); }
          if (backupTimer) { clearTimeout(backupTimer); backupTimer = null; }
          if (db && AUTH_BACKUP) { try { await authBackupRef().delete(); } catch (e) { log('backup delete failed:', e.message); } }
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => { reconnectTimer = null; start().catch((e) => log('restart failed:', e.message)); }, 5000);
          return;
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { reconnectTimer = null; start().catch((e) => log('restart failed:', e.message)); }, 10000);
      }
    });

    // تتبع حالة التسليم للرسايل الصادرة (1=pending 2=server 3=delivered 4=read)
    sock.ev.on('message-receipt.update', (list) => {
      for (const r of list || []) {
        log('receipt', String(r?.key?.id || '').slice(0, 8), 'to', String(r?.key?.remoteJid || '').replace(/^(\d{6})\d+/, '$1***'), JSON.stringify({ d: !!r?.receipt?.receiptTimestamp, r: !!r?.receipt?.readTimestamp, p: !!r?.receipt?.playedTimestamp }));
      }
    });
    sock.ev.on('messages.update', (updates) => {
      for (const u of updates || []) {
        if (u?.key?.fromMe && u?.update?.status !== undefined) {
          log('ack', String(u.key.id || '').slice(0, 8), 'status', u.update.status, 'to', String(u.key.remoteJid || '').replace(/(\d{4})@/, '****@').slice(-24));
        }
      }
    });
    sock.ev.on('messages.upsert', async (event) => {
      if (event.type !== 'notify') return;
      for (const m of event.messages || []) {
        try {
          await handleIncoming(m);
        } catch (e) {
          log('message handling failed:', e.message);
        }
      }
    });
  } catch (e) {
    connecting = false;
    log('start failed:', e.message);
    if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; start().catch(() => {}); }, 15000);
  }
}

async function handleIncoming(m) {
  if (!m?.key) return;
  if (m.key.fromMe) return;
  const jid = String(m.key.remoteJid || '');
  if (!jid || jid === 'status@broadcast') return;
  if (jid.endsWith('@g.us') && !ALLOW_GROUPS) return;
  if (jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return;
  if (map.isEmpty(m)) return;

  let text = map.extractText(m);
  if (PREFIX && jid.endsWith('@g.us')) {
    if (!text.trim().startsWith(PREFIX)) return;
    text = text.trim().slice(PREFIX.length).trim();
  }

  let waId = map.waIdFromJid(jid);
  if (jid.endsWith('@lid')) {
    // واتساب بيبعت أحيانا معرّف LID بدل الرقم؛ نجيب الرقم الحقيقي
    let pn = m.key.senderPn || m.key.remoteJidAlt || m.key.participantPn || '';
    if (!pn) {
      try { pn = (await sock.signalRepository?.lidMapping?.getPNForLID?.(jid)) || ''; } catch (_) {}
    }
    if (!pn) { log('lid بدون رقم، مفاتيح الرسالة:', Object.keys(m.key).join(',')); lidJids.set(waId, jid); }
    else waId = map.waIdFromJid(String(pn));
  }
  if (!waId) return;

  const name = m.pushName || '';
  const type = map.mediaTypeOf(m);
  const choiceId = map.choiceIdOf(m) || map.choiceFromText(text, lastMenu.get(waId));

  if (OPTOUT_RE.test(String(text || '').trim()) && db) {
    try {
      await db.collection('whatsappOptOut').doc(waId).set({ waId, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await sock.sendMessage(jid, { text: 'تمام، وقفنا الرسائل الدعائية على رقمك. لو احتجت أي مساعدة ابعتلنا هنا.' });
      log('optout ->', waId);
    } catch (e) { log('optout failed:', e.message); }
    return;
  }

  const res = await fetch(`${PLATFORM_URL}/api/whatsapp/bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET },
    body: JSON.stringify({ from: waId, name, text, messageId: m.key.id || '', type, choiceId }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    log('bridge HTTP', res.status, await res.text().catch(() => ''));
    return;
  }

  const data = await res.json();
  const messages = map.repliesToMessages(data?.replies);
  for (const item of messages) {
    if (item.rows?.length) lastMenu.set(waId, item.rows);
    if (item.imageUrl && (await imageOk(item.imageUrl))) {
      await sock.sendMessage(jid, { image: { url: item.imageUrl }, caption: String(item.text || '').slice(0, 1000) });
    } else {
      await sock.sendMessage(jid, { text: item.text || item.imageUrl });
    }
  }
  try { await sock.readMessages([m.key]); } catch (_) {}
  log(`in ${waId} -> ${messages.length} رد`);
}

// ===== ردود الأدمن من اللوحة (outbox) =====
const claimed = new Set();

// يحدد الـ jid الصح للرد: LID محفوظ من رسالة واردة، أو رقم حقيقي موجود على واتساب، أو LID بالشكل (14+ رقم)
async function resolveJid(waId) {
  if (lidJids.has(waId)) return lidJids.get(waId);
  try {
    const found = await sock.onWhatsApp(waId);
    if (found && found[0]?.exists) return found[0].jid || map.jidFromWaId(waId);
  } catch (_) {}
  if (waId.length >= 14) return `${waId}@lid`;
  return null;
}

async function processOutbox(ref, data) {
  const id = ref.id;
  if (claimed.has(id)) return;
  claimed.add(id);
  const waId = String(data.waId || '');
  const isOtp = data.kind === 'otp';
  const skipLog = isOtp || String(data.kind || '').startsWith('campaign');
  const msgRef = !skipLog && waId && db ? db.collection('whatsappConversations').doc(waId).collection('messages').doc(`out_${id}`) : null;
  try {
    const age = data.createdAt?.toDate ? Date.now() - data.createdAt.toDate().getTime() : 0;
    if (age > (isOtp ? OTP_MAX_AGE_MS : OUTBOX_MAX_AGE_MS)) {
      if (isOtp) { await ref.set({ status: 'failed', error: 'expired', text: '[expired]', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); log('otp expired ->', waId); return; }
      await ref.set({ status: 'failed', error: 'expired', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (msgRef) await msgRef.set({ status: 'failed' }, { merge: true }).catch(() => {});
      log('outbox expired ->', waId);
      return;
    }

    const gotIt = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().status !== 'pending') return false;
      tx.set(ref, { status: 'sending' }, { merge: true });
      return true;
    });
    if (!gotIt) return;

    if (isOtp) {
      // تأكد إن الرقم عليه واتساب قبل الإرسال (الإرسال لأرقام مش مسجلة بيرفع خطر الحظر)
      const found = await sock.onWhatsApp(waId).catch(() => null);
      if (!found || !found[0]?.exists) {
        await ref.set({ status: 'failed', error: 'not_on_whatsapp', text: '[otp]', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        log('otp skipped (not on whatsapp) ->', waId);
        return;
      }
      await new Promise((r) => setTimeout(r, 800 + Math.floor(Math.random() * 1200)));
      // الأفضل نبعت على LID لو معروف (مستخدمين كتير محادثتهم مع البوت على LID مش على الرقم)
      const pnJid = found[0].jid || map.jidFromWaId(waId);
      let lidJid = found[0].lid ? String(found[0].lid) : '';
      if (!lidJid) {
        try { lidJid = (await sock.signalRepository?.lidMapping?.getLIDForPN?.(pnJid)) || ''; } catch (_) {}
      }
      if (lidJid && !lidJid.includes('@')) lidJid += '@lid';
      const targetJid = lidJid || pnJid;
      await acquireSlot('otp');
      const sentOtp = await sock.sendMessage(targetJid, { text: String(data.text || '') });
      log('otp jid', targetJid.replace(/^(\d{6})\d+/, '$1***'), lidJid ? '(lid)' : '(pn)', 'id', String(sentOtp?.key?.id || '').slice(0, 8));
      await ref.set({ status: 'sent', text: '[otp]', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      log('otp sent ->', waId);
      return;
    }
    const target = await resolveJid(waId);
    if (!target) {
      await ref.set({ status: 'failed', error: 'not_on_whatsapp', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (msgRef) await msgRef.set({ status: 'failed' }, { merge: true }).catch(() => {});
      log('outbox failed (no valid jid) ->', waId);
      return;
    }
    await acquireSlot(String(data.kind || '').startsWith('campaign') ? 'campaign' : 'admin');
    const imgUrl = typeof data.imageUrl === 'string' && /^https?:\/\//.test(data.imageUrl) ? data.imageUrl : '';
    if (imgUrl && !(await imageOk(imgUrl))) throw new Error('image_too_large_or_unreachable');
    const sentOut = await sock.sendMessage(target, imgUrl ? { image: { url: imgUrl }, caption: String(data.text || '').slice(0, 1000) } : { text: String(data.text || '') });
    log('outbox jid', String(target).replace(/^(\d{6})\d+/, '$1***'), 'id', String(sentOut?.key?.id || '').slice(0, 8));
    await ref.set({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (msgRef) await msgRef.set({ status: 'sent' }, { merge: true }).catch(() => {});
    log('outbox sent ->', waId);
  } catch (e) {
    const err = String(e.message || e).slice(0, 200);
    await ref.set({ status: 'failed', error: err, ...(isOtp ? { text: '[otp]' } : {}), sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    if (msgRef) await msgRef.set({ status: 'failed' }, { merge: true }).catch(() => {});
    log('outbox failed ->', waId, err);
  } finally {
    setTimeout(() => claimed.delete(id), 60000);
  }
}

async function sweepOutbox() {
  if (!db) return;
  try {
    const snap = await db.collection('whatsappOutbox').where('status', '==', 'pending').limit(50).get();
    for (const doc of snap.docs) await processOutbox(doc.ref, doc.data());
  } catch (e) {
    log('outbox sweep failed:', e.message);
  }
}

function watchOutbox() {
  if (!db) return;
  db.collection('whatsappOutbox')
    .where('status', '==', 'pending')
    .onSnapshot(
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added' && change.type !== 'modified') return;
          const data = change.doc.data() || {};
          if (data.status !== 'pending' || !ready) return;
          processOutbox(change.doc.ref, data);
        });
      },
      (err) => log('outbox watcher error:', err.message)
    );
  log('outbox watcher: ok');
}


// ===== حملات واتساب الإعلانية =====
const OPTOUT_RE = /^(إيقاف|ايقاف|ايقاف الرسائل|إيقاف الرسائل|stop|unsubscribe)$/i;
const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

// فحص حجم الصورة قبل الإرسال (من غير تحميلها في الذاكرة)
async function imageOk(url) {
  // GET بنطاق 0-0 بدل HEAD (الـ Worker بتاع R2 بيرفض HEAD)، ومن غير تحميل الصورة
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) });
    const type = String(r.headers.get('content-type') || '');
    const cr = String(r.headers.get('content-range') || '');
    const total = cr.includes('/') ? Number(cr.split('/').pop()) : Number(r.headers.get('content-length') || 0);
    try { await r.body?.cancel(); } catch (_) {}
    return (r.status === 200 || r.status === 206) && type.startsWith('image/') && total > 0 && total <= IMAGE_MAX_BYTES;
  } catch (_) { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let campaignBusy = false;

// ينتظر مدة معينة لكن يقطع لو الحملة اتوقفت أو الجسر فصل. يرجّع true لو لسه شغالة.
async function waitWhileRunning(cref, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(5000, end - Date.now()));
    if (!ready) return false;
    const st = (await cref.get()).data()?.status;
    if (st !== 'running') return false;
  }
  return true;
}

async function campaignTick() {
  if (campaignBusy || !ready || !sock || !db) return;
  campaignBusy = true;
  try {
    const q = await db.collection('whatsappCampaigns').where('status', '==', 'running').limit(1).get();
    if (q.empty) return;
    const cref = q.docs[0].ref;
    log('campaign: شغالة', q.docs[0].id);
    let sinceBatch = 0;
    let consecutiveFails = 0;
    while (ready) {
      const c = (await cref.get()).data() || {};
      if (c.status !== 'running') break;

      const day = new Date().toISOString().slice(0, 10);
      const statRef = db.collection('whatsappCampaignStats').doc(day);
      const sentToday = Number((await statRef.get()).data()?.sent || 0);
      if (sentToday >= Number(c.dailyCap || 100)) {
        await cref.set({ status: 'paused', pausedReason: 'daily_cap' }, { merge: true });
        log('campaign: وقفت (الحد اليومي)');
        break;
      }

      const rs = await cref.collection('recipients').where('status', '==', 'pending').limit(1).get();
      if (rs.empty) {
        await cref.set({ status: 'done', finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        log('campaign: خلصت');
        break;
      }
      const rd = rs.docs[0];
      const r = rd.data();
      const inc = admin.firestore.FieldValue.increment(1);

      const opted = await db.collection('whatsappOptOut').doc(r.waId).get();
      if (opted.exists) {
        await rd.ref.set({ status: 'skipped', error: 'opted_out' }, { merge: true });
        await cref.set({ skipped: inc }, { merge: true });
        continue;
      }
      let found = null;
      try { found = await sock.onWhatsApp(r.waId); } catch (_) {}
      if (!found || !found[0]?.exists) {
        await rd.ref.set({ status: 'skipped', error: 'not_on_whatsapp' }, { merge: true });
        await cref.set({ skipped: inc }, { merge: true });
        await sleep(1500 + Math.floor(Math.random() * 1500));
        continue;
      }
      const pnJid = found[0].jid || map.jidFromWaId(r.waId);
      let lidJid = found[0].lid ? String(found[0].lid) : '';
      if (lidJid && !lidJid.includes('@')) lidJid += '@lid';
      const target = lidJid || pnJid;
      const greeting = r.name ? `أهلاً ${r.name} 👋\n` : '';
      const body = (greeting + String(c.message || '')).slice(0, 1024);
      try {
        await acquireSlot('campaign');
        if (c.imageUrl && (await imageOk(c.imageUrl))) {
          await sock.sendMessage(target, { image: { url: c.imageUrl }, caption: body });
        } else if (c.imageUrl) {
          throw new Error('image_unavailable');
        } else {
          await sock.sendMessage(target, { text: body });
        }
        await rd.ref.set({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await cref.set({ sent: inc }, { merge: true });
        await statRef.set({ sent: inc }, { merge: true });
        consecutiveFails = 0;
        sinceBatch++;
        log('campaign: sent ->', r.waId.replace(/\d{4}$/, '****'));
      } catch (e) {
        const err = String(e.message || e).slice(0, 120);
        await rd.ref.set({ status: 'failed', error: err }, { merge: true });
        await cref.set({ failed: inc }, { merge: true });
        consecutiveFails++;
        log('campaign: failed ->', err);
        if (consecutiveFails >= 5) {
          await cref.set({ status: 'paused', pausedReason: 'errors' }, { merge: true });
          log('campaign: وقفت تلقائي (5 أخطاء ورا بعض)');
          break;
        }
      }

      // تأخير عشوائي بين الرسائل، وراحة أطول بعد كل دفعة
      if (sinceBatch >= Number(c.batchSize || 10)) {
        sinceBatch = 0;
        if (!(await waitWhileRunning(cref, (5 + Math.random() * 5) * 60 * 1000))) break;
      } else if (!(await waitWhileRunning(cref, (25 + Math.random() * 45) * 1000))) break;
    }
  } catch (e) {
    log('campaign error:', e.message);
  } finally {
    campaignBusy = false;
  }
}
setInterval(campaignTick, 20000);

// نبض الجسر: المنصة بتقرأه عشان تعرف الجسر شغال قبل ما تبعت كود تحقق
async function heartbeat() {
  if (!db) return;
  try {
    await db.collection('bridgeStatus').doc('main').set({ ready, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) { log('heartbeat failed:', e.message); }
}
setInterval(heartbeat, 30000);

// ===== فحص صحة =====
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(ready ? 'ok: connected' : 'ok: starting');
  })
  .listen(PORT, () => log(`health on :${PORT}`));

(async () => {
  if (!BRIDGE_SECRET) log('تحذير: BRIDGE_SECRET غير موجود — المنصة هترفض كل الطلبات');
  if (!db) log('تحذير: ردود الأدمن من اللوحة مش هتوصل (Firebase مش متظبط)');
  if (!PAIR_PHONE) log('ملاحظة: PAIR_PHONE مش متظبط — الربط هيبقى بـ QR في اللوج');
  await loadBaileys();
  await restoreAuth();
  watchOutbox();
  await start();
})();

process.on('SIGTERM', async () => {
  log('SIGTERM — إغلاق');
  try { sock?.end(undefined); } catch (_) {}
  process.exit(0);
});
