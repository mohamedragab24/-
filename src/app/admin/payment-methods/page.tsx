"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, WalletCards, Pencil, Trash2, Save, X, Minus } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type Account = { label: string; number: string };

// قوالب سريعة: تملأ النموذج فقط (لا تُحفظ حتى تضغط "إضافة")
const TEMPLATES: { title: string; name: string; accounts: Account[] }[] = [
  { title: "قالب المحافظ الإلكترونية", name: "المحافظ الإلكترونية", accounts: [
    { label: "فودافون كاش", number: "" }, { label: "أورنج كاش", number: "" }, { label: "اتصالات كاش", number: "" }, { label: "وي باي", number: "" },
  ] },
  { title: "قالب إنستا باي", name: "إنستا باي", accounts: [{ label: "", number: "" }] },
];

/** يوحّد الشكل القديم (accountNumber) والجديد (accounts[]) */
const getAccounts = (m: any): Account[] => {
  const list = Array.isArray(m?.accounts) ? m.accounts.map((a: any) => ({ label: String(a?.label || ""), number: String(a?.number || "") })).filter((a: Account) => a.number) : [];
  if (!list.length && m?.accountNumber) list.push({ label: "", number: String(m.accountNumber) });
  return list;
};

export default function AdminPaymentMethodsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([{ label: "", number: "" }]);
  const [sortOrder, setSortOrder] = useState("1");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const methodsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, "paymentMethods"), orderBy("sortOrder", "asc")) : null), [firestore]);
  const { data: methods, isLoading } = useCollection(methodsQuery);

  const reset = () => { setEditingId(null); setName(""); setAccounts([{ label: "", number: "" }]); setSortOrder("1"); setActive(true); };
  const startEdit = (m: any) => {
    setEditingId(m.id); setName(m.name || "");
    const a = getAccounts(m); setAccounts(a.length ? a : [{ label: "", number: "" }]);
    setSortOrder(String(m.sortOrder || 1)); setActive(m.active !== false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setAcc = (i: number, patch: Partial<Account>) => setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const save = async () => {
    const clean = accounts.map((a) => ({ label: a.label.trim(), number: a.number.trim() })).filter((a) => a.number);
    if (!firestore || !name.trim() || clean.length === 0) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "اكتب اسم الوسيلة وأضف رقمًا واحدًا على الأقل." });
      return;
    }
    setBusy(true);
    try {
      const data = {
        name: name.trim(),
        accounts: clean,
        accountNumber: clean[0].number, // للتوافق مع الشاشات القديمة
        sortOrder: Number(sortOrder) || 1,
        active,
        updatedAt: new Date(),
      };
      if (editingId) await updateDoc(doc(firestore, "paymentMethods", editingId), data);
      else await addDoc(collection(firestore, "paymentMethods"), { ...data, createdAt: new Date() });
      toast({ title: editingId ? "تم تعديل وسيلة الدفع" : "تمت إضافة وسيلة الدفع" });
      reset();
    } catch {
      toast({ variant: "destructive", title: "تعذر الحفظ" });
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!firestore || !confirm("هل تريد حذف وسيلة الدفع؟")) return;
    try { await deleteDoc(doc(firestore, "paymentMethods", id)); toast({ title: "تم حذف وسيلة الدفع" }); }
    catch { toast({ variant: "destructive", title: "تعذر الحذف" }); }
  };

  if (!user) return <div className="p-20 text-center font-black">يجب تسجيل الدخول.</div>;

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="border-r-8 border-primary pr-5">
        <h1 className="text-4xl font-black">إدارة المحافظ</h1>
        <p className="text-muted-foreground font-bold mt-2">كل وسيلة دفع (مثل «المحافظ الإلكترونية» أو «إنستا باي») تحتوي أرقامها، وتظهر هذه الأرقام للمستفهم تحتها عند اختيارها. يتم تأكيد الدفع تلقائيًا عبر بوت تليجرام.</p>
      </div>

      <Card className="rounded-[2rem] shadow-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="text-primary" /> {editingId ? "تعديل وسيلة دفع" : "إضافة وسيلة دفع"}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <Button key={t.title} type="button" variant="secondary" className="rounded-xl font-bold" onClick={() => { setName(t.name); setAccounts(t.accounts.map((a) => ({ ...a }))); }}>{t.title}</Button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1"><Label>اسم الوسيلة</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="المحافظ الإلكترونية" /></div>
            <div><Label>الترتيب</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></div>
            <div className="flex items-center justify-between gap-3 h-10"><div><Label>مفعلة</Label><p className="text-xs text-muted-foreground">تظهر في الشراء</p></div><Switch checked={active} onCheckedChange={setActive} /></div>
          </div>

          <div className="space-y-3">
            <Label>الأرقام التي تستقبل التحويل</Label>
            {accounts.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Input value={a.label} onChange={(e) => setAcc(i, { label: e.target.value })} placeholder="اسم المحفظة (مثال: فودافون كاش)" />
                <Input value={a.number} onChange={(e) => setAcc(i, { number: e.target.value })} placeholder="01xxxxxxxxx" dir="ltr" />
                <Button type="button" variant="outline" size="icon" className="rounded-xl" disabled={accounts.length === 1} onClick={() => setAccounts((p) => p.filter((_, idx) => idx !== i))}><Minus className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setAccounts((p) => [...p, { label: "", number: "" }])}><Plus className="ml-2 h-4 w-4" />إضافة رقم آخر</Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={save} disabled={busy} className="rounded-xl font-black"><Save className="ml-2 h-4 w-4" />{editingId ? "حفظ التعديل" : "إضافة"}</Button>
            {editingId && <Button variant="outline" onClick={reset} className="rounded-xl"><X className="ml-2 h-4 w-4" />إلغاء</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] shadow-lg overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="text-primary" /> طرق الدفع الحالية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-center p-8">جارٍ التحميل...</p>
            : (methods || []).length === 0 ? <p className="text-center p-8 text-muted-foreground font-bold">لا توجد وسائل دفع بعد. استخدم أحد القوالب أو أضف وسيلة جديدة.</p>
            : (methods || []).map((m: any) => (
              <div key={m.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border bg-white">
                <div className="flex-1 space-y-1">
                  <div className="font-black text-lg">{m.name}</div>
                  {getAccounts(m).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm"><span className="text-zinc-500 font-bold">{a.label || "رقم"}:</span><span className="font-mono text-primary font-black" dir="ltr">{a.number}</span></div>
                  ))}
                </div>
                <Badge className={m.active === false ? "bg-zinc-200 text-zinc-700" : "bg-emerald-100 text-emerald-700"}>{m.active === false ? "موقوفة" : "مفعلة"}</Badge>
                <Button variant="outline" onClick={() => startEdit(m)} className="rounded-xl"><Pencil className="ml-2 h-4 w-4" />تعديل</Button>
                <Button variant="destructive" onClick={() => remove(m.id)} className="rounded-xl"><Trash2 className="ml-2 h-4 w-4" />حذف</Button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
