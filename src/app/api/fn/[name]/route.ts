import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS: Record<string, number> = {
  "invalid-argument": 400,
  "failed-precondition": 400,
  "out-of-range": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  aborted: 409,
  "resource-exhausted": 429,
  unimplemented: 501,
  unavailable: 503,
  "deadline-exceeded": 504,
};

function fail(code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] || 500 });
}

/**
 * يشغّل دوال الـ onCall نفسها (من src/server/functions) على Vercel بدل Firebase Functions.
 * العميل يرسل: POST /api/fn/<name>  { data: {...} }  مع Authorization: Bearer <Firebase ID token>
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  let fns: any;
  let admin: any;
  try {
    // require متأخر حتى لا يفشل الـ build لو متغيرات البيئة غير مضبوطة
    fns = require("../../../../server/functions/index.js");
    admin = require("firebase-admin");
  } catch (e: any) {
    console.error("functions init failed", e);
    return fail("internal", "إعداد الخادم ناقص: تأكد من متغير FIREBASE_SERVICE_ACCOUNT في Vercel");
  }

  const entry = fns[name];
  if (!entry || !entry.__callable) return fail("not-found", "الدالة غير موجودة");

  let auth: any = undefined;
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    try {
      const decoded = await admin.auth().verifyIdToken(header.slice(7));
      auth = { uid: decoded.uid, token: decoded };
    } catch {
      return fail("unauthenticated", "انتهت الجلسة، سجّل الدخول من جديد");
    }
  }

  let data: any = {};
  try {
    const body = await req.json();
    data = body?.data ?? {};
  } catch {
    data = {};
  }

  try {
    const result = await entry.handler({ auth, data, rawRequest: req });
    return NextResponse.json({ data: result ?? null });
  } catch (e: any) {
    if (e && typeof e.code === "string" && STATUS[e.code] !== undefined) {
      return fail(e.code, String(e.message || ""));
    }
    console.error(`fn ${name} failed`, e);
    return fail("internal", String(e?.message || "internal").slice(0, 300));
  }
}
