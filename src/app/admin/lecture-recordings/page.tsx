
"use client";

import { useState } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminActor } from "@/lib/admin-activity";
import { Video, Play, Trash2, Search, Clock, HardDrive, Users, Loader2, Film } from "lucide-react";

/**
 * تسجيلات المحاضرات والميتنجات (جلسات المجموعات) — تظهر للإدارة في لوحة التحكم:
 * تشغيل التسجيل برابط مؤقت موقّع، أو حذفه نهائياً. المصدر: مجموعة lectureRecordings
 * التي يكتبها بوت التسجيل ومسار الرفع من الجهاز.
 */
export default function AdminLectureRecordings() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const actor = useAdminActor();
  const [search, setSearch] = useState("");
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [playTitle, setPlayTitle] = useState("");
  const [playRec, setPlayRec] = useState<any>(null);
  const [playError, setPlayError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "lectureRecordings"), orderBy("order", "desc"), limit(200)) : null),
    [firestore]
  );
  const { data, isLoading } = useCollection(q);
  // تسجيلات المحاضرات الفردية (استفهام: طالب ومُفهم) من مجموعة sessionRecordings
  const qSessions = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "sessionRecordings"), orderBy("createdAt", "desc"), limit(200)) : null),
    [firestore]
  );
  const { data: sessionData, isLoading: sessionsLoading } = useCollection(qSessions);

  const fns = () => getFunctions(initializeFirebase().firebaseApp, "us-central1");

  const millis = (ts: any) =>
    ts?.toMillis ? ts.toMillis() : ts?.toDate ? ts.toDate().getTime() : typeof ts === "string" ? new Date(ts).getTime() : 0;

  const rows = [
    ...(data || []).map((r: any) => ({ ...r, _sort: millis(r.createdAt) })),
    ...(sessionData || []).map((r: any) => ({
      ...r,
      kind: "istifham",
      groupName: "محاضرة فردية (طالب ومُفهم)",
      ownerName: "",
      _sort: millis(r.createdAt),
    })),
  ]
    .sort((a, b) => b._sort - a._sort)
    .filter((r: any) => {
      const t = search.trim().toLowerCase();
      if (!t) return true;
      return (
        r.title?.toLowerCase().includes(t) ||
        r.groupName?.toLowerCase().includes(t) ||
        r.ownerName?.toLowerCase().includes(t)
      );
    });

  const fmtSize = (bytes: number) => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجا` : `${mb.toFixed(0)} ميجا`;
  };
  const fmtDur = (sec: number) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} س ${m % 60} د` : `${m} دقيقة`;
  };
  const fmtDate = (ts: any) => {
    const d = ts?.toDate ? ts.toDate() : (typeof ts === "string" ? new Date(ts) : null);
    return d ? d.toLocaleDateString("ar-EG") + " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—";
  };

  const play = async (r: any) => {
    setBusyId(r.id);
    try {
      const res: any =
        r.kind === "istifham"
          ? await httpsCallable(fns(), "getSessionRecordingUrl")({ requestId: r.id })
          : await httpsCallable(fns(), "getLectureRecordingUrl")({ id: r.id });
      setPlayTitle(r.title || "تسجيل");
      setPlayRec(r);
      setPlayError("");
      setPlayUrl(res.data.url);
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر التشغيل", description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: any) => {
    if (!window.confirm(`حذف تسجيل «${r.title || r.sessionId}» نهائياً من التخزين؟ لا يمكن التراجع.`)) return;
    setBusyId(r.id);
    try {
      await httpsCallable(fns(), "adminDeleteLectureRecording")({ id: r.id });
      toast({ title: "تم حذف التسجيل" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر الحذف", description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (r: any) => {
    if (r.status === "ready") return <Badge className="bg-green-100 text-green-700">جاهز</Badge>;
    if (r.status === "processing" || r.status === "uploading") return <Badge className="bg-yellow-100 text-yellow-700" title={r.error}>قيد المعالجة</Badge>;
    return <Badge className="bg-red-100 text-red-700" title={r.error}>فشل</Badge>;
  };

  const isPageLoading = isLoading || sessionsLoading;
  const dateOf = (ts: any) => (ts?.toDate ? ts.toDate() : typeof ts === "string" ? new Date(ts) : null);
  // تاريخ إصلاح مشكلة الشاشة السوداء في التسجيل (تغيير ترميز صفحة التسجيل إلى h264)
  const FIX_DATE = new Date("2026-11-25T20:00:00+02:00");
  const sourceLabel = (s: any) =>
    s === "device" ? "مسجلة من جهاز" : s === "agora-web" ? "تلقائية (سيرفر)" : s === "bot" ? "تلقائية (بوت)" : "";

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <Film className="h-9 w-9 text-primary" /> تسجيلات المحاضرات والميتنجات
          </h1>
          <p className="text-muted-foreground text-lg">كل التسجيلات تظهر هنا: جلسات المجموعات (محاضرة / ميتنج) والمحاضرات الفردية بين الطالب والمُفهم. تشغيل أو حذف.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="ابحث باسم الجلسة أو المجموعة أو المُفهم..."
            className="h-14 pr-12 rounded-2xl shadow-sm border-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isPageLoading ? (
        <Card className="rounded-3xl border-2"><CardContent className="p-16 text-center animate-pulse font-black text-lg">جاري تحميل التسجيلات...</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-3xl border-2"><CardContent className="p-16 text-center text-muted-foreground font-bold space-y-3">
          <Video className="h-12 w-12 mx-auto opacity-30" />
          <p>لا توجد تسجيلات محاضرات حتى الآن.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((r: any) => (
            <Card key={r.id} className="rounded-3xl border-2 bg-white overflow-hidden hover:shadow-xl transition-all">
              <div className="bg-zinc-900 p-5 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Video className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-white truncate">{r.title || `جلسة ${r.sessionId || r.requestId || r.id}`}</h3>
                  <p className="text-xs text-zinc-400 font-bold truncate flex items-center gap-1">
                    <Users className="h-3 w-3" /> {r.kind === "istifham" ? "محاضرة فردية (طالب ومُفهم)" : `${r.groupName || "مجموعة"} · ${r.ownerName || "مُفهم"}`}
                  </p>
                </div>
                <div className="mr-auto shrink-0">{statusBadge(r)}</div>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtDur(r.durationSec)}</span>
                  <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {fmtSize(r.size)}</span>
                  <span>{fmtDate(r.createdAt)}</span>
                </div>
                {r.error && r.status !== "ready" && (
                  <p className="text-[11px] font-bold text-red-500 break-all">{r.error}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => play(r)}
                    disabled={r.status !== "ready" || busyId === r.id}
                    className="flex-1 h-12 rounded-2xl font-black gap-2"
                  >
                    {busyId === r.id ? <Loader2 className="animate-spin h-5 w-5" /> : <Play className="h-5 w-5" />} تشغيل
                  </Button>
                  {r.kind !== "istifham" && (
                    <Button
                      variant="outline"
                      onClick={() => remove(r)}
                      disabled={busyId === r.id}
                      className="h-12 rounded-2xl font-black text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {r.kind === "istifham" && (
                  <p className="text-[11px] font-bold text-muted-foreground">
                    تسجيل المحاضرات الفردية محكوم بمدد الاحتفاظ المتفق عليها ويُحذف تلقائيًا بعد انتهائها (أو بعد الشكوى).
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!playUrl} onOpenChange={(o) => { if (!o) { setPlayUrl(null); setPlayRec(null); setPlayError(""); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-black">{playTitle}</DialogTitle>
          </DialogHeader>
          {playRec && (
            <div className="text-xs font-bold text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{fmtDate(playRec.createdAt)}</span>
              {sourceLabel(playRec.source) && <span>· {sourceLabel(playRec.source)}</span>}
              {dateOf(playRec.createdAt) && dateOf(playRec.createdAt)! < FIX_DATE && (
                <span className="text-amber-600">· تسجيل قديم قبل إصلاح 25 نوفمبر: لو كان اتسجل بدون صورة سيبقى كذلك، الإصلاح يشمل التسجيلات الجديدة فقط</span>
              )}
            </div>
          )}
          <div className="relative">
            {playUrl && (
              <video
                src={playUrl}
                controls
                autoPlay
                className="w-full rounded-2xl bg-black max-h-[70vh]"
                onError={() => setPlayError("تعذر تشغيل الفيديو داخل التطبيق.")}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (!v.videoWidth || !v.videoHeight) setPlayError("ملف التسجيل لا يحتوي على صورة فيديو (صوت فقط).");
                }}
              />
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-lg pointer-events-none">
              {actor.fullName || actor.email || "مسؤول"} — عرض إداري
            </div>
          </div>
          {playError && <p className="text-sm font-bold text-red-600">{playError}</p>}
          {playUrl && (
            <Button variant="outline" className="rounded-2xl font-black" onClick={() => window.open(playUrl, "_blank")}>
              فتح في المتصفح الخارجي (للتجربة لو الفيديو لا يعمل داخل التطبيق)
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
