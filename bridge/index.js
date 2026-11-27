'use strict';

/**
 * جسر واتساب غير رسمي (QR) لبوت فهمت.
 *
 * بيشتغل كجهاز مرتبط (linked device) زي واتساب ويب على رقم مخصص للبوت،
 * وبيستخدم نفس منطق البوت الموجود على Vercel:
 *   رسالة واردة → POST /api/whatsapp/bridge (بهيدر x-bridge-secret) → ردود → إرسال من هنا.
 *   ردود الأدمن من اللوحة → Firestore (whatsappOutbox) → هنا يبعتها ويعلّمها sent.
 *
 * تحذير: الطريقة دي غير رسمية ومخالفة لشروط واتساب، والرقم ممكن يتحظر في أي وقت.
 * الرقم لازم يكون مخصص للبوت بس.
 *
 * متغيرات البيئة:
 *   PLATFORM_URL              https://fahemt.online
 *   BRIDGE_SECRET             نفس القيمة اللي على Vercel
 *   FIREBASE_SERVICE_ACCOUNT  محتوى ملف الخدمة كـ JSON في سطر واحد
 *   SESSION_PATH              مجلد حفظ الجلسة (افتراضي ./session)
 *   PORT                      بورت فحص الصحة (افتراضي 8080)
 *   PAIR_PHONE                رقم البوت بالصيغة الدولية بدون + (اختياري): بيربط بكود
 *                             من الموبايل بدل مسح QR
 *   PUPPETEER_EXECUTABLE_PATH كروم/كروميوم النظام لو مش عايز النسخة اللي بينزّلها puppeteer
 *   BRIDGE_ALLOW_GROUPS       1 = يرد في الجروبات كمان (افتراضي 0)
 *   BRIDGE_PREFIX             اختياري: بادئة لازم تكون في أول الرسالة في الجروبات
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const admin = require('firebase-admin');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const PLATFORM_URL = (process.env.PLATFORM_URL || 'https://fahemt.online').replace(/\/+$/, '');
const BRIDGE_SECRET = String(process.env.BRIDGE_SECRET || '').trim();
const SESSION_PATH = process.env.SESSION_PATH || path.join(__dirname, 'session');
const PORT = Number(process.env.PORT || 8080);
const ALLOW_GROUPS = String(process.env.BRIDGE_ALLOW_GROUPS || '0') === '1';
const PREFIX = String(process.env.BRIDGE_PREFIX || '').trim();
const PAIR_PHONE = String(process.env.PAIR_PHONE || '').replace(/[^\d]/g, '');

// رد الأدمن اللي عدّى عليه ده أكتر من كده بيتعلّم expired بدل ما يتبعت متأخر
const OUTBOX_MAX_AGE_MS = 15 * 60 * 1000;

const log = (...args) => console.log(new Date().toISOString(), ...args);

function writePrivate(file, content) {
  try {
    fs.writeFileSync(file, content, { mode: 0o600 });
    fs.chmodSync(file, 0o600);
  } catch (e) {
    log('write failed:', file, e.message);
  }
}

function rmQuiet(file) {
  try { fs.unlinkSync(file); } catch (_) {}
}

// ===== Firebase (للـ outbox) =====
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

// ===== كروميوم =====
function chromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const chrome = chromiumPath();
log('chromium:', chrome || '(نسخة puppeteer المدمجة)');

// ===== عميل واتساب =====
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    ...(chrome ? { executablePath: chrome } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
});

let ready = false;
let pairingRequested = false;

client.on('qr', async (qr) => {
  if (PAIR_PHONE) {
    // ربط بكود من الموبايل: أسهل بكتير من مسح QR من ترمينال سيرفر
    if (pairingRequested) return;
    pairingRequested = true;
    try {
      const code = await client.requestPairingCode(PAIR_PHONE, false);
      log('=== كود الربط:', code, '=== ادخله من موبايل رقم البوت: الإعدادات → الأجهزة المرتبطة → ربط بكود');
      writePrivate(path.join(__dirname, 'pair-code.txt'), String(code));
    } catch (e) {
      pairingRequested = false;
      log('pairing code failed:', e.message, '— جرّب QR');
      qrcode.generate(qr, { small: true });
      writePrivate(path.join(__dirname, 'last-qr.txt'), qr);
    }
    return;
  }
  log('=== امسح الكود من واتساب: الأجهزة المرتبطة → ربط جهاز ===');
  qrcode.generate(qr, { small: true });
  writePrivate(path.join(__dirname, 'last-qr.txt'), qr);
});

client.on('authenticated', () => log('authenticated'));
client.on('auth_failure', (m) => log('auth_failure:', m));
client.on('change_state', (s) => log('state:', s));

client.on('ready', () => {
  ready = true;
  rmQuiet(path.join(__dirname, 'last-qr.txt'));
  rmQuiet(path.join(__dirname, 'pair-code.txt'));
  log('ready — البوت متصل. الرقم:', client.info?.wid?.user || '؟');
  sweepOutbox();
});

client.on('disconnected', (reason) => {
  ready = false;
  log('disconnected:', reason, '— إعادة الاتصال بعد 15 ثانية');
  setTimeout(() => client.initialize().catch((e) => log('reinit failed', e.message)), 15000);
});

/** يبعت ردود البوت اللي راجعة من المنصة */
async function deliver(chatId, replies) {
  for (const reply of replies || []) {
    try {
      if (reply.type === 'text') {
        await client.sendMessage(chatId, String(reply.body || ''));
      } else if (reply.type === 'list') {
        // واتساب غير الرسمي مبيعملش قوايم تفاعلية — بنبعتها كنص مرقّم
        const lines = [reply.body || ''];
        if (Array.isArray(reply.rows) && reply.rows.length) {
          lines.push('');
          reply.rows.forEach((r, i) => lines.push(`${i + 1}) ${r.title}`));
          lines.push('');
          lines.push(`اكتب رقم الاختيار (1-${reply.rows.length}) أو كلامك عادي.`);
        }
        await client.sendMessage(chatId, lines.filter(Boolean).join('\n'));
      } else if (reply.type === 'buttons') {
        const lines = [reply.body || ''];
        if (Array.isArray(reply.buttons) && reply.buttons.length) {
          lines.push('');
          reply.buttons.forEach((b, i) => lines.push(`${i + 1}) ${b.title}`));
        }
        await client.sendMessage(chatId, lines.filter(Boolean).join('\n'));
      }
    } catch (e) {
      log('send failed:', e.message);
    }
  }
}

/** آخر قائمة اتبعتت للعميل (لتحويل رقم مكتوب إلى اختيار) */
const lastMenu = new Map();

client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    const chat = await msg.getChat();
    if (chat.isGroup && !ALLOW_GROUPS) return;

    let text = String(msg.body || '').trim();
    if (PREFIX && chat.isGroup && !text.startsWith(PREFIX)) return;
    if (PREFIX) text = text.slice(PREFIX.length).trim();

    const waId = String(msg.from || '').split('@')[0].replace(/[^\d]/g, '');
    if (!waId) return;

    const contact = await msg.getContact().catch(() => null);
    const name = contact?.pushname || contact?.name || '';

    // لو العميل كتب رقم من القائمة، نحوّله لاختيار
    let choiceId = '';
    const menu = lastMenu.get(waId);
    if (menu && /^[1-9]$/.test(text)) {
      const row = menu[Number(text) - 1];
      if (row) choiceId = row.id;
    }

    const type = msg.hasMedia ? (msg.type || 'document') : 'text';

    const res = await fetch(`${PLATFORM_URL}/api/whatsapp/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET },
      body: JSON.stringify({ from: waId, name, text, messageId: msg.id?._serialized || '', type, choiceId }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      log('bridge HTTP', res.status, await res.text().catch(() => ''));
      return;
    }

    const data = await res.json();
    for (const reply of data?.replies || []) {
      if (reply.type === 'list' && Array.isArray(reply.rows)) lastMenu.set(waId, reply.rows);
    }
    await deliver(msg.from, data?.replies || []);
    await chat.sendSeen().catch(() => {});
    log(`in ${waId} -> ${(data?.replies || []).length} رد`);
  } catch (e) {
    log('message handling failed:', e.message);
  }
});

// ===== ردود الأدمن من اللوحة (outbox) =====
const claimed = new Set();

/** يحجز المستند ويعلّمه sending عشان ميتكررش، ويبعت بعد كده */
async function processOutbox(ref, data) {
  const id = ref.id;
  if (claimed.has(id)) return;
  claimed.add(id);
  try {
    const age = data.createdAt?.toDate ? Date.now() - data.createdAt.toDate().getTime() : 0;
    const msgRef = data.waId ? db.collection('whatsappConversations').doc(String(data.waId)).collection('messages').doc(`out_${id}`) : null;

    if (age > OUTBOX_MAX_AGE_MS) {
      await ref.set({ status: 'failed', error: 'expired', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (msgRef) await msgRef.set({ status: 'failed' }, { merge: true }).catch(() => {});
      log('outbox expired ->', data.waId);
      return;
    }

    const claimedOk = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().status !== 'pending') return false;
      tx.set(ref, { status: 'sending' }, { merge: true });
      return true;
    });
    if (!claimedOk) return;

    await client.sendMessage(`${data.waId}@c.us`, String(data.text || ''));
    await ref.set({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (msgRef) await msgRef.set({ status: 'sent' }, { merge: true }).catch(() => {});
    log('outbox sent ->', data.waId);
  } catch (e) {
    const err = String(e.message || e).slice(0, 200);
    await ref.set({ status: 'failed', error: err, sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    if (data.waId) {
      db.collection('whatsappConversations').doc(String(data.waId)).collection('messages').doc(`out_${ref.id}`)
        .set({ status: 'failed' }, { merge: true }).catch(() => {});
    }
    log('outbox failed ->', data.waId, err);
  } finally {
    setTimeout(() => claimed.delete(id), 60000);
  }
}

/** مسح أولي بعد الاتصال (رسائل كانت مستنية والسيرفر واقف) */
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
          if (data.status !== 'pending') return;
          if (!ready) return; // هيتبعت في sweepOutbox أول ما يتصل
          processOutbox(change.doc.ref, data);
        });
      },
      (err) => log('outbox watcher error:', err.message)
    );
  log('outbox watcher: ok');
}

// ===== فحص صحة (لمنصات الاستضافة) =====
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(ready ? 'ok: connected' : 'ok: starting');
  })
  .listen(PORT, () => log(`health on :${PORT}`));

if (!BRIDGE_SECRET) log('تحذير: BRIDGE_SECRET غير موجود — المنصة هترفض كل الطلبات');
if (!db) log('تحذير: ردود الأدمن من اللوحة مش هتوصل (Firebase مش متظبط)');

watchOutbox();
client.initialize().catch((e) => log('initialize failed:', e.message));

process.on('SIGTERM', async () => {
  log('SIGTERM — إغلاق');
  try { await client.destroy(); } catch (_) {}
  process.exit(0);
});
