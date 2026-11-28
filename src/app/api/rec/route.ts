import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * واجهة صفحة تسجيل البوت (public/rec/index.html). تُحمى بتوكن JWT قصير العمر خاص بجلسة واحدة:
 *   GET /api/rec?op=config&t=<jwt>            → بيانات دخول القناة (مشاهد فقط)
 *   GET /api/rec?op=events&t=<jwt>&after=<ms> → أحداث السبورة/الملف/الشات بعد وقت معيّن
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t") || "";
  const op = url.searchParams.get("op") || "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bot = require("../../../server/functions/bot-recording.js");
    const p = bot.verifyPageToken(t);
    if (op === "config") return NextResponse.json(bot.rtcConfig(p), { headers: { "Cache-Control": "no-store" } });
    if (op === "events") {
      const out = await bot.readEvents(p, Number(url.searchParams.get("after") || 0));
      return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
    }
    if (op === "diag") { await bot.pageDiag(p, url.searchParams.get("d") || ""); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "bad op" }, { status: 400 });
  } catch (e: any) {
    const expired = /jwt|signature|expired/i.test(String(e?.message || ""));
    return NextResponse.json({ error: expired ? "unauthorized" : String(e?.message || e) }, { status: expired ? 401 : 500 });
  }
}
