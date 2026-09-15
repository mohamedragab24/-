"use client";

import React, { useState } from "react";
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
import { enrollStudent, isUserEnrolled } from "@/lib/courses-data";
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
  currentBalance = 350,
  onPurchaseSuccess
}: CoursePurchaseDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<"balance" | "card">("balance");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!course) return null;

  const isAlreadyBought = isUserEnrolled(course.id, studentId);
  const isOwner = course.instructorId === studentId;

  const handleConfirmPurchase = () => {
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

    setTimeout(() => {
      enrollStudent(
        course.id,
        studentId,
        studentName,
        studentEmail,
        course.price
      );

      setIsProcessing(false);
      toast({
        title: "تم الاشتراك في الكورس بنجاح!",
        description: "تم تفعيل الكورس في حسابك، يمكنك البدء في المشاهدة المحمية الآن فوراً."
      });

      onOpenChange(false);
      if (onPurchaseSuccess) {
        onPurchaseSuccess();
      } else {
        router.push(`/courses/${course.id}`);
      }
    }, 1200);
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
                  بواسطة: {course.instructorName} • {course.lessons.length} دروس
                </p>
              </div>
            </div>

            {/* اختيار طريقة الدفع */}
            <div className="space-y-3 text-right">
              <h5 className="font-black text-sm text-zinc-800">طريقة الدفع:</h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* خيار 1: رصيد المحفظة */}
                <div
                  onClick={() => setPaymentMethod("balance")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "balance"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-zinc-900">رصيد فهمت</span>
                    <Wallet className={`w-5 h-5 ${paymentMethod === "balance" ? "text-primary" : "text-zinc-400"}`} />
                  </div>
                  <p className="text-xs text-zinc-500 font-bold font-mono">
                    المتوفر: {currentBalance} ج.م
                  </p>
                </div>

                {/* خيار 2: دفع إلكتروني فوري */}
                <div
                  onClick={() => setPaymentMethod("card")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "card"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-zinc-900">دفع إلكتروني فوري</span>
                    <CreditCard className={`w-5 h-5 ${paymentMethod === "card" ? "text-primary" : "text-zinc-400"}`} />
                  </div>
                  <p className="text-xs text-zinc-500 font-bold">
                    فيزا، ماستركارد، فودافون كاش، محافظ
                  </p>
                </div>
              </div>
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
                disabled={isProcessing}
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
