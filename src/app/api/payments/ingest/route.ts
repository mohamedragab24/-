import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diagnose } = require("../../../../server/diagnostics.js");

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
  if (!secret) {
    return NextResponse.json({ ok: false, error: "config/ingest-secret-missing", message: "PAYMENT_INGEST_SECRET غير مضبوط على السيرفر", cause: "المتغير غير موجود في Vercel أو لم تعمل Redeploy.", fix: "أضف PAYMENT_INGEST_SECRET في Vercel بنفس القيمة الموجودة في تطبيق البوابة (الإعدادات)، ثم Redeploy." }, { status: 500 });
  }
  const ok = given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) {
    return NextResponse.json({ ok: false, error: "auth/bad-secret", message: given ? "السر المرسل من التطبيق لا يطابق السر على السيرفر" : "التطبيق لم يرسل السر", cause: "قيمة PAYMENT_INGEST_SECRET في Vercel تختلف عن القيمة المخزنة في تطبيق البوابة.", fix: "اجعل القيمة واحدة في الاثنين: تطبيق البوابة ← الإعدادات ← سر الربط، و Vercel ← PAYMENT_INGEST_SECRET (ثم Redeploy)." }, { status: 401 });
  }

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
    const d = diagnose(e, { stage: "init" });
    return NextResponse.json({ ok: false, error: d.code, message: d.message, cause: d.cause, fix: d.fix, technical: d.technical }, { status: 500 });
  }
}
