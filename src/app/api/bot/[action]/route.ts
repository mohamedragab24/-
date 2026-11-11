import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * واجهة بوت التسجيل (recorder-bot) للمنصة: upload-url | complete | fail
 * محمية بسر مشترك في الهيدر x-bot-secret (= RECORDER_BOT_SECRET في Vercel).
 */
function secretOk(req: NextRequest): boolean {
  const expected = String(process.env.RECORDER_BOT_SECRET || "").trim();
  const got = String(req.headers.get("x-bot-secret") || "").trim();
  if (!expected || expected.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  if (!secretOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await ctx.params;
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rec = require("../../../../server/functions/device-recording.js");
    let out: any;
    if (action === "upload-url") out = await rec.botUploadUrl(body);
    else if (action === "complete") out = await rec.botComplete(body);
    else if (action === "fail") out = await rec.botFail(body);
    else return NextResponse.json({ error: "unknown action" }, { status: 404 });
    return NextResponse.json(out ?? { ok: true });
  } catch (e: any) {
    console.error("bot api failed", action, e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: e?.httpErrorCode?.status || 500 });
  }
}
