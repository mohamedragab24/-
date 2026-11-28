import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * إرسال رد أدمن من لوحة التحكم (/admin/whatsapp).
 * الحماية: توكن Firebase ID في هيدر Authorization + التأكد أن المستخدم أدمن.
 */
async function requireAdmin(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return { error: "unauthenticated" as const };
  const admin = require("firebase-admin");
  let decoded: any;
  try {
    decoded = await admin.auth().verifyIdToken(header.slice(7));
  } catch {
    return { error: "unauthenticated" as const };
  }
  const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
  const profile = snap.exists ? snap.data() || {} : {};
  const isAdmin = decoded.admin === true || profile.isAdmin === true || profile.role === "admin";
  if (!isAdmin) return { error: "permission-denied" as const };
  return { uid: decoded.uid, fullName: profile.fullName || decoded.name || decoded.email || "" };
}

export async function POST(req: NextRequest) {
  try {
    require("../../../../server/functions/index.js");
  } catch (e: any) {
    console.error("whatsapp send init failed", e);
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }

  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error === "permission-denied" ? 403 : 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const waId = String(body?.waId || "").trim();
  const text = String(body?.text || "").trim();
  const imageUrl = String(body?.imageUrl || "").trim();
  if (!waId || (!text && !imageUrl)) return NextResponse.json({ ok: false, error: "invalid-argument" }, { status: 400 });

  try {
    const wa = require("../../../../server/functions/whatsapp.js");
    const out = await wa.sendAdminReply({ waId, text, imageUrl, actor: { uid: auth.uid, fullName: auth.fullName } });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    const code = String(e?.code || "internal");
    const message =
      code === "failed-precondition"
        ? "عدّت ٢٤ ساعة من آخر رسالة للعميل، وميتا مش بتسمح برد حر بعد كده. اطلب منه يبعت رسالة تانية الأول."
        : String(e?.message || e);
    console.error("whatsapp admin reply failed", e?.message);
    return NextResponse.json({ ok: false, error: code, message }, { status: code === "failed-precondition" ? 409 : 500 });
  }
}
