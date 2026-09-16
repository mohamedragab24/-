
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCent, Download, Plus, Search, CheckCircle2, XCircle, Wallet, MinusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminFinance() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchId, setSearchId] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [actionType, setActionType] = useState<'deposit' | 'withdrawal'>('deposit');
  
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: adminProfile } = useDoc(userRef);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com" || user?.email === "mohamedmini2006@gamil.com";
  const canReadFinance = adminProfile?.isAdmin || isMasterAdmin;

  const pendingPayoutQuery = useMemoFirebase(() => {
    if (!firestore || !canReadFinance) return null;
    return query(collection(firestore, "payoutRequests"), where("status", "==", "pending"));
  }, [firestore, canReadFinance]);

  const completedPayoutQuery = useMemoFirebase(() => {
    if (!firestore || !canReadFinance) return null;
    return query(collection(firestore, "payoutRequests"), where("status", "==", "completed"));
  }, [firestore, canReadFinance]);

  const rejectedPayoutQuery = useMemoFirebase(() => {
    if (!firestore || !canReadFinance) return null;
    return query(collection(firestore, "payoutRequests"), where("status", "==", "rejected"));
  }, [firestore, canReadFinance]);

  const { data: rawPending } = useCollection(pendingPayoutQuery);
  const { data: rawCompleted } = useCollection(completedPayoutQuery);
  const { data: rawRejected } = useCollection(rejectedPayoutQuery);

  const pendingPayouts = rawPending?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const completedPayouts = rawCompleted?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const rejectedPayouts = rawRejected?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleSearch = async () => {
    if (!firestore || !searchId.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال البريد الإلكتروني أو المعرف للبحث." });
      return;
    }
    
    setTargetUser(null);
    try {
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("email", "==", searchId.trim()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setTargetUser({ ...snap.docs[0].data(), id: snap.docs[0].id });
      } else {
        const userRef = doc(firestore, "users", searchId.trim());
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setTargetUser({ ...userSnap.data(), id: userSnap.id });
        } else {
          toast({ variant: "destructive", title: "خطأ", description: "عذراً، هذا المستخدم غير موجود." });
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "حدث خطأ أثناء محاولة البحث." });
    }
  };

  const handleManualAction = async () => {
    if (!firestore || !targetUser || !amount) return;
    try {
      const numAmount = Number(amount);
      await addDoc(collection(firestore, "users", targetUser.id, "transactions"), {
        amount: numAmount,
        type: actionType,
        details: actionType === 'deposit' ? 'شحن رصيد يدوي بواسطة الإدارة' : 'خصم رصيد يدوي بواسطة الإدارة',
        status: 'completed',
        timestamp: new Date().toISOString()
      });

      await addDoc(collection(firestore, "adminLogs"), {
        action: actionType === 'deposit' ? 'manual_recharge' : 'manual_deduction',
        targetUserId: targetUser.id,
        amount: numAmount,
        timestamp: new Date().toISOString()
      });

      toast({ title: "تمت العملية!", description: `تم تحديث رصيد ${targetUser.fullName} بنجاح.` });
      setAmount("");
      setTargetUser(null);
      setSearchId("");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تنفيذ العملية المالية." });
    }
  };

  const approvePayout = async (payout: any) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "payoutRequests", payout.id), { status: 'completed' });
      if (payout.transactionId) {
        await updateDoc(doc(firestore, "users", payout.userId, "transactions", payout.transactionId), {
          status: 'completed',
          details: 'تم تحويل أرباحك لمحفظتك بنجاح'
        });
      }
      toast({ title: "تم التحويل", description: "تم تأكيد تحويل المبلغ بنجاح." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل معالجة الطلب." });
    }
  };

  const rejectPayout = async () => {
    if (!firestore || !selectedPayout || !rejectionReason.trim()) return;
    try {
      await updateDoc(doc(firestore, "payoutRequests", selectedPayout.id), { 
        status: 'rejected',
        rejectionReason: rejectionReason 
      });
      if (selectedPayout.transactionId) {
        await updateDoc(doc(firestore, "users", selectedPayout.userId, "transactions", selectedPayout.transactionId), {
          status: 'rejected',
          details: `مرفوض: ${rejectionReason}`
        });
      }
      setIsRejectModalOpen(false);
      setRejectionReason("");
      setSelectedPayout(null);
      toast({ title: "تم الرفض", description: "تم رفض الطلب وإعادة الرصيد للمستخدم." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل رفض الطلب." });
    }
  };

  if (!canReadFinance && adminProfile) {
    return <div className="p-20 text-center font-black opacity-30 text-2xl">عذراً، لا تملك صلاحية الوصول لهذه الصفحة.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex justify-between items-center border-r-8 border-purple-500 pr-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black font-headline">إدارة المالية</h1>
          <p className="text-muted-foreground text-lg">التحكم في الأرصدة وإدارة طلبات السحب.</p>
        </div>
      </div>

      <Tabs defaultValue="payouts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-16 p-1 bg-muted rounded-2xl mb-8">
          <TabsTrigger value="actions" className="rounded-xl text-lg font-bold">
            <Wallet className="h-5 w-5 ml-2" /> شحن/خصم يدوي
          </TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-xl text-lg font-bold">
            <Download className="h-5 w-5 ml-2" /> طلبات السحب
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <Card className="max-w-3xl mx-auto shadow-xl rounded-[2.5rem] overflow-hidden border-2">
            <CardHeader className="bg-purple-600 text-white p-8">
              <CardTitle className="text-2xl font-black flex items-center gap-3">
                <BadgeCent className="h-8 w-8" /> التحكم في الرصيد
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="font-bold mb-2 block">البريد الإلكتروني أو المعرف</Label>
                  <Input 
                    placeholder="مثال: name@example.com" 
                    className="h-14 rounded-xl text-lg"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                  />
                </div>
                <Button onClick={handleSearch} className="h-14 px-8 rounded-xl bg-purple-600 mt-8">
                  <Search className="h-6 w-6" />
                </Button>
              </div>

              {targetUser && (
                <div className="p-6 bg-zinc-50 rounded-2xl border-2 border-dashed space-y-6 animate-in fade-in">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={targetUser.profilePictureUrl} />
                      <AvatarFallback>{targetUser.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-xl font-black">{targetUser.fullName}</h4>
                      <p className="text-sm text-muted-foreground font-bold">{targetUser.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant={actionType === 'deposit' ? 'default' : 'outline'}
                      onClick={() => setActionType('deposit')}
                      className={`h-14 text-lg font-bold rounded-xl ${actionType === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      <Plus className="ml-2 h-5 w-5" /> شحن
                    </Button>
                    <Button 
                      variant={actionType === 'withdrawal' ? 'destructive' : 'outline'}
                      onClick={() => setActionType('withdrawal')}
                      className="h-14 text-lg font-bold rounded-xl"
                    >
                      <MinusCircle className="ml-2 h-5 w-5" /> خصم
                    </Button>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <Label className="font-bold">المبلغ (ج.م)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="h-16 text-3xl font-black text-center rounded-2xl"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <Button 
                      onClick={handleManualAction} 
                      className={`w-full h-14 text-xl font-black rounded-xl ${actionType === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      تأكيد العملية
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="bg-transparent gap-4 mb-6">
              <TabsTrigger value="pending" className="bg-orange-50 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-xl px-8 font-bold">
                الانتظار ({pendingPayouts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="completed" className="bg-green-50 data-[state=active]:bg-green-500 data-[state=active]:text-white rounded-xl px-8 font-bold">
                المكتملة ({completedPayouts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="bg-red-50 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-xl px-8 font-bold">
                المرفوضة ({rejectedPayouts?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <PayoutTable payouts={pendingPayouts} onApprove={approvePayout} onReject={(p: any) => { setSelectedPayout(p); setIsRejectModalOpen(true); }} />
            </TabsContent>
            <TabsContent value="completed">
              <PayoutTable payouts={completedPayouts} readonly />
            </TabsContent>
            <TabsContent value="rejected">
              <PayoutTable payouts={rejectedPayouts} readonly showReason />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-2xl font-black">رفض طلب السحب</DialogTitle>
            <DialogDescription className="text-right">يرجى كتابة سبب الرفض، سيتم إخطار المستخدم وإعادة الرصيد له.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label className="font-bold mb-2 block">سبب الرفض</Label>
            <Textarea 
              placeholder="مثلاً: رقم المحفظة غير صحيح..." 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="h-32 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={rejectPayout} className="w-full h-12 font-bold">تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayoutTable({ payouts, onApprove, onReject, readonly, showReason }: any) {
  return (
    <Card className="shadow-xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
      <Table>
        <TableHeader className="bg-muted/50 h-16">
          <TableRow>
            <TableHead className="text-right px-8 font-black">المفهم</TableHead>
            <TableHead className="text-right font-black">المبلغ</TableHead>
            <TableHead className="text-right font-black">رقم المحفظة</TableHead>
            <TableHead className="text-right font-black">التاريخ</TableHead>
            {showReason && <TableHead className="text-right font-black">السبب</TableHead>}
            {!readonly && <TableHead className="text-left px-8 font-black">الإجراءات</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts?.map((p: any) => (
            <TableRow key={p.id} className="h-20 hover:bg-zinc-50">
              <TableCell className="px-8">
                <div className="flex flex-col text-right">
                  <span className="font-bold">{p.userName}</span>
                  <span className="text-[10px] text-muted-foreground">{p.userEmail}</span>
                </div>
              </TableCell>
              <TableCell className="font-black text-purple-600 text-lg">{p.amount} ج.م</TableCell>
              <TableCell className="font-mono font-bold">{p.phoneNumber}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(p.timestamp).toLocaleDateString('ar-EG')}
              </TableCell>
              {showReason && <TableCell className="text-red-600 font-bold italic text-sm">{p.rejectionReason || "-"}</TableCell>}
              {!readonly && (
                <TableCell className="px-8 text-left">
                  <div className="flex gap-2 justify-end">
                    <Button onClick={() => onApprove(p)} size="sm" className="bg-green-600 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                    </Button>
                    <Button onClick={() => onReject(p)} size="sm" variant="destructive" className="rounded-lg">
                      <XCircle className="h-4 w-4 ml-1" /> رفض
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {(!payouts || payouts.length === 0) && (
            <TableRow>
              <TableCell colSpan={showReason ? 6 : 5} className="text-center py-20 text-muted-foreground font-bold">
                لا توجد طلبات حالياً.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
