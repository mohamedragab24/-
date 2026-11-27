import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook واتساب (WhatsApp Cloud API — ميتا):
 *  GET  : تحقق ميتا من الرابط (hub.challenge) بمطابقة WHATSAPP_VERIFY_TOKEN.
 *  POST : كل رسالة واردة من الطلبة/المفهمين + حالات التسليم والقراءة.
 *
 * الأمان: يتم التحقق من توقيع ميتا X-Hub-Signature-256 بـ WHATSAPP_APP_SECRET.
 * (لو محتاج تجربة سريعة قبل ضبط السر: WHATSAPP_ALLOW_UNSIGNED=1 مؤقتًا.)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ ok: false, error: "webhook verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let wa: any;
  try {
    // require متأخر: تهيئة firebase-admin تحصل داخل index.js
    require("../../../../server/functions/index.js");
    wa = require("../../../../server/functions/whatsapp.js");
  } catch (e: any) {
    console.error("whatsapp init failed", e);
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-hub-signature-256") || "";
  if (!wa.verifySignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid_json" });
  }

  try {
    const out = await wa.handleWebhook(body);
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    console.error("whatsapp webhook failed", e);
    // 200 حتى لا تعيد ميتا الإرسال بلا نهاية؛ الخطأ ظاهر في سجلات Vercel
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
}
