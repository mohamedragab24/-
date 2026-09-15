
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Info } from "lucide-react";

export default function GuaranteesPage() {
  const points = [
    { title: "حجز قيمة الجلسة مسبقاً في رصيد المستفهم", desc: "لا تبدأ أي جلسة إلا بعد تأكد المنصة من وجود رصيد لا يقل عن قيمة الجلسة في حساب المستفهم." },
    { title: "التوثيق الرقمي للجلسة", desc: "كل ثانية صوتية ومرئية مسجلة ومحفوظة لدينا مؤقتاً وذلك لمراجعتها من قِبَل الإدارة في حال التقدم بشكوى أو حدوث نزاع." },
    { title: "شرط تحقيق هدف الاستفهام", desc: "لا يتم تحرير المبلغ للمفهم إلا بعد التأكد من تحقيق الهدف المَرجو من الاستفهام." },
    { title: "تقييم المستفهم للمفهم", desc: "نظام تقييم شفاف لا يمكن حذفه أو التلاعب به لضمان مصداقية المفهمين وجودة الخدمة." },
    { title: "العدالة في التقييم", desc: "يحق للمستخدم الاعتراض على التقييمات الكيدية، ويقوم فريقنا بمراجعتها وحذفها إذا ثبت عدم صحتها." },
    { title: "حماية الجهد العلمي", desc: "نضمن للمفهم حقه المالي كاملاً في حال كان الشرح وافياً والمستفهم يحاول التلاعب بالحقوق." },
    { title: "نظام النزاعات اليدوي", desc: "في حال الشكوى، تتدخل إدارة المنصة للمراجعة والفصل بين الطرفين بمهنية وحيادية تامة." },
    { title: "حق استرداد الرصيد", desc: "نضمن للمستفهم استرداد مبلغه كاملاً في حال ثبت عدم تمكن المفهم من إيصال المعلومة المطلوبة." },
    { title: "الاعتراف الطوعي", desc: "نوفر خيار الاعتراف بالخطأ للمفهم قبل إنهاء الجلسة لإنهاء النزاع ودياً وتخفيف العواقب الإدارية." },
    { title: "أمن بيانات الدفع", desc: "أي مشاركة لبيانات بنكية بين المستخدمين تكون على مسؤوليتهم، أما عمليات الدفع داخل المنصة فهي مؤمنة تماماً." },
    { title: "حق تعليق الميزات", desc: "يحق للموقع تجميد ميزات الحساب مؤقتاً عند الاشتباه في مخالفة أمنية حتى يتم التحقق من الهوية." },
    { title: "التحكيم الملزم", desc: "في حال نشوب خلاف، يتدخل الدعم الفني للفصل بناءً على تسجيل الجلسة، ويكون حكمه نهائياً وملزماً للطرفين." },
    { title: "سرية تسجيلات الجلسات", desc: "التسجيلات هي المرجع لفض النزاعات، ولا يحق لأي طرف تسريبها أو استخدامها خارج المنصة لأي سبب." },
    { title: "منع التعاملات الخارجية", desc: "الالتزام بالدفع والتواصل داخل المنصة هو الشرط الوحيد لضمان حقك؛ المنصة لا تضمن أي اتفاق خارجي." },
    { title: "فلترة الاستفهامات", desc: "نضمن عدم نشر أي استفهام يتضمن أموراً مخالفة للشريعة أو القانون أو استشارات طبية ودينية وقانونية دقيقة." }
  ];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-16 mb-20 text-right" dir="rtl">
      <div className="text-center space-y-6 relative py-10">
        <div className="bg-primary/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto text-primary shadow-inner mb-6">
          <ShieldCheck size={48} />
        </div>
        <h1 className="text-4xl md:text-7xl font-black font-headline tracking-tight text-zinc-900">
          ضمان حقوق المستخدم
        </h1>
        <p className="text-muted-foreground text-xl font-bold max-w-3xl mx-auto leading-relaxed">
          نحن في فهمت نلعب دور الوسيط لضمان تجربة عادلة ومرضية، حيث تبقى حقوقك المالية والمعرفية في مأمن تام.
        </p>
      </div>

      <div className="space-y-12">
        {points.map((item, index) => (
          <div key={index} className="space-y-2 border-r-8 border-primary/10 pr-8 group hover:border-primary transition-all">
            <h3 className="text-2xl font-black text-zinc-900 block">
              • {item.title}:
            </h3>
            <p className="text-lg text-zinc-600 font-bold leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      <Card className="rounded-[3rem] bg-zinc-900 text-white p-10 text-center shadow-2xl mt-20">
        <div className="flex justify-center mb-4 text-primary">
          <Info size={48} />
        </div>
        <p className="text-zinc-400 text-xl font-bold leading-relaxed">
          نظام "فهمت" مصمم تقنياً ليطبق هذه الضمانات آلياً ويدوياً لضمان تجربة عادلة للجميع.
        </p>
      </Card>
    </div>
  );
}
