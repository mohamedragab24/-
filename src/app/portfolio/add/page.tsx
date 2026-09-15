
"use client";

import { useState, useRef } from "react";
import { useFirestore, useUser, useStorage, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, query, orderBy, doc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  ImageIcon, 
  Loader2,
  Video,
  CloudUpload,
  Layers,
  Filter,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddPortfolioWork() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    categorySub: "",
    categoryOpt: ""
  });

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "categories"), orderBy("createdAt", "desc"));
  }, [firestore]);
  const { data: allCategories } = useCollection(categoriesQuery);

  const mainCategories = allCategories?.filter(c => c.type === 'main' || !c.type) || [];
  const subCategories = allCategories?.filter(c => c.type === 'sub' && c.parentId === allCategories?.find(m => m.name === formData.category)?.id) || [];
  const optCategories = allCategories?.filter(c => c.type === 'option' && c.parentId === allCategories?.find(s => s.name === formData.categorySub)?.id) || [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'video') {
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      } else {
        setThumbFile(file);
        setThumbPreview(URL.createObjectURL(file));
      }
    }
  };

  const upload = async (file: File, path: string) => {
    const sRef = ref(storage!, path);
    await uploadBytesResumable(sRef, file);
    return getDownloadURL(sRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !videoFile || !thumbFile || !formData.category) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى اختيار القسم والملفات المطلوبة." });
      return;
    }
    setIsSubmitting(true);
    try {
      const vUrl = await upload(videoFile, `portfolio/${user.uid}/v_${Date.now()}`);
      const tUrl = await upload(thumbFile, `portfolio/${user.uid}/t_${Date.now()}`);
      
      await addDoc(collection(firestore!, "portfolio"), {
        mufhemId: user.uid,
        ...formData,
        mediaUrl: vUrl,
        thumbnailUrl: tUrl,
        mediaType: "video",
        status: "pending_approval",
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم الإرسال للمراجعة", description: "سيقوم فريق الإدارة بمراجعة عملك ونشره قريباً." });
      router.push("/portfolio");
    } catch (e) {
      toast({ variant: "destructive", title: "فشل الرفع" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10 mb-24 text-right" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">إضافة نموذج تفهيم</h1>
        <p className="text-muted-foreground text-lg font-bold">اعرض مهاراتك من خلال نماذج تعليمية مميزة تجذب المستفهمين.</p>
      </div>

      <Card className="rounded-[3rem] border-2 shadow-2xl p-10 bg-white">
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-2">
            <Label className="font-black text-lg">عنوان العمل</Label>
            <Input 
              value={formData.title} 
              onChange={(e)=>setFormData({...formData, title: e.target.value})} 
              className="h-16 rounded-2xl border-2 font-black text-xl" 
              placeholder="مثال: شرح مبسط للوراثة المندلية"
              required 
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 text-right">
              <Label className="font-black flex items-center gap-2 justify-end">القسم <Layers size={16} className="text-primary" /></Label>
              <Select value={formData.category} onValueChange={(v)=>setFormData({...formData, category: v, categorySub: "", categoryOpt: ""})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {mainCategories.map(c=><SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-right">
              <Label className="font-black flex items-center gap-2 justify-end">التخصص <Filter size={16} className="text-primary" /></Label>
              <Select disabled={!formData.category} value={formData.categorySub} onValueChange={(v)=>setFormData({...formData, categorySub: v, categoryOpt: ""})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                <SelectContent>
                  {subCategories.map(c=><SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-right">
              <Label className="font-black flex items-center gap-2 justify-end">تخصص إضافي <Activity size={16} className="text-primary" /></Label>
              <Select disabled={!formData.categorySub} value={formData.categoryOpt} onValueChange={(v)=>setFormData({...formData, categoryOpt: v})}>
                <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue placeholder="اختر (اختياري)" /></SelectTrigger>
                <SelectContent>
                  {optCategories.map(c=><SelectItem key={c.id} value={c.name} className="font-bold text-right">{c.name}</SelectItem>)}
                  <SelectItem value="أخرى" className="font-bold text-primary italic text-right">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="font-black text-lg">الصورة المصغرة (Thumbnail)</Label>
              <div onClick={()=>thumbInputRef.current?.click()} className="h-56 rounded-3xl border-4 border-dashed border-zinc-100 bg-zinc-50 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-primary/30 group">
                {thumbPreview ? (
                  <img src={thumbPreview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <div className="text-center space-y-2">
                    <ImageIcon className="text-zinc-200 mx-auto" size={48}/>
                    <p className="text-xs font-bold text-zinc-400">اضغط لرفع صورة الغلاف</p>
                  </div>
                )}
              </div>
              <input type="file" ref={thumbInputRef} className="hidden" accept="image/*" onChange={(e)=>handleFile(e, 'image')} />
            </div>
            <div className="space-y-3">
              <Label className="font-black text-lg">فيديو الشرح</Label>
              <div onClick={()=>videoInputRef.current?.click()} className="h-56 rounded-3xl border-4 border-dashed border-zinc-100 bg-zinc-50 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-primary/30 group">
                {videoPreview ? (
                  <video src={videoPreview} className="w-full h-full object-contain" muted />
                ) : (
                  <div className="text-center space-y-2">
                    <Video className="text-zinc-200 mx-auto" size={48}/>
                    <p className="text-xs font-bold text-zinc-400">اضغط لرفع فيديو النموذج</p>
                  </div>
                )}
              </div>
              <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e)=>handleFile(e, 'video')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-black text-lg">الشرح التفصيلي</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e)=>setFormData({...formData, description: e.target.value})} 
              className="h-48 rounded-3xl border-2 p-6 text-lg font-medium leading-relaxed" 
              placeholder="اكتب وصفاً مختصراً عما سيتعلمه المستفهم من هذا النموذج..."
              required 
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-24 rounded-[2.5rem] text-3xl font-black bg-primary shadow-2xl hover:scale-[1.02] transition-all">
            {isSubmitting ? (
              <><Loader2 className="animate-spin ml-3 h-8 w-8" /> جاري الرفع...</>
            ) : (
              "إرسال العمل للمراجعة"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
