
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Clock, User, Activity, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AdminLogs() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "adminLogs"), orderBy("timestamp", "desc"), limit(200));
  }, [firestore]);

  const { data: logs, isLoading } = useCollection(logsQuery);

  const filteredLogs = logs?.filter(log => 
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.targetUserId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    switch(action) {
      case 'grant_admin': return <Badge className="bg-red-500">منح صلاحية</Badge>;
      case 'revoke_admin': return <Badge variant="destructive">سحب صلاحية</Badge>;
      case 'manual_recharge': return <Badge className="bg-green-600">شحن يدوي</Badge>;
      case 'manual_deduction': return <Badge className="bg-orange-500">خصم يدوي</Badge>;
      case 'verify_user': return <Badge className="bg-blue-500">توثيق</Badge>;
      case 'unverify_user': return <Badge variant="outline">إلغاء توثيق</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-zinc-800 pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline">سجل الرقابة الإدارية</h1>
          <p className="text-muted-foreground text-lg">تتبع كافة الإجراءات التي قام بها المسؤولون في النظام.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالأجراء أو المعرف..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
        <Table>
          <TableHeader className="bg-muted/30 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black">الإجراء</TableHead>
              <TableHead className="text-right font-black">المستهدف (User ID)</TableHead>
              <TableHead className="text-right font-black">التفاصيل</TableHead>
              <TableHead className="text-right font-black">الوقت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-20 animate-pulse font-bold">جاري تحميل السجلات...</TableCell></TableRow>
            ) : filteredLogs?.map((log) => (
              <TableRow key={log.id} className="h-20 hover:bg-zinc-50 transition-colors">
                <TableCell className="px-8">{getActionBadge(log.action)}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-muted-foreground">{log.targetUserId || "نظام عام"}</TableCell>
                <TableCell className="font-bold text-sm">{log.details || log.amount ? `المبلغ: ${log.amount} ج.م` : "إجراء إداري"}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-[10px] font-bold text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(log.timestamp).toLocaleDateString('ar-EG')}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!filteredLogs || filteredLogs.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold">لا توجد سجلات مطابقة.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
