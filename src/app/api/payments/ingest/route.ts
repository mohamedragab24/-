import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * مدخل بديل مباشر: لو تطبيق قراءة الرسائل (sms-payment) يستطيع إرسال POST مباشرة بدل تليجرام.
 * POST /api/payments/ingest   Header: x-ingest-secret: <PAYMENT_INGEST_SECRET>
 * Body: { "text": "نص رسالة التحويل", "id": "معرّف فريد اختياري" }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PAYMENT_INGEST_SECRET;
  const given = req.headers.get("x-ingest-secret") || "";
  const ok = secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const text = String(body?.text || "");
  if (!text) return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });

  try {
    require("../../../../server/functions/index.js");
    const pv = require("../../../../server/functions/payment-verify.js");
    const id = String(body?.id || crypto.createHash("sha256").update(text).digest("hex").slice(0, 32));
    const result = await pv.ingestPaymentMessage({ text, docId: `ing_${id}`, dateMs: Date.now(), source: "ingest" });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("ingest failed", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
