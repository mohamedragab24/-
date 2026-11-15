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
const isTransient = (e) => /allocate_timeout|timeout|temporar|busy|overload|region|5\d\d/i.test(String(e?.message || '')) || (e?.agoraStatus >= 500);

/** يعيد المحاولة عند أخطاء Agora المؤقتة (مثل allocate_timeout). */
async function call(c, path, body, tries = 5, method = 'POST') {
  let last;
  const trail = [];
  // بعض المشاريع يفشل فيها حجز المورد (allocate_timeout) بدون تحديد منطقة: نجرّب مناطق Agora بالتناوب
  const regions = (String(process.env.AGORA_RECORDING_REGION || '').trim() ? [String(process.env.AGORA_RECORDING_REGION).trim()] : ['', 'EU', 'AP', 'NA', 'EU']);
  for (let i = 0; i < tries; i++) {
    if (path === 'acquire' && body?.clientRequest) {
      const r = regions[Math.min(i, regions.length - 1)];
      if (r) body.clientRequest.region = r; else delete body.clientRequest.region;
    }
    try { return await callOnce(c, path, body, method); }
    catch (e) {
      last = e;
      trail.push(`${(body?.clientRequest?.region) || 'default'}@${c.useAltHost ? 'sd-rtn' : 'agora.io'}:${e.agoraStatus || '?'}`);
      if (!isTransient(e) || i === tries - 1) { e.message = `${e.message} [المحاولات: ${trail.join(' | ')}]`; throw e; }
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
  let text = '';
  try { text = await res.text(); data = JSON.parse(text); } catch (_) {}
  if (!res.ok) {
    const reason = data?.reason || data?.message || data?.error || (text ? text.slice(0, 160) : '');
    const action = path.split('/').pop();
    const err = new Error(`Agora ${action} فشل [HTTP ${res.status}${data?.code ? ` / code ${data.code}` : ''}]: ${reason || 'بدون تفاصيل'}`);
    err.agoraStatus = res.status;
    err.agoraBody = text.slice(0, 300);
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

/** فحص سريع: المتغيرات الناقصة + صحة بيانات Agora + حجز مورد لتسجيل الصفحات (scene 1) + هل recorder.html يُفتح بلا إعادة توجيه. */
async function checkConfig() {
  const c = cfg();
  const out = { missingVars: missing(c), project: null, acquire: null, page: null };
  if (c.appId && c.customerId && c.customerSecret) {
    try {
      const auth = Buffer.from(`${c.customerId}:${c.customerSecret}`).toString('base64');
      const res = await fetch('https://api.agora.io/dev/v1/projects', { headers: { Authorization: `Basic ${auth}` } });
      if (res.ok) {
        const j = await res.json();
        const list = Array.isArray(j?.projects) ? j.projects : [];
        const hit = list.find((p) => String(p.vendor_key || '') === c.appId);
        out.project = hit ? { ok: true, name: String(hit.name || '') } : { ok: false, error: `الـ App ID لا يتبع هذا الحساب (عدد المشاريع: ${list.length})` };
      } else out.project = { ok: false, error: `رفضت Agora بيانات الدخول (HTTP ${res.status})` };
    } catch (e) { out.project = { ok: false, error: String(e?.message || e) }; }
    try {
      const r = await call(c, 'acquire', { cname: `check_${Date.now()}`.slice(0, 40), uid: WEB_REC_UID, clientRequest: { resourceExpiredHour: 1, scene: 1 } }, 4);
      out.acquire = { ok: !!r.resourceId };
    } catch (e) { out.acquire = { ok: false, error: String(e?.message || e) }; }
  }
  try {
    const base = String(process.env.PLATFORM_URL || 'https://www.fahemt.online').replace(/\/+$/, '');
    const res = await fetch(`${base}/recorder.html`, { redirect: 'manual' });
    out.page = { ok: res.status === 200, status: res.status, location: res.headers.get('location') || '', url: `${base}/recorder.html` };
  } catch (e) { out.page = { ok: false, error: String(e?.message || e) }; }
  return out;
}

module.exports = { startRecording, stopRecording, fileExists, checkConfig };

// ---------------------------------------------------------------- تسجيل صفحة ويب (Web Page Recording)
// سحابة Agora تفتح صفحة recorder.html (تعيد رسم الاجتماع كاملًا: المشاركين/الشاشة المشاركة والسبورة والملفات والشات)
// وتسجّلها فيديو + صوت وترفعها إلى R2 — بدون أي سيرفر عندنا (لا VPS).
const WEB_REC_UID = '1000000001';

const step = async (label, fn) => { try { return await fn(); } catch (e) { e.message = `[${label}] ${e.message}`; throw e; } };

/** يفحص حالة تسجيل صفحة الويب (query). */
async function queryWebRecording(state) {
  const c = cfg();
  return call(c, `resourceid/${state.resourceId}/sid/${state.sid}/mode/web/query`, null, 1, 'GET');
}

/** يبدأ تسجيل صفحة الويب. pageUrl = رابط recorder.html بكل بارامتراته. prefix = مسار الحفظ داخل R2. */
async function startWebRecording({ cname, pageUrl, prefix, maxHours = 4 }) {
  const c = cfg();
  const miss = missing(c);
  if (miss.length) throw new Error(`إعدادات التسجيل ناقصة في Vercel: ${miss.join(', ')}`);
  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
  const recToken = RtcTokenBuilder.buildTokenWithUid(c.appId, c.cert, cname, Number(WEB_REC_UID), RtcRole.SUBSCRIBER, Math.floor(Date.now() / 1000) + 8 * 3600);
  const acq = await step('acquire', () => call(c, 'acquire', { cname, uid: WEB_REC_UID, clientRequest: { resourceExpiredHour: 24, scene: 1 } }));
  const resourceId = acq.resourceId;
  const start = await step('start', () => call(c, `resourceid/${resourceId}/mode/web/start`, {
    cname,
    uid: WEB_REC_UID,
    clientRequest: {
      token: recToken,
      extensionServiceConfig: {
        errorHandlePolicy: 'error_abort',
        extensionServices: [{
          serviceName: 'web_recorder_service',
          errorHandlePolicy: 'error_abort',
          serviceParam: { url: pageUrl, audioProfile: 0, videoWidth: 1280, videoHeight: 720, maxRecordingHour: maxHours },
        }],
      },
      recordingFileConfig: { avFileType: ['hls', 'mp4'] },
      storageConfig: {
        vendor: 11, // تخزين متوافق مع S3 (Cloudflare R2)
        region: 0,
        bucket: c.bucket,
        accessKey: c.r2Key,
        secretKey: c.r2Secret,
        fileNamePrefix: prefix,
        extensionParams: { endpoint: `${c.r2Account}.r2.cloudflarestorage.com` },
      },
    },
  }));
  const state = { mode: 'agora-web', resourceId, sid: start.sid, uid: WEB_REC_UID, cname, startedAtMs: Date.now(), pageUrl: pageUrl.replace(/token=[^&]+/, 'token=***') };
  // تحقق مبكر: لو تعذّر فتح الصفحة تخرج خدمة Agora فورًا؛ نكتشف ذلك الآن ونعرض السبب الحقيقي بدل الانتظار لنهاية الجلسة
  await new Promise((r) => setTimeout(r, 7000));
  try {
    const q = await queryWebRecording(state);
    const svc = (q?.serverResponse?.extensionServiceState || [])[0] || {};
    const st = String(svc?.payload?.state || '');
    state.lastQuery = JSON.stringify(q?.serverResponse || {}).slice(0, 280);
    if (st === 'exit' || st === 'failed') throw new Error(`خرجت خدمة التسجيل بعد البدء مباشرة (state=${st}). غالبًا لا تستطيع Agora فتح الصفحة أو أُعيد توجيهها: ${state.pageUrl}. التفاصيل: ${state.lastQuery}`);
  } catch (e) {
    if (/خرجت خدمة التسجيل/.test(String(e.message))) { try { await stopWebRecording(state); } catch (_) {} throw e; }
    // فشل الاستعلام نفسه (مثل 404 «لا يوجد worker»): نعتبره دليلًا على توقف الخدمة
    if (e.agoraStatus === 404 || e.agoraStatus === 400) { throw new Error(`[query] لم تعد خدمة التسجيل تعمل بعد البدء: ${e.message}`); }
    // أخطاء أخرى مؤقتة: لا نفشل الجلسة بسببها
  }
  return state;
}

/** يوقف تسجيل الصفحة ويرجّع مسار ملف mp4 مع تفاصيل الحالة (لعرض السبب الحقيقي عند عدم وجود ملف). */
async function stopWebRecording(state) {
  const c = cfg();
  const res = await step('stop', () => call(c, `resourceid/${state.resourceId}/sid/${state.sid}/mode/web/stop`, { cname: state.cname, uid: state.uid, clientRequest: {} }));
  const sr = res?.serverResponse || {};
  const list = sr.fileList;
  const names = Array.isArray(list) ? list.map((f) => String(f?.fileName || '')) : (typeof list === 'string' ? [list] : []);
  const mp4s = names.filter((n) => n.toLowerCase().endsWith('.mp4'));
  return { mp4: mp4s[0] || null, mp4s, files: names, uploadingStatus: String(sr.uploadingStatus || ''), raw: JSON.stringify(sr).slice(0, 300) };
}

module.exports.startWebRecording = startWebRecording;
module.exports.stopWebRecording = stopWebRecording;
