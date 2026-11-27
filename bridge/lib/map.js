'use strict';

/**
 * دوال تحويل صافية (بدون شبكة أو واتساب) عشان تتختبر لوحدها.
 */

/** 201012345678@s.whatsapp.net → 201012345678 */
function waIdFromJid(jid) {
  const raw = String(jid || '').split('@')[0].split(':')[0];
  return raw.replace(/[^\d]/g, '');
}

/** 201012345678 → 201012345678@s.whatsapp.net */
function jidFromWaId(waId) {
  return `${String(waId || '').replace(/[^\d]/g, '')}@s.whatsapp.net`;
}

/** نص الرسالة الواردة من أي شكل (نص عادي، رد، تعليق على ميديا، اختيار قائمة) */
function extractText(m) {
  const msg = m?.message || {};
  if (msg.conversation) return String(msg.conversation);
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text);
  if (msg.imageMessage?.caption) return String(msg.imageMessage.caption);
  if (msg.videoMessage?.caption) return String(msg.videoMessage.caption);
  if (msg.documentMessage?.caption) return String(msg.documentMessage.caption);
  if (msg.buttonsResponseMessage?.selectedDisplayText) return String(msg.buttonsResponseMessage.selectedDisplayText);
  if (msg.listResponseMessage?.title) return String(msg.listResponseMessage.title);
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return String(msg.listResponseMessage.singleSelectReply.selectedRowId);
  if (msg.templateButtonReplyMessage?.selectedDisplayText) return String(msg.templateButtonReplyMessage.selectedDisplayText);
  return '';
}

/** يجمع السطور مع سطر فاضي واحد بين الأجزاء ومن غير زيادة في الآخر */
function tidy(lines) {
  return String(lines.join('\n')).replace(/\n{3,}/g, '\n\n').trim();
}

const MEDIA_KEYS = [
  'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage',
  'stickerMessage', 'contactMessage', 'locationMessage', 'ptvMessage',
];

/** نوع الرسالة اللي بنبعته للمنصة: text أو نوع الميديا */
function mediaTypeOf(m) {
  const msg = m?.message || {};
  for (const k of MEDIA_KEYS) {
    if (msg[k]) return k.replace('Message', '') || 'document';
  }
  if (msg.protocolMessage || msg.senderKeyDistributionMessage) return 'other';
  return 'text';
}

/**
 * هل الرسالة مفيهاش حاجة نرد عليها؟
 * بيشمل إشعارات النظام (حذف رسالة، مفاتيح تشفير) — لو رحنا للمنصة كانت هترد عليها
 * برد «رسالة غير نصية» وده غلط.
 */
function isEmpty(m) {
  const msg = m?.message || {};
  if (!Object.keys(msg).length) return true;
  const type = mediaTypeOf(m);
  if (type === 'other') return true;
  if (type !== 'text') return false;
  return !extractText(m).trim();
}

/** اختيار القائمة اللي رجع من واتساب (لو العميل داس على صف في قائمة تفاعلية) */
function choiceIdOf(m) {
  const msg = m?.message || {};
  const id = msg.listResponseMessage?.singleSelectReply?.selectedRowId
    || msg.buttonsResponseMessage?.selectedButtonId
    || msg.templateButtonReplyMessage?.selectedId;
  return id ? String(id) : '';
}

/**
 * تحويل ردود المنصة إلى رسايل نصية.
 * واتساب غير الرسمي مبيعملش قوايم/أزرار تفاعلية، فبنبعتها كنص مرقّم.
 * يرجّع [{ text, rows? }] — rows موجودة لما الرد قائمة، عشان نحول رقم مكتوب لاختيار.
 */
function repliesToMessages(replies) {
  const out = [];
  for (const reply of replies || []) {
    if (reply.type === 'text') {
      out.push({ text: String(reply.body || '') });
    } else if (reply.type === 'list') {
      const lines = [reply.body || ''];
      const rows = Array.isArray(reply.rows) ? reply.rows : [];
      if (rows.length) {
        lines.push('');
        rows.forEach((r, i) => lines.push(`${i + 1}) ${r.title}`));
        lines.push('');
        lines.push(`اكتب رقم الاختيار (1-${rows.length}) أو كلامك عادي.`);
      }
      out.push({ text: tidy(lines), rows });
    } else if (reply.type === 'buttons') {
      const lines = [reply.body || ''];
      const buttons = Array.isArray(reply.buttons) ? reply.buttons : [];
      if (buttons.length) {
        lines.push('');
        buttons.forEach((b, i) => lines.push(`${i + 1}) ${b.title}`));
      }
      out.push({ text: tidy(lines) });
    }
  }
  return out.filter((m) => m.text.trim());
}

/** لو العميل كتب رقم من القائمة، نحوّله لاختيار */
function choiceFromText(text, rows) {
  const t = String(text || '').trim();
  if (!Array.isArray(rows) || !rows.length) return '';
  if (!/^[1-9]$/.test(t)) return '';
  const row = rows[Number(t) - 1];
  return row && row.id ? String(row.id) : '';
}

module.exports = {
  waIdFromJid,
  jidFromWaId,
  extractText,
  mediaTypeOf,
  isEmpty,
  choiceIdOf,
  repliesToMessages,
  choiceFromText,
};
