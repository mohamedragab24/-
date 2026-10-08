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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diagnose } = require("../../../../server/diagnostics.js");

/** يرجّع خطأ منظّمًا: code + message + cause (السبب) + fix (المطلوب) + technical (للنسخ) */
function fail(code: string, message: string, extra: { cause?: string; fix?: string; technical?: string; link?: string; fn?: string } = {}, status?: number) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status: status ?? (STATUS[code] || 500) });
}

function failFrom(e: any, ctx: { stage?: string; fn?: string }) {
  const d = diagnose(e, ctx);
  const known = STATUS[d.code] !== undefined;
  return fail(d.code, d.message, { cause: d.cause, fix: d.fix, technical: d.technical, link: d.link, fn: ctx.fn }, known ? STATUS[d.code] : 500);
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
    return failFrom(e, { stage: "init", fn: name });
  }

  const entry = fns[name];
  if (!entry || !entry.__callable) {
    return fail("not-found", `الدالة غير موجودة على السيرفر: ${name}`, {
      cause: "التطبيق يستدعي دالة لم تُنشر في نسخة المنصة الحالية على Vercel.",
      fix: "ارفع آخر نسخة من fahmni-platform إلى Vercel (git push) وانتظر انتهاء النشر، ثم أعد المحاولة. وتأكد أن اسم الدالة مكتوب بنفس الشكل في التطبيق.",
      fn: name,
    });
  }

  let auth: any = undefined;
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    try {
      const decoded = await admin.auth().verifyIdToken(header.slice(7));
      auth = { uid: decoded.uid, token: decoded };
    } catch (e: any) {
      const d = diagnose(e, { stage: "user", fn: name });
      // أخطاء الاتصال بـ Google أثناء التحقق ليست خطأ المستخدم
      if (d.code.startsWith("config/") || d.code.startsWith("firebase/")) return failFrom(e, { fn: name });
      return fail("unauthenticated", "انتهت الجلسة، سجّل الدخول من جديد", {
        cause: "توكن الدخول منتهي أو غير صالح لهذا المشروع.",
        fix: "سجّل الخروج ثم سجّل الدخول من جديد. لو تكرر تأكد أن التطبيق والمنصة على نفس مشروع Firebase.",
        technical: d.technical, fn: name,
      });
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
    console.error(`fn ${name} failed`, e);
    return failFrom(e, { fn: name });
  }
}
