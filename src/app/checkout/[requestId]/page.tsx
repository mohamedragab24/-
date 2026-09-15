
"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, collection, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Wallet, 
  Smartphone, 
  CreditCard, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  BadgeCent,
  Lock,
  ArrowRight,
  FileText,
  Download,
  Printer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { cn } from "@/lib/utils";

type PaymentMethod = 'wallet' | 'e-wallet' | 'card';

function CheckoutContent() {
  const params = useParams();
  const requestId = params?.requestId as string;
  const searchParams = useSearchParams();
  const offerId = searchParams?.get('offerId');
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedRefund, setAgreedRefund] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, "istifhams", requestId);
  }, [firestore, requestId]);

  const { data: request, isLoading: isRequestLoading } = useDoc(requestRef);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!firestore || !user?.uid) return;
      const txSnap = await getDocs(collection(firestore, "users", user.uid, "transactions"));
      let bal = 0;
      txSnap.forEach(doc => {
        const d = doc.data();
        if (d.status !== 'rejected') {
          if (d.type === 'deposit' || d.type === 'earning') bal += d.amount;
          else bal -= d.amount;
        }
      });
      setWalletBalance(bal);
    };
    fetchBalance();
  }, [firestore, user?.uid]);

  const amountToPay = request?.amount || 0;

  const handlePayment = async () => {
    if (!firestore || !user || !request) return;
    if (!agreedTerms || !agreedRefund) {
      toast({ variant: "destructive", title: "تنبيه", description: "يجب الموافقة على الشروط وسياسة الاسترجاع للمتابعة." });
      return;
    }

    if (walletBalance < amountToPay && paymentMethod === 'wallet') {
      toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "يرجى شحن محفظتك للمتابعة." });
      return;
    }

    setIsProcessing(true);
    try {
      const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // تحديث حالة الطلب
      await updateDoc(requestRef!, { 
        status: "paid", 
        invoiceNumber,
        paidAt: new Date().toISOString()
      });

      // خصم من المحفظة
      await addDoc(collection(firestore, "users", user.uid, "transactions"), {
        amount: amountToPay,
        type: 'payment',
        details: `دفع رسوم محاضرة: ${request.title}`,
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      
      setInvoiceData({
        number: invoiceNumber,
        date: new Date().toLocaleDateString('ar-EG'),
        customerName: user.displayName || "عميل فهمت",
        customerEmail: user.email,
        productName: request.title,
        price: amountToPay,
        status: 'مدفوع'
      });

      toast({ title: "تم الدفع بنجاح!" });
      setShowInvoice(true);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الدفع" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isRequestLoading) return <div className="p-20 text-center animate-pulse font-black">جاري التحميل...</div>;
  if (!request) return <div className="p-20 text-center font-bold text-red-500">الاستفهام غير موجود.</div>;

  if (showInvoice && invoiceData) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-10" dir="rtl">
        <Card className="rounded-[3rem] shadow-2xl border-4 border-primary/10 bg-white overflow-hidden p-8 md:p-12 space-y-10">
          <div className="flex justify-between items-start border-b pb-8">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-primary">فاتورة إلكترونية</h2>
              <p className="text-zinc-400 font-bold">رقم: {invoiceData.number}</p>
            </div>
            <div className="text-3xl font-black text-zinc-900">فهمت.</div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 text-right">
            <div>
              <Label className="text-zinc-400 font-black text-[10px] uppercase">العميل</Label>
              <p className="font-black text-lg">{invoiceData.customerName}</p>
              <p className="text-xs text-zinc-500 font-medium">{invoiceData.customerEmail}</p>
            </div>
            <div className="text-left">
              <Badge className="bg-green-100 text-green-600 text-lg px-6 py-1 font-black">مدفوع</Badge>
              <p className="text-xs text-zinc-400 font-bold mt-2">{invoiceData.date}</p>
            </div>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-8 border-2 border-dashed">
            <table className="w-full text-right">
              <thead>
                <tr className="text-zinc-400 text-xs font-black uppercase border-b pb-4">
                  <th className="pb-4">الوصف</th>
                  <th className="pb-4 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-xl font-black text-zinc-800">
                  <td className="pt-6">{invoiceData.productName}</td>
                  <td className="pt-6 text-left">{invoiceData.price} ج.م</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-6 flex justify-between items-center px-4">
            <span className="text-xl font-bold text-zinc-500">الإجمالي النهائي</span>
            <span className="text-4xl font-black text-primary">{invoiceData.price} ج.م</span>
          </div>

          <div className="pt-8 border-t space-y-4">
            <Button onClick={() => router.push(`/meeting/${requestId}`)} className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary shadow-xl hover:scale-[1.02] transition-all">
              الانتقال للمحاضرة المباشرة <ArrowRight className="mr-2 rotate-180" />
            </Button>
            <Button variant="ghost" onClick={() => window.print()} className="w-full h-12 rounded-xl font-bold text-zinc-400">
              <Printer size={18} className="ml-2" /> طباعة الفاتورة
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline">إتمام الدفع الآمن</h1>
        <p className="text-muted-foreground text-lg">أنت على وشك تفعيل غرفتك التعليمية الخاصة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card className="rounded-[2.5rem] shadow-xl bg-white p-8 space-y-8 h-fit border-2">
          <div className="space-y-4 text-right">
            <Label className="text-zinc-400 font-black text-[10px] uppercase">ملخص الطلب</Label>
            <h4 className="font-black text-xl text-zinc-800 leading-tight">{request.title}</h4>
          </div>
          <div className="pt-6 border-t border-dashed flex justify-between items-center">
            <span className="text-zinc-400 font-black">المبلغ</span>
            <span className="text-3xl font-black text-primary">{amountToPay} <span className="text-sm">ج.م</span></span>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[3rem] shadow-2xl bg-white p-8 md:p-12 space-y-10 border-2 text-right">
            <div className="space-y-6">
              <h3 className="text-2xl font-black flex items-center gap-3 justify-end">
                اختر وسيلة الدفع <Lock className="text-zinc-300" size={20} />
              </h3>
              
              <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="grid gap-4">
                <div className={cn(
                  "p-8 rounded-[2.5rem] border-4 transition-all cursor-pointer flex items-center justify-between",
                  paymentMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-zinc-100 bg-zinc-50'
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-4 rounded-2xl", paymentMethod === 'wallet' ? 'bg-primary text-white' : 'bg-zinc-200')}>
                      <Wallet size={32} />
                    </div>
                    <div>
                      <Label className="text-xl font-black cursor-pointer block">محفظة الموقع</Label>
                      <p className="text-sm font-bold text-zinc-500">رصيدك الحالي: {walletBalance} ج.م</p>
                    </div>
                  </div>
                  <RadioGroupItem value="wallet" id="wallet" className="h-6 w-6" />
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-6 p-8 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed">
              <div className="flex items-start gap-4 flex-row-reverse">
                <Checkbox id="terms" checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(!!v)} className="mt-1" />
                <Label htmlFor="terms" className="text-sm font-bold text-zinc-600 leading-relaxed cursor-pointer select-none">
                  أوافق على <Link href="/terms" target="_blank" className="text-primary underline">شروط الاستخدام</Link> الخاصة بالمنصة.
                </Label>
              </div>
              <div className="flex items-start gap-4 flex-row-reverse">
                <Checkbox id="refund" checked={agreedRefund} onCheckedChange={(v) => setAgreedRefund(!!v)} className="mt-1" />
                <Label htmlFor="refund" className="text-sm font-bold text-zinc-600 leading-relaxed cursor-pointer select-none">
                  أوافق على <Link href="/refund-policy" target="_blank" className="text-primary underline">سياسة الاسترجاع</Link> (حق الاسترداد خلال 14 يوماً).
                </Label>
              </div>
            </div>

            <Button 
              disabled={isProcessing} 
              onClick={handlePayment} 
              className="w-full h-24 rounded-[2.5rem] text-3xl font-black bg-primary shadow-2xl hover:scale-[1.02] transition-all"
            >
              {isProcessing ? <><Loader2 className="ml-3 animate-spin" /> جاري التأمين...</> : "تأكيد الدفع الآن"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center animate-pulse font-black">جاري تحميل بوابة الدفع...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
