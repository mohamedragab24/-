
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, CheckCircle2, XCircle, Clock, User, Mail, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminAppeals() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const appealsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "appeals"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: appeals, isLoading } = useCollection(appealsQuery);

  const handleAction = async (appeal: any, action: 'approve' | 'reject') => {
    if (!firestore) return;
    try {
      if (action === 'approve') {
        // فك الحظر
        await updateDoc(doc(firestore, "users", appeal.userId), { status: 'active' });
        await updateDoc(doc(firestore, "appeals", appeal.id), { status: 'accepted' });
        toast({ title: "تم فك الحظر", description: "يمكن للمستخدم الآن دخول المنصة بشكل طبيعي." });
      } else {
        // رفض الطعن
        await updateDoc(doc(firestore, "appeals", appeal.id), { status: 'rejected' });
        toast({ variant: "destructive", title: "تم رفض الطعن", description: "سيبقى حساب المستخدم محظوراً." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تنفيذ العملية." });
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-red-600 pr-6">
        <h1 className="text-4xl font-black font-headline">مركز الطعون الإدارية</h1>
        <p className="text-muted-foreground text-lg">مراجعة طلبات فك الحظر المقدمة من المستخدمين الموقوفين.</p>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
        <Table>
          <TableHeader className="bg-muted/30 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black">المستخدم</TableHead>
              <TableHead className="text-right font-black">رسالة الطعن</TableHead>
              <TableHead className="text-right font-black">التاريخ</TableHead>
              <TableHead className="text-right font-black">الحالة</TableHead>
              <TableHead className="text-left px-8 font-black">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 animate-pulse font-bold">جاري جلب الطعون...</TableCell></TableRow>
            ) : appeals?.map((app) => (
              <TableRow key={app.id} className="h-24 hover:bg-red-50/30 transition-colors">
                <TableCell className="px-8">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{app.userName}</span>
                    <span className="text-xs text-muted-foreground">{app.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="text-sm font-medium italic border-r-2 pr-2 border-red-200 line-clamp-2">"{app.reason}"</p>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Clock size={12} /> {new Date(app.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={`px-4 py-1 rounded-xl font-black ${
                    app.status === 'accepted' ? 'bg-green-100 text-green-600' : 
                    app.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {app.status === 'accepted' ? 'تم القبول' : app.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </Badge>
                </TableCell>
                <TableCell className="px-8 text-left">
                  {app.status === 'pending' && (
                    <div className="flex gap-2 justify-end">
                      <Button onClick={() => handleAction(app, 'approve')} className="bg-green-600 hover:bg-green-700 h-10 rounded-xl font-bold">
                        <CheckCircle2 size={16} className="ml-1" /> فك الحظر
                      </Button>
                      <Button onClick={() => handleAction(app, 'reject')} variant="destructive" className="h-10 rounded-xl font-bold">
                        <XCircle size={16} className="ml-1" /> رفض
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!appeals || appeals.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-black opacity-30 text-xl">لا توجد طعون مقدمة حالياً.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
