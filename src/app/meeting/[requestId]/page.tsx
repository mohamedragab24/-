"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Smartphone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * لا توجد محاضرات أونلاين داخل المنصة: كل المحاضرات والاجتماعات تُفتح داخل التطبيق فقط.
 * هذه الصفحة تحوّل المستخدم للتطبيق عبر الرابط fahmny://meeting/<id>.
 */
export default function MeetingAppOnlyPage() {
  const params = useParams<{ requestId: string }>();
  const id = encodeURIComponent(String(params?.requestId || ""));
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg border text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Video className="h-8 w-8" /></div>
        <h1 className="text-2xl font-black">المحاضرات تُفتح داخل التطبيق فقط</h1>
        <p className="text-sm text-slate-600 font-bold leading-relaxed">لا توجد محاضرات أونلاين داخل المنصة. افتح تطبيق فهمني للدخول إلى المحاضرة.</p>
        <Button asChild className="w-full h-14 rounded-2xl font-black text-lg"><a href={`fahmny://meeting/${id}`}><Smartphone className="ml-2" /> فتح المحاضرة في التطبيق</a></Button>
        <Button asChild variant="outline" className="w-full rounded-2xl font-black"><Link href="/sessions">العودة</Link></Button>
      </section>
    </main>
  );
}
