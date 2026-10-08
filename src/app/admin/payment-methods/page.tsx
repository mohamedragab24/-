"use client";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, WalletCards, Pencil, Trash2, Save, X, ImagePlus } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { callGroupFn, fnErrorMessage } from "@/lib/groups";
import { GatewayLogo } from "@/components/payment/payment-method-picker";
import { GATEWAY_TEMPLATES, PAYMENT_GROUPS, gatewayGroup, gatewayNumber, logoFileToDataUrl, providerKeyFor, type PaymentGroupKey } from "@/lib/payment-groups";

/**
 * إدارة المحافظ (بوابات الدفع). كل بوابة = خدمة واحدة تظهر للمستخدم تحت مجموعتها:
 *  - اسم الخدمة: كما يراه المستخدم (فودافون كاش / تحويل برقم الموبايل ...)
 *  - اسم مزود الخدمة: يجب أن يطابق «طريقة الدفع» في تطبيق البوابة والبوت، وإلا تُرفض العملية
 *  - الرقم الذي يُحوَّل عليه + شعار المزود
 */
export default function AdminPaymentMethodsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [group, setGroup] = useState<PaymentGroupKey>("wallet");
  const [name, setName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [number, setNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const methodsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, "paymentMethods"), orderBy("sortOrder", "asc")) : null), [firestore]);
  const { data: methods, isLoading } = useCollection<any>(methodsQuery);

  const reset = () => { setEditingId(null); setGroup("wallet"); setName(""); setProviderName(""); setNumber(""); setLogoUrl(""); setSortOrder("1"); setActive(true); if (fileRef.current) fileRef.current.value = ""; };
  const startEdit = (m: any) => {
    setEditingId(m.id); setGroup(gatewayGroup(m) === "other" ? "wallet" : gatewayGroup(m));
    setName(m.name || ""); setProviderName(m.providerName || m.name || ""); setNumber(gatewayNumber(m));
    setLogoUrl(m.logoUrl || ""); setSortOrder(String(m.sortOrder || 1)); setActive(m.active !== false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickLogo = async (f?: File | null) => {
    if (!f) return;
    try { setLogoUrl(await logoFileToDataUrl(f)); } catch (e: any) { toast({ variant: "destructive", title: "تعذر رفع الصورة", description: e?.message }); }
  };

  const save = async () => {
    if (!name.trim() || !providerName.trim() || !number.trim()) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "اكتب اسم الخدمة واسم مزود الخدمة والرقم الذي سيتم التحويل عليه." });
      return;
    }
    setBusy(true);
    try {
      await callGroupFn("adminSaveGateway", {
        id: editingId || "", group, name: name.trim(), providerName: providerName.trim(), providerKey: providerKeyFor(providerName),
        number: number.trim(), logoUrl, sortOrder: Number(sortOrder) || 1, active,
      });
      toast({ title: editingId ? "تم تعديل بوابة الدفع" : "تمت إضافة بوابة الدفع" });
      reset();
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر الحفظ", description: fnErrorMessage(e) });
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف بوابة الدفع؟")) return;
    try { await callGroupFn("adminDeleteGateway", { id }); toast({ title: "تم الحذف" }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر الحذف", description: fnErrorMessage(e) }); }
  };

  if (!user) return <div className="p-20 text-center font-black">يجب تسجيل الدخول.</div>;

  const list = methods || [];
  const sections = [...PAYMENT_GROUPS.map((g) => ({ key: g.key as PaymentGroupKey, title: g.title })), { key: "other" as PaymentGroupKey, title: "بوابات قديمة (بدون مجموعة)" }]
    .map((g) => ({ ...g, items: list.filter((m: any) => gatewayGroup(m) === g.key) })).filter((g) => g.items.length > 0);

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="border-r-8 border-primary pr-5">
        <h1 className="text-4xl font-black">إدارة المحافظ</h1>
        <p className="text-muted-foreground font-bold mt-2">أضف بوابات الدفع التي تظهر للمستخدم عند الشراء وشحن المحفظة. يتم تأكيد الدفع تلقائيًا إذا تطابق اسم مزود الخدمة بين المنصة وتطبيق البوابة والبوت، وإلا تُرفض العملية.</p>
      </div>

      <Card className="rounded-[2rem] shadow-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="text-primary" /> {editingId ? "تعديل بوابة دفع" : "إضافة بوابة دفع"}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>المجموعة</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_GROUPS.map((g) => (
                <Button key={g.key} type="button" variant={group === g.key ? "default" : "outline"} className="rounded-xl font-bold" onClick={() => setGroup(g.key)}>{g.title}</Button>
              ))}
            </div>
          </div>

          {!editingId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">قوالب سريعة (تملأ الاسم فقط)</Label>
              <div className="flex flex-wrap gap-2">
                {GATEWAY_TEMPLATES.filter((t) => t.group === group).map((t) => (
                  <Button key={t.name} type="button" variant="secondary" size="sm" className="rounded-xl font-bold" onClick={() => { setName(t.name); setProviderName(t.providerName); }}>{t.name}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>اسم الخدمة (كما يظهر للمستخدم)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="فودافون كاش" /></div>
            <div><Label>اسم مزود الخدمة</Label><Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="فودافون كاش" />
              <p className="text-[11px] text-muted-foreground mt-1">اكتبه تمامًا مثل «اسم مزود الخدمة» المضاف في تطبيق بوابة الدفع (مثل VF-Cash أو فودافون كاش)؛ أي اختلاف = رفض العملية.</p></div>
            <div><Label>الرقم الذي سيتم التحويل عليه</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>الترتيب</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></div>
              <div className="flex items-center justify-between gap-3 h-10 mt-6"><Label>مفعلة</Label><Switch checked={active} onCheckedChange={setActive} /></div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <GatewayLogo m={{ name, logoUrl }} size={64} />
            <div className="space-y-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => fileRef.current?.click()}><ImagePlus className="ml-2 h-4 w-4" />{logoUrl ? "تغيير صورة المزود" : "رفع صورة المزود"}</Button>
              {logoUrl && <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => { setLogoUrl(""); if (fileRef.current) fileRef.current.value = ""; }}>إزالة الصورة</Button>}
              <p className="text-[11px] text-muted-foreground">تظهر بجانب الخدمة في اختيار الدفع، وفي شحن المحفظة، وفي إيصال الطلب.</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={save} disabled={busy} className="rounded-xl font-black"><Save className="ml-2 h-4 w-4" />{editingId ? "حفظ التعديل" : "إضافة"}</Button>
            {editingId && <Button variant="outline" onClick={reset} className="rounded-xl"><X className="ml-2 h-4 w-4" />إلغاء</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] shadow-lg overflow-hidden">
        <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="text-primary" /> بوابات الدفع الحالية</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <p className="text-center p-8">جارٍ التحميل...</p>
            : sections.length === 0 ? <p className="text-center p-8 text-muted-foreground font-bold">لا توجد بوابات دفع بعد. اختر مجموعة وأضف أول خدمة.</p>
            : sections.map((s) => (
              <div key={s.key} className="space-y-3">
                <h3 className="font-black text-lg border-r-4 border-primary pr-3">{s.title}</h3>
                {s.items.map((m: any) => (
                  <div key={m.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border bg-white">
                    <GatewayLogo m={m} size={48} />
                    <div className="flex-1 space-y-1">
                      <div className="font-black text-lg">{m.name}</div>
                      <div className="text-xs text-zinc-500 font-bold">مزود الخدمة: <span className="text-zinc-800">{m.providerName || "—"}</span></div>
                      <div className="font-mono text-primary font-black text-sm" dir="ltr">{gatewayNumber(m)}</div>
                    </div>
                    <Badge className={m.active === false ? "bg-zinc-200 text-zinc-700" : "bg-emerald-100 text-emerald-700"}>{m.active === false ? "موقوفة" : "مفعلة"}</Badge>
                    <Button variant="outline" onClick={() => startEdit(m)} className="rounded-xl"><Pencil className="ml-2 h-4 w-4" />تعديل</Button>
                    <Button variant="destructive" onClick={() => remove(m.id)} className="rounded-xl"><Trash2 className="ml-2 h-4 w-4" />حذف</Button>
                  </div>
                ))}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
