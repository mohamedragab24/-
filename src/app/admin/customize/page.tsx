
"use client";

import { useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Type, Layout, Save, RefreshCw, Sparkles, CheckCircle2, AlertCircle, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminCustomize() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings, isLoading } = useDoc(settingsRef);

  const [formData, setFormData] = useState({
    siteTitle: "",
    heroTitle: "",
    heroSubtitle: "",
    footerText: "",
    primaryColor: "#29B6F6",
    accentColor: "#FF7043",
    backgroundColor: "#F8FAFC",
    landingVideoId: ""
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        siteTitle: settings.siteTitle || "فهمني",
        heroTitle: settings.heroTitle || "أول منصة عربية لخدمات الشرح الفوري",
        heroSubtitle: settings.heroSubtitle || "مُفهمين خبراء لخدمة كل مُستفهم طموح",
        footerText: settings.footerText || "جميع الحقوق محفوظة لمنصة فهمني",
        primaryColor: settings.primaryColor || "#29B6F6",
        accentColor: settings.accentColor || "#FF7043",
        backgroundColor: settings.backgroundColor || "#F8FAFC",
        landingVideoId: settings.landingVideoId || "dQw4w9WgXcQ"
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, "settings", "general"), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث هوية المنصة بالكامل." });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ الإعدادات." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center font-bold animate-pulse text-2xl">جاري تحميل مركز التخصيص...</div>;

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">تخصيص المنصة (Full Control)</h1>
          <p className="text-muted-foreground text-lg">تحكم في كل كلمة ولون يظهر للمستخدمين؛ اجعل المنصة تعبر عن رؤيتك.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="h-16 px-10 rounded-2xl font-black text-xl shadow-xl">
          {isSaving ? <RefreshCw className="animate-spin ml-2" /> : <Save className="ml-2" />}
          حفظ كافة التغييرات
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* النصوص والعناوين */}
        <Card className="rounded-[2.5rem] border-2 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3 text-primary">
              <Type size={32} /> تحرير النصوص والعناوين
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="font-bold">اسم المنصة (Site Title)</Label>
              <Input value={formData.siteTitle} onChange={(e)=>setFormData({...formData, siteTitle: e.target.value})} className="h-14 border-2 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان الرئيسي لصفحة الهبوط (Hero Title)</Label>
              <Input value={formData.heroTitle} onChange={(e)=>setFormData({...formData, heroTitle: e.target.value})} className="h-14 border-2 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">الوصف التعريفي (Hero Subtitle)</Label>
              <Textarea value={formData.heroSubtitle} onChange={(e)=>setFormData({...formData, heroSubtitle: e.target.value})} className="h-24 border-2 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">فيديو اليوتيوب (Video ID)</Label>
              <div className="flex gap-2">
                <Input value={formData.landingVideoId} onChange={(e)=>setFormData({...formData, landingVideoId: e.target.value})} placeholder="مثال: dQw4w9WgXcQ" className="h-14 border-2 rounded-xl font-mono" />
                <div className="bg-red-50 p-3 rounded-xl flex items-center justify-center text-red-600"><Youtube /></div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">نص التذييل (Footer Text)</Label>
              <Input value={formData.footerText} onChange={(e)=>setFormData({...formData, footerText: e.target.value})} className="h-14 border-2 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* الألوان والثيم */}
        <Card className="rounded-[2.5rem] border-2 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3 text-accent">
              <Palette size={32} /> الهوية البصرية والألوان
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ColorBox label="اللون الأساسي (Primary)" value={formData.primaryColor} onChange={(val)=>setFormData({...formData, primaryColor: val})} />
              <ColorBox label="لون التمييز (Accent)" value={formData.accentColor} onChange={(val)=>setFormData({...formData, accentColor: val})} />
              <ColorBox label="لون الخلفية (Background)" value={formData.backgroundColor} onChange={(val)=>setFormData({...formData, backgroundColor: val})} />
            </div>

            <div className="p-8 bg-zinc-900 rounded-[2rem] text-white space-y-4">
              <h4 className="text-xl font-black flex items-center gap-2 text-primary">
                <Sparkles size={20} /> معاينة حية للألوان
              </h4>
              <div className="flex gap-4">
                <div style={{ backgroundColor: formData.primaryColor }} className="h-12 w-full rounded-xl flex items-center justify-center font-black">الأساسي</div>
                <div style={{ backgroundColor: formData.accentColor }} className="h-12 w-full rounded-xl flex items-center justify-center font-black">التميز</div>
              </div>
              <p className="text-xs text-zinc-400 font-bold">ملاحظة: عند الحفظ سيتم تغيير شكل المنصة بالكامل لكل المستخدمين في أقل من ثانية.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorBox({ label, value, onChange }: any) {
  return (
    <div className="space-y-3">
      <Label className="font-black text-sm">{label}</Label>
      <div className="flex gap-2">
        <input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="h-14 w-14 rounded-xl cursor-pointer border-2"
        />
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="h-14 font-mono font-bold border-2 rounded-xl"
        />
      </div>
    </div>
  );
}
