"use client";

import { useEffect } from "react";
import { explain } from "@/lib/error-center";

/** حدود الخطأ لكل صفحة: بدل شاشة بيضاء يظهر السبب والمطلوب للحل. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const e = explain(error, "تحميل الصفحة");
  useEffect(() => { console.error("[route error]", error); }, [error]);
  return (
    <div dir="rtl" className="mx-auto max-w-lg p-6 mt-10 rounded-2xl border border-red-200 bg-white shadow text-right">
      <h2 className="text-lg font-black text-red-700">⚠️ {e.title}</h2>
      {e.cause && <p className="mt-3 text-sm"><b>السبب: </b>{e.cause}</p>}
      {e.fix && <p className="mt-2 text-sm rounded-lg bg-emerald-50 border border-emerald-200 p-2"><b>المطلوب: </b>{e.fix}</p>}
      <pre dir="ltr" className="mt-3 text-[10px] bg-slate-100 rounded-lg p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto">{e.technical}{error?.digest ? `\ndigest: ${error.digest}` : ""}</pre>
      <div className="mt-4 flex gap-2">
        <button onClick={() => reset()} className="px-4 py-2 rounded-lg bg-primary text-white font-bold text-sm">إعادة المحاولة</button>
        <button onClick={() => navigator.clipboard?.writeText(`${e.title}\n${e.cause || ""}\n${e.technical || ""}`)} className="px-4 py-2 rounded-lg border font-bold text-sm">نسخ التفاصيل</button>
      </div>
    </div>
  );
}
