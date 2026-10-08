"use client";
import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { callGroupFn, fnErrorMessage } from "@/lib/groups";
import { FileCheck, Loader2, Search } from "lucide-react";

/** مراجعة عمليات الدفع: كل رسالة وصلت من تطبيق بوابة الدفع + حالتها + ربطها بطلب شراء/شحن. */
const STATUS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "بانتظار الطلب", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "مقبولة", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "مرفوضة", cls: "bg-red-100 text-red-800" },
  duplicate: { label: "مكررة", cls: "bg-violet-100 text-violet-800" },
};
const REASONS: Record<string, string> = { provider_not_allowed: "مزود غير مضاف", provider_mismatch: "اسم مزود الخدمة غير متطابق", duplicate_transaction: "رقم العملية مستخدم من قبل", admin_rejected: "رفض الأدمن" };
const fmt = (ts: any) => { try { const d = ts?.toDate ? ts.toDate() : typeof ts === "number" ? new Date(ts) : ts ? new Date(ts) : null; return d ? d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short", hour12: false, timeZone: "Africa/Cairo" }) : "—"; } catch { return "—"; } };
const STATUS_COLORS: Record<string, string> = { done: "bg-emerald-50 border-emerald-300 text-emerald-800", pending: "bg-amber-50 border-amber-300 text-amber-800", not_done: "bg-red-50 border-red-300 text-red-800", not_found: "bg-zinc-50 border-zinc-300 text-zinc-700" };

export default function AdminPaymentReviewPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const txQ = useMemoFirebase(() => (firestore ? query(collection(firestore, "telegramTransactions"), orderBy("receivedAt", "desc"), limit(300)) : null), [firestore]);
  const { data: txs, isLoading } = useCollection<any>(txQ);
  const mQ = useMemoFirebase(() => (firestore ? collection(firestore, "paymentMethods") : null), [firestore]);
  const { data: gateways } = useCollection<any>(mQ);
  const providers = useMemo(() => { const m = new Map<string, string>(); (gateways || []).forEach((g: any) => { if (g.providerKey) m.set(g.providerKey, g.providerName || g.name); }); return Array.from(m, ([id, name]) => ({ id, name })); }, [gateways]);
  const [provFilter, setProvFilter] = useState("");

  const rows = useMemo(() => (txs || []).filter((t: any) => {
    const st = t.reviewStatus || "pending_review";
    if (filter !== "all" && st !== filter) return false;
    if (provFilter && t.providerKey !== provFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.txId, t.userName, t.courseName, t.phone, t.orderNumber, t.providerName, t.rawText].some((v) => String(v || "").toLowerCase().includes(q));
  }), [txs, filter, search, provFilter]);

  // ---------- استعلام عن حالة عملية ----------
  const [qTx, setQTx] = useState(""); const [qOrder, setQOrder] = useState(""); const [qProv, setQProv] = useState("");
  const [result, setResult] = useState<any>(null);
  const check = async (p?: { txId?: string; orderNumber?: string; providerKey?: string }) => {
    const payload = p || { txId: qTx.trim(), orderNumber: qOrder.trim(), providerKey: qProv };
    if (!payload.txId && !payload.orderNumber) { toast({ variant: "destructive", title: "اكتب رقم العملية أو رقم الطلب" }); return; }
    setBusy("check"); setResult(null);
    try { setResult(await callGroupFn("adminCheckTransactionStatus", payload)); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر الاستعلام", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 border-r-8 border-primary pr-4"><FileCheck className="text-primary" /><div><h1 className="text-3xl font-black">مراجعة عمليات الدفع</h1><p className="text-sm text-zinc-500 font-bold">العمليات تُقبل تلقائيًا ولا تحتاج مراجعة يدوية. هذه الصفحة للمتابعة عند حدوث مشكلة: اعرف هل العملية مقبولة أم مرفوضة وابحث برقم العملية أو مزود الخدمة أو رقم المحوِّل.</p></div></div>

      <Tabs defaultValue="txs">
        <TabsList className="rounded-2xl h-auto flex-wrap">
          <TabsTrigger value="txs" className="font-black">العمليات</TabsTrigger>
          <TabsTrigger value="check" className="font-black">التحقق من حالة عملية</TabsTrigger>
        </TabsList>

        <TabsContent value="txs" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            {[["all", "الكل"], ["pending_review", "بانتظار الطلب"], ["accepted", "مقبولة"], ["rejected", "مرفوضة"], ["duplicate", "مكررة"]].map(([k, l]) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="rounded-xl font-black" onClick={() => setFilter(k)}>{l}</Button>
            ))}
            <div className="relative flex-1 min-w-[220px]"><Search className="absolute right-3 top-3 h-4 w-4 text-zinc-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث: رقم العملية، مزود الخدمة (فودافون كاش)، رقم المحوِّل…" className="pr-9 h-10 rounded-xl" /></div>
            <select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} className="h-10 rounded-xl border px-3 bg-white text-sm font-bold"><option value="">كل المزودين</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          {isLoading ? <Loader2 className="animate-spin" /> : rows.length === 0 ? <p className="text-zinc-500 font-bold">لا توجد عمليات.</p> : rows.map((t: any) => {
            const st = STATUS[t.reviewStatus || "pending_review"] || STATUS.pending_review;
            return (
              <Card key={t.id} className="rounded-2xl"><CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge className={`${st.cls} font-black`}>{st.label}{t.rejectReason ? ` — ${REASONS[t.rejectReason] || t.rejectReason}` : ""}</Badge>
                  <span className="text-xs text-zinc-500 font-bold">وصلت: {fmt(t.receivedAt)}</span>
                </div>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                  {([["رقم العملية", t.txId || "غير متوفر"], ["المستخدم", t.userName || (t.uid ? t.uid : "—")], ["الكورس/النوع", t.kind === "wallet_topup" ? "شحن المحفظة" : (t.courseName || "—")], ["المبلغ", t.amount != null ? `${t.amount} ج.م` : "—"], ["مزود الخدمة", t.providerName || "—"], ["طريقة الدفع", t.methodName || "—"], ["رقم الحساب/المحفظة", t.phone || "—"], ["تاريخ العملية", fmt(t.timeMs)], ["رقم الطلب", t.orderNumber || "—"]] as [string, any][]).map(([k, v]) => (
                    <div key={k}><dt className="text-[11px] text-zinc-500 font-bold">{k}</dt><dd className="font-black break-all" dir="auto">{String(v)}</dd></div>
                  ))}
                </dl>
                <details className="text-xs"><summary className="cursor-pointer font-black text-primary">نص الرسالة المستلمة</summary><pre className="whitespace-pre-wrap bg-zinc-50 rounded-xl p-3 mt-2 font-mono text-[12px]" dir="auto">{t.rawText}</pre></details>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="rounded-xl font-black gap-1" onClick={() => check({ txId: t.txId, providerKey: t.providerKey })} disabled={!t.txId || busy === "check"}><Search size={14} /> تحقق من الحالة</Button>
                </div>
              </CardContent></Card>
            );
          })}
        </TabsContent>

        <TabsContent value="check" className="space-y-4 mt-4">
          <Card className="rounded-3xl"><CardHeader><CardTitle className="text-right font-black">إذا اشتكى مستخدم أن العملية لم تتم</CardTitle></CardHeader><CardContent className="space-y-3 text-right">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="font-black">رقم العملية</Label><Input dir="ltr" value={qTx} onChange={(e) => setQTx(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label className="font-black">طريقة الدفع</Label>
                <select value={qProv} onChange={(e) => setQProv(e.target.value)} className="h-11 w-full rounded-xl border px-3 bg-white"><option value="">— الكل —</option>{(providers || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="space-y-1"><Label className="font-black">أو رقم الطلب</Label><Input dir="ltr" value={qOrder} onChange={(e) => setQOrder(e.target.value)} placeholder="FH-… / TP-…" className="h-11 rounded-xl" /></div>
            </div>
            <Button onClick={() => check()} disabled={busy === "check"} className="rounded-xl font-black gap-2">{busy === "check" ? <Loader2 className="animate-spin" /> : <Search size={16} />} تحقق</Button>
            <p className="text-xs text-zinc-500 font-bold">الاستعلام يعتمد على سجلات النظام (رسائل بوابة الدفع والطلبات)، ويستعلم من واجهة المزود الرسمية فقط إن كانت مضبوطة (PAYMENT_STATUS_ENDPOINTS).</p>
            {result && (<div className={`rounded-2xl border-2 p-4 space-y-2 ${STATUS_COLORS[result.status] || ""}`}>
              <p className="text-2xl font-black">{result.label}</p>
              {result.details?.note && <p className="text-sm font-bold">{result.details.note}</p>}
              <pre className="text-[11px] whitespace-pre-wrap font-mono" dir="ltr">{JSON.stringify(result.details, null, 2)}</pre>
            </div>)}
          </CardContent></Card>
        </TabsContent>

      </Tabs>

    </div>
  );
}
