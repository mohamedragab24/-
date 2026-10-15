"use client";

import { useState } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { doc, updateDoc } from "firebase/firestore";
import { Smartphone, UploadCloud, Loader2, Trash2, ShieldAlert, SkipForward, FileArchive, CheckCircle2, ImagePlus, BellRing } from "lucide-react";
import { uploadImageWithProgress } from "@/lib/upload-with-progress";
import { useFirestore, useFirebase, useCollection, useMemoFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const call = async <T,>(name: string, data: any): Promise<T> => {
  const fn = httpsCallable(getFunctions(), name);
  const res: any = await fn(data);
  return res.data as T;
};

const fmtBytes = (n: number) => {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
};

/** رفع مباشر إلى R2 مع نسبة التقدم */
const putWithProgress = (url: string, file: File, contentType: string, onProgress: (p: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`فشل الرفع (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء رفع الملف"));
    xhr.send(file);
  });

const SLOTS = [
  { abi: "arm64-v8a", label: "arm64-v8a", hint: "أغلب الهواتف الحديثة (64-bit) — الأهم" },
  { abi: "armeabi-v7a", label: "armeabi-v7a", hint: "الهواتف القديمة (32-bit)" },
  { abi: "universal", label: "شامل (اختياري)", hint: "ملف واحد لكل الأجهزة — حجمه كبير" },
] as const;
type Abi = (typeof SLOTS)[number]["abi"];

const emptyForm = { versionName: "", versionCode: "", title: "", description: "", mandatory: false, notify: true, imageUrl: "" };

export default function AdminAppUpdatesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { storage } = useFirebase();
  const [imgProgress, setImgProgress] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<Partial<Record<Abi, File>>>({});
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const q = useMemoFirebase(() => (firestore ? query(collection(firestore, "appUpdates"), orderBy("versionCode", "desc")) : null), [firestore]);
  const { data: updates, isLoading } = useCollection<any>(q);
  const latest = (updates || []).find((u: any) => u.active !== false);

  const uploadImage = async (f: File) => {
    if (!storage) return toast({ variant: "destructive", title: "خدمة التخزين غير متاحة" });
    try {
      const url = await uploadImageWithProgress(storage, "notifications/updates", f, setImgProgress);
      setForm((v) => ({ ...v, imageUrl: url }));
    } catch (e: any) { toast({ variant: "destructive", title: "فشل رفع الصورة", description: e?.message }); }
    finally { setImgProgress(null); }
  };

  const publish = async () => {
    const code = Math.floor(Number(form.versionCode));
    const picked = SLOTS.filter((sl) => files[sl.abi]);
    if (!picked.length) return toast({ variant: "destructive", title: "اختر ملف APK واحدًا على الأقل" });
    if (!form.versionName.trim() || !Number.isInteger(code) || code < 1) return toast({ variant: "destructive", title: "اكتب اسم الإصدار ورقم الإصدار (build)" });
    if (!form.title.trim()) return toast({ variant: "destructive", title: "اكتب عنوان التحديث" });
    setBusy(true); setProgress(0);
    try {
      const total = picked.reduce((a, sl) => a + (files[sl.abi]!.size), 0);
      let done = 0;
      const apks: any[] = [];
      for (const sl of picked) {
        const f = files[sl.abi]!;
        const up = await call<{ url: string; key: string; contentType: string }>("createAppUpdateUploadUrl", { fileName: f.name, size: f.size });
        await putWithProgress(up.url, f, up.contentType, (p) => setProgress(Math.round(((done + (f.size * p) / 100) / total) * 100)));
        done += f.size;
        apks.push({ abi: sl.abi, key: up.key, name: f.name, size: f.size });
      }
      const res = await call<any>("publishAppUpdate", { ...form, versionCode: code, apks });
      const pushNote = !form.notify ? "" : res?.push?.error ? " (تعذر إرسال الإشعار)" : res?.push ? ` — وصل إشعار لـ ${res.push.sent} جهاز` : "";
      toast({ title: "تم نشر التحديث", description: (form.mandatory ? "التحديث إجباري: لن يفتح التطبيق إلا بعد التحديث." : "التحديث اختياري: يستطيع المستخدم تخطيه.") + pushNote });
      setForm(emptyForm); setFiles({}); setProgress(0);
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر نشر التحديث", description: e?.message || "حدث خطأ" });
    } finally { setBusy(false); }
  };

  const remove = async (u: any) => {
    if (!confirm(`حذف تحديث ${u.versionName} نهائيًا مع ملف الـ APK؟`)) return;
    setDeleting(u.id);
    try { await call("deleteAppUpdate", { id: u.id }); toast({ title: "تم حذف التحديث" }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر الحذف", description: e?.message }); }
    finally { setDeleting(null); }
  };

  const patch = async (u: any, data: Record<string, any>) => {
    if (!firestore) return;
    try { await updateDoc(doc(firestore, "appUpdates", u.id), data); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر التعديل", description: e?.message }); }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black">تحديثات التطبيق</h1>
        <p className="text-muted-foreground font-bold">ارفع ملف APK جديد، واختر هل التحديث إجباري أم اختياري. سيظهر للمستخدمين عند فتح التطبيق.</p>
      </div>

      {latest && (
        <div className="rounded-2xl border bg-primary/5 p-4 flex items-center gap-3 font-bold">
          <CheckCircle2 className="text-primary" />
          آخر إصدار منشور: <span className="text-primary">{latest.versionName}</span> (build {latest.versionCode}) —
          {latest.mandatory ? " إجباري" : " اختياري"}
        </div>
      )}

      <Card className="rounded-[2.5rem] shadow-xl">
        <CardHeader><CardTitle className="flex items-center gap-3"><Smartphone className="text-primary" /> نشر تحديث جديد</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <div><Label>اسم الإصدار</Label><Input placeholder="مثال: 1.2.0" value={form.versionName} onChange={(e) => setForm({ ...form, versionName: e.target.value })} /></div>
            <div>
              <Label>رقم الإصدار (build number)</Label>
              <Input type="number" inputMode="numeric" placeholder="مثال: 12" value={form.versionCode} onChange={(e) => setForm({ ...form, versionCode: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">لازم يكون أكبر من الرقم الموجود في pubspec.yaml للنسخة الحالية (الرقم بعد علامة +).</p>
            </div>
          </div>
          <div><Label>عنوان التحديث</Label><Input placeholder="مثال: تحديث جديد بمميزات المجموعات" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>وصف التحديث</Label><Textarea rows={5} placeholder="اكتب ما الجديد في هذا الإصدار (سطر لكل ميزة)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          <div className="space-y-3">
            <Label>ملفات التطبيق (APK) — ملف لكل معمارية</Label>
            <div className="grid gap-3">
              {SLOTS.map((sl) => {
                const f = files[sl.abi];
                return (
                  <label key={sl.abi} className={cn("flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 cursor-pointer hover:bg-primary/5 transition", f && "border-primary bg-primary/5")}>
                    <FileArchive className="text-primary w-7 h-7 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-black truncate" dir="ltr" style={{ textAlign: "right" }}>{f ? f.name : sl.label}</p>
                      <p className="text-xs text-muted-foreground">{f ? fmtBytes(f.size) : sl.hint}</p>
                    </div>
                    {f && <button type="button" className="text-xs text-red-600 font-bold" onClick={(e) => { e.preventDefault(); setFiles((v) => { const n = { ...v }; delete n[sl.abi]; return n; }); }}>إزالة</button>}
                    <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={(e) => { const nf = e.target.files?.[0]; if (nf) setFiles((v) => ({ ...v, [sl.abi]: nf })); e.target.value = ""; }} />
                  </label>
                );
              })}
            </div>
            {busy && (
              <div className="space-y-1">
                <div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="text-xs font-bold text-muted-foreground">{progress < 100 ? `جارٍ الرفع ${progress}%` : "جارٍ نشر التحديث..."}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4 space-y-3">
            <Label>صورة التحديث (تظهر في صفحة التحديث داخل التطبيق وفي الإشعار)</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-bold cursor-pointer hover:bg-zinc-50">
                <ImagePlus className="w-5 h-5" /> رفع صورة
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
              </label>
              {form.imageUrl && imgProgress === null && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setForm({ ...form, imageUrl: "" })}>إزالة الصورة</Button>}
            </div>
            {imgProgress !== null && (
              <div className="space-y-1 max-w-sm">
                <div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${imgProgress}%` }} /></div>
                <p className="text-xs font-bold text-muted-foreground">جارٍ رفع الصورة {imgProgress}%</p>
              </div>
            )}
            {form.imageUrl && <img src={form.imageUrl} alt="" className="h-32 w-56 object-cover rounded-xl border" />}
          </div>

          <div className="rounded-2xl border p-4 space-y-4">
            <label className="flex items-center justify-between gap-3 font-black">
              <span className="flex items-center gap-2"><BellRing size={18} className="text-primary" /> إرسال إشعار للمستخدمين في شريط الهاتف</span>
              <Switch checked={form.notify} onCheckedChange={(v) => setForm({ ...form, notify: v })} />
            </label>
            {form.notify && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">يصل لكل المستخدمين بعنوان التحديث ووصفه، مع صورة التحديث (اختيارية).</p>
                {/* معاينة شكل الإشعار */}
                <div className="rounded-2xl bg-zinc-100 p-3 max-w-sm">
                  <div className="rounded-xl bg-white shadow p-3 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-bold"><span className="w-4 h-4 rounded bg-primary inline-block" /> فهمت · الآن</div>
                    <p className="font-black text-sm">{form.title || "عنوان التحديث"}</p>
                    <p className="text-xs text-zinc-600 line-clamp-3">{form.description || "وصف التحديث سيظهر هنا"}</p>
                    {form.imageUrl && <img src={form.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg" />}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm({ ...form, mandatory: false })} className={cn("rounded-2xl border-2 p-4 text-right transition", !form.mandatory ? "border-primary bg-primary/5" : "hover:bg-zinc-50")}>
              <p className="font-black flex items-center gap-2"><SkipForward size={18} className="text-primary" /> تحديث اختياري</p>
              <p className="text-xs text-muted-foreground mt-1">يظهر للمستخدم زر «تخطي» ويقدر يكمل استخدام التطبيق.</p>
            </button>
            <button type="button" onClick={() => setForm({ ...form, mandatory: true })} className={cn("rounded-2xl border-2 p-4 text-right transition", form.mandatory ? "border-accent bg-accent/10" : "hover:bg-zinc-50")}>
              <p className="font-black flex items-center gap-2"><ShieldAlert size={18} className="text-accent" /> تحديث إجباري</p>
              <p className="text-xs text-muted-foreground mt-1">لا يفتح التطبيق إلا بعد التحديث، ولا يوجد زر تخطي.</p>
            </button>
          </div>

          <Button disabled={busy || imgProgress !== null} onClick={publish} className="h-16 w-full rounded-2xl font-black text-xl">
            {busy ? <Loader2 className="animate-spin ml-2" /> : <UploadCloud className="ml-2" />} رفع ونشر التحديث{form.notify ? " وإرسال الإشعار" : ""}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2.5rem] shadow-xl">
        <CardHeader><CardTitle>التحديثات السابقة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <Loader2 className="animate-spin text-primary" />}
          {!isLoading && !(updates || []).length && <p className="text-center text-muted-foreground py-8">لا توجد تحديثات منشورة بعد</p>}
          {(updates || []).map((u: any) => (
            <div key={u.id} className={cn("rounded-2xl border p-4 space-y-3", u.active === false && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-lg">{u.title}</p>
                <Badge variant="secondary">v{u.versionName} · build {u.versionCode}</Badge>
                <Badge className={u.mandatory ? "bg-accent text-white" : "bg-primary text-white"}>{u.mandatory ? "إجباري" : "اختياري"}</Badge>
                {u.active === false && <Badge variant="outline">متوقف</Badge>}
              </div>
              {u.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{u.description}</p>}
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground">
                <span dir="ltr">{u.apks ? Object.entries(u.apks).map(([k, a]: any) => `${k} ${fmtBytes(a.size)}`).join(" · ") : `${u.apkName || "app.apk"} · ${fmtBytes(u.apkSize)}`}</span>
                <span>{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString("ar-EG") : ""}</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={u.mandatory === true} onCheckedChange={(v) => patch(u, { mandatory: v })} /> إجباري</label>
                <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={u.active !== false} onCheckedChange={(v) => patch(u, { active: v })} /> مفعّل</label>
                <Button variant="ghost" size="sm" className="text-red-600 mr-auto" disabled={deleting === u.id} onClick={() => remove(u)}>
                  {deleting === u.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4 ml-1" />} حذف
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
