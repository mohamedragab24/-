
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  Scale,
  GraduationCap,
  Layout,
  Search,
  MessageSquare,
  Plus,
  Zap,
  PlayCircle,
  Menu,
  UserPlus,
  Users,
  ShieldCheck,
  Target,
  ChevronRight,
  HelpCircle,
  ArrowLeft,
  BadgeCent,
  Clock,
  ClipboardList,
  Layers,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useDoc, useMemoFirebase, useCollection, useFirebase, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { doc, collection, query, limit, where, orderBy, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";

const LANDING_FAQS = [
  { 
    q: "ما هي منصة فهمت وما الذي يميزها؟", 
    a: "منصة فهمت هي وسيط تقني يربط بين المستفهم من يبحث عن معلومة أو شرح سريع و المفهم (صاحب الخبرة والقدرة على الشرح). ما يميزنا هو التخصص في 'الفهم اللحظي' عبر جلسات مسجلة تضمن حق الطرفين، مع مراعاة الخصوصية التامة بفصل الجنسين في التعامل." 
  },
  { 
    q: "يمكنني استخدام حسابي كمستفهم ومفهم في نفس الوقت؟", 
    a: "نعم، بضغطة زر واحدة يمكنك التحول من واجهة المستفهم لطلب المساعدة، إلى واجهة المفهم لتقديم عروضك ومساعدة الآخرين دون الحاجة لإنشاء حسابين." 
  },
  { 
    q: "ما هو الإجراء المتبع في حال حدوث خلاف أثناء الجلسة؟", 
    a: "تعتمد المنصة على تسجيل الجلسة كمرجع أساسي (وهو تسجيل مؤقت يحذف نهائياً في حالة عدم وجود شكوى أو خلاف). في حال وجود شكوى، يقوم فريق الدعم الفني بمراجعة التسجيل والتحكيم بين الطرفين بناءً على محتوى الشرح." 
  }
];

export default function HomePage() {
  const { user, isUserLoading, auth } = useFirebase();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const [appealReason, setAppealReason] = useState("");
  const [isSendingAppeal, setIsSendingAppeal] = useState(false);

  const handleSendAppeal = async () => {
    if (!appealReason.trim() || !firestore || !user) return;
    setIsSendingAppeal(true);
    try {
      await addDoc(collection(firestore, "appeals"), {
        userId: user.uid,
        userName: profile?.fullName || "مستخدم",
        userEmail: user.email,
        reason: appealReason,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم إرسال الطعن", description: "سيتم مراجعة طلبك من قبل إدارة فهمت." });
      setAppealReason("");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    } finally {
      setIsSendingAppeal(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LandingPage router={router} settings={settings} />;
  }

  if (profile.status === 'blocked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-zinc-50" dir="rtl">
        <Card className="w-full max-w-2xl shadow-2xl rounded-[3rem] border-t-8 border-red-600 overflow-hidden bg-white">
          <CardHeader className="text-center p-10 bg-red-50">
            <CardTitle className="text-4xl font-black text-zinc-900">عذراً، تم حظر حسابك في فهمت</CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="p-6 bg-zinc-50 rounded-2xl border-2 border-dashed space-y-4">
              <h4 className="text-xl font-black flex items-center gap-2"><Scale className="text-red-600" /> تقديم طعن للإدارة</h4>
              <Textarea placeholder="اكتب سبب الطعن بوضوح..." className="h-40 rounded-xl" value={appealReason} onChange={(e) => setAppealReason(e.target.value)} />
              <Button onClick={handleSendAppeal} disabled={isSendingAppeal} className="w-full h-14 bg-red-600 font-bold text-white rounded-xl shadow-lg">إرسال طعن</Button>
            </div>
            <Button variant="outline" onClick={() => signOut(auth).then(() => router.push("/login"))} className="w-full h-14 font-bold rounded-xl border-2">تسجيل الخروج</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10" dir="rtl">
      <div className="relative overflow-hidden bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-2 border-primary/5">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-right flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-primary/80">أهلاً بك مجدداً في فهمت</h1>
            <div className="flex items-center gap-4 justify-end md:justify-start">
              <span className="text-4xl md:text-7xl font-black text-primary tracking-tighter">{profile.fullName}</span>
              {profile.isVerified && (
                <ShieldCheck className="h-10 w-10 md:h-12 md:w-12 text-blue-500 fill-blue-500/10" />
              )}
            </div>
          </div>
          <div className="flex flex-col items-center bg-muted/20 p-8 rounded-3xl shrink-0">
            <Badge className="mt-2 px-6 py-2 text-md font-black">
              {profile.isAdmin ? "مسؤول النظام" : (profile.role === "mufhem" ? "مُفهم" : "مُستفهم")}
            </Badge>
          </div>
        </div>
      </div>
      {profile.role === "mustafhem" ? (
        <MustafhemView profile={profile} router={router} />
      ) : (
        <MufhemView profile={profile} router={router} />
      )}
    </div>
  );
}

function LandingPage({ router, settings }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const defaultLogo = settings?.logoUrl || PlaceHolderImages.find(img => img.id === 'logo-official')?.imageUrl;
  const landingBg = settings?.landingBg || PlaceHolderImages.find(img => img.id === 'landing-bg')?.imageUrl;

  return (
    <div className="relative min-h-screen bg-white font-body overflow-x-hidden flex flex-col" dir="rtl">
      <div className="relative min-h-screen flex flex-col">
        <header className="absolute top-0 inset-x-0 z-50 px-4 md:px-12 py-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b shadow-sm">
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/" className="flex items-center group shrink-0">
              <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center overflow-hidden bg-transparent">
                <img src={defaultLogo} className="w-full h-full object-contain" alt="Logo" />
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-4 md:gap-8 flex-1 justify-end">
            <nav className="hidden lg:flex items-center gap-6 border-l border-zinc-100 pl-6">
              <LandingNavLink href="/courses" icon={Layers} label="كورسات جاهزة" />
              <LandingNavLink href="/teachers" icon={GraduationCap} label="المُفهمين" />
              <LandingNavLink href="/portfolio" icon={Layout} label="أعمال المفهمين" />
              <LandingNavLink href="/browse" icon={Search} label="الاستفهامات" />
            </nav>
            
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <Button onClick={() => router.push('/login')} variant="ghost" className="text-zinc-600 hover:bg-zinc-100 font-bold text-lg hidden sm:flex">دخول</Button>
              <Button onClick={() => router.push('/login?mode=signup')} className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl px-8 h-14 text-xl shadow-xl flex items-center gap-2">
                <UserPlus size={20} /> تسجيل جديد
              </Button>
            </div>
          </div>
        </header>

        <main className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={landingBg} 
              className="w-full h-full object-cover object-top brightness-100" 
              alt="Landing Background"
            />
          </div>

          <div className="relative z-10 w-full max-w-6xl px-4 pt-32 pb-20 space-y-12">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-9xl font-black text-white leading-tight tracking-tight drop-shadow-2xl">
                {settings?.heroTitle || "أول منصة عربية لخدمات الشرح الفوري"}
              </h1>
              <p className="text-xl md:text-4xl text-zinc-100 font-bold max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
                {settings?.heroSubtitle || "اربط عقلك بأفضل الخبراء واحصل على شرح مخصص لك في جلسات تفاعلية مباشرة."}
              </p>
            </div>

            <div className="relative max-w-4xl w-full mx-auto mt-12 group animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex flex-col md:flex-row gap-4 p-4 bg-white/95 backdrop-blur-xl rounded-[3rem] border-4 border-primary/20 shadow-[0_30px_100px_rgba(0,0,0,0.3)] transition-all group-hover:border-primary/40">
                <div className="relative flex-1">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-primary h-8 w-8" />
                  <Input 
                    placeholder="ابحث عن أي موضوع يدور في ذهنك..." 
                    className="h-16 md:h-24 pr-16 rounded-[2.5rem] border-none bg-zinc-50 text-2xl font-bold shadow-inner placeholder:text-zinc-400 text-right"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={() => router.push(`/create-request?title=${encodeURIComponent(searchTerm)}`)}
                  className="h-16 md:h-24 px-12 rounded-[2.5rem] bg-accent hover:bg-accent/90 text-2xl font-black shadow-xl shadow-accent/20 transition-all hover:scale-[1.02]"
                >
                  <MessageSquare className="ml-2" /> استفهم الآن
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <section className="bg-zinc-50 py-24 px-6 border-y">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <div className="space-y-4 text-right">
              <h2 className="text-4xl md:text-6xl font-black text-zinc-900 leading-tight">كيف يعمل فهمت؟</h2>
              <p className="text-xl text-zinc-500 font-bold leading-relaxed">خطوات بسيطة تفصلك عن المعلومة التي تبحث عنها بأسلوب ميسر وشرح بشري مباشر.</p>
            </div>
            
            <div className="space-y-8">
              <StepItem icon={MessageSquare} color="bg-blue-500" title="1. اطرح استفهامك" desc="صف الجزئية التي لا تفهمها بدقة وحدد ميزانيتك المقترحة." />
              <StepItem icon={Zap} color="bg-orange-500" title="2. استقبل العروض" desc="سيقوم المفهمون المتخصصون بتقديم عروضهم وشرح أسلوبهم." />
              <StepItem icon={PlayCircle} color="bg-green-600" title="3. ابدأ الجلسة" desc="ادخل غرفة المحاضرة المباشرة واستفهم حتى تصل للفهم التام." />
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary to-accent rounded-[4rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative aspect-video bg-black rounded-[3.5rem] overflow-hidden shadow-2xl border-8 border-white group-hover:scale-[1.02] transition-transform">
              {settings?.landingVideoId ? (
                <iframe 
                  className="w-full h-full" 
                  src={`https://www.youtube.com/embed/${settings.landingVideoId}?autoplay=0&controls=1`} 
                  title="YouTube video player" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                  <PlayCircle size={80} />
                  <p className="font-black text-xl">فيديو تعريفي عن المنصة</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* قسم استعراض ميزة كورسات جاهزة المستقلة */}
      <section className="bg-white py-24 px-6 border-t relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 text-right">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-black text-sm">
                <Layers size={16} /> ميزة مستقلة وجديدة
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-zinc-900 leading-tight">
                كورسات جاهزة ومسجلة
              </h2>
              <p className="text-xl text-zinc-500 font-bold leading-relaxed">
                اشترك وشاهد الكورس مباشرة من داخل المنصة بدون انتظار وبأعلى درجات الأمان ومكافحة التسريب وحماية حقوق المفهمين.
              </p>
            </div>

            <Button asChild className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl px-8 h-14 text-lg shadow-xl shrink-0 gap-2">
              <Link href="/courses">
                تصفح جميع الكورسات <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="rounded-[2.5rem] border-2 bg-zinc-50/50 p-8 space-y-4 text-right hover:border-primary/30 transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                <PlayCircle size={28} />
              </div>
              <h4 className="text-2xl font-black text-zinc-800">مشاهدة فورية داخل المنصة</h4>
              <p className="text-base text-zinc-600 font-bold leading-relaxed">
                بمجرد إتمام الدفع، يظهر لك الكورس مباشرة وتبدأ المشاهدة دون الحاجة لتحميل ملفات الفيديو الكبيرة.
              </p>
            </Card>

            <Card className="rounded-[2.5rem] border-2 bg-zinc-50/50 p-8 space-y-4 text-right hover:border-primary/30 transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <ShieldCheck size={28} />
              </div>
              <h4 className="text-2xl font-black text-zinc-800">حماية فائقة للمحتوى</h4>
              <p className="text-base text-zinc-600 font-bold leading-relaxed">
                تقنيات ذكية تمنع تصوير وتسجيل الشاشة وتحميل الفيديو المباشر، مع علامة مائية ديناميكية بهوية المشاهد.
              </p>
            </Card>

            <Card className="rounded-[2.5rem] border-2 bg-zinc-50/50 p-8 space-y-4 text-right hover:border-primary/30 transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                <BadgeCent size={28} />
              </div>
              <h4 className="text-2xl font-black text-zinc-800">للمفهمين: اربح من خبرتك</h4>
              <p className="text-base text-zinc-600 font-bold leading-relaxed">
                ارفع دوراتك، حدد أسعارك، وتابع أرباحك وقوائم المشتركين ومعدلات الإنجاز بكل شفافية وسهولة.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 py-24 px-6 border-t">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center">
            <h2 className="text-4xl md:text-6xl font-black text-zinc-900">أسئلة شائعة</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {LANDING_FAQS.map((faq, i) => (
              <Card key={i} className="rounded-[2.5rem] border-2 bg-white p-10 space-y-4 hover:border-primary/20 transition-all shadow-sm">
                <h4 className="text-2xl font-black text-zinc-800 flex items-center gap-3 text-right">
                  <HelpCircle className="text-primary shrink-0" /> {faq.q}
                </h4>
                <p className="text-lg text-zinc-600 font-bold leading-relaxed text-right">{faq.a}</p>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button asChild variant="ghost" className="text-xl font-black text-primary hover:text-primary/80 gap-2">
              <Link href="/support">للمزيد من الاسئلة اضغط هنا <ArrowLeft className="h-6 w-6" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MustafhemView({ profile, router }: any) {
  const firestore = useFirestore();
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !profile.id) return null;
    return query(collection(firestore, "istifhams"), where("mustafhemId", "==", profile.id), orderBy("createdAt", "desc"), limit(5));
  }, [firestore, profile.id]);

  const { data: myRequests } = useCollection(requestsQuery);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2.5rem] p-8 bg-primary text-white space-y-4 shadow-xl hover:scale-[1.02] transition-all cursor-pointer" onClick={() => router.push('/create-request')}>
          <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center"><Plus size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black">عندك سؤال؟</h2>
            <p className="text-primary-foreground/80 font-bold text-sm">اطرح استفهامك واحصل على شرح فوري.</p>
          </div>
          <Button className="bg-white text-primary hover:bg-zinc-100 font-black rounded-xl h-12 text-sm w-full">طلب استفهام جديد</Button>
        </Card>

        <Card className="rounded-[2.5rem] p-8 border-2 bg-white space-y-4 hover:border-primary/20 transition-all cursor-pointer" onClick={() => router.push('/courses')}>
          <div className="bg-emerald-50 text-emerald-600 w-14 h-14 rounded-2xl flex items-center justify-center"><Layers size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-zinc-800">كورسات جاهزة</h2>
            <p className="text-muted-foreground font-bold text-sm">تصفح الكورسات المسجلة وابدأ المشاهدة المحمية.</p>
          </div>
          <Button variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-black rounded-xl h-12 text-sm w-full">استعراض الكورسات</Button>
        </Card>

        <Card className="rounded-[2.5rem] p-8 border-2 bg-white space-y-4 hover:border-primary/20 transition-all cursor-pointer" onClick={() => router.push('/browse')}>
          <div className="bg-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center text-primary"><Search size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-zinc-800">تصفح المفهمين</h2>
            <p className="text-muted-foreground font-bold text-sm">استكشف نخبة الخبراء الموثقين في كافة التخصصات.</p>
          </div>
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 font-black rounded-xl h-12 text-sm w-full">استكشاف الخبراء</Button>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-2xl font-black text-zinc-800">أحدث استفهاماتي</h3>
          <Button variant="link" onClick={() => router.push('/requests')} className="font-black text-primary">عرض الكل</Button>
        </div>
        <div className="grid gap-4">
          {myRequests?.map((req) => (
            <IstifhamCard key={req.id} req={req} router={router} />
          ))}
          {(!myRequests || myRequests.length === 0) && (
            <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-30 font-black text-xl">لا توجد استفهامات سابقة.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MufhemView({ profile, router }: any) {
  const firestore = useFirestore();
  const availableQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "istifhams"), where("status", "==", "active"), limit(10));
  }, [firestore]);

  const { data: availableRequests } = useCollection(availableQuery);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2.5rem] p-8 bg-accent text-white space-y-4 shadow-xl hover:scale-[1.02] transition-all cursor-pointer" onClick={() => router.push('/portfolio/add')}>
          <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center"><Layout size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black">أضف لعملك</h2>
            <p className="text-accent-foreground/80 font-bold text-sm">انشر نماذج من شرحك لزيادة ثقة الطلاب بك.</p>
          </div>
          <Button className="bg-white text-accent hover:bg-zinc-100 font-black rounded-xl h-12 text-sm w-full">إضافة عمل للمعرض</Button>
        </Card>

        <Card className="rounded-[2.5rem] p-8 border-2 bg-white space-y-4 hover:border-accent/20 transition-all cursor-pointer" onClick={() => router.push('/courses')}>
          <div className="bg-primary/10 text-primary w-14 h-14 rounded-2xl flex items-center justify-center"><Layers size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-zinc-800">كورسات جاهزة</h2>
            <p className="text-muted-foreground font-bold text-sm">أنشئ كورساً، ارفع الدروس، وتابع مبيعاتك.</p>
          </div>
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 font-black rounded-xl h-12 text-sm w-full">إدارة كورساتي</Button>
        </Card>

        <Card className="rounded-[2.5rem] p-8 border-2 bg-white space-y-4 hover:border-accent/20 transition-all cursor-pointer" onClick={() => router.push('/browse')}>
          <div className="bg-accent/10 w-14 h-14 rounded-2xl flex items-center justify-center text-accent"><Zap size={28} /></div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-zinc-800">فرص التفهيم</h2>
            <p className="text-muted-foreground font-bold text-sm">تصفح طلبات الطلاب وقدم عروضك الآن.</p>
          </div>
          <Button variant="outline" className="border-accent text-accent hover:bg-accent/5 font-black rounded-xl h-12 text-sm w-full">تصفح الاستفهامات</Button>
        </Card>
      </div>

      <div className="space-y-6">
        <h3 className="text-2xl font-black text-zinc-800 px-2">استفهامات قد تناسبك</h3>
        <div className="grid gap-4">
          {availableRequests?.map((req) => (
            <IstifhamCard key={req.id} req={req} router={router} />
          ))}
          {(!availableRequests || availableRequests.length === 0) && (
            <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-30 font-black text-xl">لا توجد طلبات متاحة حالياً.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function IstifhamCard({ req, router }: any) {
  return (
    <Card 
      onClick={() => router.push(`/requests/${req.id}`)} 
      className="rounded-[2rem] border-2 hover:border-primary/20 transition-all cursor-pointer group bg-white shadow-md overflow-hidden flex flex-col md:flex-row"
    >
      <div className="md:w-48 bg-zinc-50/50 p-6 flex flex-col items-center justify-center text-center border-l shrink-0">
        <Avatar className="h-16 w-16 border-2 border-white shadow-lg mb-2">
          <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">{req.mustafhemName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="font-black text-sm text-zinc-900">{req.mustafhemName}</p>
      </div>
      <div className="flex-1 p-6 flex flex-col space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black text-zinc-400">
          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-lg flex items-center gap-1"><BadgeCent size={12} /> {req.amount} ج.م</span>
          <span className="flex items-center gap-1"><Clock size={12} /> منذ {getTimeAgo(req.createdAt)}</span>
          <Badge className="mr-auto bg-primary/10 text-primary border-none">{req.status === 'active' ? 'مفتوح' : 'مكتمل'}</Badge>
        </div>
        <h3 className="text-xl font-black text-zinc-800 group-hover:text-primary transition-colors">{req.title}</h3>
      </div>
    </Card>
  );
}

function StepItem({ icon: Icon, color, title, desc }: any) {
  return (
    <div className="flex gap-6 items-start text-right group">
      <div className={`${color} p-4 rounded-2xl text-white shadow-xl group-hover:scale-110 transition-transform`}>
        <Icon size={28} />
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-black text-zinc-800">{title}</h4>
        <p className="text-lg text-zinc-500 font-bold leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function LandingNavLink({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-zinc-600 hover:text-primary font-black text-lg transition-all group shrink-0">
      <div className="bg-zinc-100 p-2 rounded-lg group-hover:bg-primary/10 transition-all">
        <Icon size={20} className="group-hover:text-primary" />
      </div>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function getTimeAgo(dateStr: string) {
  if (!dateStr) return "لحظات";
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) return `${minutes}د`;
  if (hours < 24) return `${hours}س`;
  return `${days}ي`;
}
