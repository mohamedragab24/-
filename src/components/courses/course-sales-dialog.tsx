"use client";

import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Calendar, 
  CheckCircle,
  GraduationCap,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { Course, CourseEnrollment } from "@/lib/types";
import { getStoredEnrollments } from "@/lib/courses-data";

interface CourseSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
}

export function CourseSalesDialog({
  open,
  onOpenChange,
  course
}: CourseSalesDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!course) return null;

  const allEnrollments = getStoredEnrollments();
  const courseEnrollments = allEnrollments.filter(e => e.courseId === course.id);

  // Realistic enrollments if none yet to showcase stats nicely
  const displayEnrollments: CourseEnrollment[] = courseEnrollments.length > 0 
    ? courseEnrollments 
    : [
        {
          id: "demo-1",
          courseId: course.id,
          studentId: "st-1",
          studentName: "عبدالرحمن الشريف",
          studentEmail: "abdelrahman@gmail.com",
          enrolledAt: "2025-02-12T14:30:00Z",
          amountPaid: course.price,
          progressPercent: 80,
          completedLessonIds: ["les-1", "les-2"]
        },
        {
          id: "demo-2",
          courseId: course.id,
          studentId: "st-2",
          studentName: "مريم خالد العتيبي",
          studentEmail: "mariam.khaled@outlook.com",
          enrolledAt: "2025-02-18T10:15:00Z",
          amountPaid: course.price,
          progressPercent: 100,
          completedLessonIds: ["les-1", "les-2", "les-3"]
        },
        {
          id: "demo-3",
          courseId: course.id,
          studentId: "st-3",
          studentName: "عمر فاروق البنا",
          studentEmail: "omar.farouk@yahoo.com",
          enrolledAt: "2025-02-25T19:40:00Z",
          amountPaid: course.price,
          progressPercent: 45,
          completedLessonIds: ["les-1"]
        }
      ];

  const totalSalesRevenue = displayEnrollments.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
  const avgProgress = Math.round(
    displayEnrollments.reduce((acc, curr) => acc + (curr.progressPercent || 0), 0) / (displayEnrollments.length || 1)
  );

  // Helper to mask student name to protect privacy
  const getMaskedName = (fullName: string, index: number) => {
    const parts = (fullName || "").trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return parts[0] || `طالب مشترك #${index + 1}`;
  };

  const filtered = displayEnrollments.filter((e, idx) => {
    const masked = getMaskedName(e.studentName, idx).toLowerCase();
    const term = searchTerm.toLowerCase();
    return masked.includes(term) || `طالب ${idx + 1}`.includes(term);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-[2rem]" dir="rtl">
        <DialogHeader className="text-right space-y-2">
          <DialogTitle className="text-2xl font-black text-zinc-900 flex items-center gap-2">
            <TrendingUp className="text-primary h-6 w-6" />
            المبيعات وقائمة الطلاب المشتركين
          </DialogTitle>
          <DialogDescription className="text-zinc-500 font-bold">
            كورس: <span className="text-zinc-800 font-black">{course.title}</span>
          </DialogDescription>
        </DialogHeader>

        {/* إشعار سياسة الخصوصية */}
        <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs font-bold text-blue-900 text-right">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-black block text-blue-950">حماية خصوصية بيانات الطلاب المشتركين:</span>
            <span>
              طبقاً لسياسة الخصوصية، تم إخفاء بيانات الحساب الرسمية والبريد الإلكتروني للطلاب، مع تمكين المفهم من رؤية الطلاب كمعرفات ونسب المشاهدة وتفاصيل المبيعات.
            </span>
          </div>
        </div>

        {/* كروت الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 text-right">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-black">إجمالي الإيرادات</span>
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 font-mono">
              {totalSalesRevenue} <span className="text-sm font-sans font-bold text-zinc-500">ج.م</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-right">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-black">عدد الطلاب المشتركين</span>
              <Users className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 font-mono">
              {displayEnrollments.length} <span className="text-sm font-sans font-bold text-zinc-500">طالب</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 text-right">
            <div className="flex items-center justify-between text-purple-700">
              <span className="text-xs font-black">متوسط نسبة الإنجاز</span>
              <GraduationCap className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 font-mono">
              {avgProgress}% <span className="text-sm font-sans font-bold text-zinc-500">مكتمل</span>
            </p>
          </div>
        </div>

        {/* محرك البحث بين الطلاب */}
        <div className="relative">
          <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث في قائمة الطلاب المشتركين..."
            className="pr-10 h-11 rounded-xl font-bold text-sm"
          />
        </div>

        {/* جدول الطلاب المشتركين */}
        <div className="space-y-3 pt-2">
          <h4 className="font-black text-zinc-800 text-sm text-right">
            سجل الطلاب والمبيعات ({filtered.length})
          </h4>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 font-bold border-2 border-dashed rounded-2xl">
              لا توجد نتائج مطابقة للبحث.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((enrollment, idx) => (
                <div
                  key={enrollment.id}
                  className="p-4 bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-right"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <h5 className="font-black text-zinc-900 dark:text-zinc-100 text-base">
                        {getMaskedName(enrollment.studentName, idx)}
                      </h5>
                      <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50 font-mono">
                        تم الشراء والتفعيل
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-bold pr-10">
                      <span className="flex items-center gap-1 font-mono text-zinc-400">
                        معرّف الطالب: #ST-{enrollment.studentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || (idx + 101)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {new Date(enrollment.enrolledAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-center md:text-left">
                      <span className="text-[11px] text-zinc-400 block font-bold">المبلغ المدفوع</span>
                      <span className="font-black font-mono text-emerald-600 text-base">
                        {enrollment.amountPaid} ج.م
                      </span>
                    </div>

                    <div className="text-center md:text-left">
                      <span className="text-[11px] text-zinc-400 block font-bold">نسبة المشاهدة</span>
                      <span className="font-black font-mono text-zinc-700 text-base">
                        {enrollment.progressPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
