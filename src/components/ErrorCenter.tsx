"use client";

import { useEffect, useState } from "react";
import { AppError, onAppError, reportError } from "@/lib/error-center";
import { errorEmitter } from "@/firebase/error-emitter";

/**
 * يعرض أي خطأ فورًا: ماذا حدث / السبب / المطلوب للحل + زر نسخ التفاصيل التقنية.
 * يلتقط تلقائيًا: أخطاء JavaScript، الـ Promise المرفوضة، وأخطاء استدعاء الدوال (fn-client).
 * وضع التشخيص الكامل (يعرض حتى أخطاء الصلاحيات الصامتة): افتح أي صفحة بـ ?debug=1 (و ?debug=0 للإيقاف).
 */
const IGNORED = [/ResizeObserver loop/i, /ChunkLoadError|Loading chunk/i, /AbortError/i, /Script error\.?$/i, /Non-Error promise rejection/i];

export function ErrorCenter() {
  const [items, setItems] = useState<AppError[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("debug");
      if (q === "1") localStorage.setItem("fahmni_debug", "1");
      if (q === "0") localStorage.removeItem("fahmni_debug");
    } catch {}
    const debug = () => { try { return localStorage.getItem("fahmni_debug") === "1"; } catch { return false; } };

    const off = onAppError((e) => setItems((cur) => [e, ...cur].slice(0, 4)));

    const onWinError = (ev: ErrorEvent) => {
      const msg = String(ev.message || ev.error?.message || "");
      if (IGNORED.some((r) => r.test(msg))) return;
      reportError(ev.error || new Error(msg), "خطأ في الصفحة" + (ev.filename ? ` (${ev.filename.split("/").pop()}:${ev.lineno})` : ""));
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r: any = ev.reason;
      const msg = String(r?.message || r || "");
      if (IGNORED.some((x) => x.test(msg) || x.test(String(r?.name || "")))) return;
      if (r?.cause || r?.fix) return; // أخطاء fn-client ظهرت بالفعل
      reportError(r, "عملية لم تكتمل");
    };
    const onPerm = (err: any) => {
      if (!debug()) return; // أخطاء قراءة اختيارية: تُسجَّل في console فقط ما لم يُفعَّل ?debug=1
      reportError({ code: "permission-denied", message: String(err?.message || "permission-denied"), technical: String(err?.message || "") }, "صلاحيات Firestore");
    };

    window.addEventListener("error", onWinError);
    window.addEventListener("unhandledrejection", onRejection);
    errorEmitter.on("permission-error", onPerm);
    return () => {
      off();
      window.removeEventListener("error", onWinError);
      window.removeEventListener("unhandledrejection", onRejection);
      errorEmitter.off("permission-error", onPerm);
    };
  }, []);

  if (!items.length) return null;
  const dismiss = (id: string) => setItems((cur) => cur.filter((x) => x.id !== id));
  const copy = async (e: AppError) => {
    const text = [`الخطأ: ${e.title}`, e.where ? `المكان: ${e.where}` : "", e.cause ? `السبب: ${e.cause}` : "", e.fix ? `الحل: ${e.fix}` : "", e.technical ? `التفاصيل: ${e.technical}` : "", `الصفحة: ${location.href}`, `الوقت: ${new Date(e.at).toISOString()}`].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div dir="rtl" className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col gap-2 p-3 pointer-events-none sm:max-w-md sm:left-auto sm:right-3">
      {items.map((e) => (
        <div key={e.id} className="pointer-events-auto rounded-2xl border border-red-300 bg-white shadow-2xl overflow-hidden text-right">
          <div className="flex items-start gap-2 bg-red-50 px-4 py-3">
            <span className="text-lg" aria-hidden>⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-red-700 break-words">{e.title}</p>
              {e.where && <p className="text-[11px] text-red-500 mt-0.5">المكان: {e.where}</p>}
            </div>
            <button onClick={() => dismiss(e.id)} className="text-red-400 hover:text-red-600 text-lg leading-none px-1" aria-label="إغلاق">×</button>
          </div>
          <div className="px-4 py-3 space-y-2 text-xs text-slate-700">
            {e.cause && <p><b className="text-slate-900">السبب: </b>{e.cause}</p>}
            {e.fix && <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-2"><b className="text-emerald-800">المطلوب: </b>{e.fix}</p>}
            {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="block text-blue-600 underline break-all">فتح الرابط المطلوب للحل</a>}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => copy(e)} className="font-bold text-primary text-xs">نسخ التفاصيل</button>
              {e.technical && <button onClick={() => setOpen(open === e.id ? null : e.id)} className="text-slate-500 text-xs">{open === e.id ? "إخفاء التقني" : "تفاصيل تقنية"}</button>}
            </div>
            {open === e.id && e.technical && <pre dir="ltr" className="text-[10px] bg-slate-100 rounded-lg p-2 whitespace-pre-wrap break-all max-h-32 overflow-auto">{e.technical}</pre>}
          </div>
        </div>
      ))}
    </div>
  );
}
