"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { uploadImageWithProgress } from "@/lib/upload-with-progress";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

const emptyForm = { title: "", description: "", imageUrl: "", sendAt: "", deliveryMode: "push" }; // push = خارج التطبيق | in_app = داخل التطبيق

const statusLabel = (s?: string) =>
  s === "sent" ? "تم الإرسال" : s === "processing" ? "جارٍ الإرسال" : s === "pending" ? "مجدولة" : s === "partial" ? "وصل جزئيًا" : s === "failed" ? "فشل الإرسال" : s || "—";

function ImagePicker({ value, onChange, storage }: { value: string; onChange: (url: string) => void; storage: any }) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const pick = async (file: File) => {
    if (!storage) return toast({ variant: "destructive", title: "خدمة التخزين غير متاحة" });
    try { onChange(await uploadImageWithProgress(storage, "notifications", file, setProgress)); }
    catch (err: any) { toast({ variant: "destructive", title: "فشل رفع الصورة", description: err?.message || "تعذر الرفع" }); }
    finally { setProgress(null); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-bold cursor-pointer hover:bg-zinc-50">
          <ImagePlus className="w-5 h-5" /> رفع صورة من الجهاز
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
        </label>
        {value && progress === null && <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => onChange("")}>إزالة الصورة</Button>}
      </div>
      {progress !== null && (
        <div className="space-y-1 max-w-sm">
          <div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="text-xs font-bold text-muted-foreground">جارٍ رفع الصورة {progress}%</p>
        </div>
      )}
      {value && <img src={value} alt="صورة الإشعار" className="h-28 w-48 object-cover rounded-xl border" />}
    </div>
  );
}

export default function AdminNotifications() {
  const { toast } = useToast();
  const { firebaseApp, storage, firestore } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState(emptyForm);
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "scheduledNotifications"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (s) => setHistory(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [firestore]);

  const call = async (name: string, data: any) => {
    if (!firebaseApp) throw new Error("Firebase غير جاهز");
    const fn = httpsCallable(getFunctions(firebaseApp, "us-central1"), name);
    const res: any = await fn(data);
    return res?.data;
  };

  const submit = async () => {
    if (!f.title.trim() || !f.description.trim()) { toast({ variant: "destructive", title: "أكمل البيانات", description: "العنوان والوصف مطلوبان." }); return; }
    setLoading(true);
    try {
      const d = await call("scheduleNotification", { title: f.title, description: f.description, body: f.description, imageUrl: f.imageUrl, deliveryMode: f.deliveryMode, audience: "all", sendAt: f.sendAt ? new Date(f.sendAt).toISOString() : "" });
      toast({ title: d?.immediate ? "تم إرسال الإشعار" : "تمت جدولة الإشعار", description: d?.immediate ? (f.deliveryMode === "push" ? `وصل لـ ${d.sent} جهاز في شريط الهاتف.` : `ظهر داخل التطبيق لـ ${d.inApp} مستخدم.`) : "سيُرسل في الموعد المحدد." });
      setF(emptyForm);
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر الإرسال", description: e?.message || "حدث خطأ" }); } finally { setLoading(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.description?.trim()) { toast({ variant: "destructive", title: "العنوان والوصف مطلوبان" }); return; }
    setSaving(true);
    try {
      await call("updateNotification", { id: editing.id, title: editing.title, description: editing.description, imageUrl: editing.imageUrl || "", sendAt: editing.status === "pending" ? editing.newSendAt || "" : "" });
      toast({ title: "تم تعديل الإشعار", description: editing.deliveryMode === "push" && editing.status !== "pending" ? "التعديل في السجل فقط؛ إشعار الهاتف الذي وصل لا يمكن تغييره." : undefined });
      setEditing(null);
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر التعديل", description: e?.message }); } finally { setSaving(false); }
  };

  const remove = async (n: any) => {
    if (!confirm(`حذف الإشعار «${n.title || ""}»؟ سيُحذف أيضًا من داخل التطبيق عند المستخدمين${n.status === "pending" ? " ولن يُرسل" : ""}.`)) return;
    setDeleting(n.id);
    try { await call("deleteNotification", { id: n.id }); toast({ title: "تم حذف الإشعار" }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر الحذف", description: e?.message }); } finally { setDeleting(null); }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black">الإشعارات</h1>
        <p className="text-muted-foreground font-bold">أرسل إشعارًا بعنوان ووصف وصورة، وعدّل أو احذف أي إشعار سابق.</p>
      </div>

      <Card className="rounded-[2.5rem] shadow-xl">
        <CardHeader><CardTitle className="flex items-center gap-3"><CalendarClock className="text-primary" /> إشعار جديد</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div><Label>العنوان</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>الوصف</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>صورة الإشعار</Label><ImagePicker value={f.imageUrl} onChange={(url) => setF((v) => ({ ...v, imageUrl: url }))} storage={storage} /></div>
          <div><Label>وقت الإرسال (اتركه فارغًا للإرسال الآن)</Label><Input type="datetime-local" value={f.sendAt} onChange={(e) => setF({ ...f, sendAt: e.target.value })} /></div>
          <div className="space-y-2"><Label>مكان ظهور الرسالة</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setF({ ...f, deliveryMode: "in_app" })} className={"rounded-2xl border-2 p-4 text-right transition " + (f.deliveryMode === "in_app" ? "border-primary bg-primary/5" : "hover:bg-zinc-50")}><p className="font-black">داخل التطبيق</p><p className="text-xs text-muted-foreground mt-1">تظهر في شاشة الإشعارات داخل التطبيق.</p></button>
              <button type="button" onClick={() => setF({ ...f, deliveryMode: "push" })} className={"rounded-2xl border-2 p-4 text-right transition " + (f.deliveryMode === "push" ? "border-primary bg-primary/5" : "hover:bg-zinc-50")}><p className="font-black">خارج التطبيق</p><p className="text-xs text-muted-foreground mt-1">تصل في شريط إشعارات الهاتف بالعنوان والوصف والصورة.</p></button>
            </div>
          </div>
          <Button disabled={loading} onClick={submit} className="h-16 w-full rounded-2xl font-black text-xl">{loading ? <Loader2 className="animate-spin ml-2" /> : <CalendarClock className="ml-2" />} {f.sendAt ? "جدولة الإشعار" : "إرسال الآن"}</Button>
        </CardContent>
      </Card>

      {editing && (
        <Card className="rounded-[2.5rem] shadow-xl border-primary">
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="flex items-center gap-3"><Pencil className="text-primary" /> تعديل الإشعار</CardTitle><Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X /></Button></CardHeader>
          <CardContent className="space-y-6">
            <div><Label>العنوان</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><Label>الوصف</Label><Textarea rows={4} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>الصورة</Label><ImagePicker value={editing.imageUrl || ""} onChange={(url) => setEditing((v: any) => ({ ...v, imageUrl: url }))} storage={storage} /></div>
            {editing.status === "pending" && <div><Label>تغيير موعد الإرسال (اختياري)</Label><Input type="datetime-local" value={editing.newSendAt ? editing.newSendAt.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, newSendAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} /></div>}
            {editing.status !== "pending" && editing.deliveryMode !== "in_app" && <p className="text-xs font-bold text-muted-foreground">ملاحظة: إشعار الهاتف الذي وصل بالفعل لا يمكن تغييره، والتعديل يحدّث السجل فقط.</p>}
            <div className="flex gap-3">
              <Button disabled={saving} onClick={saveEdit} className="h-12 rounded-2xl font-black flex-1">{saving ? <Loader2 className="animate-spin ml-2" /> : null} حفظ التعديل</Button>
              <Button variant="outline" className="h-12 rounded-2xl font-black" onClick={() => setEditing(null)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[2.5rem] shadow-xl">
        <CardHeader><CardTitle>سجل الإشعارات السابقة</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead><tr className="border-b"><th className="p-3">العنوان</th><th className="p-3">الوصف</th><th className="p-3">الموعد</th><th className="p-3">الحالة</th><th className="p-3">القناة</th><th className="p-3">تم الإرسال</th><th className="p-3">فشل</th><th className="p-3">إجراءات</th></tr></thead>
              <tbody>
                {history.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد إشعارات بعد</td></tr> : history.map((n) => (
                  <tr key={n.id} className="border-b">
                    <td className="p-3 font-bold">{n.title || "—"}</td>
                    <td className="p-3 max-w-48 truncate" title={n.description || n.body || ""}>{n.description || n.body || "—"}</td>
                    <td className="p-3">{n.sendAt?.toDate ? n.sendAt.toDate().toLocaleString("ar-EG") : "—"}</td>
                    <td className="p-3" title={n.lastError || ""}>{statusLabel(n.status)}</td>
                    <td className="p-3">{n.deliveryMode === "in_app" ? "داخل التطبيق" : n.deliveryMode === "push" ? "خارج التطبيق" : "التطبيق + Push"}</td>
                    <td className="p-3">{typeof n.sentCount === "number" ? n.sentCount : "—"}</td>
                    <td className="p-3">{typeof n.failedCount === "number" ? n.failedCount : "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...n, description: n.description || n.body || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="w-4 h-4 ml-1" /> تعديل</Button>
                      <Button variant="ghost" size="sm" className="text-red-600" disabled={deleting === n.id} onClick={() => remove(n)}>{deleting === n.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4 ml-1" />} حذف</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
