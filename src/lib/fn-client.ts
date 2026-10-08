"use client";

import { getAuth } from "firebase/auth";
import { reportError } from "@/lib/error-center";

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
    } catch (netErr: any) {
      const err = Object.assign(new Error("تعذّر الاتصال بالسيرفر"), {
        code: "functions/unavailable",
        cause: "لا يوجد إنترنت، أو موقع Vercel متوقف، أو الطلب اتحجب (CORS/VPN).",
        fix: "تأكد من الإنترنت وافتح رابط الموقع للتأكد أنه يعمل ثم أعد المحاولة.",
        technical: `fetch /api/fn/${name} failed: ${String(netErr?.message || netErr)}`,
        fnName: name,
      });
      reportError(err, name);
      throw err;
    }
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (!res.ok || json?.error) {
      const e = json?.error || {};
      const code = String(e.code || "internal");
      let message = String(e.message || "internal");
      let cause: string | undefined = e.cause, fix: string | undefined = e.fix;
      if (!json) {
        // السيرفر رد بصفحة غير JSON: غالبًا Vercel timeout أو crash
        message = res.status === 504 || res.status === 408 ? "انتهت مهلة السيرفر" : `السيرفر رد بخطأ ${res.status}`;
        cause = res.status === 504 ? "العملية أخذت أكثر من حد الوقت في Vercel (60 ثانية في الخطة المجانية)." : "الدالة انهارت قبل أن ترد، أو الموقع غير منشور.";
        fix = "افتح Vercel ← Logs لمسار /api/fn/" + name + " لرؤية السبب الدقيق، وتأكد أن آخر نشر نجح (Deployments).";
      }
      const err = Object.assign(new Error(message), {
        code: `functions/${code}`, cause, fix, technical: e.technical || `HTTP ${res.status} /api/fn/${name}`, link: e.link, fnName: name,
      });
      // الأخطاء التقنية (لها سبب/حل) تظهر فورًا؛ أخطاء المنطق العادية (مثل «الرصيد غير كافٍ») يعرضها المستدعي بنفسه
      if (cause || fix) reportError(err, name);
      throw err;
    }
    return { data: json?.data as R };
  };
}
