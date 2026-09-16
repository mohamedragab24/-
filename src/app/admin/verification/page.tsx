
"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc, updateDoc, addDoc, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { 
  ShieldCheck, 
  XCircle, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  UserCheck, 
  Clock,
  IdCard,
  Eye,
  FileCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

/**
 * صفحة مراجعة طلبات التوثيق الرسمية المرفوعة من قبل المستخدمين.
 */
export default function AdminVerification() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: adminProfile } = useDoc(userRef);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com" || user?.email === "mohamedmini2006@gamil.com";
  const canReadVerifications = adminProfile?.isAdmin || isMasterAdmin;

  const pendingVerQuery = useMemoFirebase(() => {
    if (!firestore || !canReadVerifications) return null;
    return query(
      collection(firestore, "users"), 
      where("verificationStatus", "==", "pending"),
      limit(100)
    );
  }, [firestore, canReadVerifications]);

  const { data: pendingUsers, isLoading } = useCollection(pendingVerQuery);

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    if (!firestore) return;
    try {
      const isApproved = action === 'approve';
      await updateDoc(doc(firestore, "users", userId), {
        isVerified: isApproved,
        verificationStatus: isApproved ? 'verified' : 'rejected',
        verifiedAt: isApproved ? new Date().toISOString() : null
      });
      
      await addDoc(collection(firestore, "notifications"), {
        userId: userId,
        title: isApproved ? "تم توثيق هويتك بنجاح!" : "فشل توثيق الهوية",
        message: isApproved 
          ? "تهانينا، تم التحقق من وثائقك الثبوتية بنجاح."
          : "عذراً، لم نتمكن من قبول وثائق الهوية المرفوعة. يرجى إعادة الرفع بجودة أفضل.",
        type: isApproved ? "verification_success" : "verification_failed",
        read: false,
        createdAt: new Date().toISOString()
      });

      toast({ title: isApproved ? "تم التوثيق!" : "تم الرفض" });
      setSelectedUser(null);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    }
  };

  if (!canReadVerifications && adminProfile) {
    return <div className="p-20 text-center font-black opacity-30 text-2xl">عذراً، لا تملك صلاحية الوصول لمركز التوثيق.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-12" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-r-8 border-accent pr-6">
        <div className="space-y-2 text-right">
          <h1 className="text-4xl md:text-5xl font-black font-headline text-zinc-900">طلبات توثيق الهوية</h1>
          <p className="text-muted-foreground text-lg">مراجعة البطاقات الشخصية المرفوعة من قبل المفهمين والمستفهمين.</p>
        </div>
        <Button asChild variant="outline" className="h-14 px-8 rounded-2xl font-black border-2 gap-2">
          <Link href="/admin/accounts"><Search size={20}/> البحث والتوثيق يدوياً بالبريد/الهاتف</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full py-32 text-center animate-pulse font-black text-2xl">جاري فحص الطلبات...</div>
        ) : pendingUsers?.length === 0 ? (
          <div className="col-span-full py-32 text-center flex flex-col items-center gap-6 opacity-30">
            <FileCheck size={80} />
            <p className="text-2xl font-black">لا توجد طلبات توثيق هوية بانتظار المراجعة.</p>
          </div>
        ) : pendingUsers?.map((u) => (
          <Card key={u.id} className="shadow-xl rounded-[3rem] overflow-hidden border-2 bg-white hover:border-primary/20 transition-all">
            <CardHeader className="bg-muted/30 p-8 flex flex-col items-center gap-4 text-center">
              <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                <AvatarImage src={u.profilePictureUrl} />
                <AvatarFallback className="text-3xl font-black">{u.fullName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl font-black">{u.fullName}</CardTitle>
                <Badge variant="outline" className="mt-2 font-bold">{u.role === 'mufhem' ? 'خبير' : 'طالب'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button onClick={() => setSelectedUser(u)} className="w-full h-14 rounded-2xl font-black text-lg bg-zinc-900 shadow-lg">
                <Eye className="ml-2" /> مراجعة الوثائق المرفوعة
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-[800px] rounded-[3.5rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <DialogHeader className="p-8 border-b bg-zinc-900 text-white flex flex-row justify-between items-center">
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
              <ShieldCheck className="text-primary h-10 w-10" /> مراجعة وثائق الهوية
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
                <div className="space-y-4">
                  <Label className="font-black text-lg border-r-4 border-primary pr-3 block">الوجه الأمامي (ID Front)</Label>
                  <div className="aspect-[1.6/1] bg-zinc-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                    {selectedUser?.idCardFront ? (
                      <img src={selectedUser.idCardFront} className="w-full h-full object-cover" alt="ID Front" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                        <AlertCircle />
                        <span className="text-xs font-bold">لم ترفع صورة الوجه الأمامي</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="font-black text-lg border-r-4 border-primary pr-3 block">الوجه الخلفي (ID Back)</Label>
                  <div className="aspect-[1.6/1] bg-zinc-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                    {selectedUser?.idCardBack ? (
                      <img src={selectedUser.idCardBack} className="w-full h-full object-cover" alt="ID Back" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                        <AlertCircle />
                        <span className="text-xs font-bold">لم ترفع صورة الوجه الخلفي</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-start gap-4 text-right">
                <AlertCircle size={20} className="text-blue-600 shrink-0 mt-1" />
                <p className="text-sm font-bold text-blue-800 leading-relaxed">
                  تأكد من وضوح البيانات ومطابقتها لاسم المستخدم المسجل قبل الضغط على "اعتماد التوثيق".
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 pb-6">
                <Button onClick={() => handleAction(selectedUser.id, 'approve')} className="h-20 rounded-[2rem] bg-green-600 hover:bg-green-700 font-black text-2xl text-white shadow-2xl transition-all">اعتماد التوثيق</Button>
                <Button onClick={() => handleAction(selectedUser.id, 'reject')} variant="destructive" className="h-20 rounded-[2rem] font-black text-2xl shadow-2xl transition-all">رفض الطلب</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
