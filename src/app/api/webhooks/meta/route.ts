import { NextRequest, NextResponse } from "next/server";
import { POST as whatsappPost } from "../../whatsapp/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const accepted = [process.env.META_WEBHOOK_VERIFY_TOKEN, process.env.WHATSAPP_VERIFY_TOKEN]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  if (mode === "subscribe" && token && accepted.includes(token) && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

// Meta may still deliver WhatsApp events to this URL: hand them to the bot handler (signature checked there).
export async function POST(request: NextRequest) {
  return whatsappPost(request);
}

// redeploy: second app secret env added
