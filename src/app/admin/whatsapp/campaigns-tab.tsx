"use client";

import { useState } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirebase, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { uploadImageWithProgress } from "@/lib/upload-with-progress";
import { Loader2, Send, Pause, Play, Square, ImagePlus, FlaskConical, Users } from "lucide-react";

const AUD_LABEL: Record<string, string> = { mufhem: "المفهمين", mustafhem: "المستفهمين", all: "الجميع" };
const ST_LABEL: Record<string, string> = { draft: "مسودة", running: "شغالة", paused: "موقوفة مؤقتًا", stopped: "متوقفة", done: "خلصت" };
const REASON: Record<string, string> = { manual: "إيقاف يدوي", daily_cap: "وصلت للحد اليومي", errors: "إيقاف تلقائي بسبب أخطاء متكررة" };

// تصغير الصورة قبل الرفع (أقصى عرض 1280 بكسل، JPEG) عشان الجسر ميحمّلش صور تقيلة
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("تعذر ضغط الصورة"))), "image/jpeg", 0.8));
  return new File([blob], "campaign.jpg", { type: "image/jpeg" });
}

export default function CampaignsTab() {
  const { storage, firestore } = useFirebase();
  const { toast } = useToast();
  const fn = (name: string) => httpsCallable(getFunctions(), name);

  const [name, setName] = useState("");
  const [audience, setAudience] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dailyCap, setDailyCap] = useState(100);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");

  const q = useMemoFirebase(() => (firestore ? query(collection(firestore, "whatsappCampaigns"), orderBy("createdAt", "desc"), limit(20)) : null), [firestore]);
  const { data: campaigns } = useCollection(q);

  const run = async (key: string, f: () => Promise<void>) => {
    setBusy(key);
    try { await f(); } catch (e: any) { toast({ variant: "destructive", title: "حصلت مشكلة", description: e?.message || "جرّب تاني" }); } finally { setBusy(""); }
  };

  const doPreview = () => run("prev", async () => {
    const r: any = await fn("previewCampaignAudience")({ audience, verifiedOnly });
    setPreview(r.data);
  });

  const pickImage = async (file: File) => {
    if (!storage) return toast({ variant: "destructive", title: "التخزين غير متاح" });
    try {
      const small = await shrink(file);
      setImageUrl(await uploadImageWithProgress(storage, "notifications/whatsapp", small, setProgress));
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل رفع الصورة", description: e?.message || "" });
    } finally { setProgress(null); }
  };

  const create = () => run("create", async () => {
    const r: any = await fn("createWhatsappCampaign")({ name, audience, verifiedOnly, text, link, imageUrl, dailyCap });
    toast({ title: "اتعملت مسودة الحملة", description: `${r.data.total} مستلم. ابعت تجربة لرقمك قبل البدء.` });
    setName(""); setText(""); setLink(""); setImageUrl(""); setPreview(null);
  });

  const test = (id: string) => run("test" + id, async () => {
    await fn("testWhatsappCampaign")({ id, phone: testPhone });
    toast({ title: "اتبعتت التجربة", description: "افتح واتساب على الرقم وتأكد إنها وصلت وشكلها تمام." });
  });

  const act = (id: string, action: string) => run(action + id, async () => {
    await fn("setWhatsappCampaignStatus")({ id, action });
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-amber-300 bg-amber-50/60">
        <CardContent className="p-4 text-sm font-bold leading-7 text-amber-900">
          تنبيه: الإرسال الجماعي على واتساب غير الرسمي هو أكبر سبب لحظر الرقم. الحملة بتتبعت واحدة واحدة بتأخير عشوائي (٢٥ إلى ٧٠ ثانية)، وراحة ٥ إلى ١٠ دقايق كل ١٠ رسايل، وحد يومي، ومفيش رسالة بتتبعت لأي رقم كتب «إيقاف». ابدأ بحملات صغيرة.
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">حملة جديدة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="اسم الحملة (للأدمن فقط)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <select value={audience} onChange={(e) => { setAudience(e.target.value); setPreview(null); }} className="h-10 rounded-md border px-3 font-bold bg-background">
              <option value="all">الجميع (مفهمين ومستفهمين)</option>
              <option value="mufhem">المفهمين فقط</option>
              <option value="mustafhem">المستفهمين فقط</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => { setVerifiedOnly(e.target.checked); setPreview(null); }} /> الأرقام الموثّقة فقط
            </label>
            <Button type="button" variant="outline" onClick={doPreview} disabled={busy === "prev"} className="gap-2">
              {busy === "prev" ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />} احسب عدد المستلمين
            </Button>
            {preview && <Badge className="h-8 px-3">{preview.count} مستلم (استبعاد: {preview.optedOut} إيقاف، {preview.withoutPhone} بدون رقم، {preview.invalid} رقم غير صالح)</Badge>}
          </div>
          <Textarea placeholder="نص الرسالة (بحد أقصى ٩٠٠ حرف). هيتضاف اسم المستلم تلقائيًا في الأول." value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={900} />
          <Input dir="ltr" placeholder="اللينك (اختياري) https://..." value={link} onChange={(e) => setLink(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 h-10 text-sm font-bold">
              <ImagePlus size={16} /> {imageUrl ? "تغيير الصورة" : "إضافة صورة"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
            </label>
            {progress !== null && <span className="text-sm font-bold">جارٍ الرفع {progress}%</span>}
            {imageUrl && <img src={imageUrl} alt="" className="h-16 rounded-md border" />}
            {imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>إزالة</Button>}
            <label className="flex items-center gap-2 text-sm font-bold">
              الحد اليومي
              <Input type="number" min={10} max={300} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} className="w-24" />
            </label>
          </div>
          <Button onClick={create} disabled={busy === "create" || !name.trim() || !text.trim()} className="gap-2 font-black">
            {busy === "create" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} حفظ كمسودة (مش هتتبعت لسه)
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">الحملات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input dir="ltr" placeholder="رقمك للتجربة، مثال 201208015262" value={testPhone} onChange={(e) => setTestPhone(e.target.value.replace(/[^\d+]/g, ""))} className="max-w-sm" />
          {(campaigns || []).length === 0 && <p className="text-sm text-muted-foreground font-bold">لسه مفيش حملات.</p>}
          {(campaigns || []).map((c: any) => (
            <div key={c.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">{c.name} <span className="text-xs font-bold text-muted-foreground">({AUD_LABEL[c.audience] || c.audience})</span></div>
                <Badge className={c.status === "running" ? "bg-emerald-600" : c.status === "paused" ? "bg-amber-600" : ""}>{ST_LABEL[c.status] || c.status}</Badge>
              </div>
              <div className="text-sm font-bold">
                اتبعت {c.sent || 0} من {c.total || 0} · فشل {c.failed || 0} · اتخطى {c.skipped || 0}
                {c.pausedReason ? ` · ${REASON[c.pausedReason] || c.pausedReason}` : ""}
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{c.text}</div>
              <div className="flex flex-wrap gap-2">
                {["draft", "paused"].includes(c.status) && (
                  <Button size="sm" variant="outline" disabled={!testPhone || busy === "test" + c.id} onClick={() => test(c.id)} className="gap-1">
                    <FlaskConical size={14} /> ابعت تجربة لرقمي
                  </Button>
                )}
                {["draft", "paused"].includes(c.status) && (
                  <Button size="sm" disabled={!c.testSentAt || busy === "start" + c.id} onClick={() => act(c.id, "start")} className="gap-1">
                    <Play size={14} /> {c.status === "paused" ? "استكمال" : "ابدأ الحملة"}
                  </Button>
                )}
                {c.status === "running" && (
                  <Button size="sm" variant="outline" onClick={() => act(c.id, "pause")} className="gap-1"><Pause size={14} /> إيقاف مؤقت</Button>
                )}
                {["running", "paused", "draft"].includes(c.status) && (
                  <Button size="sm" variant="destructive" onClick={() => act(c.id, "stop")} className="gap-1"><Square size={14} /> إلغاء نهائي</Button>
                )}
              </div>
              {["draft", "paused"].includes(c.status) && !c.testSentAt && <p className="text-xs font-bold text-amber-700">لازم تبعت تجربة لرقمك قبل ما تبدأ.</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
