"use client";
import { useMemo, useState } from "react";
import { collection, doc, limit, orderBy, query, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { callGroupFn, fnErrorMessage } from "@/lib/groups";
import { FileCheck, Loader2, Search, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";

/** مراجعة عمليات الدفع: كل رسالة وصلت من تطبيق بوابة الدفع + حالتها + ربطها بطلب شراء/شحن. */
const STATUS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "قيد المراجعة", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "مقبولة", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "مرفوضة", cls: "bg-red-100 text-red-800" },
  duplicate: { label: "مكررة", cls: "bg-violet-100 text-violet-800" },
};
const REASONS: Record<string, string> = { provider_not_allowed: "مزود غير مضاف", duplicate_transaction: "رقم العملية مستخدم من قبل", admin_rejected: "رفض الأدمن" };
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
  const provQ = useMemoFirebase(() => (firestore ? collection(firestore, "paymentProviders") : null), [firestore]);
  const { data: providers } = useCollection<any>(provQ);

  const rows = useMemo(() => (txs || []).filter((t: any) => {
    const st = t.reviewStatus || "pending_review";
    if (filter !== "all" && st !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.txId, t.userName, t.courseName, t.phone, t.orderNumber, t.providerName, t.rawText].some((v) => String(v || "").toLowerCase().includes(q));
  }), [txs, filter, search]);

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

  // ---------- قبول/رفض ----------
  const [acceptTx, setAcceptTx] = useState<any>(null);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const openAccept = async (t: any) => {
    setAcceptTx(t); setPendingOrders([]);
    try { const r: any = await callGroupFn("adminListPendingPayments"); setPendingOrders(r.items || []); } catch (e: any) { toast({ variant: "destructive", title: "تعذر تحميل الطلبات", description: fnErrorMessage(e) }); }
  };
  const doAccept = async (paymentId: string) => {
    setBusy("accept");
    try { await callGroupFn("adminReviewPayment", { txDocId: acceptTx.id, action: "accept", paymentId }); toast({ title: "تم قبول العملية وربطها بالطلب" }); setAcceptTx(null); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر القبول", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };
  const doReject = async (t: any) => {
    const note = prompt("سبب الرفض (اختياري):") ?? null;
    if (note === null) return;
    setBusy(`rej-${t.id}`);
    try { await callGroupFn("adminReviewPayment", { txDocId: t.id, action: "reject", note }); toast({ title: "تم رفض العملية" }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر الرفض", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  // ---------- مزودو الدفع ----------
  const [pName, setPName] = useState(""); const [pKey, setPKey] = useState(""); const [pAliases, setPAliases] = useState("");
  const addProvider = async () => {
    if (!firestore) return;
    const key = (pKey.trim() || pName.trim()).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || `p_${Date.now().toString(36)}`;
    if (!pName.trim()) { toast({ variant: "destructive", title: "اكتب اسم المزود" }); return; }
    try {
      await setDoc(doc(firestore, "paymentProviders", key), { key, name: pName.trim(), aliases: pAliases.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean), active: true, sortOrder: (providers?.length || 0) + 1, createdAt: serverTimestamp() }, { merge: true });
      setPName(""); setPKey(""); setPAliases(""); toast({ title: "تمت إضافة المزود" });
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر الحفظ", description: e?.message }); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 border-r-8 border-primary pr-4"><FileCheck className="text-primary" /><div><h1 className="text-3xl font-black">مراجعة عمليات الدفع</h1><p className="text-sm text-zinc-500 font-bold">كل رسالة وصلت من تطبيق بوابة الدفع، مربوطة بطلب شراء الكورس أو شحن المحفظة.</p></div></div>

      <Tabs defaultValue="txs">
        <TabsList className="rounded-2xl h-auto flex-wrap">
          <TabsTrigger value="txs" className="font-black">العمليات</TabsTrigger>
          <TabsTrigger value="check" className="font-black">التحقق من حالة عملية</TabsTrigger>
          <TabsTrigger value="providers" className="font-black">المزودون المقبولون</TabsTrigger>
        </TabsList>

        <TabsContent value="txs" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            {[["all", "الكل"], ["pending_review", "قيد المراجعة"], ["accepted", "مقبولة"], ["rejected", "مرفوضة"], ["duplicate", "مكررة"]].map(([k, l]) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="rounded-xl font-black" onClick={() => setFilter(k)}>{l}</Button>
            ))}
            <div className="relative flex-1 min-w-[220px]"><Search className="absolute right-3 top-3 h-4 w-4 text-zinc-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث: رقم عملية، مستخدم، كورس، رقم هاتف…" className="pr-9 h-10 rounded-xl" /></div>
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
                  {([["رقم العملية", t.txId || "غير متوفر"], ["المستخدم", t.userName || (t.uid ? t.uid : "—")], ["الكورس/النوع", t.kind === "wallet_topup" ? "شحن المحفظة" : (t.courseName || "—")], ["المبلغ", t.amount != null ? `${t.amount} ج.م` : "—"], ["طريقة الدفع", t.providerName || "—"], ["رقم الحساب/المحفظة", t.phone || "—"], ["تاريخ العملية", fmt(t.timeMs)], ["رقم الطلب", t.orderNumber || "—"]] as [string, any][]).map(([k, v]) => (
                    <div key={k}><dt className="text-[11px] text-zinc-500 font-bold">{k}</dt><dd className="font-black break-all" dir="auto">{String(v)}</dd></div>
                  ))}
                </dl>
                <details className="text-xs"><summary className="cursor-pointer font-black text-primary">نص الرسالة المستلمة</summary><pre className="whitespace-pre-wrap bg-zinc-50 rounded-xl p-3 mt-2 font-mono text-[12px]" dir="auto">{t.rawText}</pre></details>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="rounded-xl font-black gap-1" onClick={() => check({ txId: t.txId, providerKey: t.providerKey })} disabled={!t.txId || busy === "check"}><Search size={14} /> تحقق من الحالة</Button>
                  {(t.reviewStatus || "pending_review") === "pending_review" && (<>
                    <Button size="sm" className="rounded-xl font-black gap-1" onClick={() => openAccept(t)}><CheckCircle2 size={14} /> قبول وربط بطلب</Button>
                    <Button size="sm" variant="outline" className="rounded-xl font-black gap-1 text-red-600" disabled={busy === `rej-${t.id}`} onClick={() => doReject(t)}><XCircle size={14} /> رفض</Button>
                  </>)}
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

        <TabsContent value="providers" className="space-y-4 mt-4">
          <p className="text-sm font-bold text-zinc-600 text-right">تُقبل فقط الرسائل التي تطابق مزودًا مفعّلًا هنا. أي رسالة أخرى لا تتحول لعملية دفع وتُسجّل كمرفوضة.</p>
          {(providers || []).map((p: any) => (
            <Card key={p.id} className="rounded-2xl"><CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><Switch checked={p.active !== false} onCheckedChange={(v) => firestore && updateDoc(doc(firestore, "paymentProviders", p.id), { active: v })} /><Button size="icon" variant="ghost" className="text-red-500" onClick={() => { if (firestore && confirm(`حذف المزود ${p.name}؟`)) deleteDoc(doc(firestore, "paymentProviders", p.id)); }}><Trash2 size={16} /></Button></div>
              <div className="text-right"><p className="font-black">{p.name} <span className="text-xs font-mono text-zinc-400" dir="ltr">{p.id}</span></p><p className="text-xs text-zinc-500 font-bold">ألقاب المطابقة: {(p.aliases || []).join("، ") || "—"}</p></div>
            </CardContent></Card>
          ))}
          <Card className="rounded-3xl border-2 border-dashed"><CardContent className="p-5 space-y-3 text-right">
            <Label className="font-black">إضافة مزود دفع</Label>
            <div className="grid md:grid-cols-3 gap-3">
              <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="الاسم كما يظهر في «طريقة الدفع» (مثال: فودافون كاش)" className="h-11 rounded-xl" />
              <Input dir="ltr" value={pKey} onChange={(e) => setPKey(e.target.value)} placeholder="المعرّف (إنجليزي، اختياري)" className="h-11 rounded-xl" />
              <Input value={pAliases} onChange={(e) => setPAliases(e.target.value)} placeholder="ألقاب أخرى مفصولة بفاصلة (VF-Cash، vodafone)" className="h-11 rounded-xl" />
            </div>
            <Button onClick={addProvider} className="rounded-xl font-black gap-2"><Plus size={16} /> إضافة</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!acceptTx} onOpenChange={(o) => !o && setAcceptTx(null)}>
        <DialogContent dir="rtl" className="rounded-[2rem] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-right font-black">ربط العملية بطلب معلّق</DialogTitle><DialogDescription className="text-right">العملية: {acceptTx?.txId || "بدون رقم"} — {acceptTx?.amount} ج.م من {acceptTx?.phone}. رقم العملية المستخدم من قبل يُرفض دائمًا حتى مع القبول اليدوي.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {pendingOrders.length === 0 ? <p className="text-sm text-zinc-500 font-bold">لا توجد طلبات معلّقة.</p> : pendingOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border rounded-2xl p-3 gap-2">
                <Button size="sm" disabled={busy === "accept"} onClick={() => doAccept(o.id)} className="rounded-xl font-black">ربط</Button>
                <div className="text-right text-sm"><p className="font-black">{o.type === "wallet_topup" ? "شحن محفظة" : o.courseName} — {o.amount} ج.م</p><p className="text-xs text-zinc-500 font-bold">{o.userName} • {o.orderNumber} • من {o.paymentPhone}</p></div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAcceptTx(null)} className="rounded-xl font-black">إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
