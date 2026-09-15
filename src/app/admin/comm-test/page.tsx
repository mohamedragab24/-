"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Send, Loader2, CheckCircle2, AlertCircle, Smartphone, Bug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendNotification } from "@/ai/flows/messaging-flow";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function CommTestPage() {
  const [recipient, setRecipient] = useState("");
  const [method, setMethod] = useState<'email' | 'whatsapp'>('whatsapp');
  const [subject, setSubject] = useState("رسالة تجريبية من منصة فهمني");
  const [body, setBody] = useState("مرحباً، هذه رسالة تجريبية لاختبار نظام التنبيهات في المنصة.");
  const [isSending, setIsSending] = useState(false);
  const [debugResult, setDebugResult] = useState<any>(null);
  const { toast } = useToast();

  const handleTestSend = async () => {
    if (!recipient.trim() || !body.trim()) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال المستلم ونص الرسالة." });
      return;
    }

    setIsSending(true);
    setDebugResult(null);
    try {
      const result = await sendNotification({
        recipient: recipient.trim(),
        method,
        subject: method === 'email' ? subject : undefined,
        body: body.trim()
      });

      if (result.success) {
        toast({ title: "تم الإرسال بنجاح!", description: result.message });
      } else {
        setDebugResult(result.rawError);
        toast({ 
          variant: "destructive", 
          title: "فشل الإرسال", 
          description: result.message,
          duration: 6000 
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ تقني", description: "تعذر الاتصال بسيرفر المراسلات." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">مركز اختبار المراسلات</h1>
        <p className="text-muted-foreground text-lg">اختبر وصول رسائل الواتساب والبريد الإلكتروني بشكل مباشر.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
          <CardHeader className="bg-zinc-900 text-white p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <Send className="text-primary" /> إرسال تنبيه تجريبي
            </CardTitle>
            <CardDescription className="text-zinc-400">تأكد من إعدادات Infobip قبل البدء.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <Label className="font-black text-lg">وسيلة الإرسال</Label>
              <RadioGroup 
                value={method} 
                onValueChange={(v: any) => setMethod(v)} 
                className="flex gap-4"
              >
                <div className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-zinc-100 bg-zinc-50'}`}>
                  <RadioGroupItem value="whatsapp" id="m1" />
                  <Label htmlFor="m1" className="font-black cursor-pointer flex items-center gap-2">
                    <MessageSquare size={18} className="text-green-600" /> واتساب
                  </Label>
                </div>
                <div className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === 'email' ? 'border-primary bg-primary/5' : 'border-zinc-100 bg-zinc-50'}`}>
                  <RadioGroupItem value="email" id="m2" />
                  <Label htmlFor="m2" className="font-black cursor-pointer flex items-center gap-2">
                    <Mail size={18} className="text-blue-600" /> بريد إلكتروني
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="font-black">المستلم</Label>
              <div className="relative">
                <Input 
                  placeholder={method === 'whatsapp' ? "مثال: 2010xxxxxxxx" : "name@example.com"} 
                  className="h-14 rounded-xl border-2 pl-12 font-bold"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {method === 'whatsapp' ? <Smartphone size={20} /> : <Mail size={20} />}
                </div>
              </div>
            </div>

            {method === 'email' && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="font-black">عنوان الرسالة</Label>
                <Input 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-14 rounded-xl border-2 font-bold"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-black">نص الرسالة</Label>
              <Textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="h-32 rounded-xl border-2 p-4 font-medium"
              />
            </div>

            <Button 
              disabled={isSending} 
              onClick={handleTestSend}
              className="w-full h-16 rounded-2xl font-black text-xl shadow-xl hover:scale-[1.02] transition-all"
            >
              {isSending ? (
                <><Loader2 className="ml-3 animate-spin" /> جاري محاولة الإرسال...</>
              ) : (
                <><Send className="ml-3" /> تنفيذ الإرسال التجريبي</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <div className="p-8 bg-blue-50 rounded-[2.5rem] border-2 border-dashed border-blue-200 space-y-6">
            <h4 className="text-2xl font-black text-blue-900 flex items-center gap-3">
              <AlertCircle className="text-blue-600" /> تنبيهات هامة للاختبار
            </h4>
            <ul className="space-y-4 text-blue-800 font-bold text-sm">
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2 shrink-0"></div>
                <p>بالنسبة للواتساب، تأكد أن الرقم قد أرسل كلمة <b>START</b> للرقم <b>447860099299</b> أولاً لتفعيل الـ Sandbox.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2 shrink-0"></div>
                <p>رقم الهاتف يجب أن يبدأ بكود الدولة (مثال: 2010... لمصر) وبدون علامة +.</p>
              </li>
            </ul>
          </div>

          {debugResult && (
            <Card className="rounded-[2.5rem] border-2 border-red-200 bg-red-50 overflow-hidden animate-in fade-in zoom-in">
              <CardHeader className="bg-red-100 p-6 border-b border-red-200">
                <CardTitle className="text-lg font-black text-red-900 flex items-center gap-2">
                  <Bug size={20} /> تفاصيل الخطأ التقني (للديناصورات فقط)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <pre className="text-[10px] font-mono bg-white p-4 rounded-xl overflow-x-auto text-red-600 max-h-60">
                  {JSON.stringify(debugResult, null, 2)}
                </pre>
                <p className="mt-4 text-xs font-bold text-red-800 italic">
                  * ابحث عن حقل "description" أو "text" داخل هذا الكود لمعرفة السبب الحقيقي للفشل.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}