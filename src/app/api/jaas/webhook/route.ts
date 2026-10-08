import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diagnose } = require("../../../../server/diagnostics.js");

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
  if (!secret) {
    console.error("[jaas webhook] JAAS_WEBHOOK_SECRET is not set");
    return NextResponse.json({ ok: false, error: "config/webhook-secret-missing", message: "JAAS_WEBHOOK_SECRET غير مضبوط", cause: "المتغير غير موجود في Vercel أو لم تعمل Redeploy.", fix: "أضف JAAS_WEBHOOK_SECRET (نص عشوائي طويل: openssl rand -hex 32) ثم Redeploy، وضع نفس القيمة في رابط الـ Webhook داخل JaaS Console." }, { status: 500 });
  }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const given = req.nextUrl.searchParams.get("secret") || req.headers.get("x-jaas-webhook-secret") || bearer;
  if (!given || !safeEqual(given, secret)) {
    console.error("[jaas webhook] rejected: secret " + (given ? "does not match" : "missing in request"));
    return NextResponse.json({ ok: false, error: "auth/bad-secret", message: given ? "السر في رابط الـ Webhook لا يطابق JAAS_WEBHOOK_SECRET" : "رابط الـ Webhook بدون سر", cause: "الرابط المسجّل في JaaS Console فيه secret مختلف عن المتغير في Vercel.", fix: "في JaaS Console ← Webhooks عدّل الرابط ليكون ...?secret=<نفس قيمة JAAS_WEBHOOK_SECRET> بالضبط." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true, ignored: "empty" });
  console.log("[jaas webhook] event:", body?.eventType, "fqn:", body?.fqn, "dataKeys:", Object.keys(body?.data || {}).join(","));

  try {
    // require متأخر حتى لا يفشل الـ build لو متغيرات البيئة غير مضبوطة
    require("../../../../server/functions/index.js");
    const { handleJaasEvent } = require("../../../../server/functions/jaas-recordings.js");
    const result = await handleJaasEvent(body);
    // نرجع 200 دائمًا كي لا يعيد JaaS الإرسال بلا نهاية؛ الأخطاء ظاهرة في الـ logs وفي حقل status=failed
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("jaas webhook failed", e);
    const d = diagnose(e, { stage: "init" });
    return NextResponse.json({ ok: false, error: d.code, message: d.message, cause: d.cause, fix: d.fix, technical: d.technical });
  }
}
