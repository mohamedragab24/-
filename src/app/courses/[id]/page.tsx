"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Clock, Lock, Play, ShoppingCart, User } from "lucide-react";
import { doc } from "firebase/firestore";
import { useFirebase, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { getCourseFromFirestore, hasPurchased, purchaseCourse } from "@/lib/course-service";
import type { Course, CourseLesson } from "@/lib/types";
import { ProtectedVideoPlayer } from "@/components/courses/protected-video-player";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

function parseRoute(raw: string) {
  const match = raw.match(/^course-(\d+)-(.+)$/);
  if (!match) return { courseId: raw, lessonNumber: null as number | null };
  return { courseId: `course-${match[2]}`, lessonNumber: Number(match[1]) };
}

export default function CourseDetailPage() {
  const params = useParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const { courseId, lessonNumber } = useMemo(() => parseRoute(rawId), [rawId]);
  const router = useRouter();
  const { user } = useFirebase();
  const db = useFirestore();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [bought, setBought] = useState(false);
  const [loading, setLoading] = useState(true);

  const profileRef = useMemoFirebase(() => user ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc(profileRef);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const found = await getCourseFromFirestore(db, courseId);
        if (!active) return;
        if (found && found.status === "published") {
          setCourse(found);
          setBought(user ? await hasPurchased(db, user.uid, found.id) : false);
        } else {
          setCourse(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [db, courseId, user]);

  const lessons = course?.lessons || [];
  const selectedIndex = lessonNumber ? lessons.findIndex(l => l.lessonNumber === lessonNumber) : -1;
  const lesson: CourseLesson | undefined = selectedIndex >= 0 ? lessons[selectedIndex] : undefined;
  const isPlayerRoute = lessonNumber !== null && lessonNumber >= 2 && !!lesson;
  const locked = isPlayerRoute && !bought;
  const price = course ? (course.promotionalPrice ?? course.price) : 0;

  const buy = async () => {
    if (!course) return;
    if (!user) { router.push("/login"); return; }
    try {
      await purchaseCourse(db, user.uid, course);
      setBought(true);
      toast({ title: "تم الشراء بنجاح", description: "تم فتح جميع الدروس." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "تعذر الشراء", description: e?.message || "حدث خطأ أثناء الشراء" });
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center font-black" dir="rtl">جاري تحميل الكورس...</div>;
  if (!course) return <div className="min-h-screen grid place-items-center text-center p-8" dir="rtl"><div><h1 className="text-2xl font-black">الكورس غير متاح</h1><p className="text-zinc-500 mt-2">قد يكون قيد المراجعة أو غير منشور.</p><Button asChild className="mt-5"><Link href="/courses">العودة للكورسات</Link></Button></div></div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4 md:px-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-7">
        <Button asChild variant="ghost"><Link href="/courses"><ArrowRight className="ml-2"/>العودة للكورسات</Link></Button>
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="grid lg:grid-cols-3">
            <div className="lg:col-span-2">
              {isPlayerRoute && lesson ? (
                <div className="bg-black min-h-[320px]">
                  {locked ? (
                    <div className="aspect-video flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
                      <Lock className="w-14 h-14"/>
                      <h2 className="text-xl font-black">هذا الدرس مقفول</h2>
                      <p className="text-zinc-300">اشترِ الكورس لفتح الدرس {lesson.lessonNumber} وجميع الدروس التالية.</p>
                      <Button onClick={buy} className="rounded-xl"><ShoppingCart className="ml-2"/>شراء الكورس</Button>
                    </div>
                  ) : (
                    <ProtectedVideoPlayer
                      videoUrl={lesson.videoUrl || lesson.storagePath || ""}
                      lessonTitle={`${lesson.lessonNumber}- ${lesson.title.replace(/^\s*\d+\s*-\s*/, "")}`}
                      courseTitle={course.title}
                      studentName={profile?.fullName || profile?.name || user?.displayName || "مستفهم منصة فهمت"}
                      studentEmail={profile?.email || user?.email || ""}
                      studentId={user?.uid || ""}
                      hasNextLesson={selectedIndex < lessons.length - 1}
                      onNextLesson={() => {
                        const next = lessons[selectedIndex + 1];
                        if (next) router.push(`/courses/course-${next.lessonNumber}-${course.id.replace(/^course-/, "")}`);
                      }}
                    />
                  )}
                </div>
              ) : (
                <img src={course.coverUrl} className="w-full aspect-video object-cover" alt={course.title}/>
              )}

              <div className="p-7 space-y-5">
                <div className="flex gap-2"><Badge>{course.category}</Badge>{bought&&<Badge className="bg-emerald-600">تم الشراء</Badge>}</div>
                <h1 className="text-3xl font-black">{course.title}</h1>
                <p className="text-zinc-600 leading-8">{course.description}</p>
                <div className="flex items-center gap-3"><Avatar><AvatarImage src={course.instructorAvatar}/><AvatarFallback><User/></AvatarFallback></Avatar><div><b>{course.instructorName}</b><div className="text-xs text-zinc-500">المُفهم</div></div></div>
                {isPlayerRoute && lesson && <div className="font-black text-lg">{lesson.lessonNumber}- {lesson.title.replace(/^\s*\d+\s*-\s*/, "")}</div>}
              </div>
            </div>

            <aside className="p-7 border-r bg-white space-y-5">
              <div className="text-center"><div className="text-sm text-zinc-500">السعر</div><div className="text-4xl font-black text-primary">{price} ج.م</div>{course.promotionalPrice!=null&&<div className="text-sm line-through text-zinc-400">{course.price} ج.م</div>}</div>
              {!bought&&<Button onClick={buy} className="w-full h-14 rounded-2xl text-lg font-black"><ShoppingCart className="ml-2"/>شراء الكورس</Button>}
              <div><h3 className="font-black mb-3">دروس الكورس</h3><div className="space-y-2">
                {lessons.map((l: CourseLesson, i: number) => {
                  const cleanTitle = l.title.replace(/^\s*\d+\s*-\s*/, "");
                  const href = `/courses/course-${l.lessonNumber}-${course.id.replace(/^course-/, "")}`;
                  return <Link key={l.id} href={href} className={`w-full text-right p-3 rounded-xl border flex items-center gap-3 ${lessonNumber===l.lessonNumber?'border-primary bg-primary/5':''}`}><span className="font-mono font-black">{l.lessonNumber}-</span><span className="flex-1 font-bold text-sm">{cleanTitle}</span>{i===0?<Play className="w-4 h-4 text-emerald-600"/>:<Lock className="w-4 h-4 text-zinc-400"/>}</Link>;
                })}
              </div></div>
              <div className="text-xs text-zinc-500 font-bold"><Clock className="inline w-3 h-3 ml-1"/> الدرس 1 معاينة مجانية — الدروس 2+ للمشتري فقط</div>
            </aside>
          </div>
        </Card>
      </div>
    </div>
  );
}
