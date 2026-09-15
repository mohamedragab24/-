
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, addDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, ArrowRight, Sparkles, UserCheck, CheckCircle2, Loader2, MapPin, User, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function JobsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [application, setApplication] = useState({ 
    fullName: "", 
    email: "", 
    phone: "", 
    age: "", 
    address: "", 
    experience: "" 
  });

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "jobs"), where("status", "==", "active"));
  }, [firestore]);

  const { data: rawJobs, isLoading } = useCollection(jobsQuery);
  const jobs = rawJobs ? [...rawJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  const handleApply = async () => {
    if (!selectedJob || !application.fullName || !application.phone || !application.age || !application.address || !application.experience) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى تعبئة كافة الحقول المطلوبة." });
      return;
    }
    setIsApplying(true);
    try {
      await addDoc(collection(firestore, "jobs", selectedJob.id, "applications"), {
        userId: user?.uid || "guest",
        userName: application.fullName,
        userEmail: application.email || user?.email || "غير متوفر",
        userPhone: application.phone,
        age: application.age,
        address: application.address,
        experience: application.experience,
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم إرسال طلبك", description: "شكراً لاهتمامك بالانضمام إلينا. سنقوم بمراجعة طلبك والتواصل معك." });
      setApplication({ fullName: "", email: "", phone: "", age: "", address: "", experience: "" });
      setSelectedJob(null);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الطلب، يرجى المحاولة لاحقاً." });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-16 mb-20" dir="rtl">
      <div className="text-center space-y-6 relative py-10">
        <div className="absolute inset-0 bg-primary/5 rounded-[4rem] -z-10 blur-3xl"></div>
        <div className="bg-primary/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto text-primary shadow-inner mb-6"><Briefcase size={48} /></div>
        <h1 className="text-4xl md:text-7xl font-black font-headline tracking-tight text-zinc-900 leading-tight">انضم إلى <span className="text-primary">فريقنا</span></h1>
        <p className="text-muted-foreground text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-bold">نحن دائماً نبحث عن المواهب الاستثنائية التي ترغب في تغيير مستقبل التعليم العربي.</p>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="py-20 text-center animate-pulse font-black text-2xl">جاري تحميل الوظائف...</div>
        ) : jobs && jobs.length > 0 ? (
          jobs.map((job) => (
            <Card key={job.id} className="rounded-[2.5rem] border-2 border-transparent hover:border-primary/20 transition-all shadow-lg overflow-hidden bg-white group">
              <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="space-y-4 text-right flex-1 w-full">
                  <div className="flex items-center gap-3 justify-end md:justify-start flex-wrap">
                    <Badge variant="secondary" className="font-bold bg-muted/50">{job.type === 'full-time' ? 'دوام كامل' : 'عمل حر'}</Badge>
                    <span className="text-xs text-muted-foreground font-bold flex items-center gap-1"><Clock size={12}/> {new Date(job.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 group-hover:text-primary transition-colors">{job.title}</h3>
                  <p className="text-zinc-600 font-medium leading-relaxed">{job.description}</p>
                </div>
                <Button onClick={() => setSelectedJob(job)} className="h-16 px-10 rounded-2xl font-black text-lg bg-zinc-900 hover:bg-primary transition-colors group-hover:scale-105 shadow-xl">
                  التقدم لهذه الوظيفة <ArrowRight className="mr-2 rotate-180" />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center bg-zinc-50 rounded-[3rem] border-4 border-dashed border-zinc-200">
            <p className="text-2xl font-black text-zinc-400">لا توجد وظائف شاغرة حالياً. تابعنا باستمرار!</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-[650px] rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black">التقدم لوظيفة: {selectedJob?.title}</DialogTitle>
            <DialogDescription className="text-right">أدخل بياناتك وسيتم التواصل معك من قبل فريق التوظيف.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6 max-h-[60vh] overflow-y-auto px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">الاسم الكامل</Label>
                <Input placeholder="اسمك الثلاثي" value={application.fullName} onChange={(e)=>setApplication({...application, fullName: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">السن</Label>
                <Input type="number" placeholder="مثال: 25" value={application.age} onChange={(e)=>setApplication({...application, age: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input placeholder="01xxxxxxxxx" value={application.phone} onChange={(e)=>setApplication({...application, phone: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">البريد الإلكتروني (اختياري)</Label>
                <Input type="email" placeholder="example@mail.com" value={application.email} onChange={(e)=>setApplication({...application, email: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان بالكامل</Label>
              <Input placeholder="المحافظة، المدينة، الشارع" value={application.address} onChange={(e)=>setApplication({...application, address: e.target.value})} className="h-14 rounded-xl border-2" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">المهارات والخبرات السابقة</Label>
              <Textarea placeholder="اكتب لماذا أنت الشخص المناسب لهذه الوظيفة وما هي خبراتك..." value={application.experience} onChange={(e)=>setApplication({...application, experience: e.target.value})} className="h-40 rounded-xl p-4 border-2" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApply} disabled={isApplying} className="w-full h-16 rounded-2xl font-black text-xl shadow-lg">
              {isApplying ? <Loader2 className="animate-spin ml-2" /> : <CheckCircle2 className="ml-2" />}
              إرسال طلب التقدم الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
