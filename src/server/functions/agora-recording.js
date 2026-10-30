/**
 * تسجيل اجتماعات المجموعات عبر Agora Cloud Recording (وضع mix: فيديو واحد لكل الجلسة)
 * مع الحفظ مباشرة في Cloudflare R2 (S3-compatible) تحت groups/<groupId>/recordings/.
 *
 * متغيرات Vercel المطلوبة:
 *   AGORA_APP_ID, AGORA_APP_CERTIFICATE            (موجودة للاجتماعات)
 *   AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET       (Agora Console ← RESTful API ← Add a secret)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   (موجودة للرفع)
 * ولازم تفعّل Cloud Recording على مشروع Agora من Console.
 */
const REC_UID = 2147483000; // معرّف «المسجِّل» داخل القناة (لا يستخدمه أي مستخدم)

const cfg = () => ({
  appId: String(process.env.AGORA_APP_ID || '').trim(),
  cert: String(process.env.AGORA_APP_CERTIFICATE || '').trim(),
  customerId: String(process.env.AGORA_CUSTOMER_ID || '').trim(),
  customerSecret: String(process.env.AGORA_CUSTOMER_SECRET || '').trim(),
  r2Account: String(process.env.R2_ACCOUNT_ID || '').trim(),
  r2Key: String(process.env.R2_ACCESS_KEY_ID || '').trim(),
  r2Secret: String(process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  bucket: String(process.env.R2_BUCKET || 'fahmny-videos').trim(),
});

function missing(c) {
  return [
    !c.appId && 'AGORA_APP_ID', !c.cert && 'AGORA_APP_CERTIFICATE',
    !c.customerId && 'AGORA_CUSTOMER_ID', !c.customerSecret && 'AGORA_CUSTOMER_SECRET',
    !c.r2Account && 'R2_ACCOUNT_ID', !c.r2Key && 'R2_ACCESS_KEY_ID', !c.r2Secret && 'R2_SECRET_ACCESS_KEY',
  ].filter(Boolean);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTransient = (e) => /allocate_timeout|timeout|temporar|busy|overload|5\d\d/i.test(String(e?.message || '')) || (e?.agoraStatus >= 500);

/** يعيد المحاولة عند أخطاء Agora المؤقتة (مثل allocate_timeout). */
async function call(c, path, body, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await callOnce(c, path, body); }
    catch (e) {
      last = e;
      if (!isTransient(e) || i === tries - 1) throw e;
      if (i === 1) c.useAltHost = true; // بعد محاولتين: ننتقل لنطاق Agora البديل (api.sd-rtn.com)
      await sleep(2000 * (i + 1)); // backoff: 2s, 4s, 6s, 8s (توصية Agora لخطأ allocate_timeout)
    }
  }
  throw last;
}

async function callOnce(c, path, body) {
  const auth = Buffer.from(`${c.customerId}:${c.customerSecret}`).toString('base64');
  const host = c.useAltHost ? 'api.sd-rtn.com' : 'api.agora.io';
  const res = await fetch(`https://${host}/v1/apps/${c.appId}/cloud_recording/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const msg = `${data?.reason || data?.message || 'HTTP ' + res.status}${data?.code ? ' (code ' + data.code + ')' : ''}`;
    const err = new Error(`Agora ${path.split('/').pop()}: ${msg}`);
    err.agoraStatus = res.status;
    throw err;
  }
  return data;
}

/** يبدأ التسجيل (يُستدعى عند بدء جلسة مسجلة). يرجّع الحالة المطلوب حفظها على الجلسة. */
async function startRecording({ channel, groupId, prefix }) {
  const c = cfg();
  const miss = missing(c);
  if (miss.length) throw new Error(`إعدادات التسجيل ناقصة في Vercel: ${miss.join(', ')}`);
  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
  const token = RtcTokenBuilder.buildTokenWithUid(c.appId, c.cert, channel, REC_UID, RtcRole.SUBSCRIBER, Math.floor(Date.now() / 1000) + 6 * 3600);
  const uid = String(REC_UID);

  const acq = await call(c, 'acquire', { cname: channel, uid, clientRequest: { resourceExpiredHour: 24, scene: 0 } });
  const resourceId = acq.resourceId;
  const start = await call(c, `resourceid/${resourceId}/mode/mix/start`, {
    cname: channel,
    uid,
    clientRequest: {
      token,
      recordingConfig: {
        channelType: 0,
        streamTypes: 2, // صوت + فيديو
        maxIdleTime: 1800, // يبقى بانتظار دخول أحد حتى 30 دقيقة
        transcodingConfig: { width: 1280, height: 720, fps: 15, bitrate: 1200, mixedVideoLayout: 1, backgroundColor: '#000000' },
      },
      recordingFileConfig: { avFileType: ['hls', 'mp4'] },
      storageConfig: {
        vendor: 11, // تخزين متوافق مع S3 (Cloudflare R2)
        region: 0,
        bucket: c.bucket,
        accessKey: c.r2Key,
        secretKey: c.r2Secret,
        fileNamePrefix: prefix || ['groups', groupId, 'recordings'],
        extensionParams: { endpoint: `${c.r2Account}.r2.cloudflarestorage.com` },
      },
    },
  });
  return { resourceId, sid: start.sid, uid, channel };
}

/** يوقف التسجيل ويرجّع مسار ملف mp4 داخل R2 (أو null لو لم يُنتج). */
async function stopRecording(state) {
  const c = cfg();
  const res = await call(c, `resourceid/${state.resourceId}/sid/${state.sid}/mode/mix/stop`, {
    cname: state.channel,
    uid: state.uid,
    clientRequest: { async_stop: false },
  });
  const list = res?.serverResponse?.fileList;
  const names = Array.isArray(list) ? list.map((f) => String(f?.fileName || '')) : (typeof list === 'string' ? [list] : []);
  const mp4 = names.find((n) => n.toLowerCase().endsWith('.mp4')) || null;
  return { mp4, files: names };
}

/** يتأكد فعليًا أن الملف موجود في R2 (HEAD) وحجمه معقول، مع إعادة المحاولة. */
async function fileExists(key, tries = 5, delayMs = 3000) {
  const { presignedUrl } = require('./r2');
  for (let i = 0; i < tries; i++) {
    try {
      const signed = presignedUrl({ method: 'HEAD', key, expiresSeconds: 120 });
      const res = await fetch(signed.url, { method: 'HEAD' });
      if (res.ok && Number(res.headers.get('content-length') || 0) > 1024) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

/** فحص سريع للإعدادات: أي متغير ناقص + محاولة acquire حقيقية (بدون بدء تسجيل ولا تكلفة). */
async function checkConfig() {
  const c = cfg();
  const missingVars = missing(c);
  const out = { missingVars, acquire: null };
  if (c.appId && c.customerId && c.customerSecret) {
    try {
      const r = await call(c, 'acquire', { cname: `check_${Date.now()}`.slice(0, 40), uid: String(REC_UID), clientRequest: { resourceExpiredHour: 1, scene: 0 } }, 2);
      out.acquire = { ok: !!r.resourceId };
    } catch (e) { out.acquire = { ok: false, error: String(e?.message || e), status: e?.agoraStatus || 0 }; }
  }
  return out;
}

module.exports = { startRecording, stopRecording, fileExists, checkConfig };
