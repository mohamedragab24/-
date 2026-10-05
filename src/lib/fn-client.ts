"use client";

import { getAuth } from "firebase/auth";

/**
 * بديل متوافق مع واجهة firebase/functions: بدل استدعاء Cloud Functions (تحتاج Blaze)
 * نستدعي مسار Vercel: /api/fn/<name> مع Firebase ID token.
 */
export function getFunctions(_app?: unknown, _region?: string): unknown {
  return {};
}

export function httpsCallable<T = any, R = any>(_functions: unknown, name: string) {
  return async (data?: T): Promise<{ data: R }> => {
    const user = getAuth().currentUser;
    const token = user ? await user.getIdToken() : null;
    let res: Response;
    try {
      res = await fetch(`/api/fn/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ data: data ?? {} }),
      });
    } catch {
      throw Object.assign(new Error("internal"), { code: "functions/internal" });
    }
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (!res.ok || json?.error) {
      const code = String(json?.error?.code || "internal");
      const message = String(json?.error?.message || "internal");
      throw Object.assign(new Error(message), { code: `functions/${code}` });
    }
    return { data: json?.data as R };
  };
}
