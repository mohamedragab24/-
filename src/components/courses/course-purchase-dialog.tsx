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
import { collection, doc, getDocs, getDoc, getFirestore, query, where } from "firebase/firestore";
import { initializeFirebase, useFirestore, useUser, useMemoFirebase, useDoc, useCollection } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { R2MediaImage } from "@/components/r2-media-image";

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

/** يوحّد حسابات الاستقبال: accounts[] الجديدة أو accountNumber القديمة */
const accountsOf = (m: any): { label: string; number: string }[] => {
  const list = Array.isArray(m?.accounts) ? m.accounts.map((a: any) => ({ label: String(a?.label || ""), number: String(a?.number || "") })).filter((a: any) => a.number) : [];
  if (!list.length && m?.accountNumber) list.push({ label: "", number: String(m.accountNumber) });
  return list;
};

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
  const { user } = useUser();
  const firestore = useFirestore();
  const walletRef = useMemoFirebase(() => (firestore && user?.uid) ? doc(firestore, "wallets", user.uid) : null, [firestore, user?.uid]);
  const userRef = useMemoFirebase(() => (firestore && user?.uid) ? doc(firestore, "users", user.uid) : null, [firestore, user?.uid]);
  const { data: liveWallet } = useDoc(walletRef);
  const { data: liveProfile } = useDoc(userRef);
  const txQuery = useMemoFirebase(() => (firestore && user?.uid) ? collection(firestore, "users", user.uid, "transactions") : null, [firestore, user?.uid]);
  const { data: liveTransactions } = useCollection(txQuery);
  // نفس طريقة حساب الرصيد في صفحة المحفظة: السجل هو المصدر الأخير عند غياب wallets/users.balance
  const ledgerBalance = (liveTransactions || []).reduce((acc: number, tx: any) => {
    if (["rejected", "pending", "cancelled"].includes(String(tx.status || ""))) return acc;
    const n = Number(tx.amount || 0);
    return ["deposit", "earning", "refund"].includes(String(tx.type || "")) ? acc + n : acc - n;
  }, 0);

  const [paymentMethod, setPaymentMethod] = useState<string>("balance");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [walletBalance, setWalletBalance] = useState(Number(currentBalance ?? 0));
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  useEffect(() => {
    if (typeof currentBalance === "number") setWalletBalance(currentBalance);
  }, [currentBalance]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const { firebaseApp } = initializeFirebase();
        const fs = getFirestore(firebaseApp);
        const methodsSnap = await getDocs(query(collection(fs, "paymentMethods"), where("active", "==", true)));
        const methods = methodsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any,b:any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
        if (active) setPaymentMethods(methods);
      } catch (e) {
        console.error("Unable to load payment methods", e);
      }
    })();
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    const hasValue = (v: any) => v !== undefined && v !== null && Number.isFinite(Number(v));
    const wallet = liveWallet?.balance;
    const legacy = liveProfile?.balance;
    if (hasValue(wallet)) setWalletBalance(Math.round(Number(wallet) * 100) / 100);
    else if (hasValue(legacy)) setWalletBalance(Math.round(Number(legacy) * 100) / 100);
    else setWalletBalance(Math.round(ledgerBalance * 100) / 100);
  }, [liveWallet?.balance, liveProfile?.balance, ledgerBalance]);

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
      const result: any = await purchaseCourse({ courseId: course.id, source: "web", paymentMethod, phone: paymentPhone.trim() });
      if (!result.data?.ok) throw new Error("purchase_failed");
      try { const fb = initializeFirebase(); await syncPurchasedCourses(fb.firestore, fb.auth?.currentUser?.uid); } catch (_) {}
      setIsProcessing(false);
      const pending = result.data?.pending === true;
      toast({
        title: pending ? "تم تسجيل الطلب" : "تم شراء الكورس بنجاح!",
        description: pending
          ? "حوّل المبلغ الآن إلى الرقم الظاهر، وسيتم تأكيد العملية تلقائيًا بمجرد وصولها."
          : paymentMethod === "balance" ? "تم خصم المبلغ من المحفظة وتسجيل العملية." : "تم تأكيد العملية وتفعيل الكورس في كورساتي."
      });
      onOpenChange(false);
      if (onPurchaseSuccess) onPurchaseSuccess();
      const paymentId = String(result.data?.paymentId || "");
      router.push(paymentId ? `/order-complete?paymentId=${encodeURIComponent(paymentId)}` : `/courses/${course.id}`);
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
              <R2MediaImage
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
                <div onClick={() => setPaymentMethod("balance" as any)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "balance" ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-200 hover:border-zinc-300"}`}>
                  <div className="flex items-center justify-between mb-1"><span className="font-black text-sm text-zinc-900">محفظة فهمت</span><Wallet className="w-5 h-5 text-primary" /></div>
                  <p className="text-xs text-zinc-500 font-bold">الرصيد المتاح: {walletBalance} ج.م</p>
                </div>
                {paymentMethods.map((method:any) => (
                  <div key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === method.id ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-200 hover:border-zinc-300"}`}>
                    <div className="flex items-center justify-between mb-1"><span className="font-black text-sm text-zinc-900">{method.name}</span><CreditCard className="w-5 h-5 text-zinc-400" /></div>
                    <p className="text-xs text-zinc-500 font-bold">{accountsOf(method).length > 1 ? `${accountsOf(method).length} خيارات للتحويل` : (accountsOf(method)[0]?.label || "وسيلة دفع إلكترونية")}</p>
                  </div>
                ))}
                {paymentMethods.length === 0 && (
                  <p className="col-span-full text-xs font-bold text-amber-700 bg-amber-50 p-3 rounded-xl">لا توجد وسائل دفع إلكترونية مفعّلة حاليًا. يمكنك الدفع من محفظة فهمت.</p>
                )}
              </div>
              {paymentMethod !== "balance" && (
                <div className="mt-3 space-y-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  {(() => {
                    const selected = paymentMethods.find((m: any) => m.id === paymentMethod);
                    const accs = accountsOf(selected);
                    if (!accs.length) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-600 font-bold text-center">حوّل مبلغ <span className="text-primary">{course.price} ج.م</span> إلى أحد الأرقام التالية:</p>
                        {accs.map((a, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white border flex items-center justify-between gap-3">
                            <span className="text-sm font-black text-zinc-800">{a.label || selected?.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black tracking-widest text-primary" dir="ltr">{a.number}</span>
                              <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold" onClick={() => { try { navigator.clipboard?.writeText(a.number); toast({ title: "تم نسخ الرقم" }); } catch (_) {} }}>نسخ</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div><label htmlFor="payment-phone" className="text-sm font-bold text-zinc-700">رقم الحساب/الهاتف الذي تم الدفع منه *</label><input id="payment-phone" inputMode="tel" autoComplete="tel" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="01xxxxxxxxx" className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-right" />
                    <p className="text-xs text-zinc-500 mt-1">اكتب الرقم الذي تم التحويل منه فقط، ولا نطلب اسم صاحب المحفظة.</p></div>
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl">اضغط «تأكيد الشراء» أولًا ثم حوّل المبلغ بالضبط من الرقم المكتوب أعلاه؛ يتم التأكيد وتفعيل الكورس تلقائيًا بمجرد وصول العملية.</p>
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
                disabled={isProcessing || (paymentMethod !== "balance" && paymentPhone.trim().replace(/[^\d+]/g, "").length < 8) || (paymentMethod === "balance" && walletBalance < Number(course.price || 0))}
                className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-8 h-12 text-base gap-2"
              >
                {isProcessing ? "جارٍ تسجيل الطلب..." : `تأكيد الشراء (${course.price} ج.م)`}
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
