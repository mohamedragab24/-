
"use client";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  Plus, 
  Download, 
  Smartphone, 
  Building2, 
  CheckCircle2, 
  ShieldCheck,
  History,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type WithdrawalMethod = 'insta_pay' | 'e_wallet' | 'bank_transfer';

function WalletContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>('e_wallet');
  const [transferTarget, setTarget] = useState("");

  const userRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(userRef);

  const transactionsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, "users", user.uid, "transactions"), orderBy("timestamp", "desc")) : null, [firestore, user]);
  const { data: transactions, isLoading } = useCollection(transactionsQuery);

  const balance = transactions?.reduce((acc: number, tx: any) => {
    if (tx.status === 'rejected') return acc;
    if (tx.type === 'deposit' || tx.type === 'earning') return acc + tx.amount;
    return acc - tx.amount;
  }, 0) || 0;

  const handleTransaction = async () => {
    if (!firestore || !user || !amount || !profile) return;
    const numAmount = Number(amount);
    
    if (profile.role === 'mufhem') {
      if (numAmount > balance) { toast({ variant: "destructive", title: "رصيد غير كافٍ" }); return; }
      if (!transferTarget) { toast({ variant: "destructive", title: "يرجى تحديد رقم التحويل" }); return; }
      
      const txRef = await addDoc(collection(firestore, "users", user.uid, "transactions"), {
        amount: numAmount,
        type: 'withdrawal',
        details: `سحب أرباح (${withdrawalMethod})`,
        status: 'pending',
        transferTarget,
        method: withdrawalMethod,
        timestamp: new Date().toISOString()
      });

      await addDoc(collection(firestore, "payoutRequests"), {
        userId: user.uid,
        userName: profile.fullName,
        method: withdrawalMethod,
        transferTarget,
        amount: numAmount,
        status: 'pending',
        transactionId: txRef.id,
        timestamp: new Date().toISOString()
      });
      toast({ title: "تم تقديم طلب السحب" });
    } else {
      await addDoc(collection(firestore, "users", user.uid, "transactions"), {
        amount: numAmount,
        type: 'deposit',
        details: 'شحن رصيد المحفظة',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      toast({ title: "تم الشحن بنجاح" });
    }
    setIsModalOpen(false);
    setAmount("");
    setTarget("");
  };

  if (isLoading || !profile) return <div className="p-10 text-center font-bold">جاري تحميل المحفظة...</div>;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12 mb-20" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div><h1 className="text-5xl font-black font-headline">محفظة فهمت</h1><p className="text-muted-foreground text-xl">إدارة رصيدك والتحكم في أرباحك.</p></div>
        <div className="bg-green-100 text-green-700 px-6 py-3 rounded-2xl font-black flex items-center gap-3"><ShieldCheck /> معاملات مؤمنة</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card className="lg:col-span-2 bg-zinc-900 text-white border-none shadow-2xl rounded-[3rem] p-12 relative overflow-hidden">
          <div className="relative z-10 space-y-10">
            <div className="space-y-2"><span className="text-zinc-400 font-black text-xl">الرصيد المتاح</span><div className="flex items-baseline gap-4"><span className="text-8xl font-black tabular-nums tracking-tighter">{balance}</span><span className="text-3xl font-bold opacity-60">ج.م</span></div></div>
            <Button onClick={()=>setIsModalOpen(true)} className="bg-primary text-white px-12 py-10 rounded-3xl font-black text-2xl shadow-xl transition-all">
              {profile.role === 'mustafhem' ? <><Plus className="ml-3 h-8 w-8" /> إضافة رصيد</> : <><Download className="ml-3 h-8 w-8" /> سحب الأرباح</>}
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent dir="rtl" className="rounded-[3rem] sm:max-w-[550px]">
          <DialogHeader><DialogTitle className="text-right text-3xl font-black">{profile.role === 'mustafhem' ? 'شحن المحفظة' : 'سحب الأرباح'}</DialogTitle></DialogHeader>
          <div className="py-6 space-y-8 text-right">
            <div className="space-y-3"><Label className="font-black text-xl">المبلغ (ج.م)</Label><Input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className="h-16 text-3xl font-black text-center rounded-2xl border-2" /></div>
            {profile.role === 'mufhem' && (
              <div className="space-y-6">
                <Label className="font-black text-xl">وسيلة السحب</Label>
                <RadioGroup value={withdrawalMethod} onValueChange={(v:any)=>setWithdrawalMethod(v)} className="grid gap-3">
                  <div className="flex items-center justify-between p-4 border-2 rounded-xl"><div className="flex items-center gap-3"><Smartphone className="text-primary"/><Label className="font-bold">محفظة إلكترونية</Label></div><RadioGroupItem value="e_wallet" /></div>
                  <div className="flex items-center justify-between p-4 border-2 rounded-xl"><div className="flex items-center gap-3"><CheckCircle2 className="text-primary"/><Label className="font-bold">إنستا باي (InstaPay)</Label></div><RadioGroupItem value="insta_pay" /></div>
                  <div className="flex items-center justify-between p-4 border-2 rounded-xl"><div className="flex items-center gap-3"><Building2 className="text-primary"/><Label className="font-bold">تحويل بنكي</Label></div><RadioGroupItem value="bank_transfer" /></div>
                </RadioGroup>
                <div className="space-y-2"><Label className="font-black">رقم الحساب / المحفظة للتحويل</Label><Input value={transferTarget} onChange={(e)=>setTarget(e.target.value)} className="h-14 rounded-xl border-2 font-bold" /></div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleTransaction} className="w-full py-8 text-xl font-black rounded-2xl shadow-xl">تأكيد العملية</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-8 pt-10">
        <h2 className="text-3xl font-black flex items-center gap-3 text-right"><History className="text-primary"/> سجل المعاملات</h2>
        <Card className="shadow-2xl border-2 overflow-hidden rounded-[3rem] bg-white">
          <Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-right px-8 font-black">العملية</TableHead><TableHead className="text-right font-black">التاريخ</TableHead><TableHead className="text-right font-black">المبلغ</TableHead><TableHead className="text-right px-8 font-black">الحالة</TableHead></TableRow></TableHeader>
            <TableBody>
              {transactions?.map((tx: any) => (
                <TableRow key={tx.id} className="h-20">
                  <TableCell className="px-8 font-bold">{tx.details}</TableCell>
                  <TableCell className="text-muted-foreground font-bold">{new Date(tx.timestamp).toLocaleDateString('ar-EG')}</TableCell>
                  <TableCell className={`font-black text-xl ${tx.type === 'deposit' || tx.type === 'earning' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'deposit' || tx.type === 'earning' ? '+' : '-'}{tx.amount} ج.م</TableCell>
                  <TableCell className="px-8"><Badge className={tx.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}>{tx.status === 'completed' ? 'ناجحة' : 'قيد الانتظار'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">جاري التحميل...</div>}>
      <WalletContent />
    </Suspense>
  );
}
