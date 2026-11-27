import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فحص إعداد واتساب بعد النشر:
 *   https://<الدومين>/api/whatsapp/setup?key=<WHATSAPP_VERIFY_TOKEN>
 * يرجّع: المتغيرات المضبوطة، رقم الواتساب المسجّل، والتطبيقات المشتركة في الـ WABA.
 * أضف &subscribe=1 لتفعيل اشتراك التطبيق في الـ WABA (الخطوة اللي بتتنسي).
 */
function keyOk(req: NextRequest) {
  const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
  const got = String(req.nextUrl.searchParams.get("key") || "").trim();
  if (!expected || !got || expected.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

export async function GET(req: NextRequest) {
  if (!keyOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const result: any = { webhookUrl: `${req.nextUrl.origin}/api/whatsapp/webhook` };

  try {
    require("../../../../server/functions/index.js");
    const wa = require("../../../../server/functions/whatsapp.js");
    Object.assign(result, await wa.setupStatus());
    if (req.nextUrl.searchParams.get("subscribe") === "1") {
      try {
        result.subscribe = await wa.subscribeApp();
      } catch (e: any) {
        result.subscribe = { ok: false, error: String(e?.message || e) };
      }
    }
  } catch (e: any) {
    result.ok = false;
    result.error = String(e?.message || e).slice(0, 300);
  }

  return NextResponse.json(result);
}
