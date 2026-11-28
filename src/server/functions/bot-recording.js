/**
 * بوت تسجيل المنصة: يربط Agora Cloud Recording (agora-recording.js) بجلسات المجموعات والاستفهام.
 *
 * الوضع الأساسي «web page recording»: Agora تفتح صفحة التسجيل /rec/index.html (public/rec) في متصفح خفي،
 * والصفحة تدخل القناة كمشاهد وتعرض الفيديوهات + مشاركة الشاشة + السبورة + الملف المشارَك + الشات
 * (من سجل الأحداث الذي يكتبه مدير الجلسة)، فيُسجَّل كل ما يراه الحاضرون. لو فشل هذا الوضع نرجع تلقائيًا
 * لوضع mix (صوت + فيديو القناة فقط) حتى لا تضيع الجلسة.
 *
 * - كل تسجيل شغّال له سجل في `botRecordings/{id}` (للسيرفر فقط — القواعد تمنع غير الأدمن):
 *     g_<groupId>_<sessionId>  |  i_<requestId>
 *   الحالات: running → stopping → done | pending (الملف لم يُؤكَّد بعد) | failed
 * - عند الإنهاء نوقف البوت، نتأكد أن الملف وصل R2، ثم نكتب مستندات التسجيل بنفس البنية التي
 *   تقرؤها لوحة التحكم وتطبيق الموبايل (recordings / lectureRecordings / sessionRecordings).
 * - sweep() يُستدعى من الـ cron: يُنهي ما نُسي مفتوحًا، ويؤكّد الملفات المتأخرة.
 */
const admin = require('firebase-admin');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rec = require('./agora-recording');

const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const REG = () => db.collection('botRecordings');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_BYTES = 1024;

const gid = (groupId, sessionId) => `g_${groupId}_${sessionId}`;
const iid = (requestId) => `i_${requestId}`;
const msg = (e) => String(e?.message || e).slice(0, 300);

// ---------------------------------------------------------------- صفحة التسجيل (توكن + رابط)
const pageSecret = () => process.env.REC_PAGE_SECRET || crypto.createHash('sha256').update(`recpage:${process.env.AGORA_APP_CERTIFICATE || ''}`).digest('hex');
const siteBase = () => String(process.env.REC_PAGE_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).trim().replace(/\/+$/, '');

/** توكن قصير العمر يعطي صفحة التسجيل حق قراءة أحداث جلسة واحدة فقط. */
const signPageToken = (payload) => jwt.sign(payload, pageSecret(), { expiresIn: '9h' });
const verifyPageToken = (t) => jwt.verify(String(t || ''), pageSecret());
const pageUrl = (payload) => { const b = siteBase(); return b ? `${b}/rec/index.html?t=${encodeURIComponent(signPageToken(payload))}` : ''; };

/** مسار أحداث الجلسة (يكتبها مدير الجلسة من التطبيق). */
function eventsCol(p) {
  return p.k === 'g'
    ? db.collection('groups').doc(p.gid).collection('sessions').doc(p.sid).collection('events')
    : db.collection('istifhams').doc(p.rid).collection('events');
}

/** أحداث بعد وقت معيّن (للصفحة). */
async function readEvents(p, after) {
  const snap = await eventsCol(p).where('at', '>', Number(after) || 0).orderBy('at').limit(200).get();
  const events = [];
  let last = Number(after) || 0;
  for (const d of snap.docs) { const x = d.data(); last = Math.max(last, Number(x.at) || 0); for (const e of (Array.isArray(x.ev) ? x.ev : [])) events.push(e); }
  return { events, last };
}

/** يحذف أحداث الجلسة بعد انتهاء التسجيل (لا نحتاجها بعد ذلك). */
async function purgeEvents(p) {
  try {
    const refs = await eventsCol(p).listDocuments();
    for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); }
  } catch (e) { console.error('purge events failed', msg(e)); }
}

/** بيانات اتصال صفحة التسجيل بالقناة. */
function rtcConfig(p) {
  return { appId: String(process.env.AGORA_APP_ID || '').trim(), channel: p.ch, uid: rec.WEB_UID, token: rec.pageRtcToken(p.ch) };
}

// ---------------------------------------------------------------- بدء البوت
async function start(id, meta, channel, prefix, payload) {
  try {
    let state = null;
    let webError = '';
    const url = pageUrl({ ...payload, ch: channel });
    if (!url) webError = 'REC_PAGE_BASE_URL غير مضبوط: سيُسجَّل الصوت والفيديو فقط (بدون السبورة والملفات)';
    else {
      try { state = { ...(await rec.startWebRecording({ cname: channel, pageUrl: url, prefix })), prefix }; }
      catch (e) { webError = msg(e); console.error('web recording failed, falling back to mix', id, webError); }
    }
    if (!state) state = { ...(await rec.startRecording({ channel, groupId: meta.groupId, prefix })), prefix };
    await REG().doc(id).set({ ...meta, state, mode: state.mode, status: 'running', startedAtMs: Date.now(), ...(webError ? { webError } : {}) });
    return { ok: true, mode: state.mode };
  } catch (e) {
    console.error('bot start failed', id, e);
    await REG().doc(id).set({ ...meta, status: 'failed', error: msg(e), startedAtMs: Date.now() }).catch(() => {});
    return { ok: false, error: msg(e) };
  }
}

/** يبدأ البوت لجلسة مجموعة (آمن للتكرار). */
async function startGroup(groupId, sessionId) {
  const id = gid(groupId, sessionId);
  const cur = (await REG().doc(id).get()).data();
  if (cur && cur.status === 'running') return { ok: true, already: true };
  return start(id, { kind: 'group', groupId, sessionId }, rec.groupChannel(groupId, sessionId), ['groups', groupId, 'recordings'], { k: 'g', gid: groupId, sid: sessionId });
}

/** يبدأ البوت لجلسة استفهام (آمن للتكرار). */
async function startIstifham(requestId) {
  const id = iid(requestId);
  const cur = (await REG().doc(id).get()).data();
  if (cur && cur.status === 'running') return { ok: true, already: true };
  return start(id, { kind: 'istifham', requestId }, rec.istifhamChannel(requestId), ['sessions', requestId], { k: 'i', rid: requestId });
}

// ---------------------------------------------------------------- إيقاف البوت وتحديد الملف
/** يوقف البوت (لو توقف وحده بسبب الخمول نكمل) ثم ينتظر وصول mp4 إلى R2. */
async function stopAndLocate(state, { waitTries = 2, stopTimeoutMs = 35000 } = {}) {
  // الدالة على Vercel لها حد 60 ثانية: لو الإيقاف أخذ وقتًا (جلسة طويلة) لا ننتظر؛ Agora يكمل الرفع
  // والـ cron / زر «إعادة الفحص» يؤكّد وصول الملف لاحقًا (حالة pending).
  if (state.mode === 'web') await sleep(3000); // تلتقط الصفحة آخر أحداث السبورة/الشات قبل الإغلاق
  let mp4 = null;
  try {
    const r = await Promise.race([rec.stopRecording(state), new Promise((_, rej) => setTimeout(() => rej(new Error('stop timeout')), stopTimeoutMs))]);
    mp4 = r.mp4;
  } catch (e) { console.error('bot stop (continuing with expected key)', msg(e)); }
  const key = mp4 || rec.expectedMp4Key(state.prefix, state.sid, state.channel);
  let size = 0;
  for (let i = 0; i < waitTries; i++) {
    size = await rec.fileSize(key);
    if (size > MIN_BYTES) break;
    if (i < waitTries - 1) await sleep(3000);
  }
  return { key, size, ok: size > MIN_BYTES };
}

/** يحجز التسجيل للإيقاف (مرة واحدة فقط حتى لو استدعاه أكثر من طرف). يرجّع بيانات السجل أو null. */
async function claim(id) {
  const ref = REG().doc(id);
  return db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d || d.status !== 'running') return null;
    tx.update(ref, { status: 'stopping', claimedAtMs: Date.now() });
    return d;
  });
}

// ---------------------------------------------------------------- مجموعات
async function linkGroup({ groupId, sessionId, key, size, ready, title, error }) {
  const gRef = db.collection('groups').doc(groupId);
  const g = (await gRef.get()).data() || {};
  const rRef = gRef.collection('recordings').doc(sessionId);
  const lRef = db.collection('lectureRecordings').doc(sessionId);
  const [r1, l1] = await Promise.all([rRef.get(), lRef.get()]);
  const t = title || r1.data()?.title || l1.data()?.title || `جلسة ${sessionId}`;
  const now = Date.now();
  const common = { r2Key: key, status: ready ? 'ready' : 'processing', error: ready ? '' : (error || 'جارٍ تجهيز التسجيل'), source: 'bot', size: ready ? size : 0 };
  await rRef.set({ sessionId, title: t, ...common, ...(r1.exists ? {} : { createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
  await lRef.set({
    kind: 'group', groupId, groupName: g.name || '', ownerUid: g.ownerUid || '', ownerName: g.ownerName || '', sessionId, title: t, ...common,
    durationSec: l1.data()?.durationSec || 0, ...(l1.exists ? {} : { createdAt: FV.serverTimestamp(), order: now }), ...(ready ? { readyAt: FV.serverTimestamp() } : {}),
  }, { merge: true });
  if (ready && g.ownerUid) {
    const prev = r1.data()?.status === 'ready' ? Number(r1.data()?.size || 0) : 0; // نضيف الفرق فقط
    if (size !== prev) await gRef.update({ storageBytes: FV.increment(size - prev) }).catch(() => {});
  }
}

async function failGroup(groupId, sessionId, error) {
  const gRef = db.collection('groups').doc(groupId);
  const g = (await gRef.get()).data() || {};
  const rRef = gRef.collection('recordings').doc(sessionId);
  const lRef = db.collection('lectureRecordings').doc(sessionId);
  const [r1, l1] = await Promise.all([rRef.get(), lRef.get()]);
  const now = Date.now();
  if (r1.data()?.status !== 'ready') await rRef.set({ sessionId, title: r1.data()?.title || `جلسة ${sessionId}`, status: 'failed', error, ...(r1.exists ? {} : { size: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
  if (l1.data()?.status !== 'ready') await lRef.set({ kind: 'group', groupId, groupName: g.name || '', ownerUid: g.ownerUid || '', ownerName: g.ownerName || '', sessionId, title: l1.data()?.title || `جلسة ${sessionId}`, status: 'failed', error, ...(l1.exists ? {} : { size: 0, durationSec: 0, createdAt: FV.serverTimestamp(), order: now }) }, { merge: true });
}

/** ينهي بوت جلسة مجموعة ويربط الملف. handled=false لو الجلسة لم تُسجَّل بالبوت أصلًا (مسار قديم). */
async function finishGroup(groupId, sessionId, title) {
  const id = gid(groupId, sessionId);
  const snap = (await REG().doc(id).get()).data();
  if (!snap) return { handled: false };
  if (snap.status === 'failed') { await failGroup(groupId, sessionId, snap.error || 'تعذر بدء تسجيل الجلسة').catch(() => {}); return { handled: true, status: 'failed' }; }
  const d = await claim(id);
  if (!d) return { handled: true, status: snap.status };
  const out = await stopAndLocate(d.state);
  await linkGroup({ groupId, sessionId, key: out.key, size: out.size, ready: out.ok, title });
  await REG().doc(id).update({ status: out.ok ? 'done' : 'pending', key: out.key, size: out.size, stoppedAtMs: Date.now() });
  await purgeEvents({ k: 'g', gid: groupId, sid: sessionId });
  return { handled: true, status: out.ok ? 'done' : 'pending' };
}

// ---------------------------------------------------------------- استفهام
async function writeIstifham(requestId, patch) {
  const { buildIstifhamRecordingBase } = require('./device-recording');
  const ref = db.collection('istifhams').doc(requestId);
  const r = (await ref.get()).data() || {};
  const out = db.collection('sessionRecordings').doc(requestId);
  const cur = (await out.get()).data();
  const now = Date.now();
  await out.set({ ...buildIstifhamRecordingBase(r, requestId, now), ...patch, createdAt: cur?.createdAt || FV.serverTimestamp() }, { merge: true });
}

/** ينهي بوت جلسة استفهام ويكتب سجل التسجيل. handled=false لو لم تُسجَّل بالبوت (مسار قديم). */
async function finishIstifham(requestId) {
  const id = iid(requestId);
  const snap = (await REG().doc(id).get()).data();
  if (!snap) return { handled: false };
  // إغلاق الجلسة نفسها (idempotent) — قد نصل هنا من الـ cron وليس من العميل
  await db.collection('istifhams').doc(requestId).update({ recordingStopped: true, recordingOpen: false, recordingEndedAtMs: Date.now() }).catch(() => {});
  if (snap.status === 'failed') { await writeIstifham(requestId, { r2Key: '', status: 'failed', error: snap.error || 'تعذر بدء تسجيل الجلسة' }); return { handled: true, status: 'failed' }; }
  const d = await claim(id);
  if (!d) return { handled: true, status: snap.status };
  const out = await stopAndLocate(d.state);
  await writeIstifham(requestId, {
    r2Key: out.key, status: out.ok ? 'ready' : 'processing', error: out.ok ? '' : 'جارٍ تجهيز التسجيل', source: 'bot',
    size: out.ok ? out.size : 0, savedAtMs: Date.now(),
  });
  await REG().doc(id).update({ status: out.ok ? 'done' : 'pending', key: out.key, size: out.size, stoppedAtMs: Date.now() });
  await purgeEvents({ k: 'i', rid: requestId });
  return { handled: true, status: out.ok ? 'done' : 'pending' };
}

/** يؤكّد وصول ملف تسجيل بوت معلّق (pending) الآن. يرجّع true لو أصبح جاهزًا. */
async function confirmPending(id) {
  const ref = REG().doc(id);
  const d = (await ref.get()).data();
  if (!d || d.status !== 'pending') return d?.status === 'done';
  const size = await rec.fileSize(d.key);
  if (size <= MIN_BYTES) return false;
  if (d.kind === 'group') await linkGroup({ groupId: d.groupId, sessionId: d.sessionId, key: d.key, size, ready: true });
  else await writeIstifham(d.requestId, { r2Key: d.key, status: 'ready', error: '', source: 'bot', size, savedAtMs: Date.now() });
  await ref.update({ status: 'done', size });
  return true;
}

// ---------------------------------------------------------------- cron
/** ينهي أي بوت نُسي مفتوحًا، ويؤكّد الملفات التي تأخر وصولها. */
async function sweep() {
  const now = Date.now();
  const res = { finished: 0, confirmed: 0, failed: 0 };
  const snap = await REG().where('status', 'in', ['running', 'stopping', 'pending']).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const age = now - Number(d.startedAtMs || 0);
    try {
      if (d.status === 'pending') {
        const size = await rec.fileSize(d.key);
        if (size > MIN_BYTES) {
          if (d.kind === 'group') await linkGroup({ groupId: d.groupId, sessionId: d.sessionId, key: d.key, size, ready: true });
          else await writeIstifham(d.requestId, { r2Key: d.key, status: 'ready', error: '', source: 'bot', size, savedAtMs: now });
          await doc.ref.update({ status: 'done', size });
          res.confirmed++;
        } else if (now - Number(d.stoppedAtMs || d.startedAtMs || now) > 48 * 3600 * 1000) {
          const err = 'لم يصل ملف التسجيل من Agora خلال 48 ساعة';
          if (d.kind === 'group') await failGroup(d.groupId, d.sessionId, err); else await writeIstifham(d.requestId, { status: 'failed', error: err });
          await doc.ref.update({ status: 'failed', error: err });
          res.failed++;
        }
        continue;
      }
      const stale = d.status === 'stopping'
        ? now - Number(d.claimedAtMs || d.startedAtMs || 0) > 10 * 60 * 1000
        : (age > 7 * 3600 * 1000 || (age > 40 * 60 * 1000 && !(await rec.isRunning(d.state))));
      if (!stale) continue;
      if (d.status === 'stopping') await doc.ref.update({ status: 'running' });
      if (d.kind === 'group') await finishGroup(d.groupId, d.sessionId); else await finishIstifham(d.requestId);
      res.finished++;
    } catch (e) { console.error('bot sweep failed', doc.id, e); }
  }
  return res;
}

/** تشخيص صفحة التسجيل: يحفظ آخر 40 سطر في botRecordings/{id}.pageDiag */
async function pageDiag(p, text) {
  const id = p.k === 'g' ? gid(p.gid, p.sid) : iid(p.rid);
  const line = `${new Date().toISOString().slice(11, 19)} ${String(text || '').slice(0, 400)}`;
  const ref = REG().doc(id);
  await db.runTransaction(async (tx) => {
    const d = await tx.get(ref); const cur = (d.exists && Array.isArray(d.data().pageDiag)) ? d.data().pageDiag : [];
    tx.set(ref, { pageDiag: cur.concat(line).slice(-40) }, { merge: true });
  });
}

module.exports = { pageDiag, verifyPageToken, readEvents, rtcConfig, startGroup, startIstifham, finishGroup, finishIstifham, confirmPending, sweep, iid, gid };
