"use client";

import React, { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Course } from "@/lib/types";
import { isUserEnrolled, syncPurchasedCourses } from "@/lib/courses-data";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface CoursePurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  currentBalance?: number;
  onPurchaseSuccess?: () => void;
}

export function CoursePurchaseDialog({
  open,
  onOpenChange,
  course,
  studentId = "current-student-id",
  studentName = "مستفهم منصة فهمت",
  studentEmail = "student@fahimt.com",
  currentBalance,
  onPurchaseSuccess
}: CoursePurchaseDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<"balance" | "vodafone_cash" | "orange_cash" | "etisalat_cash" | "we_pay" | "instapay" | "bank_transfer">("balance");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [walletBalance, setWalletBalance] = useState(Number(currentBalance ?? 0));
  useEffect(() => {
    if (typeof currentBalance === "number") setWalletBalance(currentBalance);
  }, [currentBalance]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const { firebaseApp } = initializeFirebase();
        const uid = getAuth(firebaseApp).currentUser?.uid;
        if (!uid) { if (active && currentBalance == null) setWalletBalance(0); return; }
        const walletSnap = await getDoc(doc(getFirestore(firebaseApp), "wallets", uid));
        const storedBalance = walletSnap.exists() ? Number(walletSnap.data()?.balance) : NaN;
        if (Number.isFinite(storedBalance)) {
          if (active) setWalletBalance(Math.round(storedBalance * 100) / 100);
        } else if (active) {
          setWalletBalance(0);
        }
      } catch (e) { console.error("Unable to load wallet balance", e); }
    })();
    return () => { active = false; };
  }, [open, currentBalance]);

  if (!course) return null;

  const isAlreadyBought = isUserEnrolled(course.id, studentId);
  const isOwner = course.instructorId === studentId;

  const handleConfirmPurchase = async () => {
    if (isAlreadyBought) {
      toast({
        variant: "destructive",
        title: "غير مسموح",
        description: "أنت مشترك بالفعل في هذا الكورس ولديك صلاحية مشاهدته."
      });
      return;
    }

    if (isOwner) {
      toast({
        variant: "destructive",
        title: "غير مسموح",
        description: "لا يمكنك شراء كورس قمت بنشره بنفسك."
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { firebaseApp } = initializeFirebase();
      const functions = getFunctions(firebaseApp, "us-central1");
      const purchaseCourse = httpsCallable(functions, "purchaseCourse");
      const result: any = await purchaseCourse({ courseId: course.id, source: "web", paymentMethod, phone: paymentPhone.trim(), accountHolderName: accountHolderName.trim() });
      if (!result.data?.ok) throw new Error("purchase_failed");
      try { const fb = initializeFirebase(); await syncPurchasedCourses(fb.firestore, fb.auth?.currentUser?.uid); } catch (_) {}
      setIsProcessing(false);
      toast({
        title: "تم شراء الكورس بنجاح!",
        description: "تم خصم المبلغ من المحفظة وتسجيل العملية في Firebase."
      });
      onOpenChange(false);
      if (onPurchaseSuccess) onPurchaseSuccess();
      router.push(`/courses/${course.id}`);
    } catch (error: any) {
      console.error("purchaseCourse failed", error);
      setIsProcessing(false);
      const code = String(error?.code || "");
      const generic = code.endsWith("/internal") || error?.message === "internal";
      toast({
        variant: "destructive",
        title: "تعذر إتمام الشراء",
        description: generic
          ? "تعذر الاتصال بخدمة الشراء. تأكد من نشر دوال Firebase (purchaseCourse) ثم حاول مرة أخرى."
          : error?.message || "حاول مرة أخرى.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 md:p-8 rounded-[2rem]" dir="rtl">
        <DialogHeader className="text-right space-y-2">
          <DialogTitle className="text-2xl font-black text-zinc-900 flex items-center gap-2">
            <Lock className="text-primary h-6 w-6" />
            {isAlreadyBought ? "أنت مشترك بالفعل في الكورس" : isOwner ? "أنت صاحب هذا الكورس" : "شراء الكورس وتفعيل المشاهدة الفورية"}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 font-bold">
            مشاهدة مباشرة ومحمية داخل منصة فهمت بالجنيه المصري.
          </DialogDescription>
        </DialogHeader>

        {isAlreadyBought ? (
          <div className="py-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h4 className="font-black text-xl text-zinc-900">أنت مشترك بالفعل في هذا الكورس!</h4>
              <p className="text-sm text-zinc-600 font-bold max-w-md mx-auto leading-relaxed">
                لا يمكن إعادة شراء كورس قمت بالاشتراك فيه مسبقاً. كافة أجزاء وفيديوهات الكورس مفتوحة ومتاحة لك للمشاهدة في أي وقت.
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push(`/courses/${course.id}`);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl px-8 h-12 gap-2 shadow-md"
            >
              الانتقال لمشاهدة جميع الدروس الآن
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        ) : isOwner ? (
          <div className="py-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h4 className="font-black text-xl text-zinc-900">أنت ناشر ومفهم هذا الكورس!</h4>
              <p className="text-sm text-zinc-600 font-bold max-w-md mx-auto leading-relaxed">
                لا يمكن للمفهم شراء كورسه الخاص. يمكنك معاينة المحتوى وتعديل الدروس ومتابعة إحصائيات الطلاب والمبيعات.
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push(`/courses/${course.id}`);
              }}
              className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-8 h-12 gap-2 shadow-md"
            >
              معاينة الكورس وإدارته
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* بطاقة ملخص الكورس */}
            <div className="flex gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border text-right">
              <img
                src={course.coverUrl}
                alt={course.title}
                className="w-24 h-24 rounded-xl object-cover shrink-0 border"
              />
              <div className="space-y-1.5 flex-1">
                <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold">
                  {course.category}
                </Badge>
                <h4 className="font-black text-base text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                  {course.title}
                </h4>
                <p className="text-xs text-zinc-500 font-bold">
                  بواسطة: {course.instructorName} • {(Array.isArray(course.lessons) ? course.lessons.length : 0)} دروس
                </p>
              </div>
            </div>

            {/* اختيار طريقة الدفع */}
            <div className="space-y-3 text-right">
              <h5 className="font-black text-sm text-zinc-800">طريقة الدفع:</h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["balance", "محفظة فهمت", `الرصيد المتاح: ${walletBalance} ج.م`],
                  ["vodafone_cash", "فودافون كاش", "محفظة إلكترونية"],
                  ["orange_cash", "أورنج كاش", "محفظة إلكترونية"],
                  ["etisalat_cash", "اتصالات كاش", "محفظة إلكترونية"],
                  ["we_pay", "وي باي", "محفظة إلكترونية"],
                  ["instapay", "إنستا باي", "تحويل فوري"],
                  ["bank_transfer", "تحويل بنكي", "تحويل بنكي"]
                ].map(([value, label, hint]) => (
                  <div key={value} onClick={() => setPaymentMethod(value as any)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === value ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-200 hover:border-zinc-300"}`}>
                    <div className="flex items-center justify-between mb-1"><span className="font-black text-sm text-zinc-900">{label}</span>{value === "balance" ? <Wallet className="w-5 h-5 text-primary" /> : <CreditCard className="w-5 h-5 text-zinc-400" />}</div>
                    <p className="text-xs text-zinc-500 font-bold">{hint}</p>
                  </div>
                ))}
              </div>
              {paymentMethod !== "balance" && (
                <div className="mt-3 space-y-3">
                  <div><label htmlFor="payment-phone" className="text-sm font-bold text-zinc-700">رقم الحساب/الهاتف الذي تم الدفع منه *</label><input id="payment-phone" inputMode="tel" autoComplete="tel" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="01xxxxxxxxx" className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-right" /></div>
                  <div><label htmlFor="account-holder" className="text-sm font-bold text-zinc-700">اسم صاحب الحساب *</label><input id="account-holder" value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)} placeholder="الاسم كما هو في وسيلة الدفع" className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-right" /></div>
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">سيتم إنشاء الطلب كمعلّق، ولا يفتح الكورس إلا بعد تأكيد الإدارة لتحصيل المبلغ.</p>
                </div>
              )}
            </div>

            {/* تفاصيل الحساب والإجمالي بالجنيه المصري */}
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl space-y-2 text-right">
              <div className="flex items-center justify-between text-sm font-bold text-zinc-600">
                <span>سعر الكورس:</span>
                <span className="font-mono">{course.price} ج.م</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-zinc-600">
                <span>رسوم المشاهدة والحماية:</span>
                <span className="text-emerald-600 font-bold">مجاناً (0 ج.م)</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between font-black text-lg text-zinc-900 dark:text-white">
                <span>الإجمالي المطلوب:</span>
                <span className="font-mono text-primary text-xl">{course.price} ج.م</span>
              </div>
            </div>

            {/* رسالة الأمان */}
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>عند الشراء يفتح لك باقي أجزاء وفيديوهات الكورس فوراً داخل المنصة.</span>
            </div>

            <DialogFooter className="flex flex-row items-center justify-between pt-2 border-t gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
                إلغاء
              </Button>

              <Button
                onClick={handleConfirmPurchase}
                disabled={isProcessing || (paymentMethod !== "balance" && paymentPhone.trim().replace(/[^\d+]/g, "").length < 8) || (paymentMethod !== "balance" && !accountHolderName.trim()) || (paymentMethod === "balance" && walletBalance < Number(course.price || 0))}
                className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-8 h-12 text-base gap-2"
              >
                {isProcessing ? "جارٍ إتمام الدفع..." : `تأكيد الشراء (${course.price} ج.م)`}
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
