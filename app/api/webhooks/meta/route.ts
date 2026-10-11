import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
const { searchParams } = new URL(request.url);

const mode = searchParams.get("hub.mode");
const token = searchParams.get("hub.verify_token");
const challenge = searchParams.get("hub.challenge");

const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

if (
mode === "subscribe" &&
verifyToken &&
token === verifyToken &&
challenge
) {
return new Response(challenge, {
status: 200,
headers: {
"Content-Type": "text/plain",
},
});
}

return NextResponse.json(
{ error: "Webhook verification failed" },
{ status: 403 }
);
}

export async function POST(request: NextRequest) {
try {
const body = await request.json();

console.log("Meta Webhook event received:", body);

return NextResponse.json({ received: true }, { status: 200 });

} catch {
return NextResponse.json(
{ error: "Invalid webhook payload" },
{ status: 400 }
);
}
}
