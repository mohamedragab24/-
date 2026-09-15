
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Camera, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2,
  Clock,
  Loader2,
  Smartphone,
  User as UserIcon,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from "@/firebase";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ProfilePage() {
  const { user, auth } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const userRef = useMemoFirebase(() => (firestore && user?.uid) ? doc(firestore, "users", user.uid) : null, [firestore, user?.uid]);
  const { data: profile, isLoading } = useDoc(userRef);

  const [formData, setFormData] = useState({
    fullName: "",
    birthDate: "",
    profilePictureUrl: "",
    bio: "",
    phoneNumber: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        birthDate: profile.birthDate ? profile.birthDate.split('T')[0] : "",
        profilePictureUrl: profile.profilePicturePending ? profile.pendingProfilePictureUrl : (profile.profilePictureUrl || ""),
        bio: profile.bio || "",
        phoneNumber: profile.phoneNumber || ""
      });
    }
  }, [profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBasic = async () => {
    if (!userRef || !profile) return;
    setIsSaving(true);
    try {
      const updateData: any = {
        fullName: formData.fullName,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
        updatedAt: new Date().toISOString(),
        needsProfileCompletion: false
      };
      
      const currentOfficial = profile.profilePictureUrl || "";
      const currentPending = profile.pendingProfilePictureUrl || "";
      
      // إذا تغيرت الصورة، نضعها في الحقل المنتظر للمراجعة
      if (formData.profilePictureUrl && formData.profilePictureUrl !== (profile.profilePicturePending ? currentPending : currentOfficial)) {
        updateData.pendingProfilePictureUrl = formData.profilePictureUrl;
        updateData.profilePicturePending = true;
      }

      await updateDoc(userRef, updateData);
      toast({ title: "تم حفظ التغييرات", description: "سيتم مراجعة الصورة الشخصية من قبل الإدارة." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحفظ" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-20 text-center font-black animate-pulse">جاري تحميل بياناتك...</div>;

  const defaultAvatar = profile?.gender === 'female' 
    ? "https://picsum.photos/seed/female/200/200" 
    : "https://picsum.photos/seed/male/200/200";

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12 mb-24 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-primary pr-6">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black font-headline text-zinc-900">الملف الشخصي</h1>
          {profile?.isVerified && <ShieldCheck className="h-10 w-10 text-blue-500" />}
        </div>
        <Button variant="outline" onClick={() => signOut(auth).then(()=>router.push("/login"))} className="rounded-xl h-12 font-bold text-red-600 border-red-100">
          <LogOut className="ml-2" /> تسجيل خروج
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {/* المربع الأساسي - البيانات العامة */}
        <Card className="shadow-2xl border-2 rounded-[3.5rem] overflow-hidden bg-white">
          <div className="h-32 bg-primary/10"></div>
          <CardContent className="px-8 md:px-12 pb-12 relative">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-8 -mt-16 mb-12">
              <div className="relative">
                <div className="h-40 w-40 rounded-full border-[8px] border-white shadow-xl overflow-hidden bg-zinc-100">
                  <img src={formData.profilePictureUrl || defaultAvatar} className="w-full h-full object-cover" alt="Profile" />
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 bg-primary p-3 rounded-xl text-white shadow-lg border-2 border-white">
                  <Camera size={20}/>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e)=>handleFileUpload(e, 'profilePictureUrl')} />
              </div>
              <div className="flex-1 text-center md:text-right">
                <h2 className="text-3xl font-black flex items-center justify-center md:justify-start gap-2">
                  {formData.fullName}
                  {profile?.isVerified && <ShieldCheck className="h-6 w-6 text-blue-500" />}
                </h2>
                <Badge variant="outline" className="mt-2 text-primary font-bold">{profile?.role === 'mufhem' ? 'مُفهم' : 'مُستفهم'}</Badge>
              </div>
            </div>

            {profile?.profilePicturePending && (
              <div className="bg-orange-50 p-4 rounded-xl flex items-center gap-3 text-orange-700 font-black text-xs border border-orange-100 mb-8">
                <Clock size={16} className="shrink-0 animate-pulse" />
                <span>صورتك الشخصية الجديدة قيد المراجعة حالياً. ستظهر للآخرين فور اعتمادها.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="font-black">الاسم بالكامل</Label>
                <Input value={formData.fullName} onChange={(e)=>setFormData({...formData, fullName: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-black">تاريخ الميلاد</Label>
                <Input type="date" value={formData.birthDate} onChange={(e)=>setFormData({...formData, birthDate: e.target.value})} className="h-14 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-black">رقم الهاتف</Label>
                <div className="flex gap-2">
                  <Input value={formData.phoneNumber} onChange={(e)=>setFormData({...formData, phoneNumber: e.target.value})} className="h-14 rounded-xl border-2 font-mono" dir="ltr" />
                  <Button variant="outline" className="h-14 rounded-xl font-bold border-primary text-primary">توثيق الرقم</Button>
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="font-black">نبذة تعريفية</Label>
                <Textarea value={formData.bio} onChange={(e)=>setFormData({...formData, bio: e.target.value})} className="h-32 rounded-xl border-2" placeholder="اشرح مهاراتك أو ما تبحث عنه..." />
              </div>
            </div>
            <Button onClick={handleSaveBasic} disabled={isSaving} className="w-full h-16 mt-10 rounded-2xl font-black text-xl shadow-xl">
              {isSaving ? <Loader2 className="animate-spin ml-2" /> : "حفظ التغييرات العامة"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
