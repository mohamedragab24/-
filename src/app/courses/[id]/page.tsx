"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  ArrowRight,
  Play, 
  Lock, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  GraduationCap, 
  Share2, 
  Star, 
  Layers, 
  AlertCircle,
  Sparkles,
  BookOpen,
  Bell,
  BellRing,
  User,
  ExternalLink
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Course, CourseLesson, CourseEnrollment } from "@/lib/types";
import { 
  getCourseById, 
  isUserEnrolled, 
  getStoredEnrollments, 
  updateLessonProgress 
} from "@/lib/courses-data";
import { ProtectedVideoPlayer } from "@/components/courses/protected-video-player";
import { CoursePurchaseDialog } from "@/components/courses/course-purchase-dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useFirebase();
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(userRef);

  const courseId = params?.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [userEnrollment, setUserEnrollment] = useState<CourseEnrollment | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const currentUserId = user?.uid || "guest-user";
  const currentUserName = profile?.name || user?.displayName || "مستفهم منصة فهمت";
  const currentUserEmail = user?.email || profile?.email || "student@fahimt.com";

  const refreshCourseState = () => {
    if (!courseId) return;
    const found = getCourseById(courseId);
    setCourse(found || null);

    const enrolled = isUserEnrolled(courseId, currentUserId);
    setIsEnrolled(enrolled);

    if (enrolled) {
      const enrollments = getStoredEnrollments();
      const myEnroll = enrollments.find(e => e.courseId === courseId && e.studentId === currentUserId);
      setUserEnrollment(myEnroll || null);
    }
  };

  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && course?.instructorId) {
      try {
        const subs = JSON.parse(localStorage.getItem("fahimt_subscribed_instructors") || "[]");
        setIsSubscribed(subs.includes(course.instructorId));
      } catch (e) {
        console.error(e);
      }
    }
  }, [course?.instructorId]);

  const handleToggleSubscribe = () => {
    if (!course?.instructorId) return;
    try {
      const subs = JSON.parse(localStorage.getItem("fahimt_subscribed_instructors") || "[]");
      let updated: string[];
      if (subs.includes(course.instructorId)) {
        updated = subs.filter((id: string) => id !== course.instructorId);
        setIsSubscribed(false);
        toast({
          title: "تم إيقاف الإشعارات",
          description: `تم إيقاف إشعارات كورسات المُفهم ${course.instructorName}.`
        });
      } else {
        updated = [...subs, course.instructorId];
        setIsSubscribed(true);
        toast({
          title: "🔔 تم تفعيل الإشعارات بنجاح!",
          description: `هتوصلك كل الكورسات والدروس الجديدة للمُفهم ${course.instructorName} أول ما تنزل.`
        });
      }
      localStorage.setItem("fahimt_subscribed_instructors", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshCourseState();

    const handleUpdate = () => refreshCourseState();
    window.addEventListener("fahimt_courses_updated", handleUpdate);
    window.addEventListener("fahimt_enrollments_updated", handleUpdate);

    return () => {
      window.removeEventListener("fahimt_courses_updated", handleUpdate);
      window.removeEventListener("fahimt_enrollments_updated", handleUpdate);
    };
  }, [courseId]);

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 font-body" dir="rtl">
        <Layers className="w-16 h-16 text-zinc-300" />
        <h2 className="text-2xl font-black text-zinc-800">الكورس غير موجود أو تم إخفاؤه</h2>
        <Button asChild className="bg-primary text-white rounded-xl">
          <Link href="/courses">العودة لدليل الكورسات</Link>
        </Button>
      </div>
    );
  }

  const isMufhem = profile?.role === "mufhem";
  const isInstructor = Boolean(
    isMufhem && user?.uid && course.instructorId && course.instructorId === user.uid
  );

  // Helper to determine if a lesson is locked for the current user
  const isLessonLocked = (index: number) => {
    // If the student bought the course or the instructor is viewing their own course, nothing is locked
    if (isEnrolled || isInstructor) return false;

    // Only the very first lesson (index 0) can be a free preview if marked
    if (index === 0 && course.lessons[0]?.isFreePreview) {
      return false;
    }

    // ALL other lessons (lesson 2, 3, etc.) are strictly locked with a padlock
    return true;
  };

  const activeLesson: CourseLesson | undefined = course.lessons[selectedLessonIndex] || course.lessons[0];
  const activeLessonLocked = isLessonLocked(selectedLessonIndex);
  const canPlayActiveLesson = !activeLessonLocked;
  const isCurrentCompleted = userEnrollment?.completedLessonIds?.includes(activeLesson?.id || "") || false;

  const handleToggleLessonComplete = () => {
    if (!activeLesson || !isEnrolled) return;
    const nextState = !isCurrentCompleted;
    updateLessonProgress(course.id, currentUserId, activeLesson.id, nextState);
    toast({
      title: nextState ? "أحسنت! تم إكمال الدرس" : "تم إلغاء تحديد الإكمال",
      description: `الدرس: ${activeLesson.title}`
    });
    refreshCourseState();
  };

  const handleSelectLesson = (index: number) => {
    const locked = isLessonLocked(index);
    if (locked) {
      toast({
        variant: "destructive",
        title: "🔒 هذا الدرس مغلق بقفل",
        description: `الدرس "${course.lessons[index]?.title}" مغلق ولا يمكن فتحه إلا بعد شراء الكورس الكامل.`
      });
      setPurchaseOpen(true);
    }
    setSelectedLessonIndex(index);
  };

  const handleNextLesson = () => {
    if (selectedLessonIndex < course.lessons.length - 1) {
      const nextIdx = selectedLessonIndex + 1;
      if (isLessonLocked(nextIdx)) {
        toast({
          variant: "destructive",
          title: "🔒 الدرس التالي مغلق بقفل",
          description: "يرجى شراء الكورس لفتح بقية الدروس ومتابعة المشاهدة."
        });
        setPurchaseOpen(true);
        setSelectedLessonIndex(nextIdx);
        return;
      }
      setSelectedLessonIndex(nextIdx);
    }
  };

  const totalMinutes = course.lessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50/70 py-8 px-4 md:px-8 font-body" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* شريط التنقل العلوي */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="font-black text-zinc-600 gap-2 hover:bg-white rounded-xl">
            <Link href="/courses">
              <ArrowRight className="w-4 h-4" /> العودة إلى الكورسات
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold border-primary text-primary">
              {course.category}
            </Badge>
            {isEnrolled && (
              <Badge className="bg-emerald-600 text-white font-black">
                مشترك في الكورس
              </Badge>
            )}
          </div>
        </div>

        {/* منطقة المحتوى: المشغل المحمي وقائمة الدروس */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* القسم الرئيسي (2/3): مشغل الفيديو المحمي أو بطاقة الشراء */}
          <div className="lg:col-span-2 space-y-6">
            {canPlayActiveLesson ? (
              <div className="space-y-4">
                <ProtectedVideoPlayer
                  videoUrl={activeLesson.videoUrl}
                  lessonTitle={activeLesson.title}
                  courseTitle={course.title}
                  studentName={currentUserName}
                  studentEmail={currentUserEmail}
                  studentId={currentUserId}
                  isCompleted={isCurrentCompleted}
                  onToggleComplete={isEnrolled ? handleToggleLessonComplete : undefined}
                  onNextLesson={handleNextLesson}
                  hasNextLesson={selectedLessonIndex < course.lessons.length - 1}
                />

                {/* إشعار المعاينة المجانية في حال كان الدرس مفتوحاً للكل */}
                {!isEnrolled && activeLesson.isFreePreview && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-right gap-4">
                    <div className="space-y-0.5">
                      <h5 className="font-black text-amber-900 text-sm">هذا الدرس متاح كمعاينة مجانية</h5>
                      <p className="text-xs text-amber-700 font-bold">
                        لمشاهدة بقية دروس الكورس ({course.lessons.length - 1} دروس إضافية) والحصول على الدعم الكامل، اشترك الآن.
                      </p>
                    </div>
                    <Button
                      onClick={() => setPurchaseOpen(true)}
                      className="bg-primary text-white font-black text-xs h-10 px-5 rounded-xl shrink-0"
                    >
                      شراء الكورس ({course.price} ج.م)
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* شاشة حجب المحتوى غير المشترك به - تصميم أمني مع قفل واضح */
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-zinc-950 border-4 border-zinc-800 shadow-2xl flex flex-col items-center justify-center p-8 text-center text-white space-y-5">
                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 backdrop-blur-md shadow-inner">
                  <Lock className="w-10 h-10 stroke-[2.5]" />
                </div>
                <div className="space-y-2 max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-black text-xs border border-red-500/30">
                    <Lock className="w-3.5 h-3.5" /> هذا الدرس مغلق بقفل ولا يفتح إلا بعد الشراء
                  </div>
                  <h3 className="text-2xl font-black">{activeLesson?.title || "الدرس محمي"}</h3>
                  <p className="text-zinc-400 text-xs md:text-sm font-bold leading-relaxed">
                    أنت تشاهد كورس مدفوع. تم قفل هذا الدرس وجميع الدروس التالية للحماية، وسيتم فتحها فوراً لك داخل المشغل بعد إتمام شراء الكورس.
                  </p>
                </div>
                <Button
                  onClick={() => setPurchaseOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-14 px-8 text-base shadow-xl hover:scale-105 transition-all gap-2 cursor-pointer"
                >
                  <Lock className="w-5 h-5" />
                  <span>شراء الكورس وفتح هذا الدرس ({course.price} ج.م)</span>
                </Button>
              </div>
            )}

            {/* تفاصيل ووصف الكورس */}
            <div className="bg-white dark:bg-zinc-900 border rounded-3xl p-6 md:p-8 space-y-6 text-right shadow-sm">
              <div className="space-y-3">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">
                  {course.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-zinc-500">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    المفهم: {course.instructorName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    المدة الكلية: {totalMinutes} دقيقة
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-4 h-4 fill-current" />
                    {course.rating || 5.0} تقييم عام
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <h4 className="font-black text-base text-zinc-800 dark:text-zinc-200">عن هذا الكورس:</h4>
                <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed whitespace-pre-line">
                  {course.description}
                </p>
              </div>

              {/* بطاقة المُفهم مع صورته الشخصية وزر دخول الملف الشخصي وزر تفعيل الإشعارات */}
              <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-zinc-200 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Avatar className="w-14 h-14 rounded-2xl border-2 border-primary/20 shadow-md shrink-0">
                    <AvatarImage src={course.instructorAvatar} alt={course.instructorName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">
                      {course.instructorName?.charAt(0) || "م"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base text-zinc-900 dark:text-white">
                        {course.instructorName}
                      </h4>
                      <Badge className="bg-primary/15 text-primary border-none text-[11px] font-black px-2.5 py-0.5 rounded-lg">
                        مُفهم
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 font-bold">
                      مُقدم هذا الكورس • يمكنك متابعته واستلام إشعارات كورساته القادمة فور نزولها
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl font-black text-xs h-10 px-4 border-zinc-300 dark:border-zinc-700 hover:border-primary gap-1.5 cursor-pointer"
                  >
                    <Link href="/profile">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>الملف الشخصي للمُفهم</span>
                    </Link>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleToggleSubscribe}
                    variant={isSubscribed ? "default" : "outline"}
                    className={`rounded-xl font-black text-xs h-10 px-4 gap-2 cursor-pointer shadow-sm transition-all ${
                      isSubscribed
                        ? "bg-amber-500 hover:bg-amber-600 text-white border-none"
                        : "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50/60 hover:bg-amber-100"
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <BellRing className="w-4 h-4 text-white animate-bounce" />
                        <span>الإشعارات مفعّلة 🔔</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 text-amber-600" />
                        <span>تفعيل إشعارات الكورسات القادمة</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* القسم الجانبي (1/3): قائمة الدروس والتقدم وشراء الكورس */}
          <div className="space-y-6">

            {/* بطاقة التقدم (في حال المشترك) أو لوحة المفهم أو الشراء (في حال غير المشترك) */}
            {isEnrolled ? (
              <Card className="rounded-3xl border-2 bg-white shadow-sm p-6 text-right space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-zinc-800 text-sm">نسبة تقدمك في الكورس</h4>
                  <span className="font-black font-mono text-primary text-base">
                    {userEnrollment?.progressPercent || 0}%
                  </span>
                </div>
                <Progress value={userEnrollment?.progressPercent || 0} className="h-2.5 bg-zinc-100" />
                <p className="text-xs text-zinc-500 font-bold">
                  أنهيت {userEnrollment?.completedLessonIds?.length || 0} من {course.lessons.length} دروس.
                </p>
                <div className="pt-2 border-t text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>أنت مشترك بالفعل ولديك وصول كامل لجميع الدروس.</span>
                </div>
              </Card>
            ) : isInstructor ? (
              <Card className="rounded-3xl border-2 bg-gradient-to-br from-white to-primary/5 shadow-md p-6 text-right space-y-4">
                <div className="space-y-1">
                  <Badge className="bg-primary/10 text-primary border-none font-bold text-xs">أنت ناشر هذا الكورس</Badge>
                  <h4 className="font-black text-lg text-zinc-900">صلاحيات كاملة للمفهم</h4>
                  <p className="text-xs text-zinc-500 font-bold leading-relaxed">
                    بصفتك المفهم وناشر الكورس، يمكنك مشاهدة كافة الأجزاء والفيديوهات بحرية بدون شراء، وإدارة المحتوى ومتابعة إحصائيات طلابك.
                  </p>
                </div>
                <div className="pt-2 border-t flex flex-col gap-2">
                  <Button asChild className="w-full bg-primary text-white font-black rounded-xl h-11 text-xs">
                    <Link href="/courses">لوحة إدارة كورساتي</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="rounded-3xl border-2 bg-gradient-to-br from-white to-primary/5 shadow-md p-6 text-right space-y-5">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-500 font-bold block">سعر الكورس الكامل</span>
                  <div className="text-3xl font-black text-primary font-mono">
                    {course.price} <span className="text-base font-sans font-bold text-zinc-700">ج.م</span>
                  </div>
                </div>

                <Button
                  onClick={() => setPurchaseOpen(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black rounded-xl h-14 text-base shadow-lg hover:scale-102 transition-all gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  شراء الكورس والبدء فوراً
                </Button>
              </Card>
            )}

            {/* قائمة تشغيل الدروس (Playlist) */}
            <div className="bg-white dark:bg-zinc-900 border rounded-3xl p-5 shadow-sm space-y-4 text-right">
              <div className="flex items-center justify-between pb-3 border-b">
                <h4 className="font-black text-zinc-800 dark:text-zinc-200 text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  دروس الكورس ({course.lessons.length})
                </h4>
                <span className="text-xs text-zinc-400 font-mono font-bold">
                  {totalMinutes} دقيقة
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {course.lessons.map((lesson, idx) => {
                  const isActive = idx === selectedLessonIndex;
                  const isCompleted = userEnrollment?.completedLessonIds?.includes(lesson.id);
                  const isLocked = isLessonLocked(idx);

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => handleSelectLesson(idx)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 text-right ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                          : isLocked
                          ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-red-300 hover:bg-red-50/20"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-primary/40 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* حالة الأيقونة: قفل أحمر بارز أو إكمال أو تشغيل */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-600"
                            : isLocked
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : isActive
                            ? "bg-primary text-white"
                            : "bg-zinc-100 text-zinc-700"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-red-600 stroke-[2.5]" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <h5 className={`font-black text-xs leading-snug ${
                            isActive 
                              ? "text-primary" 
                              : isLocked 
                              ? "text-zinc-700 dark:text-zinc-300" 
                              : "text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {lesson.title}
                          </h5>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                            <span>{lesson.durationMinutes} دقيقة</span>
                            {isLocked && (
                              <>
                                <span>•</span>
                                <span className="text-red-600 font-sans font-bold flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> مقفل
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isLocked ? (
                        <Badge className="text-[10px] bg-red-100/90 text-red-700 hover:bg-red-200 border-none shrink-0 font-black gap-1 flex items-center py-1 px-2.5">
                          <Lock className="w-3 h-3" /> قفل
                        </Badge>
                      ) : (idx === 0 && lesson.isFreePreview && !isEnrolled && !isInstructor) ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50 shrink-0 font-bold">
                          معاينة مجانية (الدرس الأول)
                        </Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* حوار الشراء */}
        <CoursePurchaseDialog
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          course={course}
          studentId={currentUserId}
          studentName={currentUserName}
          studentEmail={currentUserEmail}
          onPurchaseSuccess={() => {
            refreshCourseState();
            toast({
              title: "تم تفعيل الكورس بنجاح!",
              description: "يمكنك الآن مشاهدة جميع الدروس مباشرة."
            });
          }}
        />

      </div>
    </div>
  );
}
