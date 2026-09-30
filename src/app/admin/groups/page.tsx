"use client";

import { useState } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { callGroupFn, fnErrorMessage, formatBytes, estimateWeeklyFee } from "@/lib/groups";

export default function AdminGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const groupsQ = useMemoFirebase(() => (firestore ? collection(firestore, "groups") : null), [firestore]);
  const billsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, "groupBills"), orderBy("createdAt", "desc")) : null), [firestore]);
  const { data: groups, isLoading } = useCollection<any>(groupsQ);
  const { data: bills } = useCollection<any>(billsQ);

  const totalUnpaid = (bills || []).filter((b: any) => b.status === "unpaid").reduce((a: number, b: any) => a + Number(b.fee || 0), 0);
  const totalPaid = (bills || []).filter((b: any) => b.status === "paid").reduce((a: number, b: any) => a + Number(b.fee || 0), 0);

  const backfill = async () => {
    setBusy(true);
    try { const r = await callGroupFn<{ assigned: number }>("backfillPublicIds"); toast({ title: `تم توليد ${r.assigned} رقم تعريفي` }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر التنفيذ", description: fnErrorMessage(e) }); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button onClick={backfill} disabled={busy} variant="outline" className="rounded-xl font-black">{busy ? <Loader2 className="animate-spin" /> : "توليد أرقام تعريفية للمستخدمين القدامى"}</Button>
        <div className="border-r-8 border-primary pr-6"><h1 className="text-3xl font-black">المجموعات والفواتير</h1><p className="text-muted-foreground font-bold">متوسط الطلاب والحجم أسبوعيًا يُحسب تلقائيًا.</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-5 text-right"><p className="text-xs font-black text-zinc-500">عدد المجموعات</p><p className="text-3xl font-black">{groups?.length || 0}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-right"><p className="text-xs font-black text-zinc-500">مجمّدة</p><p className="text-3xl font-black text-red-600">{(groups || []).filter((g: any) => g.status === "frozen").length}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-right"><p className="text-xs font-black text-zinc-500">محصّل (ج.م)</p><p className="text-3xl font-black text-emerald-600">{Math.round(totalPaid * 100) / 100}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5 text-right"><p className="text-xs font-black text-zinc-500">غير مدفوع (ج.م)</p><p className="text-3xl font-black text-orange-600">{Math.round(totalUnpaid * 100) / 100}</p></CardContent></Card>
      </div>

      <Card className="rounded-3xl"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">المجموعة</TableHead><TableHead className="text-right">المُفهم</TableHead><TableHead className="text-right">الطلاب</TableHead>
            <TableHead className="text-right">الحجم</TableHead><TableHead className="text-right">تقدير أسبوعي</TableHead><TableHead className="text-right">الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
            {(groups || []).map((g: any) => (
              <TableRow key={g.id}>
                <TableCell className="font-black">{g.name}</TableCell><TableCell>{g.ownerName || g.ownerUid}</TableCell>
                <TableCell>{g.memberCount || 0}</TableCell><TableCell>{formatBytes(g.storageBytes || 0)}</TableCell>
                <TableCell>{estimateWeeklyFee(g.storageBytes, g.memberCount)} ج.م</TableCell>
                <TableCell>{g.status === "frozen" ? <Badge variant="destructive">مجمّدة</Badge> : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">نشطة</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <h2 className="text-xl font-black">الفواتير الأسبوعية</h2>
      <Card className="rounded-3xl"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">الأسبوع</TableHead><TableHead className="text-right">المجموعة</TableHead><TableHead className="text-right">متوسط الطلاب</TableHead>
            <TableHead className="text-right">متوسط GB</TableHead><TableHead className="text-right">الرسوم</TableHead><TableHead className="text-right">الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(bills || []).map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>{b.weekKey}</TableCell><TableCell className="font-black">{b.groupName}</TableCell><TableCell>{b.avgStudents}</TableCell>
                <TableCell>{b.avgGB}</TableCell><TableCell>{b.fee} ج.م</TableCell>
                <TableCell>{b.status === "paid" ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">مدفوعة</Badge> : <Badge variant="destructive">غير مدفوعة</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
