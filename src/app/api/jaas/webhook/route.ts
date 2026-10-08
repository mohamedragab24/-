import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Webhook تسجيلات JaaS: POST /api/jaas/webhook?secret=<JAAS_WEBHOOK_SECRET>
 * (أضف نفس الرابط في JaaS Console ← Webhooks، وفعّل RECORDING_STARTED / RECORDING_ENDED / RECORDING_UPLOADED).
 * السر يُقبل من: ?secret=  أو  Authorization: Bearer <secret>  أو  x-jaas-webhook-secret
 * عند RECORDING_UPLOADED يُنزَّل الـ MP4 ويُرفع إلى Cloudflare R2 ثم تُحفظ بياناته (lectureRecordings + المجموعة).
 */
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  const secret = process.env.JAAS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "JAAS_WEBHOOK_SECRET is not set" }, { status: 500 });
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const given = req.nextUrl.searchParams.get("secret") || req.headers.get("x-jaas-webhook-secret") || bearer;
  if (!given || !safeEqual(given, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true, ignored: "empty" });

  try {
    // require متأخر حتى لا يفشل الـ build لو متغيرات البيئة غير مضبوطة
    require("../../../../server/functions/index.js");
    const { handleJaasEvent } = require("../../../../server/functions/jaas-recordings.js");
    const result = await handleJaasEvent(body);
    // نرجع 200 دائمًا كي لا يعيد JaaS الإرسال بلا نهاية؛ الأخطاء ظاهرة في الـ logs وفي حقل status=failed
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("jaas webhook failed", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
}
