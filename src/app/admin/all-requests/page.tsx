
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, deleteDoc, doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Video, Calendar, User, BadgeCent, Clock, Search, Trash2, Eye, FileText, CreditCard, Hash, Zap, Ticket } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminAllRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "istifhams"), orderBy("createdAt", "desc"), limit(200));
  }, [firestore]);

  const { data: requests, isLoading } = useCollection(requestsQuery);

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "istifhams", id));
      toast({ title: "تم الحذف", description: "تم حذف الاستفهام بنجاح من النظام." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حذف الاستفهام." });
    }
  };

  const filteredRequests = requests?.filter(r => 
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mustafhemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mufhemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id?.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge className="bg-orange-100 text-orange-600 border-none font-black">قيد المراجعة</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-600 border-none font-black">بانتظار مفهم</Badge>;
      case 'accepted':
        return <Badge className="bg-yellow-100 text-yellow-700 border-none font-black">بانتظار الدفع</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-600 border-none font-black">مدفوع وجاهز</Badge>;
      case 'completed':
        return <Badge className="bg-zinc-900 text-white border-none font-black">مكتمل</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-600 border-none font-black">ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">رقابة المحاضرات</h1>
          <p className="text-muted-foreground text-lg">متابعة كافة الاستفهامات والجلسات القائمة والمنتهية في المنصة.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالعنوان، المستفهم أو المفهم..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
        <Table>
          <TableHeader className="bg-muted/30 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black text-zinc-900">المحاضرة</TableHead>
              <TableHead className="text-right font-black text-zinc-900">الأطراف</TableHead>
              <TableHead className="text-right font-black text-zinc-900">المبلغ</TableHead>
              <TableHead className="text-right font-black text-zinc-900">الحالة</TableHead>
              <TableHead className="text-left px-8 font-black text-zinc-900">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 animate-pulse font-bold text-xl">جاري تحميل السجلات...</TableCell></TableRow>
            ) : filteredRequests?.map((req) => (
              <TableRow key={req.id} className="h-24 hover:bg-primary/5 transition-colors">
                <TableCell className="px-8">
                  <div className="flex flex-col text-right">
                    <span className="font-bold text-lg text-zinc-800 line-clamp-1">{req.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">ID: {req.id.slice(-8)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm space-y-1 text-right">
                    <span className="font-bold">{req.mustafhemName} <Badge variant="outline" className="text-[8px] h-4">طالب</Badge></span>
                    {req.mufhemName && <span className="font-bold text-primary">{req.mufhemName} <Badge className="text-[8px] h-4 bg-primary/10 text-primary border-none">مفهم</Badge></span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-primary text-lg">{req.amount} ج.م</span>
                </TableCell>
                <TableCell className="text-right">
                  {getStatusBadge(req.status)}
                </TableCell>
                <TableCell className="px-8 text-left">
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(req)} className="rounded-xl h-10 w-10 text-blue-600">
                      <Eye size={20} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl h-10 w-10">
                          <Trash2 size={20} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-right">حذف نهائي؟</AlertDialogTitle>
                          <AlertDialogDescription className="text-right">سيتم حذف الاستفهام وكافة بياناته من النظام.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2">
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(req.id)} className="bg-red-600">حذف الآن</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <DialogHeader className="p-8 bg-zinc-900 text-white">
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
              <FileText className="text-primary" /> تفاصيل الاستفهام الكاملة
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-right">مراجعة البيانات المالية والتقنية والجودة.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-[#F8FAFC]">
            <div className="p-6 bg-white rounded-3xl border-2 border-dashed space-y-4 shadow-sm">
              <h4 className="text-xl font-black text-zinc-900">{selectedRequest?.title}</h4>
              <p className="text-zinc-600 leading-relaxed font-medium">{selectedRequest?.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailBox icon={User} label="المستفهم" value={selectedRequest?.mustafhemName} />
              <DetailBox icon={Zap} label="المفهم" value={selectedRequest?.mufhemName || "لم يتم التحديد"} />
              <DetailBox icon={Calendar} label="تاريخ الطلب" value={new Date(selectedRequest?.createdAt).toLocaleString('ar-EG')} />
              <DetailBox icon={BadgeCent} label="المبلغ" value={`${selectedRequest?.amount} ج.م`} color="text-green-600" />
            </div>

            {selectedRequest?.status === 'completed' && (
              <div className="space-y-6">
                <h5 className="text-xl font-black border-r-4 border-primary pr-3 flex items-center gap-2">
                  <CreditCard size={20} className="text-primary" /> تفاصيل الدفع والعملية
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailBox icon={Hash} label="رقم الفاتورة" value={selectedRequest?.invoiceNumber || "INV-8821"} />
                  <DetailBox icon={CreditCard} label="وسيلة الدفع" value="محفظة الموقع (خصم مباشر)" />
                  <DetailBox icon={Clock} label="وقت الدفع" value={selectedRequest?.paidAt ? new Date(selectedRequest.paidAt).toLocaleString('ar-EG') : "مسجل"} />
                  <DetailBox icon={CheckCircle2} label="حالة العملية" value="مكتملة وناجحة" color="text-green-600" />
                </div>
              </div>
            )}

            {selectedRequest?.couponApplied && (
              <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-100 flex justify-between items-center px-6">
                <span className="font-black text-orange-700 flex items-center gap-2">
                  <Ticket size={18}/> تم استخدام كوبون:
                </span>
                <span className="font-mono font-black text-lg text-orange-800">{selectedRequest.couponApplied}</span>
              </div>
            )}
          </div>
          <div className="p-6 bg-zinc-50 border-t flex justify-end">
            <Button onClick={() => setSelectedRequest(null)} className="rounded-xl px-10 h-12 font-black">إغلاق النافذة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailBox({ icon: Icon, label, value, color }: any) {
  return (
    <div className="p-4 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
      <div className="p-2 bg-zinc-50 rounded-xl text-primary"><Icon size={20} /></div>
      <div className="text-right">
        <p className="text-[10px] font-black text-muted-foreground uppercase">{label}</p>
        <p className={`font-black text-sm ${color || 'text-zinc-800'}`}>{value}</p>
      </div>
    </div>
  );
}
