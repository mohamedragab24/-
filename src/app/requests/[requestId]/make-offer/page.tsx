
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, collection, addDoc } from "firebase/firestore";
import { 
  Zap, 
  BadgeCent, 
  Clock, 
  Send, 
  ChevronRight, 
  Loader2,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  User,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

/**
 * صفحة تقديم عرض تفهيم - تم تحديثها للفترة المجانية واختيار موعد محدد.
 */
export default function MakeOfferPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  // السعر مثبت على صفر للفترة المجانية، والمدة أصبحت موعداً محدداً
  const [formData, setFormData] = useState({ amount: "0", readyAt: "", details: "" });

  const requestRef = useMemoFirebase(() => (firestore && requestId) ? doc(firestore, "istifhams", requestId as string) : null, [firestore, requestId]);
  const { data: request, isLoading } = useDoc(requestRef);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !request) return;
    
    if (!formData.readyAt) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى تحديد موعد جاهزيتك للجلسة." });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, "istifhams", requestId as string, "offers"), {
        mufhemId: user.uid,
        mufhemName: user.displayName || "مفهم",
        mufhemAvatar: user.photoURL || "",
        amount: 0, // دائماً صفر في الفترة المجانية
        readyAt: formData.readyAt,
        details: formData.details,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم إرسال عرضك بنجاح!", description: "ستتلقى إشعاراً فور قبول الطالب لعرضك." });
      router.push(`/requests/${requestId}`);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال العرض، يرجى المحاولة لاحقاً." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4 bg-white min-h-screen" dir="rtl">
      <Loader2 className="animate-spin h-12 w-12 text-primary" />
      <p className="font-black text-2xl">جاري تحضير صفحة العرض...</p>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10 mb-20" dir="rtl">
      <div className="flex items-center justify-between border-r-8 border-primary pr-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black font-headline text-zinc-900">تقديم عرض تفهيم</h1>
          <p className="text-muted-foreground text-lg font-bold">ضع خطة الشرح الخاصة بك وموعد جاهزيتك لإقناع المستفهم.</p>
        </div>
        <Button variant="ghost" onClick={() => router.back()} className="h-14 rounded-2xl font-bold gap-2">
          <ChevronRight className="h-5 w-5" /> <span>رجوع</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-10">
        <Card className="rounded-[2.5rem] bg-zinc-900 text-white p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-10 opacity-5 -rotate-12"><HelpCircle size={150}/></div>
          <div className="relative z-10 space-y-4 text-right">
            <Badge variant="outline" className="text-primary border-primary/30 font-black">أنت تقدم عرضاً على:</Badge>
            <h2 className="text-3xl font-black">{request?.title}</h2>
            <div className="pt-4 border-t border-white/10 flex gap-6 text-sm font-bold text-zinc-400 justify-end">
              <span className="flex items-center gap-2"><User size={16}/> المستفهم: {request?.mustafhemName}</span>
              <span className="flex items-center gap-2"><Calendar size={16}/> موعد المستفهم: {new Date(request?.meetingTime).toLocaleString('ar-EG')}</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-[3rem] border-2 shadow-2xl bg-white overflow-hidden">
          <CardHeader className="bg-zinc-50 p-8 border-b">
            <CardTitle className="text-xl font-black flex items-center gap-3">
              <Zap className="text-primary" /> تفاصيل عرضك المالي والتقني
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 md:p-12 space-y-10 text-right">
            <form onSubmit={handleSendOffer} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3 text-right">
                  <Label className="font-black text-lg flex items-center gap-2 justify-end">سعرك المقترح <BadgeCent size={18} className="text-green-600"/></Label>
                  <Input 
                    type="text" 
                    readOnly
                    className="h-16 rounded-2xl border-2 font-black text-3xl text-center shadow-inner bg-zinc-50 text-zinc-400" 
                    value="0" 
                  />
                  <p className="text-[10px] text-green-600 font-black text-center">الخدمة مجانا لحين انتهاء الفترة المجانية</p>
                </div>
                <div className="space-y-3 text-right">
                  <Label className="font-black text-lg flex items-center gap-2 justify-end">موعد الجاهزية <Clock size={18} className="text-blue-600"/></Label>
                  <Input 
                    type="datetime-local" 
                    className="h-16 rounded-2xl border-2 font-bold text-lg text-center shadow-inner focus:border-primary px-4" 
                    value={formData.readyAt} 
                    onChange={(e) => setFormData({...formData, readyAt: e.target.value})} 
                    required 
                  />
                  <p className="text-[10px] text-muted-foreground font-bold text-center">(يرجى الالتزام بالموعد الذي حدده المستفهم قدر الإمكان لزيادة فرصة قبول عرضك)</p>
                </div>
              </div>

              <div className="space-y-3 text-right">
                <Label className="font-black text-lg flex items-center gap-2 justify-end">تفاصيل العرض <FileText size={18} className="text-primary"/></Label>
                <Textarea 
                  className="h-48 rounded-[2rem] border-2 p-6 text-lg font-medium leading-relaxed focus:border-primary" 
                  placeholder="(اشرح اسلوبك ومؤهلاتك والأدوات التي ستستخدمها ووضح لماذا انت الأنسب لهذه المهمة)"
                  value={formData.details} 
                  onChange={(e) => setFormData({...formData, details: e.target.value})} 
                  required 
                />
              </div>

              <div className="p-6 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 space-y-4">
                <AlertCircle size={24} className="shrink-0 mt-1 text-blue-600" />
                <p className="text-xs font-bold leading-relaxed text-blue-800">
                  تنبيه: التزامك بالموعد والجودة المحددة في العرض هو أساس الثقة في فهمت. لا يحق لك طلب مبالغ إضافية خارج المنصة.
                </p>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-24 rounded-[2.5rem] text-3xl font-black bg-primary shadow-2xl hover:scale-[1.02] transition-all">
                {isSubmitting ? <><Loader2 className="animate-spin ml-3 h-8 w-8" /> جاري الإرسال...</> : "إرسال العرض"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
