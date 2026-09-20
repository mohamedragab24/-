const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function safeRequestId(value) {
  return String(value || "unknown-room").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "unknown-room";
}

function parseRange(value) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(String(value || ""));
  if (!match) return undefined;
  const offset = Number(match[1]);
  if (!Number.isFinite(offset) || offset < 0) return undefined;
  const end = match[2] ? Number(match[2]) : undefined;
  if (end !== undefined && (!Number.isFinite(end) || end < offset)) return undefined;
  return end === undefined ? { offset } : { offset, length: end - offset + 1 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "") {
      return json({
        success: true,
        message: "Fahmny R2 Worker is connected",
        bucket: "fahmny-videos",
      });
    }

    // JaaS recording webhook.
    // JaaS sends a pre-authenticated recording URL; the Worker streams it
    // directly into R2 without exposing R2 credentials to the client.
    if (url.pathname === "/__jaas/recording" && request.method === "POST") {
      try {
        const event = await request.json();
        const type = String(event.event || event.type || "").toUpperCase();
        if (type !== "RECORDING_UPLOADED" && type !== "RECORDING_ENDED") {
          return json({ ok: true, ignored: true });
        }

        const data = event.data || event;
        const recordingUrl = data.preAuthenticatedLink || data.preAuthenticatedUrl || data.recordingUrl || data.url;
        if (!recordingUrl) return json({ ok: false, error: "missing recording url" }, 400);

        const room = String(data.roomName || data.room || data.conferenceId || "unknown-room");
        const requestId = safeRequestId(data.requestId || data.meetingId || room.replace(/^.*Fahimni_/, ""));
        const response = await fetch(recordingUrl);
        if (!response.ok || !response.body) {
          return json({ ok: false, error: `recording download failed: ${response.status}` }, 502);
        }

        const r2Key = `meetings/${requestId}/${Date.now()}.mp4`;
        await env.R2_BUCKET.put(r2Key, response.body, {
          httpMetadata: { contentType: "video/mp4" },
        });

        return json({ ok: true, r2Key });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    const key = url.pathname.replace(/^\/+/, "");
    if (!key) return json({ success: false, error: "missing key" }, 400);

    // Upload course cover/video or any other authorized R2 object.
    if (request.method === "PUT") {
      await env.R2_BUCKET.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream",
        },
      });
      return json({ success: true, key });
    }

    // Read course media / recordings. Supports HTTP Range requests so browsers
    // can stream/seek large MP4 files instead of downloading the whole object.
    if (request.method === "GET") {
      const range = request.headers.get("Range");
      const object = await env.R2_BUCKET.get(key, range ? { range: parseRange(range) } : undefined);
      if (!object) return new Response("File not found", { status: 404, headers: corsHeaders });

      const headers = new Headers(corsHeaders);
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=3600");
      if (object.range) {
        const size = object.size;
        const startByte = object.range.offset || 0;
        const endByte = typeof object.range.length === "number" ? startByte + object.range.length - 1 : size - 1;
        headers.set("Content-Range", `bytes ${startByte}-${endByte}/${size}`);
        headers.set("Content-Length", String(endByte - startByte + 1));
        return new Response(object.body, { status: 206, headers });
      }
      headers.set("Content-Length", String(object.size));
      return new Response(object.body, { headers });
    }

    // Delete remains available for existing admin tooling. Protect it with a
    // Worker secret before using it in production: set DELETE_SECRET and send
    // X-R2-Delete-Secret from a trusted server only.
    if (request.method === "DELETE") {
      if (env.DELETE_SECRET && request.headers.get("X-R2-Delete-Secret") !== env.DELETE_SECRET) {
        return json({ success: false, error: "forbidden" }, 403);
      }
      await env.R2_BUCKET.delete(key);
      return json({ success: true, deleted: key });
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  },
};
