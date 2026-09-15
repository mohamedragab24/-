
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock, 
  PlayCircle, 
  FileSearch,
  User,
  Calendar,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function AdminPortfolioApprovals() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "portfolio"), where("status", "==", "pending_approval"));
  }, [firestore]);

  const { data: pendingItems, isLoading } = useCollection(pendingQuery);

  const handleApprove = (id: string) => {
    if (!firestore) return;
    const workRef = doc(firestore, "portfolio", id);
    updateDocumentNonBlocking(workRef, { status: "approved" });
    toast({ title: "تم قبول العمل بنجاح", description: "العمل متاح الآن في المعرض العام." });
    setSelectedItem(null);
  };

  const handleReject = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "portfolio", id));
      toast({ variant: "destructive", title: "تم رفض وحذف العمل" });
      setSelectedItem(null);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">مراجعة أعمال المفهمين</h1>
        <p className="text-muted-foreground text-lg">مراجعة النماذج التعليمية المرفوعة قبل نشرها للطلاب.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full py-20 text-center animate-pulse font-bold">جاري جلب الطلبات...</div>
        ) : pendingItems?.map((item) => (
          <Card key={item.id} className="rounded-[2.5rem] overflow-hidden shadow-lg border-2 hover:border-primary/20 transition-all bg-white group">
            <div className="relative aspect-video bg-zinc-100 overflow-hidden">
              {item.mediaType === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <PlayCircle className="text-white/50 h-16 w-16" />
                </div>
              ) : (
                <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
              )}
              <Badge className="absolute top-4 right-4 bg-orange-100 text-orange-600 border-none font-bold">بانتظار المراجعة</Badge>
            </div>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-black text-xl truncate">{item.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedItem(item)} className="flex-1 rounded-xl font-bold"><Eye size={16} className="ml-2"/> معاينة</Button>
                <Button onClick={() => handleApprove(item.id)} className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-white">قبول</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && pendingItems?.length === 0 && (
          <div className="col-span-full py-32 text-center text-muted-foreground font-black text-xl opacity-30">
            لا توجد أعمال جديدة بانتظار المراجعة.
          </div>
        )}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-[800px] rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <DialogHeader className="p-6 border-b bg-muted/10 sr-only">
            <DialogTitle>معاينة العمل: {selectedItem?.title}</DialogTitle>
            <DialogDescription>مراجعة محتوى العمل قبل اتخاذ قرار النشر.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[90vh]">
            <div className="bg-black aspect-video flex items-center justify-center">
              {selectedItem?.mediaType === 'video' ? (
                <video src={selectedItem.mediaUrl} controls className="w-full h-full" autoPlay />
              ) : (
                <img src={selectedItem?.mediaUrl} className="w-full h-full object-contain" alt="Preview" />
              )}
            </div>
            <div className="p-8 space-y-6 bg-white">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-zinc-900">{selectedItem?.title}</h2>
                <div className="flex items-center gap-4 text-muted-foreground font-bold text-sm">
                  <span className="flex items-center gap-1"><Clock size={14}/> {new Date(selectedItem?.createdAt).toLocaleDateString('ar-EG')}</span>
                  <span className="flex items-center gap-1"><User size={14}/> المفهم ID: {selectedItem?.mufhemId.slice(0, 8)}</span>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 rounded-2xl border-2 border-dashed">
                <p className="text-lg leading-relaxed font-medium text-zinc-700">{selectedItem?.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button onClick={() => handleApprove(selectedItem.id)} className="h-16 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-xl text-white shadow-lg">قبول العمل ونشره</Button>
                <Button onClick={() => handleReject(selectedItem.id)} variant="destructive" className="h-16 rounded-2xl font-black text-xl shadow-lg">رفض وحذف العمل</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
