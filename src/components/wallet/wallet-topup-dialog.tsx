"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, getFirestore, query, where } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { useToast } from "@/hooks/use-toast";

const accountsOf = (m: any): { label: string; number: string }[] => {
  const list = Array.isArray(m?.accounts) ? m.accounts.map((a: any) => ({ label: String(a?.label || ""), number: String(a?.number || "") })).filter((a: any) => a.number) : [];
  if (!list.length && m?.accountNumber) list.push({ label: "", number: String(m.accountNumber) });
  return list;
};

/**
 * شحن المحفظة عبر بوابة الدفع (نفس مسار شراء الكورس):
 * طلب شحن ← تحويل المبلغ ← وصول رسالة العملية من تطبيق بوابة الدفع ← إضافة الرصيد تلقائيًا.
 * لا يُضاف أي رصيد من المتصفح مباشرة.
 */
export function WalletTopupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [methods, setMethods] = useState<any[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const { firebaseApp } = initializeFirebase();
        const snap = await getDocs(query(collection(getFirestore(firebaseApp), "paymentMethods"), where("active", "==", true)));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
        if (alive) { setMethods(list); if (list.length && !methodId) setMethodId(String((list[0] as any).id)); }
      } catch (e) { console.error("payment methods", e); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = methods.find((m) => m.id === methodId);
  const accs = accountsOf(selected);
  const numAmount = Number(amount);
  const valid = Number.isFinite(numAmount) && numAmount >= 10 && !!methodId && phone.replace(/[^\d+]/g, "").length >= 8;

  const submit = async () => {
    setBusy(true);
    try {
      const { firebaseApp } = initializeFirebase();
      const res: any = await httpsCallable(getFunctions(firebaseApp, "us-central1"), "createWalletTopup")({ amount: numAmount, paymentMethod: methodId, phone: phone.trim(), source: "web" });
      const d = res.data;
      onOpenChange(false);
      toast({ title: d?.pending ? "تم تسجيل طلب الشحن" : "تم شحن المحفظة", description: d?.pending ? "حوّل المبلغ بالضبط من الرقم المكتوب، وسيُضاف الرصيد تلقائيًا بمجرد وصول العملية." : undefined });
      router.push(`/order-complete?paymentId=${encodeURIComponent(String(d?.paymentId || ""))}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر تسجيل طلب الشحن", description: e?.message && e.message !== "internal" ? e.message : "حاول مرة أخرى." });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="rounded-[2rem] sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-right"><DialogTitle className="text-2xl font-black">شحن المحفظة</DialogTitle><DialogDescription className="text-right font-bold">حوّل المبلغ ثم يُضاف الرصيد تلقائيًا بعد التحقق من العملية.</DialogDescription></DialogHeader>
        <div className="space-y-5 text-right">
          <div className="space-y-2"><Label className="font-black">المبلغ (ج.م) — 10 كحد أدنى</Label><Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-black text-center rounded-2xl border-2" /></div>
          <div className="space-y-2"><Label className="font-black">طريقة الدفع</Label>
            {methods.length === 0 ? <p className="text-xs font-bold text-amber-700 bg-amber-50 p-3 rounded-xl">لا توجد وسائل دفع مفعّلة حاليًا.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {methods.map((m) => (
                  <div key={m.id} onClick={() => setMethodId(m.id)} className={`p-4 rounded-2xl border-2 cursor-pointer ${methodId === m.id ? "border-primary bg-primary/5" : "border-zinc-200"}`}>
                    <div className="flex items-center justify-between"><span className="font-black text-sm">{m.name}</span><CreditCard className="w-5 h-5 text-zinc-400" /></div>
                  </div>
                ))}
              </div>)}
          </div>
          {accs.length > 0 && (
            <div className="space-y-2 p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-bold text-zinc-600 text-center">حوّل <span className="text-primary">{amount || "…"} ج.م</span> إلى أحد الأرقام:</p>
              {accs.map((a, i) => (<div key={i} className="p-3 rounded-xl bg-white border flex items-center justify-between gap-3"><span className="text-sm font-black">{a.label || selected?.name}</span><div className="flex items-center gap-2"><span className="text-lg font-black tracking-widest text-primary" dir="ltr">{a.number}</span><Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold" onClick={() => { try { navigator.clipboard?.writeText(a.number); toast({ title: "تم نسخ الرقم" }); } catch (_) {} }}>نسخ</Button></div></div>))}
            </div>)}
          <div className="space-y-1"><Label className="font-black">رقم الحساب/الهاتف الذي سيتم التحويل منه *</Label><Input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" className="h-12 rounded-xl border-2" /></div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl"><ShieldCheck className="w-4 h-4 shrink-0" /><span>اضغط «تأكيد» أولًا ثم حوّل المبلغ بالضبط من الرقم المكتوب. رقم العملية لا يُقبل مرتين.</span></div>
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-black">إلغاء</Button><Button onClick={submit} disabled={!valid || busy} className="rounded-xl font-black px-8">{busy ? <Loader2 className="animate-spin" /> : "تأكيد طلب الشحن"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
