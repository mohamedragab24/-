"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import CampaignsTab from "./campaigns-tab";
import {
  MessageCircle, Send, Search, Bot, UserRound, Loader2, Copy, CheckCircle2,
  Phone, Clock, Settings2, BookOpen, RefreshCw, ExternalLink, Plus, Trash2, ShieldAlert,
} from "lucide-react";

/**
 * بوت واتساب — إدارة محادثات الطلبة والمفهمين على واتساب.
 * المصدر: whatsappConversations (يكتبها webhook ميتا على السيرفر)
 * الإرسال: /api/whatsapp/send (يتحقق من صلاحية الأدمن على السيرفر)
 */

const ENV_VARS = [
  { key: "WHATSAPP_ACCESS_TOKEN", label: "توكن الوصول الدائم (System User Token)", note: "من Meta App → WhatsApp → API Setup، وخليه Permanent من Business Settings." },
  { key: "WHATSAPP_PHONE_NUMBER_ID", label: "معرّف رقم الواتساب (Phone number ID)", note: "رقم طويل بيظهر في API Setup جنب الرقم، مش رقم التليفون نفسه." },
  { key: "WHATSAPP_BUSINESS_ACCOUNT_ID", label: "معرّف حساب واتساب للأعمال (WABA ID)", note: "مطلوب لتفعيل الاشتراك في الـ webhook." },
  { key: "WHATSAPP_VERIFY_TOKEN", label: "كلمة تحقق الـ webhook (أي نص تختاره)", note: "هتكتبها بنفسك في ميتا وفي Vercel. بتفتح بيها /api/whatsapp/setup." },
  { key: "WHATSAPP_APP_SECRET", label: "App Secret", note: "من Meta App → Settings → Basic. بيتحقق من توقيع كل رسالة واردة." },
];

const DEFAULT_TEXTS: Record<string, string> = {
  welcome: "أهلاً بيك في فهمت 👋\nأنا المساعد الآلي، أقدر أساعدك في الكورسات، حجز محاضرة مع مُفَهِّم، الدفع والمحفظة، والمشاكل التقنية.",
  courses: "",
  booking: "",
  payment: "",
  session: "",
  account: "",
  fallback: "",
  handoff: "",
};

const TEXT_LABELS: Record<string, string> = {
  welcome: "رسالة الترحيب",
  courses: "رد الكورسات والأسعار",
  booking: "رد حجز المحاضرات",
  payment: "رد الدفع والمحفظة",
  session: "رد مشاكل المحاضرات",
  account: "رد الحساب",
  fallback: "رد لما البوت ميفهمش",
  handoff: "رد التحويل لموظف",
};

function millis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "string") return new Date(ts).getTime();
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function timeAgo(ms: number) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-lg gap-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
      {done ? "تم" : "نسخ"}
    </Button>
  );
}

export default function AdminWhatsApp() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [tab, setTab] = useState("chats");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "human" | "bot">("all");
  const [setupKey, setSetupKey] = useState("");
  const [setupResult, setSetupResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpResult, setOtpResult] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const convQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "whatsappConversations"), orderBy("lastMessageAt", "desc"), limit(150)) : null),
    [firestore]
  );
  const { data: conversations, isLoading } = useCollection(convQuery);

  const msgsQuery = useMemoFirebase(
    () =>
      firestore && selectedId
        ? query(collection(firestore, "whatsappConversations", selectedId, "messages"), orderBy("createdAt", "asc"), limit(300))
        : null,
    [firestore, selectedId]
  );
  const { data: messages } = useCollection(msgsQuery);

  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, "settings", "whatsappBot") : null),
    [firestore]
  );
  const { data: settings } = useDoc(settingsRef);

  const [texts, setTexts] = useState<Record<string, string>>(DEFAULT_TEXTS);
  const [faqs, setFaqs] = useState<{ id: string; question: string; answers: string[] }[]>([]);
  const [keywords, setKeywords] = useState("");
  const [botOn, setBotOn] = useState(true);
  const [requireOtpOnSignup, setRequireOtpOnSignup] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTexts({ ...DEFAULT_TEXTS, ...((settings as any).texts || {}) });
    const rawFaqs = Array.isArray((settings as any).faqs) ? (settings as any).faqs : [];
    setFaqs(
      rawFaqs.map((f: any, idx: number) => ({
        id: String(f?.id || `faq_${idx}_${Date.now()}`),
        question: String(f?.question || ""),
        answers: Array.isArray(f?.answers) && f.answers.length
          ? f.answers.map((a: any) => String(a))
          : f?.answer ? [String(f.answer)] : [""],
      }))
    );
    setKeywords(Array.isArray((settings as any).handoffKeywords) ? (settings as any).handoffKeywords.join(", ") : "");
    setBotOn((settings as any).enabled !== false);
    setRequireOtpOnSignup((settings as any).requireOtpOnSignup === true);
  }, [settings]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, selectedId]);

  const selected = useMemo(
    () => (conversations || []).find((c: any) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const rows = useMemo(() => {
    const list = (conversations || []) as any[];
    return list.filter((c) => {
      if (filter === "human" && c.status !== "human") return false;
      if (filter === "bot" && c.status === "human") return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return String(c.name || "").toLowerCase().includes(q) || String(c.waId || "").includes(q) || String(c.lastMessage || "").toLowerCase().includes(q);
    });
  }, [conversations, filter, search]);

  const stats = useMemo(() => {
    const list = (conversations || []) as any[];
    return {
      total: list.length,
      human: list.filter((c) => c.status === "human").length,
      today: list.filter((c) => millis(c.lastInboundAt) > Date.now() - 86400000).length,
    };
  }, [conversations]);

  const token = async () => (user ? user.getIdToken() : null);

  const handleSend = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      const idToken = await token();
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ waId: selectedId, text: reply }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "لم يتم الإرسال", description: json?.message || json?.error || "خطأ غير معروف" });
        return;
      }
      setReply("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "لم يتم الإرسال", description: String(e?.message || e) });
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async (waId: string, enable: boolean) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "whatsappConversations", waId), {
      botEnabled: enable,
      status: enable ? "bot" : "human",
      handoff: !enable,
      unread: 0,
    });
    toast({ title: enable ? "البوت شغال في المحادثة" : "البوت متوقف — الرد يدوي" });
  };

  const saveSettings = async () => {
    if (!firestore) return;
    setSavingSettings(true);
    try {
      await setDoc(
        doc(firestore, "settings", "whatsappBot"),
        {
          enabled: botOn,
          requireOtpOnSignup,
          texts,
          faqs: faqs
            .filter((f) => f.question.trim())
            .map((f) => ({
              id: f.id,
              question: f.question.trim(),
              answers: (f.answers || []).map((a) => a.trim()).filter(Boolean),
            })),
          handoffKeywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || null,
        },
        { merge: true }
      );
      toast({ title: "تم حفظ إعدادات البوت" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل الحفظ", description: String(e?.message || e) });
    } finally {
      setSavingSettings(false);
    }
  };

  const runSetupCheck = async () => {
    if (!setupKey.trim()) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/whatsapp/setup?key=${encodeURIComponent(setupKey.trim())}&subscribe=1`);
      const json = await res.json();
      setSetupResult(json);
    } catch (e: any) {
      setSetupResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setChecking(false);
    }
  };

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "https://fahemt.online/api/whatsapp/webhook";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <MessageCircle className="text-emerald-600" /> بوت واتساب
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            الطلبة والمفهمين يكتبوا على واتساب المنصة، والبوت يرد على الأسئلة الشائعة ويحوّللك المحادثة لما يحتاج موظف.
          </p>
        </div>
        <div className="flex gap-3">
          <Badge className="bg-emerald-600 h-8 px-3">محادثات: {stats.total}</Badge>
          <Badge className="bg-orange-500 h-8 px-3">تحتاج موظف: {stats.human}</Badge>
          <Badge className="bg-blue-600 h-8 px-3">آخر ٢٤ ساعة: {stats.today}</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="chats" className="gap-2"><MessageCircle size={16} /> المحادثات</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings2 size={16} /> إعدادات البوت</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Send size={16} /> الحملات</TabsTrigger>
          <TabsTrigger value="otp" className="gap-2"><ShieldAlert size={16} /> كود التحقق OTP</TabsTrigger>
          <TabsTrigger value="setup" className="gap-2"><BookOpen size={16} /> طريقة الربط</TabsTrigger>
        </TabsList>

        {/* ================= المحادثات ================= */}
        <TabsContent value="chats" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <Card className="rounded-2xl overflow-hidden">
              <div className="p-3 border-b space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-3 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم" className="pr-9 rounded-xl" />
                </div>
                <div className="flex gap-2">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "human", label: "تحتاج موظف" },
                    { id: "bot", label: "البوت" },
                  ].map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={filter === (f.id as any) ? "default" : "outline"}
                      className="rounded-lg text-xs"
                      onClick={() => setFilter(f.id as any)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              <ScrollArea className="h-[560px]">
                {isLoading && <div className="p-6 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div>}
                {!isLoading && !rows.length && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    مفيش محادثات لسه. أول ما حد يبعت رسالة على رقم واتساب المنصة هتظهر هنا.
                  </div>
                )}
                {rows.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-right p-3 border-b hover:bg-zinc-50 transition ${selectedId === c.id ? "bg-emerald-50/70" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">{c.name || c.waId}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(millis(c.lastMessageAt))}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-muted-foreground truncate">{c.lastMessage || "—"}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.channel === "web" && (
                          <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700">واتساب غير رسمي</Badge>
                        )}
                        {c.status === "human" && <Badge className="bg-orange-500 text-[9px] h-4">موظف</Badge>}
                        {Number(c.unread || 0) > 0 && <Badge className="bg-red-500 text-[9px] h-4">{c.unread}</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </Card>

            <Card className="rounded-2xl flex flex-col overflow-hidden">
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center gap-3">
                  <MessageCircle size={48} className="opacity-30" />
                  <p className="font-bold">اختار محادثة من القائمة</p>
                  <p className="text-xs">هتشوف كل الرسائل وتقدر ترد أو تسلّم البوت تاني.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-black flex items-center gap-2">
                        {selected.name || selected.waId}
                        {selected.userUid ? <Badge className="bg-blue-600 text-[10px]">حساب منصة</Badge> : <Badge variant="outline" className="text-[10px]">رقم غير مسجّل</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1" dir="ltr">
                        <span className="flex items-center gap-1"><Phone size={12} /> +{selected.waId}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(millis(selected.lastInboundAt))}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold">{selected.botEnabled === false ? "الرد يدوي" : "البوت شغال"}</span>
                      <Switch
                        checked={selected.botEnabled !== false}
                        onCheckedChange={(v) => toggleBot(selected.id, v)}
                      />
                    </div>
                  </div>

                  <ScrollArea className="flex-1 h-[430px] p-4 bg-zinc-50">
                    <div className="space-y-2 p-2">
                      {(messages || []).map((m: any) => {
                        const out = m.direction === "out";
                        return (
                          <div key={m.id} className={`flex ${out ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${out ? "bg-emerald-600 text-white" : "bg-white border"}`}>
                              {m.text || `[${m.type}]`}
                              <div className={`text-[10px] mt-1 flex items-center gap-2 ${out ? "text-emerald-100" : "text-muted-foreground"}`}>
                                {out && (m.by === "human" ? <UserRound size={10} /> : <Bot size={10} />)}
                                <span>{m.by === "human" ? "موظف" : out ? "بوت" : "العميل"}</span>
                                <span>{new Date(millis(m.createdAt) || Date.now()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                                {out && m.status && <span>· {m.status === "read" ? "تم القراءة" : m.status === "delivered" ? "تم التسليم" : m.status === "failed" ? "فشل" : "تم الإرسال"}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t bg-white space-y-2">
                    <div className="flex gap-2">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="اكتب ردك للعميل... (لو عدّت ٢٤ ساعة من آخر رسالة له، ميتا مش هتسمح بالإرسال)"
                        className="rounded-xl min-h-[64px]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
                        }}
                      />
                      <Button onClick={handleSend} disabled={sending || !reply.trim()} className="rounded-xl h-auto px-6 gap-2">
                        {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} إرسال
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Ctrl + Enter للإرسال. الردود من هنا بتتسجل باسمك في إشعارات الأدمن.</p>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ================= إعدادات البوت ================= */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black">تشغيل البوت</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{botOn ? "شغال لكل المحادثات" : "متوقف"}</span>
                <Switch checked={botOn} onCheckedChange={setBotOn} />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              لو قفلته، الرسائل الجديدة هتتسجل وتظهر هنا بس مش هتترد عليها تلقائيًا.
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black">تأكيد الموبايل بكود واتساب عند التسجيل</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">لما يتفعّل، صفحة التسجيل مش هتسمح بإكمال الحساب غير بعد ما الرقم يتأكد بكود واتساب.</p>
              </div>
              <Switch checked={requireOtpOnSignup} onCheckedChange={setRequireOtpOnSignup} />
            </CardHeader>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg font-black">نصوص الردود</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(TEXT_LABELS).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold">{TEXT_LABELS[key]}</label>
                  <Textarea
                    value={texts[key] ?? ""}
                    onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
                    placeholder="سيبه فاضي لاستخدام النص الافتراضي"
                    className="rounded-xl min-h-[90px] text-sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-black">أسئلة وأجوبة البوت</CardTitle>
              <p className="text-xs text-muted-foreground">كل سؤال تقدر تحطله أكتر من رد، والبوت يختار واحد منهم عشوائي كل مرة عشان الكلام ميبقاش مكرر.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {faqs.map((f, i) => (
                <div key={f.id} className="border-2 rounded-2xl p-3 space-y-2 bg-white">
                  <div className="flex gap-2 items-center">
                    <Input
                      value={f.question}
                      onChange={(e) => setFaqs((list) => list.map((x, idx) => (idx === i ? { ...x, question: e.target.value } : x)))}
                      placeholder="السؤال أو كلمات البحث (مثال: بكام الكورس)"
                      className="rounded-lg font-bold"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title="حذف السؤال"
                      onClick={() => setFaqs((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(f.answers || []).map((answer, ai) => (
                      <div key={ai} className="flex gap-2 items-start">
                        <span className="text-[10px] font-black text-muted-foreground mt-4 w-10 shrink-0">رد {ai + 1}</span>
                        <Textarea
                          value={answer}
                          onChange={(e) =>
                            setFaqs((list) =>
                              list.map((x, idx) =>
                                idx === i ? { ...x, answers: x.answers.map((a, j) => (j === ai ? e.target.value : a)) } : x
                              )
                            )
                          }
                          placeholder="نص الرد"
                          className="rounded-lg min-h-[60px] text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          title="حذف الرد"
                          disabled={(f.answers || []).length <= 1}
                          onClick={() =>
                            setFaqs((list) =>
                              list.map((x, idx) => (idx === i ? { ...x, answers: x.answers.filter((_, j) => j !== ai) } : x))
                            )
                          }
                        >
                          <Trash2 size={14} className="text-zinc-400" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1"
                      onClick={() =>
                        setFaqs((list) => list.map((x, idx) => (idx === i ? { ...x, answers: [...(x.answers || []), ""] } : x)))
                      }
                    >
                      <Plus size={14} /> إضافة رد آخر
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={() => setFaqs((l) => [...l, { id: `faq_${Date.now()}`, question: "", answers: [""] }])}
              >
                <Plus size={16} /> إضافة سؤال جديد
              </Button>
              <p className="text-xs text-muted-foreground">
                المطابقة بالكلمات المفتاحية: لو رسالة العميل فيها كلمة من السؤال (٣ حروف أو أكتر) البوت يرد بأحد الردود.
                لو مفيش تطابق بيرد بالردود الجاهزة (الكورسات، الحجز، الدفع...).
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg font-black">كلمات التحويل لموظف</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="مثال: موظف, شكوى, مسؤول" className="rounded-xl" />
              <p className="text-xs text-muted-foreground">مفصولة بفاصلة. أي رسالة فيها واحدة منها = تحويل فوري لموظف مع إشعار في لوحة الأدمن.</p>
            </CardContent>
          </Card>

          <Button onClick={saveSettings} disabled={savingSettings} className="rounded-xl gap-2">
            {savingSettings ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} حفظ الإعدادات
          </Button>
        </TabsContent>

        {/* ================= طريقة الربط ================= */}
        <TabsContent value="setup" className="mt-4 space-y-4">
          <Card className="rounded-2xl border-emerald-200 bg-emerald-50/40">
            <CardHeader><CardTitle className="text-lg font-black flex items-center gap-2"><ShieldAlert size={18} /> لازم تعمل الخطوات دي مرة واحدة على ميتا</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-7">
              <p>1) ادخل <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">Meta for Developers <ExternalLink size={12} /></a> واعمل App نوعه Business.</p>
              <p>2) من صفحة التطبيق: Add Product → WhatsApp → اضبط رقم واتساب مخصص للمنصة (مش رقمك الشخصي).</p>
              <p>3) من WhatsApp → API Setup خد: Phone number ID و WhatsApp Business Account ID، واعمل System User Token دائم.</p>
              <p>4) ضيف المتغيرات دي في Vercel (Settings → Environment Variables) وأعد النشر:</p>
              <div className="space-y-2">
                {ENV_VARS.map((v) => (
                  <div key={v.key} className="flex items-center justify-between gap-2 bg-white border rounded-xl px-3 py-2">
                    <div>
                      <div className="font-mono text-xs font-bold" dir="ltr">{v.key}</div>
                      <div className="text-[11px] text-muted-foreground">{v.label} — {v.note}</div>
                    </div>
                    <CopyBtn value={v.key} />
                  </div>
                ))}
              </div>
              <p>5) في WhatsApp → Configuration → Webhook: حط الرابط ده وكلمة التحقق اللي اخترتها:</p>
              <div className="flex items-center justify-between gap-2 bg-white border rounded-xl px-3 py-2" dir="ltr">
                <code className="text-xs break-all">{webhookUrl}</code>
                <CopyBtn value={webhookUrl} />
              </div>
              <p>6) اشترك في الحقول: <span className="font-mono text-xs">messages</span> (وبعدها اضغط Subscribe للتطبيق على الـ WABA).</p>
              <p>7) بعد النشر، افحص الإعداد من هنا:</p>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  placeholder="الصق WHATSAPP_VERIFY_TOKEN هنا"
                  className="rounded-xl max-w-md"
                  dir="ltr"
                />
                <Button onClick={runSetupCheck} disabled={checking} className="rounded-xl gap-2">
                  {checking ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} فحص الإعداد
                </Button>
              </div>
              {setupResult && (
                <pre className="bg-zinc-900 text-emerald-300 text-[11px] rounded-xl p-3 overflow-auto max-h-72" dir="ltr">
                  {JSON.stringify(setupResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= كود التحقق OTP ================= */}
        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab />
        </TabsContent>

        <TabsContent value="otp" className="mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg font-black">إزاي بيشتغل كود التحقق</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm leading-7">
              <p>1) الموقع أو التطبيق يطلب كود للرقم، والسيرفر يولّد <b>6 أرقام</b> عشوائية (مش Math.random).</p>
              <p>2) السيرفر يخزّن <b>هاش</b> الكود بس في Firestore مع صلاحية <b>5 دقايق</b> وحد أقصى <b>5 محاولات</b>، وحد أقصى 5 إرسالات في الساعة للرقم.</p>
              <p>3) الكود بيتبعت على واتساب: <b>قالب معتمد</b> (بيشتغل في أي وقت) ولو القالب مش متاح بيرجع لرسالة نصية عادية.</p>
              <p>4) التحقق بيحصل على السيرفر بس، ومفيش أي رد بيرجّع الكود. بعد النجاح بيرجع <code className="text-xs">customToken</code> يسجّل بيه العميل دخول من غير SMS.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-blue-200 bg-blue-50/40">
            <CardHeader><CardTitle className="text-lg font-black">القالب المطلوب على ميتا</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border rounded-xl p-3">
                  <div className="text-[11px] text-muted-foreground">اسم القالب</div>
                  <div className="font-mono font-bold" dir="ltr">fahemt_otp</div>
                </div>
                <div className="bg-white border rounded-xl p-3">
                  <div className="text-[11px] text-muted-foreground">التصنيف</div>
                  <div className="font-bold">Utility (أو Authentication)</div>
                </div>
                <div className="bg-white border rounded-xl p-3">
                  <div className="text-[11px] text-muted-foreground">اللغة</div>
                  <div className="font-bold" dir="ltr">Arabic (ar)</div>
                </div>
              </div>
              <div className="bg-white border rounded-xl p-3 space-y-2">
                <div className="text-[11px] text-muted-foreground">{"نص الرسالة ({{1}} هو الكود)"}</div>
                <p className="font-bold leading-7">{"كود التحقق الخاص بك على منصة فهمت هو {{1}}. الكود صالح لمدة 5 دقائق ولا تشاركه مع أي شخص."}</p>
                <CopyBtn value="كود التحقق الخاص بك على منصة فهمت هو {{1}}. الكود صالح لمدة 5 دقائق ولا تشاركه مع أي شخص." />
              </div>
              <p className="text-xs text-muted-foreground">
                لو ميتا رفضت التصنيف Utility وحوّلته لـ Authentication، اعمل القالب تصنيف Authentication مع زر «نسخ الكود»،
                وحط <span className="font-mono">WHATSAPP_OTP_TEMPLATE_MODE=auth</span> في Vercel.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg font-black">إرسال كود تجريبي</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  value={otpPhone}
                  onChange={(e) => setOtpPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="rounded-xl max-w-xs"
                  dir="ltr"
                />
                <Button
                  className="rounded-xl gap-2"
                  disabled={otpBusy || !otpPhone.trim()}
                  onClick={async () => {
                    setOtpBusy(true);
                    setOtpResult(null);
                    try {
                      const fn = httpsCallable(getFunctions(), "sendWhatsappOtpTest");
                      const res = await fn({ phone: otpPhone.trim() });
                      setOtpResult(`تم الإرسال ✅ عبر: ${res?.data?.channel === "bridge" ? "واتساب (الجسر)" : res?.data?.channel === "template" ? "قالب معتمد" : "رسالة نصية"} — صالح ${res?.data?.expiresInSeconds || 300} ثانية`);
                    } catch (e: any) {
                      setOtpResult(`فشل: ${e?.message || e}`);
                    } finally {
                      setOtpBusy(false);
                    }
                  }}
                >
                  {otpBusy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} إرسال كود
                </Button>
              </div>
              {otpResult && <p className="text-sm font-bold">{otpResult}</p>}
              <p className="text-xs text-muted-foreground">
                لو OTP_TRANSPORT=bridge الكود بيتبعت من رقم الجسر (واتساب غير رسمي) ومش محتاج قالب ولا توكن ميتا. الجسر لازم يكون شغال (ready).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
