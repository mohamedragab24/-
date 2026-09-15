
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Info, ShieldCheck, Zap, Users, MessageSquare } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-16 mb-20 text-right" dir="rtl">
      <div className="text-center space-y-8 relative py-20">
        <div className="bg-primary/10 w-32 h-32 rounded-[3rem] flex items-center justify-center mx-auto text-primary shadow-inner mb-8">
          <Info size={64} />
        </div>
        <h1 className="text-5xl md:text-8xl font-black font-headline tracking-tight text-zinc-900">
          عن منصة <span className="text-primary">فهمت</span>
        </h1>
      </div>

      <div className="space-y-12">
        <div className="border-r-[12px] border-primary pr-10">
          <h2 className="text-4xl font-black text-zinc-800 mb-8">ما هي منصة فهمت؟</h2>
          <p className="text-zinc-600 text-2xl md:text-3xl leading-relaxed font-bold">
            فهمت هي المنصة العربية الأولى المتخصصة في طلب وتقديم خدمات الشرح الفوري التفاعلي لأغلب التخصصات الأكديمية والتقنية والمهارية. تعمل فهمت على ربط الباحثين عن المعرفة (المُستَفهِمين) بنخبة من الخبراء وأصحاب أساليب الشرح المبسط (المُفَهِّمين) لمساعدتهم على استيعاب النقاط الصعبة وتجاوز التحديات التعليمية أوالتقنية أوالمهارية في جلسات تفاعلية مباشرة.
          </p>
        </div>

        <div className="bg-zinc-50 p-10 rounded-[3rem] border-2 border-dashed space-y-6">
          <p className="text-xl text-zinc-700 font-medium leading-relaxed">
            تتيح لك المنصة طرح "استفهامك" مجاناً في مختلف المجالات—سواء كانت أكاديمية، تقنية، أو عملية—لتتلقى عروضاً من مُفَهِّمين موثقين، يمكنك بعدها اختيار الأنسب لبدء جلسة تفهيم موثقة ومسجلة. تضمن منصة فهمت حقوق الطرفين المالية والمعرفية من خلال عملها كوسيط، مع الالتزام لأقصى درجة ممكنة بالخصوصية وحقوق الملكية.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureItem icon={Zap} title="شرح فوري" desc="تجاوز التحديات في جلسات مباشرة." />
        <FeatureItem icon={ShieldCheck} title="ضمان الحقوق" desc="نظام وساطة مالي آمن تماماً." />
        <FeatureItem icon={Users} title="خبراء موثقون" desc="نخبة من المفهمين المعتمدين." />
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-8 bg-white rounded-3xl border-2 hover:border-primary transition-all text-center space-y-4 shadow-sm">
      <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-primary">
        <Icon size={32} />
      </div>
      <h4 className="text-2xl font-black text-zinc-800">{title}</h4>
      <p className="text-zinc-500 font-bold">{desc}</p>
    </div>
  );
}
