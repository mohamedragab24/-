
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, 
  Search, 
  PlayCircle, 
  ImageIcon, 
  Clock, 
  User,
  Layout
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminPortfolioManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const worksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "portfolio"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: works, isLoading } = useCollection(worksQuery);

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "portfolio", id));
      toast({ title: "تم الحذف", description: "تم إزالة العمل من المنصة نهائياً." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  const filteredWorks = works?.filter(w => 
    w.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.mufhemId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-accent pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">إدارة معرض الأعمال</h1>
          <p className="text-muted-foreground text-lg">الرقابة الكاملة على كافة النماذج التعليمية المنشورة.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالعنوان أو معرف المفهم..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 focus:border-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 text-center animate-pulse">جاري تحميل المعرض...</div>
        ) : filteredWorks?.map((work) => (
          <Card key={work.id} className="rounded-3xl overflow-hidden shadow-md border-2 bg-white flex flex-col group">
            <div className="relative aspect-square bg-zinc-100 overflow-hidden">
              {work.mediaType === 'video' ? (
                <div className="w-full h-full relative">
                  <video src={work.mediaUrl} className="w-full h-full object-cover" muted />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <PlayCircle className="text-white h-12 w-12" />
                  </div>
                </div>
              ) : (
                <img src={work.mediaUrl} className="w-full h-full object-cover" alt="Work" />
              )}
              <Badge className={`absolute top-3 right-3 border-none font-black ${work.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                {work.status === 'approved' ? 'منشور' : 'قيد المراجعة'}
              </Badge>
            </div>
            <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="font-black text-zinc-800 line-clamp-1">{work.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold mt-2">
                  <User size={12} /> ID: {work.mufhemId.slice(0, 8)}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-dashed">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock size={10}/> {new Date(work.createdAt).toLocaleDateString('ar-EG')}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 rounded-xl h-9 w-9">
                      <Trash2 size={18} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">حذف هذا العمل؟</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">سيتم إزالة هذا النموذج التعليمي نهائياً من معرض أعمال المفهم ومن المنصة.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(work.id)} className="bg-red-600">تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!filteredWorks || filteredWorks.length === 0) && !isLoading && (
          <div className="col-span-full py-20 text-center opacity-30 font-black text-xl">
            لا توجد أعمال مطابقة للبحث.
          </div>
        )}
      </div>
    </div>
  );
}
