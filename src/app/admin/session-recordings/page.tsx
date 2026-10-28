"use client";

import { useState } from "react";
import { collection } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/** تسجيلات جلسات الاستفهام (للإدارة فقط): مشاهدة، وإنهاء الرد على الشكوى. تُحذف تلقائيًا بعد يومين (14 يومًا بحد أقصى لو فيه شكوى). */
export default function AdminSessionRecordings() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const q = useMemoFirebase(() => (firestore ? collection(firestore, "sessionRecordings") : null), [firestore]);
  const { data } = useCollection(q);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const fns = () => getFunctions(initializeFirebase().firebaseApp, "us-central1");

  const play = async (id: string) => {
    const reason = window.prompt("سبب فتح التسجيل (يُسجَّل في سجل المراجعة):", "مراجعة شكوى");
    if (!reason || !reason.trim()) return;
    try {
      const r: any = await httpsCallable(fns(), "getSessionRecordingUrl")({ requestId: id, reason: reason.trim() });
      setPlayUrl(r.data.url);
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر التشغيل", description: e?.message }); }
  };
  const retry = async (id: string) => {
    try {
      const r: any = await httpsCallable(fns(), "adminRetrySessionRecording")({ requestId: id });
      toast({ title: r.data?.ok ? "التسجيل جاهز" : "لم يكتمل بعد", description: r.data?.ok ? undefined : "الملف غير موجود في التخزين حتى الآن." });
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر إعادة المحاولة", description: e?.message }); }
  };
  const resolve = async (id: string) => {
    try {
      await httpsCallable(fns(), "adminResolveSessionComplaint")({ requestId: id });
      toast({ title: "تم إنهاء الرد على الشكوى", description: "سيُحذف التسجيل خلال يوم." });
    } catch (e: any) { toast({ variant: "destructive", title: "خطأ", description: e?.message }); }
  };

  const rows = [...(data || [])].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const left = (ms: number) => { const h = Math.max(0, Math.round((ms - Date.now()) / 3600000)); return h >= 24 ? `${Math.round(h / 24)} يوم` : `${h} ساعة`; };

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="border-r-8 border-blue-600 pr-6">
        <h1 className="text-3xl font-black">تسجيلات جلسات الاستفهام</h1>
        <p className="text-muted-foreground">تُحفظ للإدارة فقط وتُحذف تلقائيًا بعد يومين، أو 14 يومًا كحد أقصى لو قُدّمت شكوى ولم ننهِ الرد عليها.</p>
      </div>
      <Card className="rounded-3xl overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">الجلسة</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-right">يُحذف بعد</TableHead><TableHead className="text-right">حفظ عند المستفهم</TableHead><TableHead className="text-right">إجراء</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 font-bold opacity-50">لا توجد تسجيلات</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.title || r.requestId}{r.complaint && r.complaintText && <span className="block text-xs font-bold text-red-600 mt-1">شكوى: {r.complaintText}</span>}</TableCell>
                <TableCell>
                  {r.status === "ready" ? <Badge className="bg-green-100 text-green-700">جاهز</Badge> : r.status === "processing" ? <Badge className="bg-yellow-100 text-yellow-700" title={r.error}>قيد المعالجة</Badge> : <Badge className="bg-red-100 text-red-700" title={r.error}>فشل</Badge>}
                  {r.status !== "ready" && r.error && <span className="block text-[11px] text-zinc-500 mt-1">{r.error}</span>}
                  {r.complaint && <Badge className="mr-2 bg-orange-100 text-orange-700">شكوى مفتوحة</Badge>}
                </TableCell>
                <TableCell>{left(Number(r.adminExpiresAt || 0))}</TableCell>
                <TableCell>{r.studentSaveDays ? `${r.studentSaveDays} يوم` : "لا"}</TableCell>
                <TableCell className="space-x-2 space-x-reverse">
                  {r.status === "ready" && <Button size="sm" onClick={() => play(r.id)}>مشاهدة</Button>}
                  {r.status !== "ready" && <Button size="sm" variant="secondary" onClick={() => retry(r.id)}>إعادة المحاولة</Button>}
                  {r.complaint && <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>تم الرد على الشكوى</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={!!playUrl} onOpenChange={(o) => { if (!o) setPlayUrl(null); }}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل الجلسة</DialogTitle></DialogHeader>
          {playUrl && <video src={playUrl} controls controlsList="nodownload" className="w-full rounded-xl bg-black" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
