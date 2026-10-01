"use client";

import { useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";

function fmt(v: any) {
  try { const d = v?.toDate ? v.toDate() : new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-EG"); } catch { return "—"; }
}

export default function AdminPayments() {
  const { firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const pendingPaymentsQ = useMemoFirebase(() => firestore ? query(collection(firestore, "payments"), where("status", "==", "pending"), limit(100)) : null, [firestore]);
  const { data: pendingPayments } = useCollection<any>(pendingPaymentsQ);
  const recentPaymentsQ = useMemoFirebase(() => firestore ? query(collection(firestore, "payments"), where("status", "==", "completed"), limit(30)) : null, [firestore]);
  const { data: recentPayments } = useCollection<any>(recentPaymentsQ);
  const topupQ = useMemoFirebase(() => firestore ? query(collection(firestore, "topupRequests"), where("status", "==", "pending"), limit(100)) : null, [firestore]);
  const { data: topups } = useCollection<any>(topupQ);

  const call = async (key: string, fn: string, data: any, okMsg: string) => {
    if (!firebaseApp) return;
    setBusy(key);
    try {
      await httpsCallable(getFunctions(firebaseApp, "us-central1"), fn)(data);
      toast({ title: okMsg });
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر تنفيذ العملية", description: e?.message || "حاول مرة أخرى." });
    } finally { setBusy(null); }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto" dir="rtl">
      <div className="border-r-8 border-primary pr-6"><h1 className="text-4xl font-black">المدفوعات وطلبات الشحن</h1><p className="text-muted-foreground font-bold">أكّد استلام المبلغ ليُفتح الكورس أو يُضاف الرصيد تلقائيًا.</p></div>

      <Card className="rounded-[2rem]"><CardHeader><CardTitle>طلبات شراء كورسات (دفع برقم الهاتف) — بانتظار التأكيد</CardTitle></CardHeader><CardContent className="space-y-3">
        {(pendingPayments || []).length === 0 && <p className="text-sm text-zinc-500 font-bold">لا توجد طلبات معلّقة.</p>}
        {(pendingPayments || []).map((p: any) => (
          <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border p-4">
            <div className="space-y-1 text-sm font-bold">
              <div className="font-black">{p.courseName || p.courseId} — {Number(p.amount || 0).toFixed(2)} ج.م</div>
              <div className="text-zinc-500">رقم الطلب: <span className="font-mono">{p.orderNumber}</span> • {p.userName || "—"} • {p.email || "—"} • {p.phone || "—"}</div>
              <div className="text-zinc-400 text-xs">{fmt(p.createdAt)}</div>
            </div>
            <div className="flex gap-2">
              <Button disabled={busy === p.id} onClick={() => call(p.id, "reviewExternalPayment", { paymentId: p.id, approve: true }, "تم تأكيد الدفع وفتح الكورس")} className="bg-emerald-600 hover:bg-emerald-700 gap-1">{busy === p.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} تأكيد</Button>
              <Button disabled={busy === p.id} variant="outline" onClick={() => call(p.id, "reviewExternalPayment", { paymentId: p.id, approve: false }, "تم رفض الطلب")} className="text-red-600 gap-1"><X className="h-4 w-4" /> رفض</Button>
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card className="rounded-[2rem]"><CardHeader><CardTitle>طلبات شحن المحفظة</CardTitle></CardHeader><CardContent className="space-y-3">
        {(topups || []).length === 0 && <p className="text-sm text-zinc-500 font-bold">لا توجد طلبات شحن معلّقة.</p>}
        {(topups || []).map((t: any) => (
          <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border p-4">
            <div className="space-y-1 text-sm font-bold">
              <div className="font-black">{Number(t.amount || 0).toFixed(2)} ج.م — {t.userName || t.email || t.uid}</div>
              <div className="text-zinc-500">المرجع: {t.reference || "—"} • {t.email || "—"}</div>
              <div className="text-zinc-400 text-xs">{fmt(t.createdAt)}</div>
            </div>
            <div className="flex gap-2">
              <Button disabled={busy === t.id} onClick={() => call(t.id, "reviewTopupRequest", { requestId: t.id, approve: true }, "تم شحن المحفظة")} className="bg-emerald-600 hover:bg-emerald-700 gap-1"><Check className="h-4 w-4" /> تأكيد الشحن</Button>
              <Button disabled={busy === t.id} variant="outline" onClick={() => call(t.id, "reviewTopupRequest", { requestId: t.id, approve: false }, "تم رفض الطلب")} className="text-red-600 gap-1"><X className="h-4 w-4" /> رفض</Button>
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card className="rounded-[2rem]"><CardHeader><CardTitle>آخر العمليات المكتملة</CardTitle></CardHeader><CardContent className="space-y-2">
        {(recentPayments || []).map((p: any) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border p-3 text-sm font-bold">
            <span>{p.courseName || p.courseId} • <span className="font-mono">{p.orderNumber}</span></span>
            <span className="flex items-center gap-2"><Badge variant="outline">{p.paymentMethod === "wallet" ? "محفظة" : "هاتف"}</Badge>{Number(p.amount || 0).toFixed(2)} ج.م</span>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
