
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Smartphone, Apple, PlayCircle, ShieldCheck, Zap, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DownloadPage() {
  const router = useRouter();

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12" dir="rtl">
      <div className="text-center space-y-4">
        <div className="bg-primary w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl text-white mb-6">
          <Smartphone size={40} />
        </div>
        <h1 className="text-4xl md:text-6xl font-black font-headline tracking-tight">تطبيق "فهمني" على جوالك</h1>
        <p className="text-muted-foreground text-xl max-w-2xl mx-auto leading-relaxed">
          تعلم في أي وقت ومن أي مكان. احصل على إشعارات فورية وتابع محاضراتك المباشرة بسهولة عبر تطبيقنا الرسمي.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="rounded-[2.5rem] border-2 border-primary/10 shadow-xl overflow-hidden hover:border-primary transition-all group">
          <CardHeader className="bg-zinc-900 text-white p-8 text-center space-y-2">
            <Apple size={48} className="mx-auto text-primary" />
            <CardTitle className="text-2xl font-black">App Store</CardTitle>
            <CardDescription className="text-zinc-400">لمستخدمي هواتف الآيفون</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Button className="w-full h-16 rounded-2xl text-xl font-black shadow-lg">
              قريباً على App Store
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 border-primary/10 shadow-xl overflow-hidden hover:border-primary transition-all group">
          <CardHeader className="bg-zinc-900 text-white p-8 text-center space-y-2">
            <PlayCircle size={48} className="mx-auto text-primary" />
            <CardTitle className="text-2xl font-black">Google Play</CardTitle>
            <CardDescription className="text-zinc-400">لمستخدمي هواتف الأندرويد</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Button className="w-full h-16 rounded-2xl text-xl font-black shadow-lg">
              قريباً على Google Play
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="bg-primary/5 p-10 rounded-[3rem] border-2 border-dashed border-primary/20 space-y-8">
        <h3 className="text-2xl font-black text-center text-primary">لماذا تستخدم التطبيق؟</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <FeatureItem icon={Zap} title="سرعة الوصول" desc="دخول مباشر للمحاضرات بضغطة واحدة." />
          <FeatureItem icon={ShieldCheck} title="أمان عالي" desc="خصوصية تامة لبياناتك ومحادثاتك." />
          <FeatureItem icon={Globe} title="تنبيهات فورية" desc="لا تفوت أي محاضرة أو رد دعم." />
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="text-center space-y-2">
      <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto shadow-md text-primary mb-4">
        <Icon size={24} />
      </div>
      <h4 className="font-black text-lg">{title}</h4>
      <p className="text-sm text-muted-foreground font-medium">{desc}</p>
    </div>
  );
}
