import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Webhook بوت تليجرام: تليجرام يرسل لهنا كل رسالة تصل للبوت.
 * الأمان:
 *  - TELEGRAM_WEBHOOK_SECRET : يجب أن يطابق الهيدر X-Telegram-Bot-Api-Secret-Token (يُضبط عند setWebhook).
 *  - TELEGRAM_ALLOWED_CHAT_IDS : المعرّفات المسموح بها (chat.id أو from.id) مفصولة بفواصل. الافتراضي: 8848955240
 * التوكن لا يُكتب في الكود أبدًا؛ يوضع فقط في متغير البيئة TELEGRAM_BOT_TOKEN (اختياري لإرسال ردود).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET is not set" }, { status: 500 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const msg = update?.message || update?.channel_post || update?.edited_message || update?.edited_channel_post;
  const text: string = String(msg?.text || msg?.caption || "");
  if (!msg || !text) return NextResponse.json({ ok: true, ignored: true });

  const allowed = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || "8848955240").split(",").map((s) => s.trim()).filter(Boolean);
  const chatId = String(msg.chat?.id ?? "");
  const fromId = String(msg.from?.id ?? "");
  if (!allowed.includes(chatId) && !allowed.includes(fromId)) {
    return NextResponse.json({ ok: true, ignored: "chat_not_allowed" });
  }

  try {
    // require متأخر حتى لا يفشل الـ build لو متغيرات البيئة غير مضبوطة
    const pv = require("../../../../server/functions/index.js") && require("../../../../server/functions/payment-verify.js");
    const result = await pv.ingestPaymentMessage({
      text,
      docId: `tg_${chatId}_${msg.message_id}`,
      dateMs: msg.date ? Number(msg.date) * 1000 : Date.now(),
      source: "telegram",
    });
    if (result?.confirmed?.length) await pv.telegramReply(chatId, `✅ تم تأكيد الطلب تلقائيًا (${result.confirmed[0]})`);
    else if (result?.parseOk === false) await pv.telegramReply(chatId, "⚠️ لم أستطع قراءة (المبلغ/الرقم/الوقت) من هذه الرسالة.");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("telegram webhook failed", e);
    // نرجع 200 كي لا يعيد تليجرام الإرسال بلا نهاية؛ الخطأ ظاهر في سجلات Vercel
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
}
