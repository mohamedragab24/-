import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * يُستدعى مرة واحدة بعد أي تغيير للدومين:
 *   https://<الدومين-الجديد>/api/telegram/setup?key=<TELEGRAM_WEBHOOK_SECRET>
 * يفعل شيئين:
 *  1) يربط بوت تليجرام بالدومين الحالي (setWebhook) — بدون كتابة التوكن في المتصفح.
 *  2) يحفظ الدومين في Firestore (settings/app.apiBaseUrl) فيتحول إليه التطبيق تلقائيًا بدون إعادة بناء.
 * الشراء المؤكَّد نفسه محفوظ في Firebase فلا يتأثر بالدومين أصلًا.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const key = req.nextUrl.searchParams.get("key") || "";
  const ok = secret && key.length === secret.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(secret));
  if (!ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const origin = req.nextUrl.origin;
  const result: any = { origin };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) result.telegram = { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  else {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `${origin}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message", "channel_post", "edited_message"] }),
      });
      const j = await r.json();
      result.telegram = { ok: j.ok, description: j.description };
    } catch (e: any) { result.telegram = { ok: false, error: String(e?.message || e) }; }
  }

  try {
    require("../../../../server/functions/index.js");
    const admin = require("firebase-admin");
    await admin.firestore().collection("settings").doc("app").set({ apiBaseUrl: origin, apiBaseUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    result.appBaseUrl = { ok: true };
  } catch (e: any) { result.appBaseUrl = { ok: false, error: String(e?.message || e).slice(0, 200) }; }

  return NextResponse.json(result);
}
