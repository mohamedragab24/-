
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  HelpCircle,
  BadgeCent,
  Calendar,
  User,
  FileText,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminPendingRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedIstifham, setSelectedIstifham] = useState<any>(null);

  const istifhamsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "istifhams"), 
      where("status", "==", "pending_approval")
    );
  }, [firestore]);

  const { data: istifhams, isLoading } = useCollection(istifhamsQuery);

  const handleApprove = async (id: string) => {
    if (!firestore) return;
    try {
      const reqRef = doc(firestore, "istifhams", id);
      await updateDoc(reqRef, { 
        status: "active",
        approvedAt: new Date().toISOString()
      });
      
      toast({ title: "تم النشر بنجاح", description: "الاستفهام متاح الآن لكافة المفهمين." });
      setSelectedIstifham(null);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تنفيذ العملية" });
    }
  };

  const handleReject = async (id: string) => {
    if (!firestore) return;
    try {
      const reqRef = doc(firestore, "istifhams", id);
      await updateDoc(reqRef, { status: "canceled" });
      
      toast({ variant: "destructive", title: "تم الرفض", description: "تم إلغاء الطلب ولن يظهر في المنصة." });
      setSelectedIstifham(null);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تنفيذ العملية" });
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-orange-500 pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">الطلبات قيد المراجعة</h1>
        <p className="text-muted-foreground text-lg">مراجعة محتوى الاستفهامات والميزانية قبل النشر لضمان الجودة.</p>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="py-20 text-center animate-pulse font-bold">جاري تحميل الطلبات...</div>
        ) : istifhams?.map((ist) => (
          <Card key={ist.id} className="rounded-3xl border-2 p-8 shadow-md flex flex-col md:flex-row justify-between items-center gap-6 bg-white group hover:border-orange-500/20 transition-all">
            <div className="space-y-2 text-right w-full">
              <div className="flex items-center gap-3">
                <Badge className="bg-orange-100 text-orange-600 border-none font-bold px-4 py-1">بانتظار الموافقة</Badge>
                <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                  <Clock size={12}/> {new Date(ist.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
              <h4 className="text-2xl font-black text-zinc-800 group-hover:text-orange-600 transition-colors">{ist.title}</h4>
              <p className="font-bold text-muted-foreground">بواسطة: <span className="text-zinc-900">{ist.mustafhemName}</span> | الميزانية: <span className="text-primary">{ist.amount} ج.م</span></p>
            </div>
            <div className="flex gap-3 w-full md:w-auto shrink-0">
              <Button variant="outline" onClick={() => setSelectedIstifham(ist)} className="h-14 px-8 font-black rounded-2xl border-2">
                <Eye className="ml-2 h-5 w-5" /> مراجعة التفاصيل
              </Button>
              <Button onClick={() => handleApprove(ist.id)} className="bg-green-600 hover:bg-green-700 h-14 px-8 font-black rounded-2xl shadow-lg text-white">
                <CheckCircle2 className="ml-2 h-5 w-5" /> موافقة ونشر
              </Button>
            </div>
          </Card>
        ))}
        {!isLoading && istifhams?.length === 0 && (
          <div className="py-20 text-center text-muted-foreground font-black text-xl opacity-30">لا توجد طلبات جديدة للمراجعة حالياً.</div>
        )}
      </div>

      <Dialog open={!!selectedIstifham} onOpenChange={() => setSelectedIstifham(null)}>
        <DialogContent className="sm:max-w-[650px] rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3"><HelpCircle className="text-orange-500 h-8 w-8" /> تفاصيل الطلب</DialogTitle>
            <DialogDescription className="text-right text-lg">مراجعة كاملة لمحتوى الاستفهام قبل النشر للمفهمين.</DialogDescription>
          </DialogHeader>
          {selectedIstifham && (
            <div className="py-6 space-y-6 max-h-[70vh] overflow-y-auto px-2 text-right">
              <div className="p-8 bg-orange-50/50 rounded-3xl border-2 border-dashed border-orange-200 space-y-4">
                <h4 className="text-2xl font-black text-zinc-900 leading-tight">{selectedIstifham.title}</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-black text-primary flex items-center gap-2 justify-end">
                      التفاصيل <FileText size={16}/>
                    </Label>
                    <p className="text-zinc-700 leading-relaxed font-bold text-lg">{selectedIstifham.description}</p>
                  </div>
                  {selectedIstifham.goal && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="font-black text-accent flex items-center gap-2 justify-end">
                        هدف الاستفهام <Target size={16}/>
                      </Label>
                      <p className="text-zinc-700 leading-relaxed font-bold text-md italic">"{selectedIstifham.goal}"</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem icon={BadgeCent} label="الميزانية" value={`${selectedIstifham.amount} ج.م`} />
                <DetailItem icon={Calendar} label="الموعد المقترح" value={new Date(selectedIstifham.meetingTime).toLocaleString('ar-EG')} />
                <DetailItem icon={User} label="المستفهم" value={selectedIstifham.mustafhemName} />
                <DetailItem icon={Clock} label="تاريخ الطلب" value={new Date(selectedIstifham.createdAt).toLocaleDateString('ar-EG')} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6">
                <Button onClick={() => handleApprove(selectedIstifham.id)} className="h-16 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-xl shadow-xl text-white">موافقة ونشر الآن</Button>
                <Button onClick={() => handleReject(selectedIstifham.id)} variant="destructive" className="h-16 rounded-2xl font-black text-xl shadow-xl">رفض الطلب</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
  return (
    <div className="p-4 bg-muted/20 rounded-2xl border-2 border-transparent hover:border-muted transition-all flex items-center gap-4">
      <div className="bg-white p-3 rounded-xl shadow-sm text-primary">
        <Icon size={20} />
      </div>
      <div>
        <span className="text-[10px] font-black text-muted-foreground block uppercase tracking-wider">{label}</span>
        <span className="font-black text-zinc-900">{value}</span>
      </div>
    </div>
  );
}
