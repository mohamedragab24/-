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
import { uploadWaImage } from "./wa-upload";
import { fileToText } from "./extract-numbers";
import { Loader2, Send, Pause, Play, Square, ImagePlus, FlaskConical, Users } from "lucide-react";

const CC_LIST = [
  { cc: "20", name: "مصر", flag: "🇪🇬" }, { cc: "966", name: "السعودية", flag: "🇸🇦" }, { cc: "971", name: "الإمارات", flag: "🇦🇪" },
  { cc: "965", name: "الكويت", flag: "🇰🇼" }, { cc: "974", name: "قطر", flag: "🇶🇦" }, { cc: "973", name: "البحرين", flag: "🇧🇭" },
  { cc: "968", name: "عُمان", flag: "🇴🇲" }, { cc: "962", name: "الأردن", flag: "🇯🇴" }, { cc: "961", name: "لبنان", flag: "🇱🇧" },
  { cc: "964", name: "العراق", flag: "🇮🇶" }, { cc: "963", name: "سوريا", flag: "🇸🇾" }, { cc: "212", name: "المغرب", flag: "🇲🇦" },
  { cc: "213", name: "الجزائر", flag: "🇩🇿" }, { cc: "216", name: "تونس", flag: "🇹🇳" }, { cc: "218", name: "ليبيا", flag: "🇱🇾" },
  { cc: "249", name: "السودان", flag: "🇸🇩" }, { cc: "967", name: "اليمن", flag: "🇾🇪" }, { cc: "90", name: "تركيا", flag: "🇹🇷" },
  { cc: "44", name: "بريطانيا", flag: "🇬🇧" }, { cc: "1", name: "أمريكا/كندا", flag: "🇺🇸" }, { cc: "49", name: "ألمانيا", flag: "🇩🇪" },
];

const AUD_LABEL: Record<string, string> = { mufhem: "المفهمين", mustafhem: "المستفهمين", all: "الجميع", custom: "أرقام مخصصة" };
const ST_LABEL: Record<string, string> = { draft: "مسودة", running: "شغالة", paused: "موقوفة مؤقتًا", stopped: "متوقفة", done: "خلصت" };
const REASON: Record<string, string> = { manual: "إيقاف يدوي", daily_cap: "وصلت للحد اليومي", errors: "إيقاف تلقائي بسبب أخطاء متكررة" };

const REASON_AR: Record<string, string> = {
  opted_out: "كتب «إيقاف»", not_on_whatsapp: "مش على واتساب", image_unavailable: "الصورة مش متاحة", expired: "انتهت المهلة",
};

/** تفاصيل الحملة: قوائم الأرقام مع نسخ وتصدير */
function CampaignDetails({ id }: { id: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"sent" | "failed" | "pending" | "skipped">("sent");
  const load = async () => {
    setLoading(true);
    try {
      const r: any = await httpsCallable(getFunctions(), "listCampaignRecipients")({ id });
      setData(r.data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر تحميل القوائم", description: e?.message || "" });
    } finally { setLoading(false); }
  };
  const TABS: [typeof tab, string][] = [["sent", "اتبعتلهم"], ["failed", "فشلوا"], ["pending", "لسه"], ["skipped", "اتخطوا"]];
  const rows: any[] = data ? data[tab] || [] : [];
  const reasonOf = (r: any) => (r.reason ? REASON_AR[r.reason] || r.reason : "");
  const lines = rows.map((r) => "+" + r.waId + (reasonOf(r) ? "," + reasonOf(r) : ""));
  const copy = async () => {
    try { await navigator.clipboard.writeText(rows.map((r) => "+" + r.waId).join("\n")); toast({ title: `اتنسخ ${rows.length} رقم` }); }
    catch { toast({ variant: "destructive", title: "تعذر النسخ" }); }
  };
  const download = () => {
    const blob = new Blob(["\ufeffnumber,reason\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `campaign-${id}-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rounded-lg border bg-muted/30 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "جارٍ التحميل..." : data ? "تحديث" : "عرض القوائم"}</Button>
        {data && TABS.map(([k, label]) => (
          <Button key={k} type="button" size="sm" variant={tab === k ? "default" : "ghost"} onClick={() => setTab(k)}>{label} ({(data[k] || []).length})</Button>
        ))}
      </div>
      {data && (
        <>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!rows.length} onClick={copy}>نسخ الأرقام</Button>
            <Button type="button" size="sm" variant="outline" disabled={!rows.length} onClick={download}>تنزيل CSV</Button>
          </div>
          {rows.length === 0 ? <p className="text-xs text-muted-foreground font-bold">مفيش أرقام في القائمة دي.</p> : (
            <ul className="max-h-56 overflow-auto text-xs space-y-1" dir="ltr">
              {rows.map((r, i) => (
                <li key={i} className="font-mono">+{r.waId}{r.name ? ` (${r.name})` : ""}{reasonOf(r) && <span className="font-sans text-red-600" dir="rtl"> — {reasonOf(r)}</span>}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function CampaignsTab() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const fn = (name: string) => httpsCallable(getFunctions(), name);

  const [name, setName] = useState("");
  const [audience, setAudience] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dailyCap, setDailyCap] = useState(100);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [defaultCc, setDefaultCc] = useState("20");
  const isCustom = audience === "custom";

  const [manCc, setManCc] = useState("20");
  const [manNum, setManNum] = useState("");
  const addManual = () => {
    const local = manNum.replace(/\D/g, "").replace(/^0+/, "");
    if (local.length < 6) return toast({ variant: "destructive", title: "اكتب الرقم المحلي" });
    // لو كتب الرقم بكود الدولة بالفعل (مثلا 201012345678) منكررش الكود
    const full = manNum.trim().startsWith("+") || manNum.trim().startsWith("00") ? manNum.trim() : local.startsWith(manCc) && local.length > 10 ? "+" + local : "+" + manCc + local;
    setNumbersText((old) => (old ? old + "\n" : "") + full);
    setManNum(""); setPreview(null);
  };

  const importFile = async (file: File) => {
    try {
      const t = await fileToText(file);
      setNumbersText((old) => (old ? old + "\n" : "") + t);
      setPreview(null);
      toast({ title: "اتقرا الملف", description: "اضغط «احسب عدد المستلمين» عشان تشوف الصالح والمرفوض." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر قراءة الملف", description: e?.message || "جرّب لصق الأرقام يدويًا." });
    }
  };

  const q = useMemoFirebase(() => (firestore ? query(collection(firestore, "whatsappCampaigns"), orderBy("createdAt", "desc"), limit(20)) : null), [firestore]);
  const { data: campaigns } = useCollection(q);

  const run = async (key: string, f: () => Promise<void>) => {
    setBusy(key);
    try { await f(); } catch (e: any) { toast({ variant: "destructive", title: "حصلت مشكلة", description: e?.message || "جرّب تاني" }); } finally { setBusy(""); }
  };

  const doPreview = () => run("prev", async () => {
    const r: any = await fn("previewCampaignAudience")({ audience, verifiedOnly, numbersText, defaultCc });
    setPreview(r.data);
  });

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      setImageUrl(await uploadWaImage(file));
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل رفع الصورة", description: e?.message || "" });
    } finally { setUploading(false); }
  };

  const create = () => run("create", async () => {
    const r: any = await fn("createWhatsappCampaign")({ name, audience, verifiedOnly, text, link, imageUrl, dailyCap, numbersText, defaultCc });
    toast({ title: "اتعملت مسودة الحملة", description: `${r.data.total} مستلم. ابعت تجربة لرقمك قبل البدء.` });
    setName(""); setText(""); setLink(""); setImageUrl(""); setPreview(null); setNumbersText("");
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
              <option value="custom">أرقام مخصصة (لصق أو ملف)</option>
            </select>
            {!isCustom && <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => { setVerifiedOnly(e.target.checked); setPreview(null); }} /> الأرقام الموثّقة فقط
            </label>}
            <Button type="button" variant="outline" onClick={doPreview} disabled={busy === "prev"} className="gap-2">
              {busy === "prev" ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />} احسب عدد المستلمين
            </Button>
            {preview && <Badge className="h-8 px-3">{preview.count} مستلم صالح (استبعاد: {preview.optedOut} إيقاف{isCustom ? `، ${preview.duplicates || 0} مكرر، ${preview.invalid} مرفوض` : `، ${preview.withoutPhone} بدون رقم، ${preview.invalid} رقم غير صالح`})</Badge>}
          </div>
          {isCustom && (
            <div className="rounded-xl border-2 border-dashed p-3 space-y-2">
              <Textarea dir="ltr" rows={6} value={numbersText} onChange={(e) => { setNumbersText(e.target.value); setPreview(null); }}
                placeholder={"الصق الأرقام هنا (رقم في كل سطر أو بفاصلة). مثال:\n01012345678\n+20 100 123 4567\n+966 50 123 4567"} className="font-mono text-sm" />
              <div className="flex flex-wrap items-center gap-2" dir="ltr">
                <select value={manCc} onChange={(e) => setManCc(e.target.value)} className="h-9 rounded-md border px-2 bg-background text-sm">
                  {CC_LIST.map((c) => <option key={c.cc} value={c.cc}>{c.flag} +{c.cc} {c.name}</option>)}
                </select>
                <Input dir="ltr" value={manNum} onChange={(e) => setManNum(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
                  placeholder="الرقم المحلي أو كامل" className="h-9 w-48" />
                <Button type="button" size="sm" variant="outline" onClick={addManual}>+ إضافة رقم</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 h-9 text-xs font-bold bg-white">
                  رفع ملف (txt / csv / xlsx / pdf)
                  <input type="file" accept=".txt,.csv,.tsv,.xlsx,.pdf,text/plain,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  كود الدولة الافتراضي
                  <select value={defaultCc} onChange={(e) => { setDefaultCc(e.target.value); setPreview(null); }} className="h-9 rounded-md border px-2 bg-background">
                    <option value="20">مصر (+20)</option>
                    <option value="966">السعودية (+966)</option>
                    <option value="971">الإمارات (+971)</option>
                    <option value="965">الكويت (+965)</option>
                    <option value="974">قطر (+974)</option>
                    <option value="962">الأردن (+962)</option>
                  </select>
                </label>
                {numbersText && <Button type="button" variant="ghost" size="sm" onClick={() => { setNumbersText(""); setPreview(null); }}>مسح</Button>}
              </div>
              <p className="text-[11px] text-muted-foreground leading-5">
                بنشيل المسافات والرموز، والصفر الأول بيتبدل بكود الدولة الافتراضي، والأرقام اللي بتبدأ بـ + أو 00 بتفضل بكودها. بنشيل المكرر وغير الصالح (الأرقام المصرية لازم موبايل). ملفات PDF الممسوحة كصورة أو بخطوط مشفرة ممكن ما يطلعش منها أرقام، ساعتها الصقها يدويًا. اضغط «احسب عدد المستلمين» وراجع الصالح والمرفوض قبل الحفظ.
              </p>
              {preview?.optedOutList?.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-bold space-y-1">
                  <div>الأرقام دي في قائمة الإيقاف (كتبوا «إيقاف» قبل كده) ومش هتتبعتلهم:</div>
                  <div className="font-mono" dir="ltr">{preview.optedOutList.map((w: string) => "+" + w).join("  ")}</div>
                  <Button type="button" size="sm" variant="outline" disabled={busy === "unopt"} onClick={() => run("unopt", async () => {
                    await fn("removeFromWhatsappOptOut")({ waIds: preview.optedOutList });
                    toast({ title: "اتشالت من قائمة الإيقاف", description: "اضغط «احسب عدد المستلمين» تاني." });
                    setPreview(null);
                  })}>إزالة من قائمة الإيقاف (لو دي أرقام تجربة أو الشخص طلب يرجع)</Button>
                </div>
              )}
              {preview?.rejected?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-bold">المرفوض ({preview.invalid})</summary>
                  <ul className="mt-1 space-y-1 max-h-40 overflow-auto" dir="ltr">
                    {preview.rejected.map((r: any, i: number) => <li key={i} className="font-mono">{r.raw} <span className="font-sans text-red-600" dir="rtl">— {r.reason}</span></li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          <Textarea placeholder="نص الرسالة (بحد أقصى ٩٠٠ حرف). هيتضاف اسم المستلم تلقائيًا في الأول." value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={900} />
          <Input dir="ltr" placeholder="اللينك (اختياري) https://..." value={link} onChange={(e) => setLink(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 h-10 text-sm font-bold">
              <ImagePlus size={16} /> {imageUrl ? "تغيير الصورة" : "إضافة صورة"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
            </label>
            {uploading && <span className="text-sm font-bold">جارٍ الرفع...</span>}
            {imageUrl && <img src={imageUrl} alt="" className="h-16 rounded-md border" />}
            {imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>إزالة</Button>}
            <label className="flex items-center gap-2 text-sm font-bold">
              الحد اليومي
              <Input type="number" min={10} max={300} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} className="w-24" />
            </label>
          </div>
          <Button onClick={create} disabled={busy === "create" || !name.trim() || !text.trim() || (isCustom && !numbersText.trim())} className="gap-2 font-black">
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
                اتبعت {c.sent || 0} من {c.total || 0} · فشل {c.failed || 0} · اتخطى {c.skipped || 0}{c.skippedOptOut || c.skippedNoWa ? ` (${c.skippedOptOut || 0} إيقاف، ${c.skippedNoWa || 0} مش على واتساب)` : ""}
                {c.pausedReason ? ` · ${REASON[c.pausedReason] || c.pausedReason}` : ""}
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{c.text}</div>
              <CampaignDetails id={c.id} />
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
