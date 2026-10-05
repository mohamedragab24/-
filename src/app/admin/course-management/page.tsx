"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, getDocs, doc, writeBatch } from "firebase/firestore";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { Course } from "@/lib/types";
import { listAllCourses } from "@/lib/course-service";
import { CourseEditorDialog } from "@/components/courses/course-editor-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit3, Trash2, Eye, Layers, Loader2 } from "lucide-react";

async function deleteCourseCompletely(db: any, courseId: string) {
  const lessonsSnap = await getDocs(collection(db, "courses", courseId, "lessons"));
  const docsToDelete = lessonsSnap.docs;
  for (let i = 0; i < docsToDelete.length; i += 450) {
    const batch = writeBatch(db);
    docsToDelete.slice(i, i + 450).forEach((lesson) => batch.delete(lesson.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "courses", courseId));
}

export default function AdminCourseManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  const adminRef = useMemoFirebase(() => firestore && user ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(adminRef);
  const isMasterAdmin = ["mohamed76y@gmail.com", "mohamjedminijd2006@gmail.com", "mohamedmini2006@gamil.com"].includes(user?.email || "");
  const isAdmin = !!profile?.isAdmin || profile?.role === "admin" || isMasterAdmin;

  const load = async () => {
    if (!firestore || !isAdmin) return;
    setLoading(true);
    try {
      setCourses(await listAllCourses(firestore));
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "تعذر تحميل الكورسات", description: "تأكد من صلاحيات لوحة الإدارة." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firestore, isAdmin]);

  const filtered = courses.filter((course) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [course.title, course.instructorName, course.category, course.description].some((v) => String(v || "").toLowerCase().includes(q));
  });

  const handleDelete = async () => {
    if (!firestore || !deleteTarget) return;
    setSaving(true);
    try {
      await deleteCourseCompletely(firestore, deleteTarget.id);
      setCourses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: "تم حذف الكورس", description: "تم حذف الكورس ودروسه من قاعدة البيانات. سجلات المشتريات لم تُحذف حفاظاً على السجل المالي." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "تعذر حذف الكورس", description: e?.message || "حدث خطأ أثناء الحذف." });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <div className="p-20 text-center font-black text-2xl">عذراً، لا تملك صلاحية إدارة الكورسات.</div>;

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-r-8 border-primary pr-5">
        <div>
          <h1 className="text-4xl font-black">إدارة الكورسات</h1>
          <p className="text-muted-foreground font-bold mt-2">تعديل أو حذف أي كورس من لوحة الإدارة. المفهم لا يملك صلاحية حذف الكورس.</p>
        </div>
        <Badge className="w-fit bg-emerald-100 text-emerald-700 font-black px-4 py-2">صلاحيات الإدارة فقط</Badge>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الكورس أو المفهم أو التصنيف..." className="h-14 rounded-2xl pr-12 font-bold" />
        </div>
        <Button variant="outline" onClick={() => void load()} className="h-14 rounded-2xl font-black">تحديث</Button>
      </div>

      {loading ? (
        <div className="py-24 text-center font-black text-zinc-500"><Loader2 className="animate-spin mx-auto mb-3" />جاري تحميل الكورسات...</div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl"><CardContent className="py-24 text-center text-zinc-400 font-black">لا توجد كورسات مطابقة.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => (
            <Card key={course.id} className="overflow-hidden rounded-3xl border-2 bg-white shadow-sm">
              <div className="aspect-video bg-zinc-100 overflow-hidden">
                {course.coverUrl ? <img src={course.coverUrl} alt={course.title} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center"><Layers className="w-12 h-12 text-zinc-300" /></div>}
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge className={course.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{course.isPublished ? "منشور" : "قيد المراجعة / مخفي"}</Badge>
                  <span className="font-black text-primary">{Number(course.price || 0)} ج.م</span>
                </div>
                <div>
                  <h2 className="font-black text-xl line-clamp-2">{course.title}</h2>
                  <p className="text-sm text-zinc-500 font-bold mt-1">المفهم: {course.instructorName || "—"}</p>
                  <p className="text-xs text-zinc-400 mt-1">{course.category || "بدون تصنيف"} • {course.lessons?.length || 0} دروس</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="rounded-xl font-bold" onClick={() => window.open(`/courses/${course.id}`, "_blank")}><Eye className="w-4 h-4 ml-1" />معاينة</Button>
                  <Button className="rounded-xl font-bold" onClick={() => { setSelected(course); setEditorOpen(true); }}><Edit3 className="w-4 h-4 ml-1" />تعديل</Button>
                  <Button variant="destructive" className="rounded-xl font-bold" onClick={() => setDeleteTarget(course)}><Trash2 className="w-4 h-4 ml-1" />حذف</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CourseEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        courseToEdit={selected}
        instructorId={selected?.instructorId || user?.uid || ""}
        instructorName={selected?.instructorName || profile?.fullName || profile?.name || "المفهم"}
        instructorAvatar={selected?.instructorAvatar || profile?.avatarUrl || ""}
        onSaved={() => { setSelected(null); void load(); }}
        canManagePublication={true}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent dir="rtl" className="rounded-3xl">
          <DialogHeader className="text-right">
            <DialogTitle className="font-black text-red-600">حذف الكورس نهائياً؟</DialogTitle>
            <DialogDescription className="font-bold leading-relaxed">سيتم حذف الكورس وجميع دروسه من المنصة. لن يتم حذف سجلات المشتريات المالية السابقة.</DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-2xl bg-red-50 text-red-800 font-black">{deleteTarget?.title}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "جاري الحذف..." : "نعم، احذف الكورس"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
