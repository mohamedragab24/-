import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * جسر الواتساب غير الرسمي (whatsapp-web.js):
 * خدمة الربط على السيرفر الخاص بتبعت هنا كل رسالة واردة، والرد بيرجع لها في نفس الطلب
 * عشان هي اللي تبعته من جلستها. الحماية: هيدر x-bridge-secret = BRIDGE_SECRET.
 *
 * ملاحظة: الإرسال الفعلي مش من هنا — هنا بس منطق البوت (نفس منطق Cloud API).
 */
function secretOk(req: NextRequest) {
  const expected = String(process.env.BRIDGE_SECRET || "").trim();
  const got = String(req.headers.get("x-bridge-secret") || "").trim();
  if (!expected || !got || expected.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let wa: any;
  try {
    require("../../../../server/functions/index.js");
    wa = require("../../../../server/functions/whatsapp.js");
  } catch (e: any) {
    console.error("bridge init failed", e);
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json", replies: [] }, { status: 400 });
  }

  const from = String(body?.from || "").replace(/[^\d]/g, "");
  if (!from) return NextResponse.json({ ok: false, error: "missing from", replies: [] }, { status: 400 });

  try {
    const out = await wa.handleBridgeMessage({
      from,
      name: String(body?.name || ""),
      text: String(body?.text || ""),
      messageId: String(body?.messageId || ""),
      type: String(body?.type || "text"),
      choiceId: body?.choiceId ? String(body.choiceId) : "",
    });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("bridge handling failed", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200), replies: [] });
  }
}
