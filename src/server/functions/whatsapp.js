'use strict';

/**
 * بوت واتساب لمنصة فهمت (WhatsApp Cloud API — Meta مباشرة).
 *
 * المسؤوليات:
 *  1) استقبال رسائل الطلبة والمفهمين من webhook ميتا (/api/whatsapp/webhook).
 *  2) الرد التلقائي على الأسئلة الشائعة (كورسات، حجز، دفع، مشاكل المحاضرات، الحساب).
 *  3) التحويل لموظف بشري: البوت يسكت في المحادثة ويوصل إشعار للأدمن.
 *  4) حفظ كل المحادثات في Firestore لتظهر في لوحة التحكم (/admin/whatsapp).
 *  5) إرسال ردود الأدمن من اللوحة داخل نافذة الـ24 ساعة.
 *
 * كل الإعدادات من متغيرات البيئة على Vercel — مفيش أي توكن مكتوب في الكود:
 *  WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID,
 *  WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_GRAPH_VERSION (اختياري)
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

const CONV = 'whatsappConversations';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC = 'whatsappBot';
const WINDOW_MS = 24 * 60 * 60 * 1000;

const env = (k) => String(process.env[k] || '').trim();
const db = () => admin.firestore();
const now = () => admin.firestore.FieldValue.serverTimestamp();

function config() {
  return {
    phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
    wabaId: env('WHATSAPP_BUSINESS_ACCOUNT_ID'),
    token: env('WHATSAPP_ACCESS_TOKEN'),
    verifyToken: env('WHATSAPP_VERIFY_TOKEN'),
    appSecret: env('WHATSAPP_APP_SECRET'),
    graphVersion: env('WHATSAPP_GRAPH_VERSION') || 'v25.0',
    botEnabled: env('WHATSAPP_BOT_ENABLED') !== '0',
    allowUnsigned: env('WHATSAPP_ALLOW_UNSIGNED') === '1',
    notifyAdminPhone: env('WHATSAPP_ADMIN_PHONE'),
  };
}

/** فحص توقيع ميتا X-Hub-Signature-256 (HMAC-SHA256 للجسم الخام) */
function verifySignature(rawBody, signatureHeader) {
  const { appSecret, allowUnsigned } = config();
  const secrets = [appSecret, process.env.WHATSAPP_APP_SECRET_2]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (!secrets.length) return allowUnsigned;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const got = signatureHeader.slice(7);
  return secrets.some((secret) => {
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    if (expected.length !== got.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  });
}

async function graph(path, method, body) {
  const { token, graphVersion } = config();
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN غير مضبوط على السيرفر');
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Graph API ${res.status}`;
    const err = new Error(msg);
    err.graph = json?.error || null;
    err.status = res.status;
    throw err;
  }
  return json;
}

/** إرسال أي رسالة عبر Cloud API */
async function send(payload) {
  const { phoneNumberId } = config();
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID غير مضبوط على السيرفر');
  return graph(`${phoneNumberId}/messages`, 'POST', { messaging_product: 'whatsapp', ...payload });
}

const sendText = (to, body) => send({ to, type: 'text', text: { preview_url: false, body: String(body).slice(0, 4096) } });

/** قائمة تفاعلية (أقصى 10 صفوف، عنوان الصف 24 حرف، الوصف 72 حرف) */
const sendList = (to, { header, body, footer, button, rows }) =>
  send({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header ? { header: { type: 'text', text: String(header).slice(0, 60) } } : {}),
      body: { text: String(body).slice(0, 1024) },
      ...(footer ? { footer: { text: String(footer).slice(0, 60) } } : {}),
      action: {
        button: String(button || 'اختر').slice(0, 20),
        sections: [{ title: 'الأقسام', rows: rows.slice(0, 10) }],
      },
    },
  });

/** أزرار سريعة (أقصى 3 أزرار، عنوان الزر 20 حرف) */
const sendButtons = (to, { body, footer, buttons }) =>
  send({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(body).slice(0, 1024) },
      ...(footer ? { footer: { text: String(footer).slice(0, 60) } } : {}),
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: String(b.title).slice(0, 20) } })) },
    },
  });

async function markRead(messageId) {
  try {
    await send({ status: 'read', message_id: messageId });
  } catch (e) {
    // علامة القراءة تجميلية؛ لا نُفشل المعالجة بسببها
    console.warn('whatsapp markRead failed', e?.message);
  }
}

/** أرقام واتساب تأتي بصيغة دولية بدون + مثل 201012345678 */
function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

const DEFAULT_TEXT = {
  welcome:
    'أهلاً بيك في فهمت 👋\nأنا المساعد الآلي، أقدر أساعدك في الكورسات، حجز محاضرة مع مُفَهِّم، الدفع والمحفظة، والمشاكل التقنية.\nاختار من القائمة أو اكتب سؤالك.',
  courses:
    'الكورسات المتاحة على المنصة بتظهر في صفحة «الكورسات»، وكل كورس فيه السعر وعدد المحاضرات واسم المُفَهِّم.\nتقدر تشوفها من هنا: https://fahemt.online/courses\nولو عايز كورس معين اكتب اسمه وهساعدك.',
  booking:
    'حجز محاضرة فردية:\n1) سجّل دخول واختار «إنشاء استفهام» من الصفحة الرئيسية.\n2) حدّد المادة والوقت والميزانية.\n3) أول مُفَهِّم يقبل الطلب تبدأ المحاضرة من التطبيق أو المتصفح.\nالمحاضرات الفردية بتبقى بينك وبين المُفَهِّم فقط، وبتتسجل تلقائياً.',
  payment:
    'الدفع على المنصة:\n• محفظة داخلية تشحنها بفودافون كاش أو إنستاباي أو تحويل بنكي.\n• بعد التحويل ارفع صورة الإيصال من «المحفظة» ويتأكد الرصيد.\n• الشراء من الرصيد فوراً بدون انتظار.\nلو حصل خصم مرتين أو الدفع معلّق، اكتب «موظف» وهحوّلك للدعم.',
  session:
    'لو فيه مشكلة في محاضرة:\n• الصوت أو الصورة واقفين: اطلع وادخل تاني، وتأكد من إذن الميكروفون والكاميرا.\n• المحاضرة مش ظاهرة: راجع «طلباتي» ولو الطلب مقبول هتلاقي المحاضرة.\n• تسجيل المحاضرة بيظهر في صفحة «تسجيلات المحاضرات» بعد انتهاء الجلسة بدقايق.\nاكتب «موظف» لو المشكلة لسه موجودة.',
  account:
    'بخصوص حسابك:\n• تسجيل الدخول بنفس البريد أو رقم الموبايل اللي سجلت بيه.\n• نسيت كلمة السر: من صفحة الدخول اختار «نسيت كلمة المرور».\n• لتغيير رقم الموبايل أو بياناتك: من «الملف الشخصي» بعد الدخول.\nلو الحساب موقوف أو محتاج توثيق، اكتب «موظف».',
  fallback:
    'مش متأكد إني فهمت سؤالك 🤔\nتقدر تختار من القائمة أو تكتب «موظف» وحد من الفريق يرد عليك.',
  handoff:
    'تمام، حوّلت محادثتك لفريق الدعم ✅\nحد من الفريق هيرد عليك هنا على واتساب في أقرب وقت. لو حابب تضيف تفاصيل اكتبها في رسالة واحدة.',
  afterHours: 'استلمت رسالتك، وفريق الدعم هيرد عليك في مواعيد العمل (٩ صباحاً - ١٠ مساءً).',
  nonText: 'استلمت الملف ✅ لو محتاج رد سريع اكتب سؤالك في رسالة، أو اكتب «موظف» للتحويل للدعم.',
};

const MENU_ROWS = [
  { id: 'courses', title: 'الكورسات والأسعار', description: 'الكورسات المتاحة وطريقة الشراء' },
  { id: 'booking', title: 'حجز محاضرة', description: 'محاضرة فردية مع مُفَهِّم خطوة بخطوة' },
  { id: 'payment', title: 'الدفع والمحفظة', description: 'الشحن، الإيصال، والخصم المعلّق' },
  { id: 'session', title: 'مشكلة في محاضرة', description: 'الصوت، الصورة، أو التسجيل' },
  { id: 'account', title: 'حسابي', description: 'الدخول، كلمة السر، البيانات' },
  { id: 'human', title: 'التحدث مع موظف', description: 'تحويل المحادثة لفريق الدعم' },
];

const INTENTS = [
  { id: 'human', words: ['موظف', 'بشري', 'حد يرد', 'دعم', 'مسؤول', 'شكوى', 'اشتكي', 'أشتكي'] },
  { id: 'payment', words: ['دفع', 'فلوس', 'محفظ', 'رصيد', 'فودافون', 'انستاباي', 'إنستاباي', 'تحويل', 'استرداد', 'ريفند', 'خصم', 'إيصال', 'ايصال'] },
  { id: 'courses', words: ['كورس', 'كورسات', 'دورة', 'دورات', 'سعر', 'اسعار', 'أسعار', 'بكام', 'كام', 'اشتري', 'شراء', 'اشترك'] },
  { id: 'booking', words: ['حجز', 'احجز', 'محاضرة', 'محاضرات', 'ميعاد', 'موعد', 'مفهم', 'مُفهم', 'استفهام', 'طلب'] },
  { id: 'session', words: ['صوت', 'فيديو', 'ميك', 'مايك', 'كاميرا', 'شاشة', 'تسجيل', 'مش شغال', 'واقف', 'تقطيع', 'داخل'] },
  { id: 'account', words: ['حساب', 'دخول', 'باسورد', 'كلمة السر', 'كلمة المرور', 'ايميل', 'إيميل', 'بريد', 'توثيق', 'موبايل', 'رقم'] },
];

function detectIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  for (const intent of INTENTS) {
    if (intent.words.some((w) => t.includes(w))) return intent.id;
  }
  return null;
}

async function loadBotSettings() {
  try {
    const snap = await db().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
    const data = snap.exists ? snap.data() || {} : {};
    return {
      enabled: data.enabled !== false,
      texts: { ...DEFAULT_TEXT, ...(data.texts || {}) },
      extraFaqs: Array.isArray(data.faqs) ? data.faqs.filter((f) => f && f.question && f.answer) : [],
      handoffKeywords: Array.isArray(data.handoffKeywords) && data.handoffKeywords.length ? data.handoffKeywords : [],
      businessHours: data.businessHours || '٩ صباحاً - ١٠ مساءً',
    };
  } catch (e) {
    console.warn('whatsapp settings load failed', e?.message);
    return { enabled: true, texts: DEFAULT_TEXT, extraFaqs: [], handoffKeywords: [], businessHours: '٩ صباحاً - ١٠ مساءً' };
  }
}

/** يبحث عن صاحب الرقم في users (phoneNumber أو phone) */
async function findPlatformUser(waId) {
  const variants = new Set([waId]);
  const local = waId.startsWith('20') ? `0${waId.slice(2)}` : '';
  if (local) variants.add(local);
  for (const v of variants) {
    for (const field of ['phoneNumber', 'phone']) {
      try {
        const snap = await db().collection('users').where(field, '==', v).limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const u = doc.data() || {};
          return { uid: doc.id, name: u.fullName || u.name || u.displayName || '', role: u.role || (u.isAdmin ? 'admin' : '') };
        }
      } catch (e) {
        /* حقل غير مفهرس: نتجاهل ونكمل */
      }
    }
  }
  return null;
}

async function getConversation(waId) {
  const ref = db().collection(CONV).doc(waId);
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? snap.data() || {} : null };
}

async function upsertConversation(waId, patch) {
  const ref = db().collection(CONV).doc(waId);
  await ref.set({ waId, phone: waId, updatedAt: now(), ...patch }, { merge: true });
  return ref;
}

async function logMessage(waId, id, message) {
  const ref = db().collection(CONV).doc(waId).collection('messages').doc(id);
  if (message.direction === 'in') {
    try {
      await ref.create({ ...message, createdAt: now() });
      return true;
    } catch (e) {
      if (String(e?.code) === '6' || /already exists/i.test(String(e?.message))) return false;
      throw e;
    }
  }
  await ref.set({ ...message, createdAt: now() }, { merge: true });
  return true;
}

async function notifyAdminsHandoff({ waId, name, lastText, userUid }) {
  try {
    await db().collection('adminLogs').add({
      action: 'whatsapp_handoff',
      targetUserId: userUid || null,
      targetUserName: name || waId,
      details: `طلب التحدث مع موظف على واتساب (${waId}): ${String(lastText || '').slice(0, 160)}`,
      timestamp: now(),
    });
  } catch (e) {
    console.warn('whatsapp handoff notify failed', e?.message);
  }
}

function menuPayload(texts, name) {
  const hello = name ? `أهلاً ${name} 👋` : 'أهلاً بيك 👋';
  return {
    header: 'فهمت — المساعد الآلي',
    body: `${hello}\n${texts.welcome.replace(/^أهلاً بيك في فهمت 👋\n?/, '')}`.slice(0, 1024),
    footer: 'اكتب «موظف» في أي وقت للتحويل للدعم',
    button: 'اختار',
    rows: MENU_ROWS,
  };
}

async function replyFor({ intent, texts, extraFaqs }) {
  if (!intent) return { kind: 'text', body: texts.fallback };
  const faq = extraFaqs.find((f) => String(f.id || '') === intent);
  if (faq) return { kind: 'text', body: faq.answer };
  return { kind: 'text', body: texts[intent] || texts.fallback };
}

/** يبني ويرسل رد البوت. يرجّع { intent, handoff } */
async function runBot({ waId, text, name, settings, conversation }) {
  const texts = settings.texts;
  const lower = String(text || '').toLowerCase();
  const extraHandoff = settings.handoffKeywords.some((k) => k && lower.includes(String(k).toLowerCase()));
  const intent = extraHandoff ? 'human' : detectIntent(text);

  if (intent === 'human') {
    await sendText(waId, texts.handoff);
    await upsertConversation(waId, {
      status: 'human',
      botEnabled: false,
      handoff: true,
      handoffAt: now(),
      lastOutboundAt: now(),
      lastMessage: texts.handoff,
      lastMessageAt: now(),
      unread: 1,
    });
    await logMessage(waId, `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, {
      direction: 'out', type: 'text', text: texts.handoff, by: 'bot', status: 'sent',
    });
    await notifyAdminsHandoff({ waId, name, lastText: text, userUid: conversation?.userUid });
    return { intent: 'human', handoff: true };
  }

  const reply = await replyFor({ intent, texts, extraFaqs: settings.extraFaqs });
  await sendText(waId, reply.body);
  await upsertConversation(waId, {
    lastOutboundAt: now(),
    lastMessage: reply.body,
    lastMessageAt: now(),
    lastIntent: intent || 'fallback',
    unread: 0,
  });
  await logMessage(waId, `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, {
    direction: 'out', type: 'text', text: reply.body, by: 'bot', status: 'sent', intent: intent || 'fallback',
  });
  return { intent: intent || 'fallback', handoff: false };
}

/** الرد على اختيار من القائمة */
async function runMenuChoice({ waId, choiceId, settings, conversation, name }) {
  if (choiceId === 'human') return runBot({ waId, text: 'موظف', name, settings, conversation });
  if (choiceId === 'menu') {
    await sendList(waId, menuPayload(settings.texts, name));
    await upsertConversation(waId, { lastOutboundAt: now(), lastMessage: 'القائمة الرئيسية', lastMessageAt: now() });
    return { intent: 'menu' };
  }
  const reply = await replyFor({ intent: choiceId, texts: settings.texts, extraFaqs: settings.extraFaqs });
  await sendText(waId, reply.body);
  await upsertConversation(waId, {
    lastOutboundAt: now(), lastMessage: reply.body, lastMessageAt: now(), lastIntent: choiceId, unread: 0,
  });
  await logMessage(waId, `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, {
    direction: 'out', type: 'text', text: reply.body, by: 'bot', status: 'sent', intent: choiceId,
  });
  return { intent: choiceId };
}

/** يحوّل رسالة واتساب الواردة إلى نص/اختيار */
function extractInbound(m) {
  if (!m) return null;
  if (m.type === 'text') return { kind: 'text', text: m.text?.body || '' };
  if (m.type === 'interactive') {
    const list = m.interactive?.list_reply;
    const btn = m.interactive?.button_reply;
    if (list) return { kind: 'choice', choiceId: list.id, text: list.title || '' };
    if (btn) return { kind: 'choice', choiceId: btn.id, text: btn.title || '' };
  }
  if (m.type === 'button') return { kind: 'choice', choiceId: m.button?.payload || '', text: m.button?.text || '' };
  if (m.type === 'reaction') return { kind: 'skip' };
  const label = m.type === 'image' ? '[صورة]' : m.type === 'audio' ? '[رسالة صوتية]' : m.type === 'document' ? `[ملف: ${m.document?.filename || ''}]` : m.type === 'location' ? '[موقع]' : `[${m.type}]`;
  return { kind: 'other', text: label };
}

/** المعالجة الكاملة لرسالة واحدة واردة */
async function handleMessage({ m, contactName, metadata }) {
  const waId = normalizePhone(m.from);
  if (!waId) return { skipped: 'no_sender' };

  const inbound = extractInbound(m);
  if (!inbound || inbound.kind === 'skip') return { skipped: 'reaction' };

  const { data: conversation } = await getConversation(waId);
  const platformUser = conversation?.userUid ? { uid: conversation.userUid, name: conversation.userName, role: conversation.userRole } : await findPlatformUser(waId);

  const created = await logMessage(waId, String(m.id), {
    direction: 'in',
    type: m.type || 'text',
    text: inbound.text || '',
    waMessageId: String(m.id),
    from: waId,
    status: 'received',
    meta: { phoneNumberId: metadata?.phone_number_id || '', displayPhone: metadata?.display_phone_number || '' },
  });
  if (!created) return { skipped: 'duplicate' };

  // الرسالة محتاجة موظف؟ (المحادثة محوّلة أو البوت مقفول فيها)
  const humanMode = Boolean(conversation && (conversation.status === 'human' || conversation.botEnabled === false || conversation.handoff === true));

  await upsertConversation(waId, {
    waId,
    phone: waId,
    name: contactName || conversation?.name || '',
    ...(platformUser?.uid ? { userUid: platformUser.uid, userName: platformUser.name || '', userRole: platformUser.role || '' } : {}),
    lastInboundAt: now(),
    lastMessage: inbound.text || '',
    lastMessageAt: now(),
    ...(conversation ? {} : { createdAt: now(), status: 'bot', botEnabled: true, handoff: false }),
    // عدّاد غير المقروء للأدمن: بيزيد بس في المحادثات اللي محتاجة تدخل بشري
    unread: humanMode ? admin.firestore.FieldValue.increment(1) : 0,
  });

  await markRead(String(m.id));

  // المحادثة محوّلة لموظف أو البوت مقفول: نسجل الرسالة فقط والأدمن يرد
  if (humanMode) {
    return { stored: true, humanMode: true };
  }

  const settings = await loadBotSettings();
  if (!settings.enabled || !config().botEnabled) return { stored: true, botOff: true };

  if (inbound.kind === 'other') {
    await sendText(waId, settings.texts.nonText);
    await upsertConversation(waId, { lastOutboundAt: now(), lastMessage: settings.texts.nonText, lastMessageAt: now() });
    return { stored: true, intent: 'nonText' };
  }

  // أول رسالة في المحادثة: نعرض القائمة
  const isFirst = !conversation;
  if (isFirst && inbound.kind === 'text' && !detectIntent(inbound.text)) {
    const name = platformUser?.name || contactName || '';
    await sendList(waId, menuPayload(settings.texts, name));
    await upsertConversation(waId, { lastOutboundAt: now(), lastMessage: 'القائمة الرئيسية', lastMessageAt: now() });
    return { stored: true, intent: 'menu' };
  }

  if (inbound.kind === 'choice' && inbound.choiceId) {
    return { stored: true, ...(await runMenuChoice({ waId, choiceId: inbound.choiceId, settings, conversation, name: platformUser?.name || contactName })) };
  }

  return { stored: true, ...(await runBot({ waId, text: inbound.text, name: platformUser?.name || contactName, settings, conversation })) };
}

/** معالجة حالة تسليم/قراءة رسالة صادرة */
async function handleStatus(s) {
  try {
    const waId = normalizePhone(s.recipient_id);
    if (!waId || !s.id) return;
    const ref = db().collection(CONV).doc(waId).collection('messages').doc(String(s.id));
    const snap = await ref.get();
    if (!snap.exists) return;
    await ref.set({ status: String(s.status || ''), statusUpdatedAt: now(), ...(s.errors ? { errors: s.errors } : {}) }, { merge: true });
  } catch (e) {
    console.warn('whatsapp status update failed', e?.message);
  }
}

/** نقطة الدخول من الـ webhook */
async function handleWebhook(body) {
  const results = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const contactName = value?.contacts?.[0]?.profile?.name || '';
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const s of statuses) {
        await handleStatus(s);
      }
      for (const m of messages) {
        try {
          results.push(await handleMessage({ m, contactName, metadata: value.metadata }));
        } catch (e) {
          console.error('whatsapp message handling failed', e?.message, e?.graph || '');
          results.push({ error: String(e?.message || e) });
        }
      }
    }
  }
  return { handled: results.length, results };
}

/** رد الأدمن من لوحة التحكم (داخل نافذة 24 ساعة) */
async function sendAdminReply({ waId, text, actor }) {
  const phone = normalizePhone(waId);
  if (!phone || !String(text || '').trim()) {
    const e = new Error('رقم أو نص غير صالح');
    e.code = 'invalid-argument';
    throw e;
  }
  const { data: conversation } = await getConversation(phone);
  if (!conversation) {
    const e = new Error('المحادثة غير موجودة');
    e.code = 'not-found';
    throw e;
  }
  const lastInbound = conversation.lastInboundAt?.toDate ? conversation.lastInboundAt.toDate().getTime() : 0;
  if (lastInbound && Date.now() - lastInbound > WINDOW_MS) {
    const e = new Error('window_closed');
    e.code = 'failed-precondition';
    throw e;
  }

  const body = String(text).slice(0, 4096);
  const res = await sendText(phone, body);
  const waMessageId = res?.messages?.[0]?.id || `out_${Date.now()}`;

  await logMessage(phone, String(waMessageId), {
    direction: 'out', type: 'text', text: body, by: 'human',
    actorUid: actor?.uid || null, actorName: actor?.fullName || actor?.email || '', status: 'sent',
  });
  await upsertConversation(phone, {
    status: 'human', botEnabled: false, handoff: true,
    lastOutboundAt: now(), lastMessage: body, lastMessageAt: now(), unread: 0,
    lastHumanReplyBy: actor?.fullName || actor?.email || actor?.uid || '',
  });
  try {
    await db().collection('adminLogs').add({
      action: 'whatsapp_reply',
      targetUserName: conversation.name || phone,
      details: `رد واتساب على ${phone}: ${body.slice(0, 120)}`,
      adminUid: actor?.uid || null,
      timestamp: now(),
    });
  } catch (e) { /* السجل اختياري */ }
  return { ok: true, waMessageId };
}

/** حالة الإعداد (تظهر في صفحة /api/whatsapp/setup) */
async function setupStatus() {
  const cfg = config();
  const out = {
    env: {
      WHATSAPP_ACCESS_TOKEN: Boolean(cfg.token),
      WHATSAPP_PHONE_NUMBER_ID: Boolean(cfg.phoneNumberId),
      WHATSAPP_BUSINESS_ACCOUNT_ID: Boolean(cfg.wabaId),
      WHATSAPP_VERIFY_TOKEN: Boolean(cfg.verifyToken),
      WHATSAPP_APP_SECRET: Boolean(cfg.appSecret),
    },
    graphVersion: cfg.graphVersion,
    botEnabled: cfg.botEnabled,
  };
  if (cfg.token && cfg.phoneNumberId) {
    try {
      const info = await graph(`${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`, 'GET');
      out.phone = info;
    } catch (e) { out.phone = { error: e.message }; }
  }
  if (cfg.token && cfg.wabaId) {
    try {
      const subs = await graph(`${cfg.wabaId}/subscribed_apps`, 'GET');
      out.subscribedApps = subs;
    } catch (e) { out.subscribedApps = { error: e.message }; }
  }
  return out;
}

/** اشتراك تطبيق ميتا في الـ WABA (الخطوة اللي الناس بتنساها) */
async function subscribeApp() {
  const { wabaId } = config();
  if (!wabaId) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID غير مضبوط');
  return graph(`${wabaId}/subscribed_apps`, 'POST', {});
}

module.exports = {
  verifySignature,
  handleWebhook,
  sendAdminReply,
  setupStatus,
  subscribeApp,
  sendText,
  sendList,
  config,
  normalizePhone,
  DEFAULT_TEXT,
  MENU_ROWS,
};
