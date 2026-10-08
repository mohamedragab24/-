/**
 * معالجة أحداث JaaS (RECORDING_STARTED / RECORDING_ENDED / RECORDING_UPLOADED).
 * عند اكتمال الرفع: ننزّل MP4 من الرابط المؤقت ونرفعه إلى Cloudflare R2، ثم نحفظ بيانات التسجيل:
 *   lectureRecordings/{id}                      ← لوحة التسجيلات في تطبيق الأدمن
 *   groups/{gid}/recordings/{sessionId}         ← "الجلسات المسجلة" داخل المجموعة (للمُفهم والطلاب)
 * أسماء الغرف: Fahimni_group_<groupId>_<sessionId> (مجموعات) و Fahimni_<requestId> (محاضرات الاستفهام).
 */
const admin = require('firebase-admin');
const { presignedUrl, putObject } = require('./r2');

const db = () => admin.firestore();
const FV = () => admin.firestore.FieldValue;
const GROUP_ROOM = /^Fahimni_group_([A-Za-z0-9]+)_([A-Za-z0-9]+)$/;
const MEETING_ROOM = /^Fahimni_([A-Za-z0-9]+)$/;

function parseRoom(body) {
  const fqn = String(body?.fqn || body?.data?.fqn || '');
  const room = fqn.includes('/') ? fqn.split('/').slice(1).join('/') : String(body?.data?.roomName || fqn);
  let m = room.match(GROUP_ROOM);
  if (m) return { kind: 'group', groupId: m[1], sessionId: m[2], room };
  m = room.match(MEETING_ROOM);
  if (m) return { kind: 'meeting', requestId: m[1], room };
  return null;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function durationSec(data = {}) {
  const d = num(data.durationSec ?? data.duration);
  if (d > 0) return d > 100000 ? Math.round(d / 1000) : Math.round(d); // قد تأتي بالمللي ثانية
  const s = num(data.startTimestamp), e = num(data.endTimestamp);
  return s && e && e > s ? Math.round((e - s) / 1000) : 0;
}

/** يملأ بيانات العرض (اسم المجموعة/المدرس/عنوان الجلسة) */
async function describe(info) {
  if (info.kind === 'group') {
    const g = (await db().collection('groups').doc(info.groupId).get()).data() || {};
    const s = (await db().collection('groups').doc(info.groupId).collection('sessions').doc(info.sessionId).get()).data() || {};
    return { id: info.sessionId, title: s.title || 'جلسة', groupId: info.groupId, groupName: g.name || '', ownerUid: g.ownerUid || '', ownerName: g.ownerName || '', sessionId: info.sessionId };
  }
  const m = (await db().collection('istifhams').doc(info.requestId).get()).data() || {};
  return { id: `m_${info.requestId}`, title: m.title || 'محاضرة', groupId: '', groupName: 'محاضرة خاصة', ownerUid: m.mufhemId || '', ownerName: m.mufhemName || '', requestId: info.requestId };
}

async function upload(link, key) {
  const res = await fetch(link);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 0 && res.body) {
    try {
      const signed = presignedUrl({ method: 'PUT', key, expiresSeconds: 3600, contentType: 'video/mp4' });
      const put = await fetch(signed.url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(len) }, body: res.body, duplex: 'half' });
      if (!put.ok) throw new Error(`r2 put failed ${put.status}`);
      return len;
    } catch (e) {
      console.error('stream upload failed, retry buffered', e);
      if (len > 300 * 1024 * 1024) throw e;
      const again = await fetch(link);
      if (!again.ok) throw new Error(`download retry failed ${again.status}`);
      const buf = Buffer.from(await again.arrayBuffer());
      await putObject(key, buf, 'video/mp4');
      return buf.length;
    }
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await putObject(key, buf, 'video/mp4');
  return buf.length;
}

async function handleJaasEvent(body) {
  const type = String(body?.eventType || '');
  if (!['RECORDING_STARTED', 'RECORDING_ENDED', 'RECORDING_UPLOADED'].includes(type)) return { ignored: type || 'unknown' };
  const info = parseRoom(body);
  if (!info) return { ignored: 'room_not_recognized' };
  const meta = await describe(info);
  const ref = db().collection('lectureRecordings').doc(meta.id);
  const common = { kind: info.kind, ...meta, room: info.room };
  const data = body.data || {};

  if (type === 'RECORDING_STARTED') {
    const ex = await ref.get();
    if (!ex.exists || ex.data().status !== 'ready') await ref.set({ ...common, status: 'recording', createdAt: ex.exists ? ex.data().createdAt : FV().serverTimestamp(), order: Date.now() }, { merge: true });
    return { ok: true, status: 'recording' };
  }
  if (type === 'RECORDING_ENDED') {
    const ex = await ref.get();
    if (!ex.exists || ex.data().status !== 'ready') await ref.set({ ...common, status: 'processing', createdAt: ex.exists ? ex.data().createdAt : FV().serverTimestamp(), order: Date.now() }, { merge: true });
    return { ok: true, status: 'processing' };
  }

  // RECORDING_UPLOADED
  const link = data.preAuthenticatedLink || data.downloadLink || data.share || '';
  if (!link) { await ref.set({ ...common, status: 'failed', error: 'no_download_link', createdAt: FV().serverTimestamp() }, { merge: true }); return { ok: false, error: 'no_download_link' }; }
  const stamp = String(data.recordingSessionId || body.sessionId || Date.now()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const key = info.kind === 'group' ? `groups/${info.groupId}/recordings/${info.sessionId}_${stamp}.mp4` : `meetings/${info.requestId}/${stamp}.mp4`;
  await ref.set({ ...common, status: 'uploading', createdAt: FV().serverTimestamp(), order: Date.now() }, { merge: true });
  try {
    const size = await upload(link, key);
    const dur = durationSec(data);
    await ref.set({ ...common, status: 'ready', r2Key: key, size, durationSec: dur, readyAt: FV().serverTimestamp() }, { merge: true });
    if (info.kind === 'group') {
      const gRef = db().collection('groups').doc(info.groupId);
      await gRef.collection('recordings').doc(info.sessionId).set({ title: meta.title, sessionId: info.sessionId, r2Key: key, size, durationSec: dur, status: 'ready', createdAt: FV().serverTimestamp(), order: Date.now() }, { merge: true });
      await gRef.update({ storageBytes: FV().increment(size) });
    }
    return { ok: true, status: 'ready', key, size };
  } catch (e) {
    console.error('recording upload failed', e);
    await ref.set({ status: 'failed', error: String(e?.message || e).slice(0, 200), sourceLink: link }, { merge: true });
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

module.exports = { handleJaasEvent, parseRoom, durationSec };
