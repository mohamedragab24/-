"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { collection, doc, orderBy, query, where } from "firebase/firestore";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Video, FileText, ClipboardList, Radio, Users, Loader2, Trash2, Upload, Snowflake, Smartphone, ShieldCheck, Plus, UserMinus, Send, AlertTriangle, ArrowRight } from "lucide-react";
import { callGroupFn, fnErrorMessage, formatBytes, estimateWeeklyFee, uploadGroupFile, GROUP_MIN_PREPAID } from "@/lib/groups";

const AppOnlyNotice = ({ what }: { what: string }) => (
  <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 text-right">
    <Smartphone className="text-sky-600 shrink-0 mt-1" size={20} />
    <p className="text-sm font-bold text-sky-800">{what} تُفتح داخل تطبيق «فهمت» فقط، وهي محمية بعلامة مائية وبمنع تسجيل الشاشة والصوت.</p>
  </div>
);

type QDraft = { type: "mcq" | "essay"; text: string; options: string[]; correct: number; points: number };
const newQuestion = (): QDraft => ({ type: "mcq", text: "", options: ["", "", "", ""], correct: 0, points: 1 });

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const groupRef = useMemoFirebase(() => (firestore ? doc(firestore, "groups", id) : null), [firestore, id]);
  const { data: g, isLoading } = useDoc<any>(groupRef);
  const owner = !!user && g?.ownerUid === user.uid;
  const active = g?.status === "active";

  useEffect(() => { if (!isUserLoading && !user) router.push("/login"); }, [user, isUserLoading, router]);

  const col = (name: string) => (firestore && user && g && active ? query(collection(firestore, "groups", id, name), orderBy("order", "desc")) : null);
  const videosQ = useMemoFirebase(() => col("videos"), [firestore, user, id, active, !!g]);
  const filesQ = useMemoFirebase(() => col("files"), [firestore, user, id, active, !!g]);
  const quizzesQ = useMemoFirebase(() => col("quizzes"), [firestore, user, id, active, !!g]);
  const recQ = useMemoFirebase(() => col("recordings"), [firestore, user, id, active, !!g]);
  const sessQ = useMemoFirebase(() => (firestore && user && g && active ? query(collection(firestore, "groups", id, "sessions"), where("status", "==", "live")) : null), [firestore, user, id, active, !!g]);
  const membersQ = useMemoFirebase(() => (firestore && owner ? collection(firestore, "groups", id, "members") : null), [firestore, owner, id]);
  const invitesQ = useMemoFirebase(() => (firestore && owner && user ? query(collection(firestore, "groupInvites"), where("groupId", "==", id), where("ownerUid", "==", user.uid)) : null), [firestore, owner, user, id]);
  const { data: videos } = useCollection<any>(videosQ);
  const { data: files } = useCollection<any>(filesQ);
  const { data: quizzes } = useCollection<any>(quizzesQ);
  const { data: recordings } = useCollection<any>(recQ);
  const { data: liveSessions } = useCollection<any>(sessQ);
  const { data: members } = useCollection<any>(membersQ);
  const { data: invites } = useCollection<any>(invitesQ);

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [inviteId, setInviteId] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [record, setRecord] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<QDraft[]>([newQuestion()]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");

  const run = async (key: string, fn: () => Promise<void>, okTitle?: string) => {
    setBusy(key);
    try { await fn(); if (okTitle) toast({ title: okTitle }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر تنفيذ الطلب", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  const upload = (kind: "videos" | "files", file?: File | null) => {
    if (!file) return;
    if (!uploadTitle.trim()) { toast({ variant: "destructive", title: "اكتب عنوانًا للمحتوى أولًا" }); return; }
    if (kind === "files" && file.type !== "application/pdf") { toast({ variant: "destructive", title: "الملفات يجب أن تكون PDF" }); return; }
    run(`upload-${kind}`, async () => {
      setProgress(0);
      try {
        const up = await uploadGroupFile(file, id, kind, setProgress);
        await callGroupFn("registerGroupContent", { groupId: id, kind, title: uploadTitle.trim(), r2Key: up.key, size: up.size, contentType: up.contentType });
        setUploadTitle("");
      } finally { setProgress(null); if (videoInput.current) videoInput.current.value = ""; if (fileInput.current) fileInput.current.value = ""; }
    }, "تم رفع المحتوى");
  };

  const removeContent = (kind: string, cid: string) => {
    if (!confirm("حذف هذا المحتوى نهائيًا؟")) return;
    run(`del-${cid}`, async () => { await callGroupFn("deleteGroupContent", { groupId: id, kind, id: cid }); }, "تم الحذف");
  };

  const sendInvite = () => run("invite", async () => {
    const r = await callGroupFn<{ toName: string }>("sendGroupInvite", { groupId: id, publicId: inviteId.trim().toLowerCase() });
    toast({ title: "تم إرسال الدعوة", description: r.toName ? `إلى ${r.toName}` : undefined });
    setInviteId("");
  });

  const removeMember = (uid: string, name: string) => {
    if (!confirm(`حذف ${name || "الطالب"} من المجموعة؟`)) return;
    run(`rm-${uid}`, async () => { await callGroupFn("removeGroupMember", { groupId: id, uid }); }, "تم حذف الطالب");
  };

  const startSession = () => run("session", async () => {
    await callGroupFn("startGroupSession", { groupId: id, record, title: sessionTitle });
    setSessionOpen(false); setSessionTitle(""); setRecord(false);
  }, "بدأت الجلسة وتم إشعار الطلاب");

  const endSession = (sid: string) => run(`end-${sid}`, async () => { await callGroupFn("endGroupSession", { groupId: id, sessionId: sid }); }, "تم إنهاء الجلسة");

  const saveQuiz = () => run("quiz", async () => {
    await callGroupFn("createGroupQuiz", {
      groupId: id, title: quizTitle,
      questions: questions.map((q) => ({ type: q.type, text: q.text, points: q.points, ...(q.type === "mcq" ? { options: q.options.filter((o) => o.trim()), correct: q.correct } : {}) })),
    });
    setQuizOpen(false); setQuizTitle(""); setQuestions([newQuestion()]);
  }, "تم إنشاء الاختبار");

  const doDelete = () => run("delete-group", async () => {
    if (!user) return;
    const providers = user.providerData.map((p) => p.providerId);
    if (providers.includes("password") && user.email) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (providers.includes("google.com")) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
    await user.getIdToken(true);
    await callGroupFn("deleteGroup", { groupId: id, confirmName });
    toast({ title: "تم إنهاء المجموعة وحذفها" });
    router.push("/groups");
  });

  const weeklyEstimate = useMemo(() => estimateWeeklyFee(g?.storageBytes || 0, g?.memberCount || 0), [g?.storageBytes, g?.memberCount]);

  if (isUserLoading || isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!g) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center" dir="rtl">
      <ShieldCheck className="h-14 w-14 text-zinc-300" />
      <h2 className="text-2xl font-black">لا يمكنك الوصول لهذه المجموعة</h2>
      <p className="text-zinc-500 font-bold">قد تكون محذوفة أو لست عضوًا فيها.</p>
      <Button asChild className="rounded-xl font-black"><Link href="/groups">العودة للمجموعات</Link></Button>
    </div>
  );

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8 space-y-6 font-body" dir="rtl">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm font-black text-primary"><ArrowRight size={16} /> كل المجموعات</Link>

      <div className="border-r-8 border-primary pr-5 space-y-1">
        <h1 className="text-3xl md:text-4xl font-black">{g.name}</h1>
        {g.description && <p className="text-zinc-500 font-bold">{g.description}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="font-black">{g.memberCount || 0} طالب</Badge>
          <Badge variant="outline" className="font-black">{formatBytes(g.storageBytes || 0)}</Badge>
          {!owner && g.ownerName && <Badge variant="outline" className="font-black">المُفهم: {g.ownerName}</Badge>}
        </div>
      </div>

      {!active && (
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 text-right space-y-2">
          <p className="font-black text-red-700 flex items-center gap-2 justify-end"><Snowflake size={20} /> المجموعة مجمّدة</p>
          <p className="text-sm font-bold text-red-700">{owner ? "تم تجميد المجموعة لعدم سداد الرسوم. محتواها مخفي مؤقتًا عنك وعن الطلاب. ادفع الرسوم خلال 7 أيام من التجميد لاسترجاعها وإلا سيُحذف محتواها نهائيًا." : "هذه المجموعة متوقفة مؤقتًا."}</p>
          {owner && <Button asChild className="rounded-xl font-black bg-red-600 hover:bg-red-700"><Link href="/groups">سداد الرسوم</Link></Button>}
        </div>
      )}

      {owner && active && (
        <Card className="rounded-3xl border-2"><CardContent className="p-5 text-right space-y-1">
          <p className="font-black">رسوم هذه المجموعة (تظهر لك وللإدارة فقط)</p>
          <p className="text-sm text-zinc-600 font-bold">التقدير الحالي: <b>{weeklyEstimate} ج.م</b> أسبوعيًا (5 ج.م لكل جيجا + 10 ج.م لكل طالب، بمتوسط الأسبوع).</p>
          <p className="text-xs text-zinc-500 font-bold">لإضافة طلاب بعد رفع المحتوى يجب أن يكون رصيدك {GROUP_MIN_PREPAID} ج.م على الأقل.</p>
        </CardContent></Card>
      )}

      {active && (liveSessions || []).length > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-5 text-right space-y-2">
          {liveSessions!.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              {owner ? <Button size="sm" variant="outline" className="rounded-xl font-black" disabled={busy === `end-${s.id}`} onClick={() => endSession(s.id)}>إنهاء الجلسة</Button> : <span />}
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <a href={`fahmny://group/${id}/session/${s.id}`} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl px-4 h-10"><Smartphone size={16} /> دخول الاجتماع في التطبيق</a>
                <p className="font-black text-emerald-800 flex items-center gap-2"><Radio className="animate-pulse" size={18} /> جلسة مباشرة الآن: {s.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 rounded-2xl">
            <TabsTrigger value="videos" className="font-black gap-1"><Video size={14} /> الفيديوهات</TabsTrigger>
            <TabsTrigger value="files" className="font-black gap-1"><FileText size={14} /> ملفات PDF</TabsTrigger>
            <TabsTrigger value="quizzes" className="font-black gap-1"><ClipboardList size={14} /> الاختبارات</TabsTrigger>
            <TabsTrigger value="recordings" className="font-black gap-1"><Radio size={14} /> الجلسات المسجلة</TabsTrigger>
            {owner && <TabsTrigger value="members" className="font-black gap-1"><Users size={14} /> الطلاب</TabsTrigger>}
          </TabsList>

          {/* الفيديوهات */}
          <TabsContent value="videos" className="space-y-4 mt-4">
            <AppOnlyNotice what="الفيديوهات" />
            {owner ? (
              <UploadBox label="رفع فيديو" accept="video/*" title={uploadTitle} setTitle={setUploadTitle} inputRef={videoInput} busy={busy === "upload-videos"} progress={progress} onPick={(f) => upload("videos", f)} />
            ) : <p className="font-black text-zinc-600 text-right">عدد الفيديوهات: {videos?.length || 0}</p>}
            {owner && <ContentList items={videos} kind="videos" icon={<Video size={16} />} busy={busy} onDelete={removeContent} />}
          </TabsContent>

          {/* الملفات */}
          <TabsContent value="files" className="space-y-4 mt-4">
            <AppOnlyNotice what="ملفات PDF" />
            {owner ? (
              <UploadBox label="رفع ملف PDF" accept="application/pdf" title={uploadTitle} setTitle={setUploadTitle} inputRef={fileInput} busy={busy === "upload-files"} progress={progress} onPick={(f) => upload("files", f)} />
            ) : <p className="font-black text-zinc-600 text-right">عدد الملفات: {files?.length || 0}</p>}
            {owner && <ContentList items={files} kind="files" icon={<FileText size={16} />} busy={busy} onDelete={removeContent} />}
          </TabsContent>

          {/* الاختبارات */}
          <TabsContent value="quizzes" className="space-y-4 mt-4">
            <AppOnlyNotice what="الاختبارات" />
            {owner ? (
              <>
                <Button onClick={() => setQuizOpen(true)} className="rounded-xl font-black gap-2"><Plus size={16} /> اختبار جديد</Button>
                <p className="text-xs font-bold text-zinc-500">الأسئلة الاختيارية تُصحَّح تلقائيًا، والمقالية تظهر لك في التطبيق لمراجعتها وتصحيحها.</p>
                <ContentList items={quizzes} kind="quizzes" icon={<ClipboardList size={16} />} busy={busy} onDelete={removeContent} extra={(q: any) => `${q.questionCount} سؤال${q.hasEssay ? " (به مقالي)" : ""}`} />
              </>
            ) : <p className="font-black text-zinc-600 text-right">عدد الاختبارات: {quizzes?.length || 0}</p>}
          </TabsContent>

          {/* الجلسات */}
          <TabsContent value="recordings" className="space-y-4 mt-4">
            <AppOnlyNotice what="الجلسات المباشرة وتسجيلاتها" />
            {owner && <Button onClick={() => setSessionOpen(true)} className="rounded-xl font-black gap-2"><Radio size={16} /> بدء جلسة جديدة</Button>}
            {owner
              ? <ContentList items={recordings} kind="recordings" icon={<Radio size={16} />} busy={busy} onDelete={removeContent} extra={(r: any) => (r.status === "processing" ? "جارٍ المعالجة" : formatBytes(r.size))} />
              : <p className="font-black text-zinc-600 text-right">عدد الجلسات المسجلة: {recordings?.length || 0}</p>}
          </TabsContent>

          {/* الطلاب */}
          {owner && (
            <TabsContent value="members" className="space-y-5 mt-4">
              <Card className="rounded-3xl border-2"><CardContent className="p-5 space-y-3 text-right">
                <Label className="font-black">دعوة طالب بالرقم التعريفي</Label>
                <div className="flex gap-2">
                  <Button onClick={sendInvite} disabled={busy === "invite" || inviteId.trim().length !== 8} className="rounded-xl font-black gap-2">{busy === "invite" ? <Loader2 className="animate-spin" /> : <Send size={16} />} إرسال</Button>
                  <Input dir="ltr" value={inviteId} onChange={(e) => setInviteId(e.target.value.toLowerCase().replace(/[^0-9a-z]/g, "").slice(0, 8))} placeholder="مثال: k3f9a2xz" className="h-12 rounded-xl border-2 font-mono tracking-widest" />
                </div>
                <p className="text-xs font-bold text-zinc-500">الرقم التعريفي يظهر للطالب في صفحة «المجموعات». يمكنك إضافة أو حذف الطلاب في أي وقت.</p>
              </CardContent></Card>

              <h3 className="font-black text-right">الأعضاء ({members?.length || 0})</h3>
              {(members || []).map((m: any) => (
                <Card key={m.id} className="rounded-2xl"><CardContent className="p-4 flex items-center justify-between">
                  <Button size="sm" variant="outline" className="rounded-xl text-red-600 gap-1 font-black" disabled={busy === `rm-${m.id}`} onClick={() => removeMember(m.id, m.name)}><UserMinus size={14} /> حذف</Button>
                  <div className="text-right"><p className="font-black">{m.name || "طالب"}</p><p className="text-xs text-zinc-500 font-mono" dir="ltr">{m.publicId}</p></div>
                </CardContent></Card>
              ))}

              {(invites || []).filter((i: any) => i.status === "pending").length > 0 && (
                <>
                  <h3 className="font-black text-right">دعوات بانتظار الرد</h3>
                  {(invites || []).filter((i: any) => i.status === "pending").map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between bg-zinc-50 rounded-2xl p-3 text-sm font-bold">
                      <Badge variant="outline">بانتظار القبول</Badge>
                      <span>{i.toName || "طالب"} — <span className="font-mono" dir="ltr">{i.toPublicId}</span></span>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}

      {owner && (
        <div className="pt-6 border-t">
          <Button variant="outline" onClick={() => setDeleteOpen(true)} className="rounded-xl font-black text-red-600 border-red-200 gap-2"><Trash2 size={16} /> إنهاء المجموعة وحذفها</Button>
        </div>
      )}

      {/* جلسة جديدة */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="rounded-[2rem]" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-2xl font-black">بدء جلسة جديدة</DialogTitle><DialogDescription className="text-right">سيصل إشعار لكل أعضاء المجموعة، وتفتح الجلسة من التطبيق فقط.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="font-black">عنوان الجلسة (اختياري)</Label><Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} className="h-12 rounded-xl border-2" /></div>
            <label className="flex items-center gap-3 bg-zinc-50 rounded-2xl p-4 cursor-pointer">
              <Checkbox checked={record} onCheckedChange={(v) => setRecord(v === true)} />
              <span className="font-black text-sm">تسجيل الجلسة وإضافتها إلى محتوى الكورس للمجموعة</span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSessionOpen(false)} className="rounded-xl font-black">إلغاء</Button>
            <Button onClick={startSession} disabled={busy === "session"} className="rounded-xl font-black">{busy === "session" ? <Loader2 className="animate-spin" /> : "ابدأ الآن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* اختبار جديد */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="rounded-[2rem] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-2xl font-black">اختبار جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="font-black">عنوان الاختبار</Label><Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="h-12 rounded-xl border-2" /></div>
            {questions.map((q, i) => (
              <div key={i} className="border-2 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button className="text-red-500 text-xs font-black" onClick={() => setQuestions(questions.filter((_, k) => k !== i))} disabled={questions.length === 1}>حذف السؤال</button>
                  <p className="font-black">سؤال {i + 1}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={q.type === "mcq" ? "default" : "outline"} className="rounded-xl font-black" onClick={() => setQuestions(questions.map((x, k) => (k === i ? { ...x, type: "mcq" } : x)))}>اختياري</Button>
                  <Button type="button" size="sm" variant={q.type === "essay" ? "default" : "outline"} className="rounded-xl font-black" onClick={() => setQuestions(questions.map((x, k) => (k === i ? { ...x, type: "essay" } : x)))}>مقالي</Button>
                </div>
                <Input value={q.text} placeholder="نص السؤال" onChange={(e) => setQuestions(questions.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} className="h-11 rounded-xl border-2" />
                {q.type === "mcq" && q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input value={o} placeholder={`الاختيار ${oi + 1}`} onChange={(e) => setQuestions(questions.map((x, k) => (k === i ? { ...x, options: x.options.map((z, zi) => (zi === oi ? e.target.value : z)) } : x)))} className="h-10 rounded-xl border-2" />
                    <input type="radio" name={`correct-${i}`} checked={q.correct === oi} onChange={() => setQuestions(questions.map((x, k) => (k === i ? { ...x, correct: oi } : x)))} title="الإجابة الصحيحة" />
                  </div>
                ))}
                <div className="flex items-center gap-2 justify-end"><Label className="font-black text-xs">الدرجة</Label><Input type="number" min={1} max={100} value={q.points} onChange={(e) => setQuestions(questions.map((x, k) => (k === i ? { ...x, points: Number(e.target.value) || 1 } : x)))} className="h-10 w-20 rounded-xl border-2" /></div>
              </div>
            ))}
            <Button type="button" variant="outline" className="rounded-xl font-black gap-2" onClick={() => setQuestions([...questions, newQuestion()])}><Plus size={16} /> إضافة سؤال</Button>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuizOpen(false)} className="rounded-xl font-black">إلغاء</Button>
            <Button onClick={saveQuiz} disabled={busy === "quiz" || !quizTitle.trim()} className="rounded-xl font-black">{busy === "quiz" ? <Loader2 className="animate-spin" /> : "حفظ الاختبار"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف المجموعة */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-[2rem]" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-2xl font-black flex items-center gap-2 justify-end text-red-600"><AlertTriangle /> تحذير: حذف نهائي</AlertDialogTitle>
            <AlertDialogDescription className="text-right font-bold leading-7">
              إنهاء المجموعة سيحذف <b>كل الطلاب</b> و<b>كل المحتوى</b> (فيديوهات وملفات واختبارات وجلسات مسجلة) ولا يمكن التراجع. لتأكيد أن الحساب حسابك، سجّل دخولك مرة أخرى، ثم اكتب اسم المجموعة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {user?.providerData.some((p) => p.providerId === "password") && (
              <div className="space-y-1"><Label className="font-black">كلمة المرور</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl border-2" /></div>
            )}
            <div className="space-y-1"><Label className="font-black">اكتب اسم المجموعة: <span className="text-red-600">{g.name}</span></Label><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="h-11 rounded-xl border-2" /></div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-black">تراجع</AlertDialogCancel>
            <Button onClick={doDelete} disabled={busy === "delete-group" || confirmName.trim() !== g.name} className="rounded-xl font-black bg-red-600 hover:bg-red-700">{busy === "delete-group" ? <Loader2 className="animate-spin" /> : "تأكيد الحذف النهائي"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadBox({ label, accept, title, setTitle, inputRef, busy, progress, onPick }: any) {
  return (
    <Card className="rounded-3xl border-2 border-dashed"><CardContent className="p-5 space-y-3 text-right">
      <Label className="font-black">{label}</Label>
      <Input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="عنوان المحتوى" className="h-11 rounded-xl border-2" maxLength={120} />
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <Button onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl font-black gap-2">{busy ? <Loader2 className="animate-spin" /> : <Upload size={16} />} اختيار ملف ورفعه</Button>
      {progress !== null && <Progress value={progress} className="h-2" />}
    </CardContent></Card>
  );
}

function ContentList({ items, kind, icon, busy, onDelete, extra }: any) {
  if (!items?.length) return <p className="text-sm text-zinc-500 font-bold text-right">لا يوجد محتوى بعد.</p>;
  return (
    <div className="space-y-2">
      {items.map((it: any) => (
        <div key={it.id} className="flex items-center justify-between bg-white border rounded-2xl p-3">
          <Button size="icon" variant="ghost" className="text-red-500" disabled={busy === `del-${it.id}`} onClick={() => onDelete(kind, it.id)}><Trash2 size={16} /></Button>
          <div className="flex items-center gap-2 text-right">
            <div><p className="font-black text-sm">{it.title}</p><p className="text-xs text-zinc-500 font-bold">{extra ? extra(it) : formatBytes(it.size)}</p></div>
            <span className="text-primary">{icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
