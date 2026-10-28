"use client";

import { collection } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const LABELS: Record<string, string> = {
  pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض", refunding: "جارٍ الاسترداد", refunded: "مسترد", refund_failed: "فشل الاسترداد",
};

/** طلبات إلغاء الاشتراك واسترداد المبلغ خلال 24 ساعة. المحفظة تُسترد تلقائيًا؛ الوسائل الخارجية تُنفَّذ يدويًا ثم تُؤكَّد هنا. */
export default function AdminRefunds() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const q = useMemoFirebase(() => (firestore ? collection(firestore, "refundRequests") : null), [firestore]);
  const { data } = useCollection(q);
  const fns = () => getFunctions(initializeFirebase().firebaseApp, "us-central1");

  const run = async (fn: string, payload: any, okMsg: string) => {
    try { await httpsCallable(fns(), fn)(payload); toast({ title: okMsg }); }
    catch (e: any) { toast({ variant: "destructive", title: "خطأ", description: e?.message }); }
  };
  const approve = (id: string) => run("adminDecideRefund", { requestId: id, approve: true }, "تم القبول وإيقاف الوصول");
  const reject = (id: string) => { const reason = window.prompt("سبب الرفض:"); if (reason?.trim()) run("adminDecideRefund", { requestId: id, approve: false, reason }, "تم الرفض"); };
  const done = (id: string) => { const note = window.prompt("رقم عملية التحويل / ملاحظة (أو رابط الإيصال):"); if (note?.trim()) run("adminCompleteRefund", { requestId: id, success: true, note, receiptUrl: note.startsWith("http") ? note : "" }, "تم تسجيل الاسترداد"); };
  const fail = (id: string) => { const note = window.prompt("سبب فشل الاسترداد:"); if (note?.trim()) run("adminCompleteRefund", { requestId: id, success: false, note }, "تم تسجيل الفشل"); };

  const rows = [...(data || [])].sort((a: any, b: any) => (b.requestedAtMs || 0) - (a.requestedAtMs || 0));
  const fmt = (ms: number) => ms ? new Date(ms).toLocaleString("ar-EG") : "—";

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="border-r-8 border-orange-500 pr-6">
        <h1 className="text-3xl font-black">طلبات الاسترداد</h1>
        <p className="text-muted-foreground">لا يُعتبر المبلغ مستردًا إلا بعد تنفيذ العملية وتسجيل نتيجتها.</p>
      </div>
      <Card className="rounded-3xl overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">الكورس</TableHead><TableHead className="text-right">المبلغ / الوسيلة</TableHead><TableHead className="text-right">الشراء / الطلب</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-right">إجراء</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 font-bold opacity-50">لا توجد طلبات</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.courseTitle || r.courseId}<span className="block text-xs text-zinc-500">{r.reason}</span></TableCell>
                <TableCell>{r.amount} ج.م<span className="block text-xs text-zinc-500">{r.paymentMethod}</span></TableCell>
                <TableCell className="text-xs">{fmt(r.purchasedAtMs)}<span className="block">{fmt(r.requestedAtMs)}</span></TableCell>
                <TableCell><Badge>{LABELS[r.status] || r.status}</Badge>{r.rejectionReason && <span className="block text-xs mt-1">{r.rejectionReason}</span>}{r.refundError && <span className="block text-xs text-red-600 mt-1">{r.refundError}</span>}</TableCell>
                <TableCell className="space-x-2 space-x-reverse">
                  {r.status === "pending" && <><Button size="sm" onClick={() => approve(r.id)}>قبول</Button><Button size="sm" variant="outline" onClick={() => reject(r.id)}>رفض</Button></>}
                  {["refunding", "refund_failed"].includes(r.status) && r.refundMethod !== "wallet" && <><Button size="sm" onClick={() => done(r.id)}>تم التحويل</Button><Button size="sm" variant="outline" onClick={() => fail(r.id)}>فشل</Button></>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
