
"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Palette, 
  Save, 
  RefreshCw, 
  Edit3, 
  ImageIcon, 
  LayoutTemplate, 
  Monitor, 
  ChevronRight, 
  ChevronLeft, 
  Share2, 
  Globe, 
  Zap, 
  MessageSquare, 
  Youtube, 
  Facebook, 
  Send,
  Search,
  Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceHolderImages } from "@/lib/placeholder-images";

type PageType = 'home' | 'about' | 'terms' | 'privacy' | 'guarantees' | 'guide' | 'nav' | 'sidebar' | 'dashboards' | 'teachers_list' | 'portfolio_list' | 'seo';

export default function ManualEditorPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeField, setActiveField] = useState<{key: string, label: string, value: string, type: 'text' | 'textarea' | 'image'} | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('home');

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings, isLoading } = useDoc(settingsRef);

  const [formData, setFormData] = useState({
    siteTitle: "فهمت",
    heroTitle: "أول منصة عربية لخدمات الشرح الفوري",
    heroSubtitle: "مُفهمين خبراء لخدمة كل مُستفهم طموح",
    footerText: "جميع الحقوق محفوظة لمنصة فهمت",
    primaryColor: "#29B6F6",
    accentColor: "#FF7043",
    backgroundColor: "#F8FAFC",
    borderRadius: "1rem",
    metaTitle: "فهمت - منصة التعلم الذكي",
    metaDescription: "أول منصة عربية لخدمات الشرح الفوري والربط بين المفهمين والمستفهمين لتبادل الخبرات والمعرفة.",
    metaKeywords: "تعلم, شرح فوري, دروس خصوصية, تعليم اونلاين, مفهم, مستفهم",
    googleSiteVerification: "",
    ogImageUrl: "",
    logoUrl: "",
    landingBg: "",
    aboutImage: "",
    landingVideoId: "dQw4w9WgXcQ", 
    navHome: "الرئيسية",
    navAbout: "عن المنصة",
    navGuide: "الدليل",
    navGuarantees: "الضمانات",
    navTeachers: "المُفهمين",
    navPortfolio: "أعمال المفهمين",
    navBrowse: "تصفح الاستفهامات",
    sideHome: "الرئيسية",
    sideTeachers: "المُفهمين",
    sidePortfolio: "أعمال المفهمين",
    sideRequests: "استفهاماتي",
    sideWallet: "المحفظة",
    sideSettings: "الإعدادات",
    sideAdmin: "لوحة المسؤول",
    sideLogout: "تسجيل الخروج",
    sideToggleToStudent: "تبديل إلى مُستفهم",
    sideToggleToTeacher: "تبديل إلى مُفهم",
    aboutTitle: "ما هي منصة فهمت؟",
    aboutDescription: "فهمت هي المنصة العربية الأولى المتخصصة في طلب وتقديم خدمات الشرح الفوري التفاعلي لأغلب التخصصات الأكاديمية والتقنية والمهارية.",
    termsTitle: "شروط الاستخدام",
    termsDescription: "استخدامك لـ 'فهمت' يعني موافقتك الكاملة وغير المشروطة على هذه الشروط المنظمة للعلاقة بيننا.",
    privacyTitle: "سياسة الخصوصية",
    privacyDescription: "كيف تتعامل منصة 'فهمت' مع بياناتك؟ نحن نلتزم بحماية خصوصيتك وتأمين بياناتك.",
    guaranteesTitle: "ضمان الحقوق",
    guaranteesDescription: "نحن في 'فهمت' نلعب دور الوسيط الضامن لتجربة عادلة ومرضية، حيث تبقى حقوقك المالية والمعرفية في أمان تام.",
    guideTitle: "الدليل الإرشادي",
    guideSubtitle: "الدليل الشامل لمستخدمي منصة 'فهمت' لضمان تجربة تعليمية مثمرة وسلسة للطرفين.",
    studentDashboardTitle: "عندك سؤال? اطرح استفهامك الآن",
    studentDashboardBtn: "طلب استفهام جديد",
    teacherDashboardTitle: "اعرض مهاراتك.. أضف عملاً جديداً لمعرضك",
    teacherDashboardSubtitle: "كلما زادت أعمالك المميزة في المعرض, زادت ثقة الطلاب باختيارك لمشاريعهم.",
    teacherDashboardBtn: "إضافة عمل جديد للمعرض",
    teachersListTitle: "نخبة 'المفهمين' الموثقين",
    teachersListSearchPlaceholder: "(ابحث باسم المفهم)",
    portfolioListTitle: "أعمال المفهمين",
    portfolioListSubtitle: "نماذج تعليمية ملهمة من خبراء منصة فهمت.",
    createIstifhamTitle: "تفاصيل الاستفهام",
    createIstifhamBtn: "تأكيد وإرسال للمراجعة"
  });

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        ...settings
      }));
    }
  }, [settings]);

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, "settings", "general"), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث كافة تفاصيل المنصة وتجهيز إعدادات SEO." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ التغييرات." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldClick = (key: string, label: string, type: 'text' | 'textarea' | 'image' = 'text') => {
    if (type === 'image') {
      setActiveField({ key, label, value: (formData as any)[key] || "", type });
      fileInputRef.current?.click();
    } else {
      setActiveField({ key, label, value: (formData as any)[key] || "", type });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeField?.type === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [activeField.key]: reader.result as string });
        setActiveField(null);
        toast({ title: "تم تحديث الصورة في المعاينة" });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateField = () => {
    if (activeField) {
      setFormData({ ...formData, [activeField.key]: activeField.value });
      setActiveField(null);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const scrollAmount = 250;
      tabsListRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (isLoading) return <div className="p-10 text-center font-bold animate-pulse text-2xl">جاري تحميل المحرر الفائق...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-100 font-body" dir="rtl">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      
      <header className="h-24 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-6">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary">
            <LayoutTemplate size={32} />
          </div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-black">المحرر الفائق و SEO</h1>
            <p className="text-xs text-muted-foreground font-bold flex items-center gap-1">
              <Zap size={12} className="text-accent" /> تحكم كامل في الظهور والبحث
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-[60%] flex items-center gap-2 px-4">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10 text-zinc-400" onClick={() => scrollTabs('right')}>
            <ChevronRight size={24} />
          </Button>

          <Tabs value={currentPage} onValueChange={(v) => setCurrentPage(v as PageType)} className="flex-1 overflow-hidden">
            <div ref={tabsListRef} className="overflow-x-auto no-scrollbar flex items-center">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-14 flex-nowrap shrink-0">
                <TabsTrigger value="home" className="rounded-lg font-black px-4 shrink-0">الرئيسية</TabsTrigger>
                <TabsTrigger value="dashboards" className="rounded-lg font-black px-4 shrink-0">لوحات التحكم</TabsTrigger>
                <TabsTrigger value="seo" className="rounded-lg font-black px-4 shrink-0 flex items-center gap-2">إعدادات البحث <Search size={14}/></TabsTrigger>
                <TabsTrigger value="teachers_list" className="rounded-lg font-black px-4 shrink-0">المدرسين</TabsTrigger>
                <TabsTrigger value="portfolio_list" className="rounded-lg font-black px-4 shrink-0">أعمال المفهمين</TabsTrigger>
                <TabsTrigger value="nav" className="rounded-lg font-black px-4 shrink-0">الهيدر والفوتر</TabsTrigger>
                <TabsTrigger value="sidebar" className="rounded-lg font-black px-4 shrink-0">القائمة الجانبية</TabsTrigger>
                <TabsTrigger value="about" className="rounded-lg font-black px-4 shrink-0">عن المنصة</TabsTrigger>
                <TabsTrigger value="terms" className="rounded-lg font-black px-4 shrink-0">الشروط</TabsTrigger>
                <TabsTrigger value="privacy" className="rounded-lg font-black px-4 shrink-0">الخصوصية</TabsTrigger>
                <TabsTrigger value="guarantees" className="rounded-lg font-black px-4 shrink-0">الضمانات</TabsTrigger>
                <TabsTrigger value="guide" className="rounded-lg font-black px-4 shrink-0">الدليل</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10 text-zinc-400" onClick={() => scrollTabs('left')}>
            <ChevronLeft size={24} />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave} className="h-14 px-10 rounded-2xl font-black text-xl shadow-xl">
            {isSaving ? <RefreshCw className="animate-spin ml-2" /> : <Save className="ml-2" />}
            حفظ الإعدادات
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-l overflow-y-auto p-6 space-y-8 shrink-0 shadow-xl z-40">
          <div className="space-y-4">
            <h3 className="font-black text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Palette size={14} /> الهوية والتصميم
            </h3>
            <div className="space-y-6">
              <ColorInput label="اللون الأساسي" value={formData.primaryColor || ""} onChange={(v) => setFormData({...formData, primaryColor: v})} />
              <ColorInput label="لون التمييز" value={formData.accentColor || ""} onChange={(v) => setFormData({...formData, accentColor: v})} />
              <div className="space-y-2">
                <Label className="text-[10px] font-black opacity-60 pr-2">نصف قطر الزوايا</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["0px", "0.5rem", "1rem", "2rem", "3rem"].map(r => (
                    <button 
                      key={r} 
                      onClick={()=>setFormData({...formData, borderRadius: r})}
                      className={`h-10 rounded-lg border-2 text-[10px] font-bold ${formData.borderRadius === r ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-100 text-zinc-400'}`}
                    >
                      {r === "0px" ? "حادة" : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t">
            <h3 className="font-black text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon size={14} /> الأصول الرسومية والفيديو
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <ImageThumb label="اللوجو الرئيسي" value={formData.logoUrl} onClick={() => handleFieldClick('logoUrl', 'شعار المنصة', 'image')} />
              <ImageThumb label="خلفية الهيرو" value={formData.landingBg} onClick={() => handleFieldClick('landingBg', 'خلفية صفحة الهبوط', 'image')} />
              <ImageThumb label="صورة المشاركة" value={formData.ogImageUrl} onClick={() => handleFieldClick('ogImageUrl', 'صورة معاينة الروابط', 'image')} />
              <div className="space-y-2">
                <Label className="text-[10px] font-black opacity-60">فيديو اليوتيوب</Label>
                <div 
                  onClick={() => handleFieldClick('landingVideoId', 'معرف فيديو يوتيوب')}
                  className="h-24 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center cursor-pointer hover:border-primary transition-all"
                >
                  <Youtube size={24} className="text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-zinc-200/50 p-10 overflow-y-auto flex flex-col items-center">
          <div 
            className="w-full max-w-5xl bg-white shadow-[0_50px_100px_rgba(0,0,0,0.1)] overflow-hidden min-h-[1200px] transition-all duration-700"
            style={{ 
              backgroundColor: formData.backgroundColor || "#FFFFFF",
              borderRadius: formData.borderRadius 
            }}
          >
            {/* Header Preview */}
            <nav className="h-24 border-b flex items-center justify-between px-12 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => handleFieldClick('logoUrl', 'الشعار المربع', 'image')}
                >
                  {formData.logoUrl ? <img src={formData.logoUrl} className="w-full h-full object-contain" /> : <span style={{ color: formData.primaryColor }} className="text-2xl font-black">ف</span>}
                </div>
                <span 
                  className="font-black text-3xl cursor-pointer hover:text-primary transition-all"
                  style={{ color: formData.primaryColor }}
                  onClick={() => handleFieldClick('siteTitle', 'اسم المنصة')}
                >
                  {formData.siteTitle}
                </span>
              </div>
              <div className="flex gap-6 items-center">
                {['navHome', 'navTeachers', 'navPortfolio', 'navBrowse'].map(key => (
                  <span 
                    key={key}
                    className="font-black text-xs text-zinc-400 cursor-pointer hover:text-primary whitespace-nowrap"
                    onClick={() => handleFieldClick(key, 'اسم رابط التنقل')}
                  >
                    {(formData as any)[key] || ""}
                  </span>
                ))}
              </div>
            </nav>

            {/* Page Previews */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {currentPage === 'home' && (
                <>
                  <section className="relative">
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={formData.landingBg || PlaceHolderImages.find(i => i.id === 'landing-bg')?.imageUrl} 
                        className="w-full h-full object-cover brightness-[0.4] cursor-pointer hover:brightness-[0.6] transition-all" 
                        onClick={() => handleFieldClick('landingBg', 'خلفية صفحة الهبوط', 'image')}
                      />
                    </div>
                    <div className="relative z-10 py-48 px-12 text-center space-y-12">
                      <h1 
                        className="text-7xl md:text-8xl font-black leading-tight text-white cursor-pointer hover:bg-white/10 p-6 rounded-[3rem] transition-all"
                        onClick={() => handleFieldClick('heroTitle', 'عنوان الهيرو الرئيسي')}
                      >
                        {formData.heroTitle}
                      </h1>
                      <p 
                        className="text-3xl font-bold text-zinc-300 max-w-3xl mx-auto cursor-pointer hover:bg-white/5 p-4 rounded-2xl transition-all"
                        onClick={() => handleFieldClick('heroSubtitle', 'الوصف الفرعي للهيرو')}
                      >
                        {formData.heroSubtitle}
                      </p>
                    </div>
                  </section>

                  {/* YouTube Preview Section */}
                  <section 
                    className="py-24 bg-zinc-50 border-t border-b border-dashed border-zinc-200 cursor-pointer hover:bg-zinc-100 transition-all flex flex-col items-center justify-center gap-6"
                    onClick={() => handleFieldClick('landingVideoId', 'معرف فيديو يوتيوب')}
                  >
                    <div className="bg-primary/10 p-6 rounded-full text-primary">
                      <Play className="h-12 w-12 fill-current" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-black text-zinc-800">قسم الفيديو التعريفي</h3>
                      <p className="text-sm font-bold text-muted-foreground">ID الحالي: {formData.landingVideoId}</p>
                    </div>
                    <div className="w-full max-w-3xl aspect-video bg-black rounded-[3rem] shadow-2xl flex items-center justify-center overflow-hidden border-8 border-white">
                      <Youtube size={80} className="text-red-600 opacity-50" />
                    </div>
                  </section>
                </>
              )}

              {currentPage === 'seo' && (
                <section className="p-16 space-y-12">
                  <div className="space-y-4 border-r-8 border-accent pr-6">
                    <h2 className="text-4xl font-black text-zinc-900">إعدادات البحث (SEO)</h2>
                    <p className="text-zinc-500 font-bold">تحكم في كيفية ظهور المنصة في محركات البحث.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    <div className="p-8 bg-white rounded-3xl border shadow-sm space-y-6">
                      <h4 className="font-black text-xl flex items-center gap-2"><Globe className="text-primary"/> الأساسيات (Meta Tags)</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="font-black text-xs opacity-60">العنوان التعريفي (Title)</Label>
                          <Input value={formData.metaTitle} onChange={(e)=>setFormData({...formData, metaTitle: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-xs opacity-60">الوصف التعريفي (Description)</Label>
                          <Textarea value={formData.metaDescription} onChange={(e)=>setFormData({...formData, metaDescription: e.target.value})} className="h-24 rounded-xl border-2 font-medium" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <footer className="mt-20 py-16 border-t px-12 flex flex-col md:flex-row justify-between items-center bg-zinc-900 text-white rounded-t-[5rem]">
              <div className="flex items-center gap-4">
                <div style={{ color: formData.primaryColor }} className="text-xl font-black">ف</div>
                <div 
                  className="text-xl font-black opacity-60 cursor-pointer hover:bg-white/10 p-3 rounded-xl transition-all"
                  onClick={() => handleFieldClick('footerText', 'نص حقوق الملكية')}
                >
                  {formData.footerText}
                </div>
              </div>
              <div className="text-zinc-500 text-xs font-bold">معاينة التذييل الرسمي</div>
            </footer>
          </div>
        </main>
      </div>

      <Dialog open={!!activeField && activeField.type !== 'image'} onOpenChange={() => setActiveField(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-[3.5rem] border-none shadow-2xl p-12" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-4xl font-black flex items-center gap-4">
              <Edit3 className="text-primary h-10 w-10" /> تعديل المحتوى
            </DialogTitle>
            <DialogDescription className="text-right text-xl font-bold mt-2">
              تعديل: <span className="text-primary">{activeField?.label}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-10">
            <Label className="font-black mb-4 block text-lg text-right">
              {activeField?.key === 'landingVideoId' ? 'أدخل معرف الفيديو (مثلاً: dQw4w9WgXcQ)' : 'المحتوى الجديد'}
            </Label>
            {activeField?.type === 'textarea' ? (
              <Textarea 
                value={activeField?.value || ""} 
                onChange={(e) => setActiveField({...activeField!, value: e.target.value})}
                className="h-60 rounded-3xl border-4 border-zinc-100 text-2xl font-medium p-8 focus:border-primary transition-all leading-relaxed text-right"
              />
            ) : (
              <Input 
                value={activeField?.value || ""} 
                onChange={(e) => setActiveField({...activeField!, value: e.target.value})}
                className="h-20 rounded-2xl border-4 border-zinc-100 text-3xl font-black px-6 focus:border-primary transition-all text-right"
              />
            )}
          </div>
          <div className="flex gap-6">
            <Button onClick={updateField} className="flex-1 h-20 rounded-[2rem] font-black text-2xl shadow-2xl hover:scale-[1.02] transition-all">
              تحديث المعاينة
            </Button>
            <Button variant="ghost" onClick={() => setActiveField(null)} className="h-20 px-10 rounded-[2rem] font-black text-xl text-zinc-400">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label className="text-[10px] font-black opacity-60 pr-2">{label}</Label>
      <div className="flex gap-3">
        <div className="relative h-14 w-14 rounded-2xl overflow-hidden border-2 shadow-inner">
          <input 
            type="color" 
            value={value || "#000000"} 
            onChange={(e) => onChange(e.target.value)} 
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10" 
          />
          <div style={{ backgroundColor: value || "#000000" }} className="w-full h-full"></div>
        </div>
        <Input 
          value={value || ""} 
          onChange={(e) => onChange(e.target.value)} 
          className="h-14 font-mono font-bold text-lg flex-1 rounded-2xl border-2" 
        />
      </div>
    </div>
  );
}

function ImageThumb({ label, value, onClick }: any) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black opacity-60">{label}</Label>
      <div 
        onClick={onClick}
        className="h-24 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary transition-all"
      >
        {value ? (
          <img src={value} className="w-full h-full object-contain p-2" />
        ) : (
          <ImageIcon size={24} className="text-zinc-300" />
        )}
      </div>
    </div>
  );
}
