
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, query, orderBy, doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Filter, Activity, Target, Clock, BadgeCent, FileText, Sparkles, Loader2, ArrowRight, Ticket, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CreateRequestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    title: "", 
    description: "", 
    goal: "",
    amount: "", 
    category: "", 
    categorySub: "", 
    categoryOpt: "",
    meetingTime: ""
  });

  useEffect(() => {
    const titleFromQuery = searchParams?.get('title');
    if (titleFromQuery) {
      setFormData(prev => ({ ...prev, title: titleFromQuery }));
    }
  }, [searchParams]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "categories"), orderBy("name", "asc"));
  }, [firestore]);
  const { data: allCategories } = useCollection(categoriesQuery);

  const mainCategories = allCategories?.filter(c => c.type === 'main' || !c.type) || [];
  const subCategories = allCategories?.filter(c => c.type === 'sub' && c.parentId === allCategories?.find(m => m.name === formData.category)?.id) || [];
  const optCategories = allCategories?.filter(c => c.type === 'option' && c.parentId === allCategories?.find(s => s.name === formData.categorySub)?.id) || [];

  const handleCreate = async () => {
    if (!formData.title || !formData.description || !formData.goal || !formData.category || !formData.meetingTime) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى تعبئة كافة الحقول المطلوبة." });
      return;
    }

    if (!user) {
      localStorage.setItem('pending_istifham', JSON.stringify({ ...formData, amount: 0 }));
      toast({ title: "خطوة واحدة تفصلك!", description: "يرجى تسجيل حسابك الآن ليتم نشر استفهامك تلقائياً." });
      router.push("/login?mode=signup&returnTo=create-request");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore!, "istifhams"), {
        ...formData,
        originalAmount: 0,
        amount: 0,
        couponApplied: null,
        status: "pending_approval",
        mustafhemId: user.uid,
        mustafhemName: user.displayName || "مستخدم",
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم الإرسال بنجاح!", description: "سيتم مراجعة طلبك ونشره خلال دقائق." });
      router.push("/");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الطلب." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10 mb-20" dir="rtl">
      <div className="flex items-center justify-between border-r-8 border-primary pr-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black font-headline text-zinc-900">طرح استفهام جديد</h1>
          <p className="text-muted-foreground text-lg font-bold">املأ البيانات بدقة لتصل إلى أفضل المفهمين في تخصصك.</p>
        </div>
        <Button variant="ghost" onClick={() => router.back()} className="h-14 rounded-2xl font-bold gap-2">
          <ArrowRight className="h-5 w-5" /> <span>رجوع</span>
        </Button>
      </div>

      <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 p-10 border-b">
          <CardTitle className="text-2xl font-black flex items-center gap-3 text-primary">
            <Sparkles /> تفاصيل الاستفهام التعليمي
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          <div className="space-y-3">
            <Label className="font-black text-lg">عنوان الاستفهام</Label>
            <Input 
              value={formData.title} 
              onChange={(e)=>setFormData({...formData, title: e.target.value})} 
              className="h-16 rounded-2xl border-2 font-black text-xl shadow-sm"
              placeholder="مثال: شرح طريقة حل المعادلات التفاضلية"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="font-black flex items-center gap-2">القسم الرئيسي <Layers size={16}/></Label>
              <Select value={formData.category} onValueChange={(v)=>setFormData({...formData, category: v, categorySub: "", categoryOpt: ""})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold shadow-sm"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {mainCategories.map(c => <SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                  <SelectItem value="أخرى" className="font-bold text-primary italic text-right">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="font-black flex items-center gap-2">التخصص <Filter size={16}/></Label>
              <Select disabled={!formData.category} value={formData.categorySub} onValueChange={(v)=>setFormData({...formData, categorySub: v, categoryOpt: ""})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold shadow-sm"><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                <SelectContent>
                  {subCategories.map(c => <SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                  <SelectItem value="أخرى" className="font-bold text-primary italic text-right">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="font-black flex items-center gap-2">المهارة/الخيار <Activity size={16}/></Label>
              <Select disabled={!formData.categorySub} value={formData.categoryOpt} onValueChange={(v)=>setFormData({...formData, categoryOpt: v})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold shadow-sm"><SelectValue placeholder="اختر المهارة" /></SelectTrigger>
                <SelectContent>
                  {optCategories.map(c => <SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                  <SelectItem value="أخرى" className="font-bold text-primary italic text-right">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-black text-lg flex items-center gap-2">تفاصيل الاستفهام <FileText size={18} className="text-primary"/></Label>
            <Textarea 
              value={formData.description} 
              onChange={(e)=>setFormData({...formData, description: e.target.value})} 
              className="h-40 rounded-[2rem] border-2 p-6 text-lg font-medium leading-relaxed"
              placeholder="اشرح ما هي الجزئية التي لا تفهمها بالضبط..."
            />
          </div>

          <div className="space-y-3">
            <Label className="font-black text-lg text-accent flex items-center gap-2">هدف الاستفهام <Target size={18} /></Label>
            <Textarea 
              value={formData.goal} 
              onChange={(e)=>setFormData({...formData, goal: e.target.value})} 
              className="h-24 rounded-[1.5rem] border-2 border-accent/20 p-4 font-black italic shadow-inner"
              placeholder="ما هي المعلومة التي إذا فهمتها ستعتبر المهمة مكتملة؟"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-100 text-center space-y-2">
              <div className="text-sm font-black text-emerald-700">الخدمة مجانية حاليًا</div>
              <div className="text-4xl font-black text-emerald-800">0 ج.م</div>
              <p className="text-xs font-bold text-emerald-700">لا تحتاج لإدخال سعر أو كوبون أثناء الفترة المجانية.</p>
            </div>
            <div className="space-y-3">
              <Label className="font-black text-lg flex items-center gap-2">الموعد المفضل <Clock size={18} className="text-blue-600"/></Label>
              <Input 
                type="datetime-local" 
                value={formData.meetingTime} 
                onChange={(e)=>setFormData({...formData, meetingTime: e.target.value})} 
                className="h-16 rounded-2xl border-2 font-bold px-6 shadow-sm" 
              />
            </div>
          </div>

          <div className="pt-10 border-t border-dashed">
            <Button 
              onClick={handleCreate} 
              disabled={isSubmitting} 
              className="w-full h-24 rounded-[2.5rem] text-3xl font-black bg-primary shadow-2xl hover:scale-[1.02] transition-all"
            >
              {isSubmitting ? <Loader2 className="animate-spin ml-3 h-10 w-10" /> : "تأكيد وإرسال للمراجعة"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateRequestPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center animate-pulse">جاري تحميل صفحة الطلب...</div>}>
      <CreateRequestContent />
    </Suspense>
  );
}
