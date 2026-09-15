
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { doc } from "firebase/firestore";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const handleResetRequest = async () => {
    if (!email.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال البريد الإلكتروني." });
      return;
    }
    
    setIsProcessing(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setIsSuccess(true);
      toast({ title: "تم الإرسال!", description: "تحقق من بريدك الإلكتروني الآن." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "تأكد من صحة البريد المرتبط بالحساب." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#F8FAFC]" dir="rtl">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 -z-10"></div>
      
      <Card className="w-full max-w-xl shadow-[0_40px_100px_rgba(0,0,0,0.08)] border-4 border-white rounded-[4rem] bg-white overflow-hidden animate-in fade-in zoom-in duration-700">
        <CardHeader className="text-center pt-16 pb-8 space-y-10">
          <div className="relative mx-auto w-fit group">
            {settings?.logoUrl ? (
              <div className="h-40 md:h-52 flex items-center justify-center">
                <img src={settings.logoUrl} className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110" alt="Logo" />
              </div>
            ) : (
              <div className="w-32 h-32 flex items-center justify-center mx-auto text-primary">
                <Lock size={64} strokeWidth={2.5} />
              </div>
            )}
          </div>

          <div className="space-y-3 px-6">
            <CardTitle className="text-4xl md:text-5xl font-black text-zinc-900 tracking-tight">استعادة الدخول</CardTitle>
            <CardDescription className="text-xl font-bold text-zinc-500 leading-relaxed max-w-sm mx-auto">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-10 md:px-16 pb-12">
          {!isSuccess ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="font-black text-lg text-zinc-800">البريد الإلكتروني</Label>
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e)=>setEmail(e.target.value)} 
                  className="h-16 rounded-2xl border-2 font-black text-xl shadow-sm" 
                />
              </div>

              <Button onClick={handleResetRequest} disabled={isProcessing} className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin h-8 w-8" /> : "إرسال رابط الاستعادة"}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-10 py-6">
              <div className="bg-green-100 w-32 h-32 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 size={80} className="animate-bounce" />
              </div>
              <div className="space-y-4">
                <h3 className="text-4xl font-black">تم إرسال الرابط!</h3>
                <p className="text-xl font-bold text-zinc-500 leading-relaxed px-4">
                  تحقق من بريدك الآن واتبع التعليمات لتعيين كلمة المرور الجديدة.
                </p>
              </div>
              <Button asChild className="w-full h-20 rounded-[2rem] text-2xl font-black bg-zinc-900">
                <Link href="/login">العودة لتسجيل الدخول</Link>
              </Button>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="justify-center border-t border-zinc-50 py-12 bg-zinc-50/30">
          <Button variant="ghost" asChild className="font-black text-zinc-400 hover:text-primary text-xl gap-3 h-14">
            <Link href="/login">
              <ChevronRight size={28} className="rotate-180" /> 
              <span>رجوع للخلف</span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
