"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Layers, 
  Search, 
  Plus, 
  Play, 
  CheckCircle, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Clock, 
  ShieldCheck, 
  GraduationCap, 
  Sparkles,
  ArrowLeft,
  BookOpen,
  ArrowLeftRight,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Course, CourseEnrollment } from "@/lib/types";
import { 
  getStoredCourses, 
  getStoredEnrollments, 
  deleteCourse, 
  upsertCourse,
  isUserEnrolled 
} from "@/lib/courses-data";
import { listAllCourses, listPublishedCourses } from "@/lib/course-service";
import { CourseEditorDialog } from "@/components/courses/course-editor-dialog";
import { R2MediaImage } from "@/components/r2-media-image";
import { CourseSalesDialog } from "@/components/courses/course-sales-dialog";
import { CoursePurchaseDialog } from "@/components/courses/course-purchase-dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

const CATEGORIES = [
  "الكل",
  "البرمجة والتقنية",
  "الرياضيات والعلوم",
  "الذكاء الاصطناعي",
  "اللغات والآداب",
  "التصميم والمونتاج"
];

export default function CoursesPage() {
  const { toast } = useToast();
  const { user } = useFirebase();
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(userRef);

  const isMufhem = profile?.role === "mufhem";
  const currentUserId = user?.uid || "guest-user";
  const currentUserName = profile?.name || user?.displayName || (isMufhem ? "مُفهم معتمد" : "طالب مُستفهم");
  const currentUserAvatar = profile?.avatarUrl || user?.photoURL || "";
  const currentUserEmail = user?.email || profile?.email || "student@fahimt.com";

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [activeTab, setActiveTab] = useState(isMufhem ? "instructor" : "all");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [editorOpen, setEditorOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);

  const [salesOpen, setSalesOpen] = useState(false);
  const [courseForSales, setCourseForSales] = useState<Course | null>(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [courseToPurchase, setCourseToPurchase] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const refreshData = async () => {
    try {
      const remoteCourses = isMufhem
        ? await listAllCourses(firestore)
        : await listPublishedCourses(firestore);
      setCourses(remoteCourses);
    } catch (error) {
      console.error("Failed to load courses from Firebase", error);
      setCourses(getStoredCourses());
    }
    setEnrollments(getStoredEnrollments());
  };

  useEffect(() => {
    if (!firestore) return;
    void refreshData();
    const handleUpdate = () => { void refreshData(); };
    window.addEventListener("fahimt_courses_updated", handleUpdate);
    window.addEventListener("fahimt_enrollments_updated", handleUpdate);
    return () => {
      window.removeEventListener("fahimt_courses_updated", handleUpdate);
      window.removeEventListener("fahimt_enrollments_updated", handleUpdate);
    };
  }, [firestore, isMufhem]);

  // Update default tab when role changes
  useEffect(() => {
    if (isMufhem) {
      setActiveTab("instructor");
    } else {
      setActiveTab("all");
    }
  }, [isMufhem]);

  const handleTogglePublish = async (course: Course) => {
    const updated = { ...course, isPublished: !course.isPublished };
    try {
      await import("firebase/firestore").then(({ updateDoc, doc, serverTimestamp }) =>
        updateDoc(doc(firestore, "courses", course.id), {
          isPublished: updated.isPublished,
          status: updated.isPublished ? "published" : "pending",
          updatedAt: serverTimestamp()
        })
      );
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر تحديث النشر", description: "تعذر تحديث الكورس على Firebase.", variant: "destructive" });
      return;
    }
    upsertCourse(updated);
    toast({
      title: updated.isPublished ? "تم نشر الكورس" : "تم إخفاء الكورس",
      description: updated.isPublished 
        ? "أصبح الكورس متاحاً للطلاب في قائمة الكورسات." 
        : "تم حجب الكورس عن الطلاب وأصبح مسودة خاصة."
    });
    refreshData();
  };

  const handleDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
  };

  // Filtered public courses (for student browsing)
  const publicCourses = courses.filter(c => {
    const matchesCategory = selectedCategory === "الكل" || c.category === selectedCategory;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.instructorName.toLowerCase().includes(searchQuery.toLowerCase());
    return c.isPublished && matchesCategory && matchesSearch;
  });

  // Enrolled courses for the student
  const myEnrolledCourses = courses.filter(c => isUserEnrolled(c.id, currentUserId));

  // Instructor courses (created by this instructor)
  const instructorCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const isOwner = c.instructorId === currentUserId || c.instructorName === currentUserName;
    return matchesSearch && (isOwner || courses.length <= 5);
  });

  const totalSales = instructorCourses.reduce((sum, c) => sum + (c.totalEnrollments || 0), 0);
  const totalRevenue = instructorCourses.reduce((sum, c) => sum + ((c.totalEnrollments || 0) * (c.price || 0)), 0);

  return (
    <div className="min-h-screen bg-zinc-50/60 py-10 px-4 md:px-8 font-body" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ترويسة الصفحة مخصصة حسب رتبة المستخدم: مُفهم (إنشاء وإدارة) أو مُستفهم (تصفح واشتراك) */}
        {isMufhem ? (
          /* =================================================== */
          /* ترويسة المُفهم: لوحة إنشاء وإدارة الكورسات */
          /* =================================================== */
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border border-zinc-800">
            <div className="relative z-10 space-y-3 max-w-2xl text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 text-primary-foreground font-black text-xs">
                <GraduationCap size={14} className="text-primary" />
                لوحة تحكم المُفهم
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                الكورسات
              </h1>
              <p className="text-zinc-300 font-bold text-sm md:text-base leading-relaxed">
                ارفع شروحاتك وفيديوهاتك مباشرة من جهازك، حدد سعر الكورس بالجنيه المصري، وتحكم في النشر وتابع مبيعاتك والطلاب المشتركين.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
              <Button
                onClick={() => {
                  setCourseToEdit(null);
                  setEditorOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-14 px-8 text-base shadow-xl gap-2 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>إنشاء كورس جديد</span>
              </Button>
            </div>

            <div className="absolute -left-10 -bottom-10 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          </div>
        ) : (
          /* =================================================== */
          /* ترويسة المُستفهم (الطالب): تصفح الكورسات الجاهزة */
          /* =================================================== */
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border border-zinc-800">
            <div className="relative z-10 space-y-3 max-w-2xl text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 text-primary-foreground font-black text-xs">
                <BookOpen size={14} className="text-primary" />
                مكتبة الكورسات المشروحة
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                الكورسات
              </h1>
              <p className="text-zinc-300 font-bold text-sm md:text-base leading-relaxed">
                تصفح أفضل الكورسات التعليمية المسجلة من قِبل نخبة من المفهمين المعتمدين، واشترك لتشاهد الدروس المحمية مباشرة داخل المنصة.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-3 shrink-0">
              <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right space-y-0.5">
                <span className="text-[11px] font-bold text-zinc-400 block">كورساتك المشتركة</span>
                <span className="text-xl font-black font-mono text-primary">{myEnrolledCourses.length} كورس</span>
              </div>
            </div>

            <div className="absolute -left-10 -bottom-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        )}

        {/* التبويبات الرئيسية المخصصة حسب الرتبة */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <TabsList className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border shadow-sm h-auto flex flex-wrap gap-1">
              {isMufhem ? (
                /* تبويبات المُفهم: إدارة كورساته + معاينة تصفح الطلاب */
                <>
                  <TabsTrigger
                    value="instructor"
                    className="rounded-xl px-6 py-3 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white gap-2"
                  >
                    <Layers size={16} />
                    إدارة كورساتي ومبيعاتي ({instructorCourses.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="all"
                    className="rounded-xl px-6 py-3 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white gap-2"
                  >
                    <BookOpen size={16} />
                    معاينة تصفح الكورسات ({publicCourses.length})
                  </TabsTrigger>
                </>
              ) : (
                /* تبويبات المُستفهم (الطالب): تصفح الكورسات + كورساتي المشتركة */
                <>
                  <TabsTrigger
                    value="all"
                    className="rounded-xl px-6 py-3 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white gap-2"
                  >
                    <BookOpen size={16} />
                    تصفح الكورسات ({publicCourses.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="enrolled"
                    className="rounded-xl px-6 py-3 font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-white gap-2"
                  >
                    <CheckCircle size={16} />
                    كورساتي المشتركة ({myEnrolledCourses.length})
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* شريط البحث */}
            <div className="relative w-full md:w-80">
              <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-zinc-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن كورس أو مجال..."
                className="pr-10 h-12 rounded-2xl font-bold bg-white dark:bg-zinc-900 border shadow-sm text-right"
              />
            </div>
          </div>

          {/* تبويب: تصفح الكورسات للطلاب (مستفهم) */}
          <TabsContent value="all" className="space-y-8">
            {/* تصنيفات سريعة للفلترة */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-5 h-10 font-black text-xs shrink-0 cursor-pointer ${
                    selectedCategory === cat ? "bg-zinc-900 text-white shadow-sm" : "bg-white text-zinc-700"
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>

            {publicCourses.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed space-y-4">
                <Layers className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="font-black text-xl text-zinc-700">لا توجد كورسات مضافة حالياً في هذا التصنيف</h3>
                <p className="text-zinc-500 font-bold text-sm">جرب اختيار تصنيف آخر أو ابحث بكلمات مختلفة.</p>
                {isMufhem && (
                  <Button 
                    onClick={() => {
                      setCourseToEdit(null);
                      setEditorOpen(true);
                    }}
                    className="bg-primary text-white font-black rounded-xl h-11 px-6 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    إنشاء كورس جديد الآن
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {publicCourses.map((course) => {
                  const userBought = isUserEnrolled(course.id, currentUserId);

                  return (
                    <Card 
                      key={course.id}
                      className="rounded-[2.5rem] border-2 bg-white overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                    >
                      <div>
                        {/* غلاف الكورس */}
                        <div className="relative aspect-video overflow-hidden bg-zinc-100">
                          <R2MediaImage
                            src={course.coverUrl}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <Badge className="absolute top-4 right-4 bg-black/70 backdrop-blur-md text-white border-none font-bold text-xs">
                            {course.category}
                          </Badge>
                          <div className="absolute bottom-4 left-4 bg-primary text-white font-black px-3.5 py-1.5 rounded-xl shadow-lg font-mono text-sm">
                            {course.price} ج.م
                          </div>
                        </div>

                        {/* محتوى البطاقة */}
                        <CardContent className="p-6 md:p-8 space-y-4 text-right">
                          <div className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <GraduationCap className="w-4 h-4 text-primary" />
                              {course.instructorName}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              {course.lessons.length} دروس
                            </span>
                          </div>

                          <h3 className="text-xl font-black text-zinc-900 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {course.title}
                          </h3>

                          <p className="text-sm text-zinc-500 font-bold line-clamp-2 leading-relaxed">
                            {course.description}
                          </p>
                        </CardContent>
                      </div>

                      {/* زر الإجراء */}
                      <CardFooter className="p-6 md:p-8 pt-0 flex gap-3">
                        {userBought ? (
                          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-12 gap-2">
                            <Link href={`/courses/${course.id}`}>
                              <Play className="w-4 h-4 fill-current" />
                              مشاهدة الكورس (مشترك بالفعل)
                            </Link>
                          </Button>
                        ) : course.instructorId === currentUserId ? (
                          <Button asChild className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-black rounded-xl h-12 gap-2 border border-primary/20">
                            <Link href={`/courses/${course.id}`}>
                              <Sparkles className="w-4 h-4" />
                              معاينة وإدارة (كورس خاص بك)
                            </Link>
                          </Button>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <Button
                              asChild
                              variant="outline"
                              className="rounded-xl font-black h-12 text-xs border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                            >
                              <Link href={`/courses/${course.id}`}>معاينة وتفاصيل</Link>
                            </Button>

                            <Button
                              onClick={() => {
                                setCourseToPurchase(course);
                                setPurchaseOpen(true);
                              }}
                              className="rounded-xl font-black h-12 text-xs bg-primary hover:bg-primary/90 text-white shadow-md cursor-pointer"
                            >
                              شراء الكورس الآن
                            </Button>
                          </div>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* تبويب: كورساتي المشتركة (للمستفهم / الطالب) */}
          <TabsContent value="enrolled" className="space-y-6">
            <div className="flex items-center justify-between text-right">
              <div>
                <h3 className="text-2xl font-black text-zinc-900">الكورسات التي اشتركت بها</h3>
                <p className="text-zinc-500 text-sm font-bold">يمكنك المشاهدة فوراً بدون الحاجة لتحميل الفيديو بحماية كاملة.</p>
              </div>
            </div>

            {myEnrolledCourses.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed space-y-4">
                <BookOpen className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="font-black text-xl text-zinc-700">لم تشترك في أي كورس بعد</h3>
                <p className="text-zinc-500 font-bold text-sm">تصفح قائمة الكورسات واشترك لمشاهدتها مباشرة.</p>
                <Button onClick={() => setActiveTab("all")} className="bg-primary text-white font-black rounded-xl cursor-pointer">
                  استعراض الكورسات
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myEnrolledCourses.map((course) => (
                  <Card key={course.id} className="rounded-[2.5rem] border-2 bg-white overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="relative aspect-video overflow-hidden">
                        <R2MediaImage src={course.coverUrl} alt={course.title} className="w-full h-full object-cover" />
                        <Badge className="absolute top-4 right-4 bg-emerald-600 text-white font-bold">مشترك ومفعّل</Badge>
                      </div>
                      <CardContent className="p-6 md:p-8 space-y-3 text-right">
                        <h3 className="text-xl font-black text-zinc-900">{course.title}</h3>
                        <p className="text-xs text-zinc-500 font-bold">
                          المفهم: {course.instructorName} • {course.lessons.length} دروس مسجلة ومحمية
                        </p>
                      </CardContent>
                    </div>
                    <CardFooter className="p-6 md:p-8 pt-0">
                      <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white font-black rounded-xl h-12 gap-2">
                        <Link href={`/courses/${course.id}`}>
                          <Play className="w-4 h-4 fill-current" />
                          دخول قاعة المشاهدة
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* تبويب: لوحة المفهم لإنشاء وإدارة الكورسات والمبيعات */}
          <TabsContent value="instructor" className="space-y-8">
            {/* بطاقات الإحصائيات السريعة للمفهم */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-3xl border shadow-sm text-right space-y-1">
                <span className="text-xs font-bold text-zinc-500">إجمالي كورساتك</span>
                <div className="text-2xl font-black text-zinc-900 font-mono">
                  {instructorCourses.length} <span className="text-xs font-sans text-zinc-500 font-bold">كورس</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border shadow-sm text-right space-y-1">
                <span className="text-xs font-bold text-zinc-500">إجمالي المشتركين</span>
                <div className="text-2xl font-black text-primary font-mono">
                  {totalSales} <span className="text-xs font-sans text-zinc-500 font-bold">طالب</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border shadow-sm text-right space-y-1">
                <span className="text-xs font-bold text-zinc-500">إجمالي الإيرادات المقدرة</span>
                <div className="text-2xl font-black text-emerald-600 font-mono">
                  {totalRevenue} <span className="text-xs font-sans text-zinc-500 font-bold">ج.م</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-right">
              <div>
                <h3 className="text-2xl font-black text-zinc-900">الكورسات التي قمت بإنشائها</h3>
                <p className="text-zinc-500 text-sm font-bold">
                  أدر دروس وفيديوهات كل كورس، حدد السعر بالجنيه المصري، واطلع على مبيعاتك وقائمة الطلاب المشتركين.
                </p>
              </div>

              <Button
                onClick={() => {
                  setCourseToEdit(null);
                  setEditorOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl h-11 gap-2 shrink-0 cursor-pointer shadow-md"
              >
                <Plus size={16} /> إنشاء كورس جديد
              </Button>
            </div>

            {instructorCourses.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed space-y-4">
                <Video className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="font-black text-xl text-zinc-700">لم تقم بإنشاء أي كورس بعد</h3>
                <p className="text-zinc-500 font-bold text-sm max-w-md mx-auto">
                  بصفتك مُفهم معتمد، يمكنك رفع فيديوهات وشروحات دروسك وتحديد أسعارها ونشرها فوراً للطلاب.
                </p>
                <Button
                  onClick={() => {
                    setCourseToEdit(null);
                    setEditorOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl h-12 px-8 text-sm shadow-md gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء أول كورس لك الآن
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {instructorCourses.map((course) => (
                  <div
                    key={course.id}
                    className="p-6 bg-white dark:bg-zinc-900 border rounded-[2rem] shadow-sm hover:border-primary/30 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-right"
                  >
                    <div className="flex items-center gap-5 w-full lg:w-auto">
                      <R2MediaImage
                        src={course.coverUrl}
                        alt={course.title}
                        className="w-24 h-24 md:w-32 md:h-24 rounded-2xl object-cover border shrink-0 bg-zinc-100"
                      />
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-bold text-xs">{course.category}</Badge>
                          <Badge className={`border-none font-bold text-xs ${
                            course.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {course.isPublished ? "منشور للطلاب" : "مخفي (مسودة)"}
                          </Badge>
                        </div>

                        <h4 className="font-black text-lg md:text-xl text-zinc-900 dark:text-white">
                          {course.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-bold">
                          <span className="font-mono text-emerald-600 font-black text-sm">
                            {course.price} ج.م
                          </span>
                          <span>•</span>
                          <span>{course.lessons.length} دروس وفيديوهات</span>
                          <span>•</span>
                          <span>{course.totalEnrollments || 0} عملية شراء</span>
                        </div>
                      </div>
                    </div>

                    {/* أزرار الإجراءات الخاصة بالمفهم */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-4 lg:pt-0">
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-xl font-bold text-xs h-10 gap-1.5"
                      >
                        <Link href={`/courses/${course.id}`}>
                          <Eye size={14} /> معاينة كطالب
                        </Link>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleTogglePublish(course)}
                        className="rounded-xl font-bold text-xs h-10 gap-1.5 cursor-pointer"
                      >
                        {course.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
                        {course.isPublished ? "إخفاء الكورس" : "نشر الكورس"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setCourseForSales(course);
                          setSalesOpen(true);
                        }}
                        className="rounded-xl font-black text-xs h-10 gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 cursor-pointer"
                      >
                        <TrendingUp size={14} />
                        المبيعات والطلاب ({course.totalEnrollments || 0})
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setCourseToEdit(course);
                          setEditorOpen(true);
                        }}
                        className="rounded-xl font-bold text-xs h-10 gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={14} />
                        تعديل الكورس
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCourse(course)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 h-10 w-10 rounded-xl cursor-pointer"
                        title="حذف هذا الكورس"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* نافذة تأكيد حذف الكورس */}
        <Dialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
          <DialogContent className="rounded-3xl p-6 text-right max-w-md bg-white dark:bg-zinc-900 border-2" dir="rtl">
            <DialogHeader className="text-right space-y-2">
              <DialogTitle className="text-xl font-black text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                تأكيد حذف الكورس
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed">
                هل أنت متأكد من حذف كورس &ldquo;{courseToDelete?.title}&rdquo; نهائياً؟ سيتم مسح الكورس ودروسه فوراً ولن يظهر بعد الآن.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCourseToDelete(null)}
                className="rounded-xl font-bold cursor-pointer"
              >
                تراجع
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (courseToDelete) {
                    const idToDelete = courseToDelete.id;
                    deleteCourse(idToDelete);
                    setCourses((prev) => prev.filter((c) => c.id !== idToDelete));
                    setCourseToDelete(null);
                    toast({
                      title: "تم حذف الكورس بنجاح",
                      description: "تمت إزالة الكورس نهائياً من لوحتك ومن المنصة."
                    });
                    refreshData();
                  }
                }}
                className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white gap-2 cursor-pointer shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                نعم، احذف الكورس الآن
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* حوارات الإدارة والشراء */}
        <CourseEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          courseToEdit={courseToEdit}
          instructorId={currentUserId}
          instructorName={currentUserName}
          instructorAvatar={currentUserAvatar}
          onSaved={refreshData}
        />

        <CourseSalesDialog
          open={salesOpen}
          onOpenChange={setSalesOpen}
          course={courseForSales}
        />

        <CoursePurchaseDialog
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          course={courseToPurchase}
          studentId={currentUserId}
          studentName={currentUserName}
          studentEmail={currentUserEmail}
          onPurchaseSuccess={() => {
            refreshData();
            setActiveTab("enrolled");
          }}
        />
      </div>
    </div>
  );
}
