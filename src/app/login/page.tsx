
"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFirebase, useUser, useFirestore } from "@/firebase";
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Loader2, 
  ChevronRight, 
  Smartphone, 
  User, 
  Eye, 
  EyeOff,
  Globe,
  Lock
} from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// قائمة الدول مرتبة أبجدياً بالعربية مع الأعلام وأطوال الأرقام وتنسيقات البداية
const COUNTRIES = [
  { code: "962", name: "الأردن", flag: "🇯🇴", length: 9, start: ["7"], iso: "JO" },
  { code: "971", name: "الإمارات", flag: "🇦🇪", length: 9, start: ["5"], iso: "AE" },
  { code: "973", name: "البحرين", flag: "🇧🇭", length: 8, start: ["3", "6"], iso: "BH" },
  { code: "213", name: "الجزائر", flag: "🇩🇿", length: 9, start: ["5", "6", "7"], iso: "DZ" },
  { code: "249", name: "السودان", flag: "🇸🇩", length: 9, start: ["9", "1"], iso: "SD" },
  { code: "966", name: "السعودية", flag: "🇸🇦", length: 9, start: ["5"], iso: "SA" },
  { code: "252", name: "الصومال", flag: "🇸🇴", length: 9, start: [], iso: "SO" },
  { code: "964", name: "العراق", flag: "🇮🇶", length: 10, start: ["7"], iso: "IQ" },
  { code: "965", name: "الكويت", flag: "🇰🇼", length: 8, start: ["5", "6", "9"], iso: "KW" },
  { code: "212", name: "المغرب", flag: "🇲🇦", length: 9, start: ["6", "7"], iso: "MA" },
  { code: "967", name: "اليمن", flag: "🇾🇪", length: 9, start: ["7"], iso: "YE" },
  { code: "216", name: "تونس", flag: "🇹🇳", length: 8, start: ["2", "4", "5", "9"], iso: "TN" },
  { code: "269", name: "جزر القمر", flag: "🇰🇲", length: 7, start: [], iso: "KM" },
  { code: "253", name: "جيبوتي", flag: "🇩🇯", length: 8, start: [], iso: "DJ" },
  { code: "963", name: "سوريا", flag: "🇸🇾", length: 9, start: ["9"], iso: "SY" },
  { code: "968", name: "عمان", flag: "🇴🇲", length: 8, start: ["7", "9"], iso: "OM" },
  { code: "970", name: "فلسطين", flag: "🇵🇸", length: 9, start: ["5"], iso: "PS" },
  { code: "974", name: "قطر", flag: "🇶🇦", length: 8, start: ["3", "5", "6", "7"], iso: "QA" },
  { code: "961", name: "لبنان", flag: "🇱🇧", length: 8, start: ["3", "7", "8"], iso: "LB" },
  { code: "218", name: "ليبيا", flag: "🇱🇾", length: 9, start: ["9"], iso: "LY" },
  { code: "20", name: "مصر", flag: "🇪🇬", length: 10, start: ["10", "11", "12", "15"], iso: "EG" },
  { code: "222", name: "موريتانيا", flag: "🇲🇷", length: 8, start: ["2", "3", "4"], iso: "MR" },
  { code: "1", name: "أمريكا", flag: "🇺🇸", length: 10, start: [], iso: "US" },
  { code: "44", name: "بريطانيا", flag: "🇬🇧", length: 10, start: [], iso: "GB" },
  { code: "90", name: "تركيا", flag: "🇹🇷", length: 10, start: ["5"], iso: "TR" },
  { code: "33", name: "فرنسا", flag: "🇫🇷", length: 9, start: ["6", "7"], iso: "FR" },
  { code: "49", name: "ألمانيا", flag: "🇩🇪", length: 11, start: ["1"], iso: "DE" },
].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

function LoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get('mode') === 'signup' ? false : true;
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"mustafhem" | "mufhem">("mustafhem");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("20");
  const [birthDate, setBirthDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // الكشف عن الدولة تلقائياً حسب IP
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const detected = COUNTRIES.find(c => c.iso === data.country_code);
        if (detected) {
          setCountryCode(detected.code);
        }
      } catch (err) {
        console.warn("IP detection failed, using default.");
      }
    };
    if (!isLogin) detectCountry();
  }, [isLogin]);

  useEffect(() => {
    if (user && !isUserLoading && isLogin) {
      router.push("/");
    }
  }, [user, isUserLoading, router, isLogin]);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length > 6) strength += 33;
    if (/[0-9]/.test(pass)) strength += 33;
    if (/[A-Z]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) strength += 34;
    return strength;
  };

  const validatePhone = (code: string, num: string) => {
    const country = COUNTRIES.find(c => c.code === code);
    if (!country) return { valid: false, msg: "يرجى اختيار الدولة" };

    if (num.length !== country.length) {
      return { 
        valid: false, 
        msg: `في ${country.name}، يجب أن يتكون الرقم من ${country.length} أرقام بالضبط.` 
      };
    }

    if (country.start.length > 0) {
      const matchesStart = country.start.some(prefix => num.startsWith(prefix));
      if (!matchesStart) {
        return { 
          valid: false, 
          msg: `في ${country.name}، يجب أن يبدأ الرقم بـ: ${country.start.join(' أو ')}.` 
        };
      }
    }

    return { valid: true, msg: "" };
  };

  const handleSignUp = async () => {
    if (!birthDate) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال تاريخ الميلاد." });
      return;
    }
    const birthYear = new Date(birthDate).getFullYear();
    if (birthYear > 2011) {
      toast({ 
        variant: "destructive", 
        title: "عذراً", 
        description: "يحظر استخدام المنصة لمن هو أقل من 16 عام." 
      });
      return;
    }

    if (!firstName || !lastName || !phoneNumber || !email || !password || !confirmPassword) {
      toast({ variant: "destructive", title: "بيانات ناقصة" });
      return;
    }

    const phoneValidation = validatePhone(countryCode, phoneNumber);
    if (!phoneValidation.valid) {
      toast({ 
        variant: "destructive", 
        title: "رقم هاتف غير صحيح", 
        description: phoneValidation.msg 
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "كلمات المرور غير متطابقة" });
      return;
    }
    if (!agreedToTerms) {
      toast({ variant: "destructive", title: "تنبيه", description: "يجب الموافقة على الشروط للمتابعة." });
      return;
    }

    setIsProcessing(true);
    try {
      const cred = await initiateEmailSignUp(auth, email, password);
      if (cred.user) {
        const fullPhone = `${countryCode}${phoneNumber}`;
        
        await setDoc(doc(firestore!, "users", cred.user.uid), {
          id: cred.user.uid,
          fullName: `${firstName} ${lastName}`,
          firstName,
          lastName,
          email,
          phoneNumber: fullPhone,
          role,
          gender,
          isProfileApproved: false,
          birthDate: new Date(birthDate).toISOString(),
          status: "active",
          createdAt: new Date().toISOString(),
          needsProfileCompletion: true,
          password: password 
        });

        toast({ title: "تم إنشاء الحساب بنجاح!" });
        router.push("/profile");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل التسجيل", description: "البريد قد يكون مستخدماً بالفعل." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    initiateEmailSignIn(auth, email, password).then(() => {
      router.push("/");
    }).catch(() => {
      toast({ variant: "destructive", title: "البيانات غير صحيحة" });
      setIsProcessing(false);
    });
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#F8FAFC]" dir="rtl">
      <Card className="w-full max-w-xl shadow-2xl border-4 border-white rounded-[4rem] bg-white overflow-hidden animate-in fade-in duration-700">
        <CardHeader className="text-center pt-12 pb-6 space-y-8">
          <CardTitle className="text-4xl font-black text-zinc-900 tracking-tight">
            {isLogin ? "دخول المنصة" : "التسجيل في فهمت"}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="px-8 md:px-12 pb-10">
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label className="font-black">البريد الإلكتروني</Label>
                <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="h-16 rounded-2xl border-2 font-black text-lg" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                  <Label className="font-black">كلمة المرور</Label>
                  <Link href="/forgot-password" size="sm" className="text-sm font-black text-primary">نسيت كلمة المرور؟</Link>
                </div>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e)=>setPassword(e.target.value)} 
                    required 
                    className="h-16 rounded-2xl border-2 font-black text-lg pl-12" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={isProcessing} className="w-full h-20 text-2xl font-black rounded-3xl bg-primary shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin h-8 w-8" /> : "تسجيل الدخول"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black">الاسم الأول</Label>
                  <Input placeholder="أحمد" value={firstName} onChange={(e)=>setFirstName(e.target.value)} className="h-14 rounded-xl border-2 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-black">الاسم الأخير</Label>
                  <Input placeholder="محمد" value={lastName} onChange={(e)=>setLastName(e.target.value)} className="h-14 rounded-xl border-2 font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black">رقم الهاتف</Label>
                <div className="flex gap-2" dir="ltr">
                  <div className="w-32 shrink-0">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className="h-14 rounded-xl border-2 font-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={`${c.code}-${c.name}`} value={c.code} className="font-bold">
                            <span className="text-xl ml-2">{c.flag}</span>
                            <span>+{c.code}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 relative">
                    <Input 
                      placeholder={`أدخل ${selectedCountry?.length} أرقام`} 
                      maxLength={selectedCountry?.length}
                      value={phoneNumber} 
                      onChange={(e)=>setPhoneNumber(e.target.value.replace(/\D/g, ''))} 
                      className="h-14 rounded-xl border-2 font-black text-lg text-left" 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary opacity-20 group-hover:opacity-100">
                      <Smartphone size={20} />
                    </div>
                  </div>
                </div>
                <p className="text-[9px] font-bold text-muted-foreground pr-2 text-right">
                  {selectedCountry?.name}: مطلوب {selectedCountry?.length} أرقام {selectedCountry?.start.length ? `تبدأ بـ ${selectedCountry.start.join('/')}` : ''}.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-black">تاريخ الميلاد</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className="h-14 rounded-xl border-2 font-black" />
              </div>

              <div className="space-y-2">
                <Label className="font-black">البريد الإلكتروني</Label>
                <Input type="email" placeholder="name@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} required className="h-14 rounded-xl border-2 font-bold" />
              </div>

              <div className="space-y-2">
                <Label className="font-black">كلمة المرور</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e)=>setPassword(e.target.value)} 
                    required 
                    className="h-14 rounded-xl border-2 font-black pr-6" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="space-y-1">
                  <Progress value={passwordStrength} className={cn("h-1.5 rounded-full transition-all", 
                    passwordStrength < 40 ? "bg-red-500" : passwordStrength < 80 ? "bg-yellow-500" : "bg-green-500"
                  )} />
                  <p className="text-[10px] font-bold text-muted-foreground text-right">
                    قوة كلمة المرور: {passwordStrength < 40 ? "ضعيفة" : passwordStrength < 80 ? "متوسطة" : "قوية"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black">تأكيد كلمة المرور</Label>
                <Input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required className="h-14 rounded-xl border-2 font-black pr-6" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border-2 border-dashed space-y-3">
                  <Label className="text-xs font-black block text-center">نوع الحساب</Label>
                  <RadioGroup value={role} onValueChange={(v:any)=>setRole(v)} className="flex justify-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                      <RadioGroupItem value="mustafhem" id="r1" />
                      <Label htmlFor="r1" className="text-[10px] font-black cursor-pointer">مستفهم</Label>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                      <RadioGroupItem value="mufhem" id="r2" />
                      <Label htmlFor="r2" className="text-[10px] font-black cursor-pointer">مفهم</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border-2 border-dashed space-y-3">
                  <Label className="text-xs font-black block text-center">الجنس</Label>
                  <RadioGroup value={gender} onValueChange={(v:any)=>setGender(v)} className="flex justify-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                      <RadioGroupItem value="male" id="g1" />
                      <Label htmlFor="g1" className="text-[10px] font-black cursor-pointer">ذكر</Label>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                      <RadioGroupItem value="female" id="g2" />
                      <Label htmlFor="g2" className="text-[10px] font-black cursor-pointer">أنثى</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-primary/10">
                <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(v) => setAgreedToTerms(!!v)} className="mt-1" />
                <Label htmlFor="terms" className="text-xs font-bold leading-relaxed cursor-pointer select-none text-right">
                  أوافق على <Link href="/terms" target="_blank" className="text-primary underline">شروط الاستخدام</Link> و <Link href="/privacy" target="_blank" className="text-primary underline">سياسة الخصوصية</Link>.
                </Label>
              </div>

              <Button onClick={handleSignUp} disabled={isProcessing} className="w-full h-20 text-2xl font-black rounded-3xl bg-accent shadow-xl">
                {isProcessing ? <><Loader2 className="animate-spin ml-3 h-8 w-8" /> جاري التحضير...</> : "التسجيل الآن"}
              </Button>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="justify-center border-t py-10 bg-zinc-50/50">
          <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="font-black text-primary text-xl flex items-center gap-3">
            {isLogin ? "مستخدم جديد؟ سجل الآن" : "لديك حساب؟ سجل دخولك"}
            <ChevronRight className={`h-6 w-6 transition-transform ${!isLogin ? 'rotate-180' : ''}`} />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center animate-pulse">جاري تحميل المنصة...</div>}>
      <LoginContent />
    </Suspense>
  );
}
