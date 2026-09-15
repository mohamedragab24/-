"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Sparkles, Wand2, ShieldAlert, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { processAdminInstruction } from "@/ai/flows/admin-brain-flow";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function AdminAI() {
  const [instruction, setInstruction] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleExecute = async () => {
    if (!instruction.trim() || !firestore) return;
    setIsProcessing(true);
    setLastAction(null);

    try {
      const result = await processAdminInstruction({ instruction });
      
      if (result.updates && Object.keys(result.updates).length > 0) {
        // تنفيذ التحديثات في Firestore بشكل غير معطل للواجهة
        const settingsRef = doc(firestore, "settings", "general");
        setDocumentNonBlocking(settingsRef, {
          ...result.updates,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setLastAction(result.feedback);
        toast({ title: "تم التنفيذ الذكي", description: result.feedback });
        setInstruction("");
      } else {
        toast({ variant: "destructive", title: "تنبيه", description: "لم أفهم طلباً محدداً للتعديل، يرجى التوضيح أكثر." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "خطأ", description: "فشل محرك الذكاء الاصطناعي في معالجة الأمر." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-accent pr-6">
        <h1 className="text-4xl font-black font-headline">الذكاء الاصطناعي (Auto-Admin)</h1>
        <p className="text-muted-foreground text-lg">تحكم في المنصة بالأوامر النصية؛ دع الذكاء الاصطناعي يقوم بالتعديلات بدلاً عنك.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-2xl rounded-[3rem] border-2 border-accent/20 overflow-hidden bg-white">
          <CardHeader className="bg-accent text-white p-10">
            <CardTitle className="text-3xl font-black flex items-center gap-4">
              <Bot className="h-10 w-10" /> ماذا تريد أن نعدل الآن؟
            </CardTitle>
            <CardDescription className="text-white/80 text-lg">اكتب طلبك باللغة العربية (مثال: غير لون الموقع للأزرق واجعل العنوان 'فهمني للتعلم').</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <Textarea 
              placeholder="اكتب تعليماتك هنا بوضوح..." 
              className="h-60 rounded-3xl p-8 text-xl font-medium border-2 focus:border-accent shadow-inner"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <Button 
              disabled={isProcessing} 
              onClick={handleExecute}
              className="w-full h-20 rounded-3xl font-black text-2xl bg-accent hover:bg-accent/90 shadow-xl shadow-accent/20"
            >
              {isProcessing ? (
                <><Loader2 className="ml-3 h-8 w-8 animate-spin" /> جاري التفكير والتنفيذ...</>
              ) : (
                <><Zap className="ml-3 h-8 w-8" /> تنفيذ الأمر الذكي</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <div className="p-8 bg-blue-50 rounded-[2.5rem] border-2 border-dashed border-blue-200 space-y-4">
            <h4 className="text-2xl font-black text-blue-900 flex items-center gap-3">
              <Sparkles className="text-blue-600" /> مهارات الذكاء الاصطناعي الحالية
            </h4>
            <ul className="space-y-3">
              <Feature text="تغيير ألوان الموقع (الأساسي والتمييز)." />
              <Feature text="تعديل كافة نصوص وعناوين صفحات الهبوط." />
              <Feature text="تحديث إعدادات العمولات والسياسات المالية." />
              <Feature text="إعادة تسمية المنصة وتغيير نصوص التذييل." />
            </ul>
          </div>

          {lastAction && (
            <Card className="rounded-[2.5rem] border-2 border-green-200 bg-green-50 animate-in fade-in zoom-in">
              <CardContent className="p-8 flex items-start gap-4">
                <CheckCircle2 className="text-green-600 h-8 w-8 shrink-0" />
                <div>
                  <h5 className="font-black text-green-900 text-xl">آخر عملية ناجحة:</h5>
                  <p className="text-green-800 font-bold mt-1 text-lg">{lastAction}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="p-8 bg-orange-50 rounded-[2.5rem] border-2 border-orange-200 flex items-start gap-4">
            <ShieldAlert className="text-orange-600 h-8 w-8 shrink-0" />
            <p className="text-orange-900 font-bold leading-relaxed">
              تنبيه: أوامر الذكاء الاصطناعي تؤثر مباشرة على تجربة المستخدمين. سيتم تطبيق التغييرات لحظياً.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-blue-800 font-bold">
      <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
      {text}
    </li>
  );
}
