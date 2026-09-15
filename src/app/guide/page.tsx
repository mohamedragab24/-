
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  GraduationCap, 
  User, 
  Briefcase, 
  Clock, 
  ShieldCheck, 
  Download, 
  UserCheck, 
  Laptop, 
  Wrench, 
  Mic2, 
  AlertTriangle,
  Type,
  FileText,
  Target,
  ImageIcon,
  BadgeCent,
  Wallet,
  RefreshCcw,
  ClipboardList,
  MessageSquare,
  Video,
  Star
} from "lucide-react";

export default function GuidePage() {
  const teacherPoints = [
    { title: "معرض الأعمال", content: "يجب على المُفَهِّم وضع نماذج من شرحه (فيديوهات قصيرة) في معرض أعماله وأن تكون هذه النماذج معبرة عن مهاراته لزيادة فرص اختياره." },
    { title: "الالتزام بالمواعيد", content: "تقديمك لعرض تفهيم يعني تفرغك التام في الموعد المحدد؛ يرجى التأكد من التواجد في مكان به شبكة إنترنت جيدة." },
    { title: "التحقق من التخصص", content: "كمُفَهِّم، لا تقدم عروضاً على مواضيع لا تتقنها؛ فالجودة المنخفضة قد تؤدي لإيقاف حسابك." },
    { title: "سحب الأرباح", content: "تنتقل الأرباح إلى رصيدك فور تأكيد المستفهِم؛ يمكنك سحبها عبر تقديم طلب سحب على إحدى الوسائل المتاحة." },
    { title: "توثيق الهوية", content: "كمُفَهِّم، يجب عليك توثيق هويتك قبل تقديم أول عرض رسمي." },
    { title: "الموضوعات العلمية والأكاديمية", content: "يمكنك تقديم شروحات وتفهيمات في أي مادة دراسية من الابتدائي وحتى التعليم الجامعي." },
    { title: "المهارات التقنية", content: "يمكنك تقديم شروحات في استخدام تطبيق أو برنامج معين أو تعليم أي مهارة تقنية." },
    { title: "المهارات اليدوية", content: "يمكنك تقديم طرق تصليح أو طبخ أو أي مهارة يدوية أخرى تتقنها." },
    { title: "تجهيز البيئة", content: "تأكد من وجودك في مكان هادئ واتصال إنترنت مستقر قبل بدء الجلسة لضمان جودة الشرح." },
    { title: "الانسحاب من الجلسة", content: "في حال تعذر الإكمال لأسباب طارئة، يجب إبلاغ الطرف الآخر فوراً وفتح تذكرة دعم فني." }
  ];

  const studentPoints = [
    { title: "صياغة العنوان", content: "يجب أن يكون عنوان الاستفهام مختصراً ومعبراً عن جوهر المعلومة المطلوبة." },
    { title: "وصف المشكلة", content: "ننصح المستفهم بكتابة كافة تفاصيل الجزئية التي يريد فهمها ليصل إلى المفهم المناسب." },
    { title: "هدف الاستفهام", content: "نرجو كتابة الهدف النهائي الذي تريد الوصول له بوضوح؛ فهو المرجع في حال تقديم شكوى." },
    { title: "استخدام الوسائط", content: "ارفق الصور أو الملفات اللازمة لتساعد المفهمين على فهم طلبك بدقة قبل تقديم عروضهم." },
    { title: "تحديد الميزانية والموعد", content: "ضع سعراً يتناسب مع صعوبة المعلومة؛ فالميزانية الجيدة تجذب مُفَهِّمين أكثر كفاءة." },
    { title: "شحن الرصيد", content: "يتم الشحن عبر الوسائل المتاحة، ويظل المبلغ \"معلقاً\" حتى تنتهي من فهم معلومتك تماماً." },
    { title: "استعادة الرصيد", content: "يمكن استعادة الرصيد المشحون وغير المستخدم عن طريق تقديم طلب سحب." },
    { title: "مراجعة العروض", content: "قارن بين تقييمات المفهمين وخبراتهم في معرض أعمالهم قبل قبول أي عرض." },
    { title: "التواصل المباشر", content: "استخدم دردشة المنصة للاستفسار من المُفَهِّم قبل قبول عرضه لضمان ملاءمته." },
    { title: "تجهيز البيئة", content: "تأكد من وجودك في مكان هادئ واتصال إنترنت مستقر قبل بدء الجلسة." },
    { title: "التفاعل أثناء الجلسة", content: "لا تخجل من مقاطعة المفهم لطلب إعادة نقطة لم تفهمها؛ فالوقت ملكك." },
    { title: "إدارة الجلسة", content: "استخدم الميكروفون والكاميرا بوضوح، واطلب من المُفَهِّم إعادة أي نقطة لم تستوعبها." },
    { title: "الانسحاب من الجلسة", content: "في حال تعذر الإكمال، يجب إبلاغ الطرف الآخر فوراً وفتح تذكرة دعم." },
    { title: "توثيق الهوية", content: "كمُستَفهِم تستطيع الاستفادة من أول استفهام فقط قبل أن يُطلب منك توثيق هويتك." },
    { title: "الموضوعات العلمية", content: "يمكنك الاستفهام في أي مادة دراسية من الابتدائي وحتى التعليم الجامعي." },
    { title: "المهارات التقنية واليدوية", content: "يمكنك طلب الشرح في استخدام البرامج أو الحرف اليدوية كالطبخ والتصليح." },
    { title: "الممنوع الاستفهام عنه", content: "يمنع تماماً طلب استفهام في أي شيء مخالف للشرع أو القانون أو الاستشارات الطبية والدينية." },
    { title: "تقييم الجلسة", content: "لا تنسَ وضع تقييم حقيقي بعد الانتهاء؛ فهو يساعد غيرك على اختيار الأفضل." }
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12 mb-20 text-right" dir="rtl">
      <div className="text-center space-y-4">
        <div className="bg-primary/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto text-primary shadow-inner">
          <BookOpen size={40} />
        </div>
        <h1 className="text-4xl md:text-6xl font-black font-headline tracking-tight text-zinc-900">الدليل الإرشادي</h1>
        <p className="text-muted-foreground text-xl max-w-3xl mx-auto leading-relaxed font-bold">
          الدليل الشامل لمستخدمي منصة فهمت لضمان تجربة تعليمية مثمرة وسلسة للطرفين.
        </p>
      </div>

      <Tabs defaultValue="student" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-20 p-2 bg-muted/50 rounded-[2rem] mb-12">
          <TabsTrigger value="student" className="rounded-[1.5rem] text-xl font-black">دليل المُستَفهِم</TabsTrigger>
          <TabsTrigger value="teacher" className="rounded-[1.5rem] text-xl font-black">دليل المُفَهِّم</TabsTrigger>
        </TabsList>

        <TabsContent value="student" className="space-y-12 animate-in fade-in duration-500">
          {studentPoints.map((p, i) => (
            <div key={i} className="border-r-8 border-primary/10 pr-8 transition-all hover:border-primary">
              <h3 className="text-2xl font-black text-zinc-900 mb-2">• {p.title}:</h3>
              <p className="text-lg text-zinc-600 font-bold leading-relaxed">{p.content}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="teacher" className="space-y-12 animate-in fade-in duration-500">
          {teacherPoints.map((p, i) => (
            <div key={i} className="border-r-8 border-accent/10 pr-8 transition-all hover:border-accent">
              <h3 className="text-2xl font-black text-zinc-900 mb-2">• {p.title}:</h3>
              <p className="text-lg text-zinc-600 font-bold leading-relaxed">{p.content}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
