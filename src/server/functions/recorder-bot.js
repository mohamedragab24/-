/**
 * إرسال أوامر التسجيل إلى «بوت فهمت» (recorder-bot) وإيقافه.
 * متغيرات Vercel: RECORDER_BOT_URL, RECORDER_BOT_SECRET (+ AGORA_APP_ID/AGORA_APP_CERTIFICATE).
 */
const BOT_UID = 2147483001; // معرّف البوت داخل القناة (مشاهد خفي)

const channelFor = (kind, ids) =>
  (kind === 'istifham' ? `Fahimni_${ids.requestId}` : `Group_${ids.groupId}_${ids.sessionId}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

const jobIdFor = (kind, ids) => (kind === 'istifham' ? `i_${ids.requestId}` : `g_${ids.groupId}_${ids.sessionId}`);

function botConfig() {
  const url = String(process.env.RECORDER_BOT_URL || '').trim().replace(/\/+$/, '');
  const secret = String(process.env.RECORDER_BOT_SECRET || '').trim();
  if (!url || !secret) throw new Error('بوت التسجيل غير مضبوط: RECORDER_BOT_URL و RECORDER_BOT_SECRET في Vercel');
  return { url, secret };
}

async function botFetch(path, body, timeoutMs = 9000) {
  const { url, secret } = botConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bot-secret': secret }, body: JSON.stringify(body || {}), signal: ctrl.signal });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok) throw new Error(`البوت رفض الطلب (${res.status}): ${String(json.error || text).slice(0, 120)}`);
    return json;
  } finally { clearTimeout(timer); }
}

/** يطلب من البوت الانضمام للجلسة وتسجيلها. يرجّع jobId. */
async function dispatchBot({ kind, groupId, sessionId, requestId, title }) {
  const appId = String(process.env.AGORA_APP_ID || '').trim();
  const cert = String(process.env.AGORA_APP_CERTIFICATE || '').trim();
  if (!appId || !cert) throw new Error('AGORA_APP_ID / AGORA_APP_CERTIFICATE ناقصان');
  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
  const ids = { requestId, groupId, sessionId };
  const channel = channelFor(kind, ids);
  const expire = Math.floor(Date.now() / 1000) + 8 * 3600;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, BOT_UID, RtcRole.SUBSCRIBER, expire);
  const jobId = jobIdFor(kind, ids);
  await botFetch('/jobs', { jobId, kind, groupId, sessionId, requestId, appId, channel, token, uid: BOT_UID, title: title || '' });
  return jobId;
}

async function stopBot(jobId) {
  if (!jobId) return;
  await botFetch(`/jobs/${encodeURIComponent(jobId)}/stop`, {}, 6000);
}

// ---------------------------------------------------------------- واجهة موحّدة: Agora web recording (بدون VPS) أو البوت
/** RECORDER_MODE = agora-web | bot. الافتراضي: bot لو RECORDER_BOT_URL مضبوط وإلا agora-web. */
function recorderMode() {
  const m = String(process.env.RECORDER_MODE || '').trim().toLowerCase();
  if (m === 'bot' || m === 'agora-web') return m;
  return String(process.env.RECORDER_BOT_URL || '').trim() ? 'bot' : 'agora-web';
}

/** يبدأ تسجيل الجلسة ويرجّع «حالة المهمة» لتُحفظ على وثيقة الجلسة. */
async function dispatchRecording({ kind, groupId, sessionId, requestId, title }) {
  if (recorderMode() === 'bot') {
    const jobId = await dispatchBot({ kind, groupId, sessionId, requestId, title });
    return { mode: 'bot', jobId };
  }
  const appId = String(process.env.AGORA_APP_ID || '').trim();
  const cert = String(process.env.AGORA_APP_CERTIFICATE || '').trim();
  if (!appId || !cert) throw new Error('AGORA_APP_ID / AGORA_APP_CERTIFICATE ناقصان');
  const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
  const ids = { requestId, groupId, sessionId };
  const channel = channelFor(kind, ids);
  const expire = Math.floor(Date.now() / 1000) + 8 * 3600;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, BOT_UID, RtcRole.SUBSCRIBER, expire);
  const base = String(process.env.PLATFORM_URL || 'https://www.fahemt.online').replace(/\/+$/, '');
  const qs = new URLSearchParams({ appId, channel, token, uid: String(BOT_UID), title: title || 'جلسة' });
  const jobId = jobIdFor(kind, ids);
  const state = await require('./agora-recording').startWebRecording({
    cname: `web_${jobId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60),
    pageUrl: `${base}/recorder.html?${qs.toString()}`,
    prefix: kind === 'istifham' ? ['sessions', requestId] : ['groups', groupId, 'recordings'],
  });
  return { ...state, jobId };
}

/** يوقف التسجيل. لـ agora-web يرجّع { mp4 } (مسار الملف في R2). */
async function stopRecording(state) {
  if (!state) return {};
  if (state.mode === 'agora-web') return require('./agora-recording').stopWebRecording(state);
  await stopBot(state.jobId);
  return {};
}

module.exports = { dispatchBot, stopBot, jobIdFor, channelFor, recorderMode, dispatchRecording, stopRecording };
