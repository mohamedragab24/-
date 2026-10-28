"use client";

import { collection } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

/** طلبات اعتماد جهاز جديد: IP كما رصده الخادم + تفاصيل الجهاز + السبب، مع قبول/رفض وإلغاء ربط الجهاز. */
export default function AdminDeviceRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const q = useMemoFirebase(() => (firestore ? collection(firestore, "deviceChangeRequests") : null), [firestore]);
  const { data } = useCollection(q);
  const fns = () => getFunctions(initializeFirebase().firebaseApp, "us-central1");

  const decide = async (id: string, approve: boolean) => {
    let note = "";
    if (!approve) { note = window.prompt("سبب الرفض:") || ""; if (!note.trim()) return; }
    try {
      await httpsCallable(fns(), "adminDecideDeviceRequest")({ requestId: id, approve, note });
      toast({ title: approve ? "تم اعتماد الجهاز الجديد" : "تم رفض الطلب" });
    } catch (e: any) { toast({ variant: "destructive", title: "خطأ", description: e?.message }); }
  };
  const revoke = async (uid: string) => {
    if (!window.confirm("إلغاء ربط الجهاز الحالي وإنهاء جلسات هذا المستخدم؟")) return;
    try {
      await httpsCallable(fns(), "adminResetDeviceLock")({ uid });
      toast({ title: "تم إلغاء ربط الجهاز وإنهاء الجلسات" });
    } catch (e: any) { toast({ variant: "destructive", title: "خطأ", description: e?.message }); }
  };

  const rows = [...(data || [])].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const label: any = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="border-r-8 border-blue-600 pr-6">
        <h1 className="text-3xl font-black">طلبات تغيير الجهاز</h1>
        <p className="text-muted-foreground">الـ IP هنا هو ما رصده الخادم وقت الطلب؛ قد يتغير مع الشبكة أو VPN ولا يحدد الجهاز بشكل فريد.</p>
      </div>
      <Card className="rounded-3xl overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">المستخدم</TableHead><TableHead className="text-right">الجهاز الجديد / الحالي</TableHead><TableHead className="text-right">السبب</TableHead><TableHead className="text-right">IP</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-right">إجراء</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 font-bold opacity-50">لا توجد طلبات</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.name}<span className="block text-xs font-mono text-zinc-500">{r.publicId} • {r.email}</span><span className="block text-xs text-zinc-500">{r.phone}</span></TableCell>
                <TableCell>{r.newDeviceName}<span className="block text-xs text-zinc-500">الحالي: {r.currentDeviceName || "—"}</span></TableCell>
                <TableCell className="max-w-xs text-sm">{r.reason}</TableCell>
                <TableCell className="font-mono text-xs">{r.ip}</TableCell>
                <TableCell><Badge>{label[r.status] || r.status}</Badge>{r.decisionNote && <span className="block text-xs mt-1">{r.decisionNote}</span>}</TableCell>
                <TableCell className="space-x-2 space-x-reverse">
                  {r.status === "pending" && <>
                    <Button size="sm" onClick={() => decide(r.id, true)}>قبول</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>رفض</Button>
                  </>}
                  <Button size="sm" variant="ghost" onClick={() => revoke(r.uid)}>إلغاء ربط الجهاز</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
