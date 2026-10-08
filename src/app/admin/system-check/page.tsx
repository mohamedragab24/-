"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { callGroupFn } from "@/lib/groups";
import { reportError } from "@/lib/error-center";
import { Activity, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

/** فحص النظام: يختبر Firebase و R2 و JaaS والمتغيرات فعليًا، ويعرض لكل مشكلة السبب والمطلوب للحل. */
type Check = { id: string; label: string; status: "ok" | "warn" | "fail"; message: string; cause?: string; fix?: string; technical?: string; ms?: number };

const STYLE = {
  ok: { box: "border-emerald-200 bg-emerald-50", icon: <CheckCircle2 className="text-emerald-600 shrink-0" size={20} /> },
  warn: { box: "border-amber-300 bg-amber-50", icon: <AlertTriangle className="text-amber-600 shrink-0" size={20} /> },
  fail: { box: "border-red-300 bg-red-50", icon: <XCircle className="text-red-600 shrink-0" size={20} /> },
};

export default function SystemCheckPage() {
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [summary, setSummary] = useState<{ failed: number; warnings: number } | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r: any = await callGroupFn("systemCheck");
      setChecks(r.checks || []);
      setSummary({ failed: r.failed || 0, warnings: r.warnings || 0 });
    } catch (e) {
      if (!(e as any)?.cause && !(e as any)?.fix) reportError(e, "فحص النظام"); // الأخطاء التقنية ظهرت تلقائيًا من fn-client
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black"><Activity className="text-primary" /> فحص النظام</CardTitle>
          <p className="text-sm text-muted-foreground">يختبر فعليًا: المتغيرات، Firebase، رفع ملف تجريبي إلى R2، مفتاح JaaS، وسر Webhook. أي مشكلة تظهر مع سببها والمطلوب لحلها.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={run} disabled={busy} className="rounded-xl font-black">
            {busy ? <><Loader2 className="animate-spin ml-2" size={16} /> جارٍ الفحص...</> : "ابدأ الفحص الآن"}
          </Button>
          {summary && (
            <p className={`text-sm font-black ${summary.failed ? "text-red-700" : "text-emerald-700"}`}>
              {summary.failed ? `${summary.failed} مشكلة تحتاج حلًا` : "كل الفحوصات الأساسية سليمة"}{summary.warnings ? ` — ${summary.warnings} تنبيه` : ""}
            </p>
          )}
          <div className="space-y-3">
            {checks?.map((c) => (
              <div key={c.id} className={`rounded-2xl border p-4 ${STYLE[c.status].box}`}>
                <div className="flex items-start gap-3">
                  {STYLE[c.status].icon}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-black text-sm">{c.label}</p>
                    <p className="text-sm">{c.message}</p>
                    {c.cause && <p className="text-xs"><b>السبب: </b>{c.cause}</p>}
                    {c.fix && <p className="text-xs rounded-lg bg-white/70 border p-2"><b>المطلوب: </b>{c.fix}</p>}
                    {c.technical && <pre dir="ltr" className="text-[10px] bg-white/70 rounded p-2 whitespace-pre-wrap break-all">{c.technical}</pre>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
