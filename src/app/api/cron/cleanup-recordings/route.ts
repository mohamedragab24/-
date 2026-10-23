import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron يومي (vercel.json): يحذف تسجيلات جلسات الاستفهام المنتهية مدتها.
 * Vercel يرسل Authorization: Bearer <CRON_SECRET> تلقائيًا لو ضبطت متغير CRON_SECRET في المشروع.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fns = require("../../../../server/functions/index.js");
    const result = await fns._cleanupExpiredRecordings();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("cleanup failed", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
