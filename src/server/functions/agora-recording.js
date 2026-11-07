/**
 * «بوت التسجيل» الخاص بالمنصة: Agora Cloud Recording يدخل القناة بمعرّف مخفي (REC_UID) ويسجّل
 * كل الجلسة (صوت + فيديو + مشاركة الشاشة) في فيديو واحد (mix) ويرفعه مباشرة إلى Cloudflare R2،
 * بدون أي تسجيل على أجهزة المُفهّم أو المستفهم. يُستخدم لجلسات المجموعات والاستفهام (انظر bot-recording.js).
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
const isTransient = (e) => /allocate_timeout|timeout|temporar|busy|overload|region|5\d\d/i.test(String(e?.message || '')) || (e?.agoraStatus >= 500);

/** يعيد المحاولة عند أخطاء Agora المؤقتة (مثل allocate_timeout). */
async function call(c, path, body, tries = 5) {
  let last;
  // بعض المشاريع يفشل فيها حجز المورد (allocate_timeout) بدون تحديد منطقة: نجرّب مناطق Agora بالتناوب
  const regions = (String(process.env.AGORA_RECORDING_REGION || '').trim() ? [String(process.env.AGORA_RECORDING_REGION).trim()] : ['', 'EU', 'AP', 'NA', 'EU']);
  for (let i = 0; i < tries; i++) {
    if (path === 'acquire' && body?.clientRequest) {
      const r = regions[Math.min(i, regions.length - 1)];
      if (r) body.clientRequest.region = r; else delete body.clientRequest.region;
    }
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

async function callOnce(c, path, body, method = 'POST') {
  const auth = Buffer.from(`${c.customerId}:${c.customerSecret}`).toString('base64');
  const host = c.useAltHost ? 'api.sd-rtn.com' : 'api.agora.io';
  const res = await fetch(`https://${host}/v1/apps/${c.appId}/cloud_recording/${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json;charset=utf-8' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
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
        channelType: 1, // التطبيق يدخل القناة بـ liveBroadcasting (agora_meeting_room.dart) فلازم يطابقه
        streamTypes: 2, // صوت + فيديو
        maxIdleTime: 1800, // يبقى بانتظار دخول أحد (وبعد خروج الجميع) حتى 30 دقيقة ثم يتوقف وحده
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
  return { resourceId, sid: start.sid, uid, channel, mode: 'mix' };
}

/** يجمع كل أسماء الملفات من رد Agora (الشكل يختلف بين وضع mix ووضع web page). */
function collectFileNames(node, out = []) {
  if (!node) return out;
  if (typeof node === 'string') { if (/\.(mp4|m3u8)$/i.test(node)) out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => collectFileNames(n, out)); return out; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (/^file_?name$/i.test(k) && typeof v === 'string') out.push(v);
      else collectFileNames(v, out);
    }
  }
  return out;
}

/** يوقف التسجيل ويرجّع مسار ملف mp4 داخل R2 (أو null لو لم يُنتج). */
async function stopRecording(state) {
  const c = cfg();
  const mode = state.mode === 'web' ? 'web' : 'mix';
  const res = await call(c, `resourceid/${state.resourceId}/sid/${state.sid}/mode/${mode}/stop`, {
    cname: state.channel,
    uid: state.uid,
    clientRequest: mode === 'web' ? {} : { async_stop: false },
  });
  const names = [...new Set(collectFileNames(res?.serverResponse))];
  const mp4s = names.filter((n) => n.toLowerCase().endsWith('.mp4'));
  return { mp4: mp4s[0] || null, mp4s, files: names };
}

const WEB_UID = 2147482000; // معرّف صفحة التسجيل داخل القناة (Web SDK) — لا يستخدمه أي مستخدم
const WEB_REC_UID = '2147481000'; // معرّف خدمة تسجيل الصفحة لدى Agora

/** يصدر توكن دخول القناة لصفحة التسجيل (مشاهد فقط). */
function pageRtcToken(channel, hours = 9) {
  const c = cfg();
  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
  return RtcTokenBuilder.buildTokenWithUid(c.appId, c.cert, channel, WEB_UID, RtcRole.SUBSCRIBER, Math.floor(Date.now() / 1000) + hours * 3600);
}

/**
 * يبدأ «تسجيل صفحة ويب» (Agora web page recording): خدمة Agora تفتح pageUrl في متصفح خفي وتسجّل
 * ما يظهر فيه + صوته. الصفحة تعرض فيديوهات القناة والسبورة والملف المشارَك والشات، فيُسجَّل كل شيء.
 */
async function startWebRecording({ channel, pageUrl, prefix }) {
  const c = cfg();
  const miss = missing(c);
  if (miss.length) throw new Error(`إعدادات التسجيل ناقصة في Vercel: ${miss.join(', ')}`);
  const acq = await call(c, 'acquire', { cname: channel, uid: WEB_REC_UID, clientRequest: { resourceExpiredHour: 24, scene: 1 } });
  const resourceId = acq.resourceId;
  const start = await call(c, `resourceid/${resourceId}/mode/web/start`, {
    cname: channel,
    uid: WEB_REC_UID,
    clientRequest: {
      extensionServiceConfig: {
        errorHandlePolicy: 'error_abort',
        extensionServices: [{
          serviceName: 'web_recorder_service',
          errorHandlePolicy: 'error_abort',
          serviceParam: { url: pageUrl, audioProfile: 0, videoWidth: 1280, videoHeight: 720, maxRecordingHour: 8 },
        }],
      },
      recordingFileConfig: { avFileType: ['hls', 'mp4'] },
      storageConfig: {
        vendor: 11, region: 0, bucket: c.bucket, accessKey: c.r2Key, secretKey: c.r2Secret,
        fileNamePrefix: prefix,
        extensionParams: { endpoint: `${c.r2Account}.r2.cloudflarestorage.com` },
      },
    },
  });
  return { resourceId, sid: start.sid, uid: WEB_REC_UID, channel, mode: 'web' };
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
      const r = await call(c, 'acquire', { cname: `check_${Date.now()}`.slice(0, 40), uid: String(REC_UID), clientRequest: { resourceExpiredHour: 1, scene: 0 } }, 5);
      out.acquire = { ok: !!r.resourceId };
    } catch (e) { out.acquire = { ok: false, error: String(e?.message || e), status: e?.agoraStatus || 0 }; }
  }
  return out;
}

/** أسماء القنوات: لازم تطابق بالضبط ما يصدره getGroupMeetingToken / getAgoraMeetingToken. */
const clean = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
const groupChannel = (groupId, sessionId) => clean(`Group_${groupId}_${sessionId}`);
const istifhamChannel = (requestId) => clean(`Fahimni_${requestId}`);

/** مسار mp4 المتوقع لو لم يرجع Agora قائمة الملفات (Agora يسمّيه <sid>_<channel>.mp4 تحت الـ prefix). */
const expectedMp4Key = (prefix, sid, channel) => `${[].concat(prefix).join('/')}/${sid}_${channel}.mp4`;

/** حجم الملف في R2 (0 لو غير موجود). */
async function fileSize(key) {
  try {
    const { presignedUrl } = require('./r2');
    const signed = presignedUrl({ method: 'HEAD', key, expiresSeconds: 120 });
    const res = await fetch(signed.url, { method: 'HEAD' });
    return res.ok ? Number(res.headers.get('content-length') || 0) : 0;
  } catch (_) { return 0; }
}

/** هل البوت ما زال يسجّل؟ (Agora query). false لو انتهى أو لم يعد موجودًا. */
async function isRunning(state) {
  try {
    const c = cfg();
    const mode = state.mode === 'web' ? 'web' : 'mix';
    const res = await callOnce(c, `resourceid/${state.resourceId}/sid/${state.sid}/mode/${mode}/query`, null, 'GET');
    const raw = res?.serverResponse?.status;
    if (raw === undefined) return true; // الاستعلام نجح (الجلسة ما زالت معروفة لدى Agora)
    const st = Number(raw);
    return st >= 1 && st <= 5; // 1..5 = جارٍ/بدأ/يعمل؛ 6+ = متوقف
  } catch (_) { return false; }
}

module.exports = { startRecording, startWebRecording, pageRtcToken, WEB_UID, stopRecording, fileExists, fileSize, isRunning, checkConfig, groupChannel, istifhamChannel, expectedMp4Key };
