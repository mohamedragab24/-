
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, 
  Scale, 
  Activity, 
  Lock, 
  UserCheck, 
  EyeOff, 
  Monitor, 
  Users, 
  Database, 
  Copyright,
  Info
} from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12 mb-20" dir="rtl">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-black font-headline tracking-tight text-primary">سياسة الخصوصية</h1>
        <p className="text-muted-foreground text-xl leading-relaxed font-bold">كيف تتعامل منصة "فهمت" مع بياناتك؟</p>
        <div className="max-w-2xl mx-auto p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20">
          <p className="text-zinc-700 leading-relaxed font-medium">
            تلتزم منصة فهمت بحماية خصوصيتك وتأمين بياناتك عند تصفح موقعنا أو التواصل معنا رقمياً. يوضح هذا البيان كيفية جمع واستخدام المعلومات الشخصية التي تقدمها لنا لضمان بيئة تعليمية آمنة وموثوقة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <PrivacySection 
          icon={Scale} 
          title="انتفاء المسؤولية القانونية" 
          content="يقر المستخدم سواء كان مديراً أو مستخدماً بأنه المسؤول الأول والوحيد عن كيفية استخدامه للمنصة. وتخلي إدارة فهمت مسؤوليتها، إلى أقصى حد يسمح به القانون عن أي أضرار أو خسائر مادية أو معنوية ناتجة عن استخدام الموقع، أو سوء فهم المحتوى التعليمي، أو العجز التقني عن الدخول للمنصة."
        />

        <PrivacySection 
          icon={Activity} 
          title="استمرارية الخدمة والأعطال التقنية" 
          content="تعمل إدارة فهمت جاهدة لضمان استقرار المنصة على مدار الساعة؛ ومع ذلك، قد تطرأ بعض الأعطال التقنية أو فترات التحديث الضرورية التي قد تؤدي لانقطاع مؤقت أو تأخير في الاستجابة. في هذه الحالات، نرجو من المستخدمين التحلي بالصبر حتى تعود الأنظمة للعمل بكفاءتها المعتادة."
        />

        <PrivacySection 
          icon={Lock} 
          title="أمن الحساب وكلمات المرور" 
          content="يختار المشترك كلمة مرور خاصة به، ويرتبط حسابه ببريد إلكتروني رسمي للمراسلات. تقع مسؤولية حماية هذه البيانات وسريتها بالكامل على عاتق المستخدم؛ وأي عملية تتم عبر الحساب تعتبر صادرة عن صاحبه ويتحمل تبعاتها القانونية والمالية. تلتزم المنصة بتشفير كلمات المرور، ولكنها لا تتحمل مسؤولية تسريبها نتيجة إهمال المستخدم أو استخدام أجهزة غير آمنة."
        />

        <PrivacySection 
          icon={UserCheck} 
          title="معايير التسجيل واختيار الأسماء" 
          content="يتطلب الوصول لخدمات 'الاستفهام' و'التفهيم' إنشاء حساب ببيانات دقيقة وكاملة. يلتزم المستخدم بعدم انتحال شخصية الآخرين، وتجنب استخدام أسماء غير لائقة أو أرقام هواتف كاسم مستخدم. تلتزم الإدارة بمراجعة الأسماء وصور الملفات وحذف أي حساب يهدف لتضليل المستخدمين."
        />

        <PrivacySection 
          icon={EyeOff} 
          title="تداول المعلومات والسرية" 
          content="نتعامل مع معلوماتك الشخصية بسرية تامة، ولا يتم بيعها أو تأجيرها. يتم استخدام البيانات فقط لتحسين تجربة المستخدم، التواصل مع بوابات الدفع الموثوقة، أو في حال وجود أمر قضائي رسمي يلزمنا بالكشف عن معلومات محددة."
        />

        <PrivacySection 
          icon={Monitor} 
          title="الرقابة على المحتوى التعليمي والجلسات" 
          content="تعتمد المنصة مبدأ الرقابة اللاحقة والدورية حيث تمتلك الإدارة الحق في مراجعة نصوص 'الاستفهامات' وتسجيلات الجلسات للتأكد من موافقتها للشروط والآداب العامة. ولنا الحق في حذف أو تحرير أي محتوى يتجاوز سياساتنا دون الرجوع لصاحبه."
        />

        <PrivacySection 
          icon={Users} 
          title="الخصوصية الاجتماعية والالتزام القيمي" 
          content="تنفرد فهمت بتطبيق معايير الخصوصية الاجتماعية التي تضمن توجيه طلبات الإناث للمفهمات، وطلبات الذكور للمفهمين فقط، وذلك احتراماً للقيم المجتمعية وضماناً لتوفير بيئة تعليمية مريحة ومنتجة للطرفين."
        />

        <PrivacySection 
          icon={Database} 
          title="ديمومة الحساب والبيانات المالية" 
          content="نظراً لارتباط الحسابات بعمليات مالية وحقوق مستخدمين آخرين وتسجيلات جلسات سابقة، لا يمكن حذف الحساب بشكل نهائي أو تغيير اسم المستخدم بعد اعتماده، وذلك لضمان القدرة على الرجوع للسجلات في حال وجود نزاعات مالية أو قانونية مستقبلية."
        />

        <PrivacySection 
          icon={Copyright} 
          title="الملكية الفكرية وحقوق النشر" 
          content="جميع المحتويات المنشورة على المنصة محمية بموجب قوانين الملكية الفكرية. بمجرد اشتراكك فأنت توافق على احترام حقوق النشر الخاصة بالمنصة وبالشروحات المقدمة داخل الجلسات، ويمنع تداولها خارج إطار 'فهمت' دون إذن كتابي."
        />
      </div>

      <Card className="rounded-[2.5rem] border-2 border-accent/20 bg-accent/5 p-10 text-center">
        <CardContent className="space-y-4">
          <div className="flex justify-center mb-4 text-accent">
            <Info size={48} />
          </div>
          <h3 className="text-2xl font-black text-accent">ملاحظة هامة</h3>
          <p className="text-zinc-700 font-bold leading-relaxed">
            هذه السياسة قابلة للتحديث والتطوير المستمر تماشياً مع نمو المنصة. سيتم إخطار المستخدمين بأي تغييرات جوهرية، وينصح بمراجعة هذه الصفحة دورياً للاطلاع على آخر التحديثات.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PrivacySection({ icon: Icon, title, content }: any) {
  return (
    <Card className="rounded-[2rem] border-2 hover:border-primary transition-all overflow-hidden shadow-sm group">
      <CardHeader className="bg-muted/30 p-8 flex flex-row items-center gap-4 border-b">
        <div className="bg-primary p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
          <Icon size={24} />
        </div>
        <CardTitle className="text-2xl font-black text-zinc-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-8 text-lg text-zinc-600 leading-relaxed font-medium">
        {content}
      </CardContent>
    </Card>
  );
}
