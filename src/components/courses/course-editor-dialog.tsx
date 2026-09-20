"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Video, 
  Image as ImageIcon, 
  Check, 
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  Upload,
  FileVideo,
  FileImage,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Film,
  Lock
} from "lucide-react";
import { Course, CourseLesson } from "@/lib/types";
import { upsertCourse } from "@/lib/courses-data";
import { saveCourseWithLessons } from "@/lib/course-service";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  compressImageToDataUrl, 
  uploadToR2,
  processVideoFile, 
  extractVideoDuration, 
  formatBytes,
  resolveMediaUrl
} from "@/lib/video-storage";

interface CourseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseToEdit?: Course | null;
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  onSaved?: () => void;
}

export function CourseEditorDialog({
  open,
  onOpenChange,
  courseToEdit,
  instructorId,
  instructorName,
  instructorAvatar,
  onSaved
}: CourseEditorDialogProps) {
  const { toast } = useToast();

  const coverFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(courseToEdit?.title || "");
  const [description, setDescription] = useState(courseToEdit?.description || "");
  const [coverUrl, setCoverUrl] = useState(courseToEdit?.coverUrl || "");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(courseToEdit?.coverUrl || "");
  const [draftCourseId, setDraftCourseId] = useState(courseToEdit?.id || "");
  const [coverFileName, setCoverFileName] = useState("");
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [isCoverDragging, setIsCoverDragging] = useState(false);

  const [price, setPrice] = useState<number>(courseToEdit?.price || 100);
  const [category, setCategory] = useState(courseToEdit?.category || "البرمجة والتقنية");
  const [isPublished, setIsPublished] = useState<boolean>(courseToEdit ? courseToEdit.isPublished : true);
  
  // Lessons list
  const [lessons, setLessons] = useState<CourseLesson[]>(courseToEdit?.lessons || []);

  // New Lesson form state (File-driven)
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [selectedVideoToken, setSelectedVideoToken] = useState("");
  const [selectedVideoPreview, setSelectedVideoPreview] = useState("");
  const [selectedVideoName, setSelectedVideoName] = useState("");
  const [selectedVideoSize, setSelectedVideoSize] = useState("");
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [newLessonDuration, setNewLessonDuration] = useState(15);
  const [newLessonIsFree, setNewLessonIsFree] = useState(false);

  // Preview lesson video modal/dialog state
  const [previewLesson, setPreviewLesson] = useState<CourseLesson | null>(null);
  const [previewResolvedUrl, setPreviewResolvedUrl] = useState("");

  // Reset when editing a different course or opening fresh
  useEffect(() => {
    if (courseToEdit) {
      setTitle(courseToEdit.title);
      setDescription(courseToEdit.description);
      setCoverUrl(courseToEdit.coverUrl);
      setCoverPreviewUrl(courseToEdit.coverUrl);
      setDraftCourseId(courseToEdit.id);
      if (courseToEdit.coverUrl?.startsWith("r2cover:")) {
        resolveMediaUrl(courseToEdit.coverUrl).then((u) => u && setCoverPreviewUrl(u));
      }
      setCoverFileName("");
      setPrice(courseToEdit.price);
      setCategory(courseToEdit.category || "البرمجة والتقنية");
      setIsPublished(courseToEdit.isPublished);
      setLessons((courseToEdit.lessons || []).map((lesson, index) => ({ ...lesson, order: index + 1, title: withLessonNumber(lesson.title, index + 1) })));
    } else {
      setTitle("");
      setDescription("");
      setCoverUrl("");
      setCoverPreviewUrl("");
      setDraftCourseId(`course-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
      setCoverFileName("");
      setPrice(100);
      setCategory("البرمجة والتقنية");
      setIsPublished(true);
      setLessons([]);
    }
    // Reset new lesson form
    setSelectedVideoToken("");
    setSelectedVideoPreview("");
    setSelectedVideoName("");
    setSelectedVideoSize("");
    setNewLessonTitle("");
    setNewLessonDuration(15);
    setNewLessonIsFree(false);
  }, [courseToEdit, open]);

  // Handle Cover Image Upload from device
  const processCoverFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "نوع ملف غير صالح", description: "يرجى اختيار ملف صورة (JPG, PNG, WebP).", variant: "destructive" });
      return;
    }
    setIsProcessingCover(true);
    setCoverUploadProgress(0);
    try {
      const uploaded = await uploadToR2(file, draftCourseId, "cover", undefined, setCoverUploadProgress);
      setCoverUrl(uploaded.token);
      setCoverPreviewUrl(uploaded.previewUrl);
      setCoverFileName(`${file.name} (${formatBytes(file.size)})`);
      toast({
        title: "تم رفع صورة الغلاف إلى Cloudflare R2",
        description: `تم حفظ ${file.name} في مساحة تخزين الكورس.`
      });
    } catch (err) {
      console.error(err);
      toast({ title: "خطأ في رفع الصورة", description: "تعذر رفع الصورة إلى Cloudflare R2.", variant: "destructive" });
    } finally {
      setIsProcessingCover(false);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCoverFile(file);
    }
  };

  // Handle Video File Upload from device
  const processVideoFileSelected = async (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv|ogg)$/i)) {
      toast({ title: "نوع ملف غير صالح", description: "يرجى اختيار ملف فيديو (MP4, WebM, MOV).", variant: "destructive" });
      return;
    }
    setIsProcessingVideo(true);
    setVideoUploadProgress(0);
    try {
      const sizeStr = formatBytes(file.size);
      const durationMin = await extractVideoDuration(file);
      const { token, previewUrl } = await processVideoFile(file, draftCourseId, lessons.length + 1, setVideoUploadProgress);

      setSelectedVideoToken(token);
      setSelectedVideoPreview(previewUrl);
      setSelectedVideoName(file.name);
      setSelectedVideoSize(sizeStr);
      setNewLessonDuration(durationMin);

      // Auto-set title from file name if user hasn't typed one
      if (!newLessonTitle.trim()) {
        const readableTitle = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]+/g, " ");
        setNewLessonTitle(readableTitle);
      }

      toast({
        title: "تم استلام الفيديو بنجاح",
        description: `${file.name} (${sizeStr}) - المدة المقدرة: ${durationMin} دقيقة`
      });
    } catch {
      toast({ title: "خطأ", description: "تعذر استيراد ملف الفيديو.", variant: "destructive" });
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFileSelected(file);
    }
  };

  // يحافظ على رقم الدرس تلقائيًا ويمنع تكرار الأرقام عند إعادة الترتيب.
  const cleanLessonTitle = (value: string) =>
    value.trim().replace(/^\s*\d+\s*[.\-]\s*/u, "");

  const withLessonNumber = (value: string, order: number) =>
    `${order}- ${cleanLessonTitle(value)}`;

  const handleAddLesson = () => {
    if (!newLessonTitle.trim()) {
      toast({ title: "تنبيه", description: "يرجى كتابة عنوان الدرس أولاً.", variant: "destructive" });
      return;
    }
    if (!selectedVideoToken) {
      toast({ title: "تنبيه", description: "يرجى رفع ملف الفيديو الخاص بالدرس من جهازك أولاً.", variant: "destructive" });
      return;
    }

    const newLesson: CourseLesson = {
      id: `les-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      title: withLessonNumber(newLessonTitle, lessons.length + 1),
      videoUrl: selectedVideoToken,
      durationMinutes: Number(newLessonDuration) || 10,
      order: lessons.length + 1,
      isFreePreview: newLessonIsFree,
      videoFileName: selectedVideoName || undefined,
      videoFileSize: selectedVideoSize || undefined
    };

    setLessons([...lessons, newLesson]);
    
    // Clear new lesson form
    setSelectedVideoToken("");
    setSelectedVideoPreview("");
    setSelectedVideoName("");
    setSelectedVideoSize("");
    setNewLessonTitle("");
    setNewLessonDuration(15);
    setNewLessonIsFree(false);
    if (videoFileRef.current) {
      videoFileRef.current.value = "";
    }

    toast({
      title: "تمت إضافة الدرس",
      description: `تم إدراج درس "${newLesson.title}" في قائمة دروس الكورس.`
    });
  };

  const handleRemoveLesson = (id: string) => {
    const updated = lessons.filter(l => l.id !== id).map((l, index) => ({ ...l, order: index + 1, title: withLessonNumber(l.title, index + 1) }));
    setLessons(updated);
  };

  const handleMoveLesson = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const updated = [...lessons];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // re-assign order numbers
    const reordered = updated.map((l, i) => ({ ...l, order: i + 1, title: withLessonNumber(l.title, i + 1) }));
    setLessons(reordered);
  };

  // Preview lesson video
  const handleOpenPreview = async (lesson: CourseLesson) => {
    setPreviewLesson(lesson);
    const resolved = await resolveMediaUrl(lesson.videoUrl);
    setPreviewResolvedUrl(resolved);
  };

  const handleSaveCourse = async () => {
    if (!title.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم الكورس.", variant: "destructive" });
      return;
    }
    if (!coverUrl) {
      toast({ title: "خطأ", description: "يرجى رفع صورة غلاف للكورس.", variant: "destructive" });
      return;
    }
    if (lessons.length === 0) {
      toast({ title: "خطأ", description: "يجب إضافة درس وفيديو واحد على الأقل داخل الكورس.", variant: "destructive" });
      return;
    }

    const normalizedLessons = lessons.map((lesson, index) => ({
      ...lesson,
      order: index + 1,
      title: withLessonNumber(lesson.title, index + 1),
    }));

    const courseData: Course = {
      id: draftCourseId || courseToEdit?.id || `course-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      description: description.trim(),
      coverUrl: coverUrl,
      price: Number(price) || 0,
      features: [],
      lessons: normalizedLessons,
      instructorId: getAuth(getApp()).currentUser?.uid || instructorId || "",
      instructorName: instructorName || "المُفهم المتخصص",
      instructorAvatar: instructorAvatar || "",
      isPublished: courseToEdit ? isPublished : false,
      status: courseToEdit ? (isPublished ? "published" : "pending") : "pending",
      category,
      createdAt: courseToEdit?.createdAt || new Date().toISOString(),
      totalEnrollments: courseToEdit?.totalEnrollments || 0,
      rating: courseToEdit?.rating || 5.0
    };

    try {
      const auth = getAuth(getApp());
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("AUTH_REQUIRED: يجب تسجيل الدخول قبل حفظ الكورس");
      }
      const db = getFirestore(getApp());
      await saveCourseWithLessons(db, { ...courseData, instructorId: currentUser.uid }, normalizedLessons, courseToEdit?.lessons?.map(l => l.id) || []);
      // Keep local cache only for backward compatibility with the old UI.
      upsertCourse(courseData);
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم حفظ بيانات الكورس والدروس على Firebase، والملفات على Cloudflare R2."
      });
    } catch (error: any) {
      console.error("[CourseEditor] save failed", error);
      const code = String(error?.code || "");
      const message = String(error?.message || "");
      const description = code === "permission-denied" || message.includes("permission")
        ? "Firebase رفض الحفظ بسبب الصلاحيات. تأكد أن الحساب مسجل دخول وأنه مُفهم."
        : message || "حدث خطأ غير معروف أثناء حفظ الكورس.";
      toast({
        title: "تعذر حفظ الكورس",
        description,
        variant: "destructive"
      });
      return;
    }
    onOpenChange(false);
    if (onSaved) onSaved();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 md:p-8 rounded-[2rem]" dir="rtl">
          <DialogHeader className="text-right space-y-2">
            <DialogTitle className="text-2xl font-black text-zinc-900 flex items-center gap-2">
              <Layers className="text-primary h-6 w-6" />
              {courseToEdit ? "تعديل الكورس الجاهز" : "إنشاء كورس جاهز جديد (رفع فيديوهات وصور)"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-bold">
              ارفع الفيديوهات والصور مباشرة من جهازك بدون روابط خارجية، وحدد السعر والنشر.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* الحالة: نشر أو إخفاء */}
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border">
              <div className="space-y-0.5 text-right">
                <Label className="text-base font-black flex items-center gap-2">
                  {isPublished ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  حالة الكورس: {isPublished ? "منشور للجميع" : "مخفي (مسودة)"}
                </Label>
                <p className="text-xs text-zinc-500 font-bold">
                  {isPublished ? "يظهر الكورس للطلاب في صفحة الكورسات ويمكنهم شراؤه فوراً." : "لا يمكن للطلاب مشاهدة أو شراء الكورس حتى تقوم بنشره."}
                </p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>

            {/* الأساسيات: الاسم والسعر والتصنيف */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 text-right md:col-span-2">
                <Label className="font-black text-zinc-700">اسم الكورس *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: المسار المتكامل لتعلم الآلة والذكاء الاصطناعي"
                  className="h-12 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-2 text-right">
                <Label className="font-black text-zinc-700">سعر الكورس (بالجنيه المصري - ج.م) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  placeholder="100"
                  className="h-12 rounded-xl font-bold font-mono"
                />
              </div>
            </div>

            {/* تصنيف الكورس */}
            <div className="space-y-2 text-right">
              <Label className="font-black text-zinc-700">تصنيف الكورس</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border bg-white dark:bg-zinc-900 font-bold text-sm"
              >
                <option value="البرمجة والتقنية">البرمجة والتقنية</option>
                <option value="الرياضيات والعلوم">الرياضيات والعلوم</option>
                <option value="الذكاء الاصطناعي">الذكاء الاصطناعي</option>
                <option value="اللغات والآداب">اللغات والآداب</option>
                <option value="التصميم والمونتاج">التصميم والمونتاج</option>
                <option value="إدارة الأعمال والتسويق">إدارة الأعمال والتسويق</option>
              </select>
            </div>

            {/* قسم رفع صورة الغلاف من الجهاز (وليس لينك) */}
            <div className="space-y-3 text-right">
              <div className="flex items-center justify-between">
                <Label className="font-black text-zinc-800 flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-primary" />
                  رفع صورة غلاف الكورس من جهازك *
                </Label>
                {coverFileName && (
                  <Badge variant="outline" className="text-xs font-mono text-zinc-600">
                    {coverFileName}
                  </Badge>
                )}
              </div>

              {isProcessingCover && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-primary"><span>جاري رفع صورة الغلاف...</span><span>{coverUploadProgress}%</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-primary transition-all" style={{ width: `${coverUploadProgress}%` }} /></div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={coverFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleCoverFileChange}
              />

              {coverUrl ? (
                <div className="relative aspect-video w-full max-h-56 rounded-2xl overflow-hidden border-2 border-zinc-200 group bg-zinc-900">
                  <img src={coverPreviewUrl || coverUrl} alt="غلاف الكورس" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={isProcessingCover}
                      className="bg-white text-zinc-900 hover:bg-zinc-100 font-black rounded-xl text-xs gap-1.5 shadow-lg"
                    >
                      {isProcessingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      استبدال الصورة من الجهاز
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setCoverUrl("");
                        setCoverPreviewUrl("");
                        setCoverFileName("");
                      }}
                      className="rounded-xl text-xs font-bold gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </Button>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    تم رفع صورة الغلاف
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsCoverDragging(true);
                  }}
                  onDragLeave={() => setIsCoverDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsCoverDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processCoverFile(file);
                  }}
                  onClick={() => coverFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isCoverDragging 
                      ? "border-primary bg-primary/5" 
                      : "border-zinc-300 hover:border-primary/60 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                      {isProcessingCover ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <ImageIcon className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <p className="font-black text-zinc-800 text-sm">
                        اضغط لاختيار صورة الغلاف من جهازك أو اسحبها وأفلتها هنا
                      </p>
                      <p className="text-xs text-zinc-500 font-bold mt-1">
                        صيغ مقبولة: JPG, PNG, WEBP بدقة عالية (16:9 مستحسن)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* وصف الكورس */}
            <div className="space-y-2 text-right">
              <Label className="font-black text-zinc-700">وصف الكورس</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب نبذة تشويقية عما سيتعلمه الطالب، متطلبات الكورس، والفئة المستهدفة..."
                rows={3}
                className="rounded-xl font-bold leading-relaxed resize-none"
              />
            </div>

            {/* قسم إدارة ورفع فيديوهات الدروس من الجهاز (وليس لينك) */}
            <div className="space-y-4 text-right pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-zinc-900 flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  دروس وفيديوهات الكورس ({lessons.length})
                </h3>
                <span className="text-xs text-zinc-500 font-bold">يتم رفع ملفات الفيديو وتشفيرها داخل مشغل المنصة</span>
              </div>

              {/* بطاقة رفع درس وفيديو جديد من الجهاز */}
              <div className="p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border-2 border-primary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-zinc-800 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-primary" />
                    رفع درس وفيديو جديد من جهازك:
                  </h4>
                  {isProcessingVideo && (
                     <div className="flex min-w-[180px] flex-col gap-1">
                       <div className="flex justify-between text-xs font-bold text-primary"><span>جاري رفع الفيديو...</span><span>{videoUploadProgress}%</span></div>
                       <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-primary transition-all" style={{ width: `${videoUploadProgress}%` }} /></div>
                     </div>
                   )}
                </div>

                {/* Hidden video file input */}
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />

                {/* منطقة رفع ملف الفيديو */}
                {!selectedVideoToken ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsVideoDragging(true);
                    }}
                    onDragLeave={() => setIsVideoDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsVideoDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processVideoFileSelected(file);
                    }}
                    onClick={() => videoFileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all bg-white dark:bg-zinc-900 ${
                      isVideoDragging 
                        ? "border-primary bg-primary/5" 
                        : "border-zinc-300 hover:border-primary/60"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <FileVideo className="w-6 h-6" />
                      </div>
                      <p className="font-black text-sm text-zinc-800">
                        اضغط لاختيار ملف الفيديو من جهازك (أو اسحبه هنا)
                      </p>
                      <p className="text-xs text-zinc-500 font-bold">
                        صيغ مدعومة: MP4, WebM, MOV - يتم قياس مدة الفيديو تلقائياً فور الرفع
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-xs text-zinc-900 flex items-center gap-1.5">
                            {selectedVideoName}
                          </p>
                          <span className="text-[11px] text-zinc-500 font-mono font-bold">
                            الحجم: {selectedVideoSize} • المدة المقدرة: {newLessonDuration} دقيقة
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => videoFileRef.current?.click()}
                        className="rounded-xl text-xs font-bold"
                      >
                        استبدال بملف فيديو آخر
                      </Button>
                    </div>

                    {/* معاينة الفيديو السريعة قبل الحفظ */}
                    {selectedVideoPreview && (
                      <div className="aspect-video max-h-48 rounded-xl overflow-hidden bg-black">
                        <video 
                          src={selectedVideoPreview} 
                          controls 
                          playsInline 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* عنوان ومدة وخيار المجانية */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold text-zinc-700">عنوان الدرس:</Label>
                    <Input
                      value={newLessonTitle ? `${lessons.length + 1}- ${cleanLessonTitle(newLessonTitle)}` : `${lessons.length + 1}- `}
                      onChange={(e) => {
                        const value = e.target.value.replace(/^\s*\d+\s*[.\-]\s*/u, "");
                        setNewLessonTitle(value);
                      }}
                      placeholder={`${lessons.length + 1}. عنوان الدرس`}
                      className="rounded-xl font-bold text-sm h-11"
                      dir="rtl"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-zinc-700">المدة بالدقائق:</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newLessonDuration}
                      onChange={(e) => setNewLessonDuration(Number(e.target.value))}
                      className="h-11 rounded-xl font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {lessons.length === 0 ? (
                      <>
                        <Switch checked={newLessonIsFree} onCheckedChange={setNewLessonIsFree} />
                        <Label className="text-xs font-bold text-zinc-700">معاينة مجانية (الدرس التعريفي الأول - متاح للطالب قبل الشراء)</Label>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 py-1 px-2.5 rounded-lg border border-red-200">
                        <Lock className="w-3.5 h-3.5" />
                        <span>الدروس التالية تكون مغلقة بقفل تلقائياً ولا تفتح للطلاب إلا بعد الشراء.</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleAddLesson} 
                    type="button" 
                    className="bg-primary text-white font-black rounded-xl text-sm gap-1.5 px-5 h-10 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> إضافة هذا الدرس للكورس
                  </Button>
                </div>
              </div>

              {/* قائمة الدروس مع أزرار الترتيب والحذف والمعاينة */}
              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <div 
                    key={lesson.id} 
                    className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center font-mono">
                        {lesson.order}
                      </span>
                      <div>
                        <h5 className="font-black text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                          {lesson.title}
                          {index === 0 && lesson.isFreePreview ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                              معاينة مجانية
                            </span>
                          ) : (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> مقفل بقفل
                            </span>
                          )}
                        </h5>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                          <span>{lesson.durationMinutes} دقيقة</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-sans font-bold flex items-center gap-1">
                            <FileVideo className="w-3 h-3" />
                            {lesson.videoFileName || "فيديو مرفوع"}
                            {lesson.videoFileSize ? ` (${lesson.videoFileSize})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* زر معاينة الفيديو */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPreview(lesson)}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 gap-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        معاينة
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => handleMoveLesson(index, "up")}
                        title="تحريك لأعلى"
                        className="h-8 w-8 text-zinc-500 hover:text-primary"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === lessons.length - 1}
                        onClick={() => handleMoveLesson(index, "down")}
                        title="تحريك لأسفل"
                        className="h-8 w-8 text-zinc-500 hover:text-primary"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLesson(lesson.id)}
                        title="حذف الدرس"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between pt-4 border-t gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveCourse} className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-8">
              {courseToEdit ? "حفظ التعديلات" : "حفظ ونشر الكورس"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الفيديو السريعة للمفهم */}
      {previewLesson && (
        <Dialog open={!!previewLesson} onOpenChange={(open) => !open && setPreviewLesson(null)}>
          <DialogContent className="max-w-2xl p-6 rounded-3xl" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                معاينة الدرس: {previewLesson.title}
              </DialogTitle>
              <DialogDescription className="font-bold text-zinc-500">
                المدة: {previewLesson.durationMinutes} دقيقة • {previewLesson.videoFileName || "فيديو مرفوع"}
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black my-3">
              {previewResolvedUrl && (
                <video
                  src={previewResolvedUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setPreviewLesson(null)} className="rounded-xl font-bold">
                إغلاق المعاينة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
