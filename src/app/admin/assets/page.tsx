
"use client";

import { useState, useRef } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ImageIcon, 
  RefreshCw, 
  Upload, 
  Flower2, 
  Monitor, 
  Globe, 
  Smartphone,
  LayoutTemplate,
  BadgeCheck,
  AppWindow,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * مركز إدارة الأصول الرقمية لمنصة "فهمت".
 * يسمح بتغيير كل صورة في الموقع بشكل مستقل وحفظها في Firestore.
 */
export default function AdminAssets() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings, isLoading } = useDoc(settingsRef);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeKey && firestore) {
      if (file.size > 1024 * 1024) {
        toast({ variant: "destructive", title: "الملف كبير جداً", description: "يرجى اختيار صورة أقل من 1MB لضمان سرعة التحميل." });
        return;
      }

      setUploadingKey(activeKey);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await setDoc(doc(firestore, "settings", "general"), {
            [activeKey]: base64,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          toast({ title: "تم تحديث الأصل بنجاح", description: "التغيير سيظهر لكافة المستخدمين لحظياً." });
        } catch (err) {
          toast({ variant: "destructive", title: "خطأ في الحفظ" });
        } finally {
          setUploadingKey(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const assetItems = [
    { key: 'logoUrl', label: 'اللوجو الرئيسي (Landing)', desc: 'يظهر في قلب صفحة الهبوط.', icon: Flower2 },
    { key: 'miniIconUrl', label: 'اللوجو الصغير (Header)', desc: 'يظهر في الترويسة بجانب القائمة.', icon: AppWindow },
    { key: 'landingBg', label: 'خلفية الهيرو', desc: 'الصورة الكبيرة خلف عنوان الموقع.', icon: Monitor },
    { key: 'aboutImage', label: 'صورة "عن المنصة"', desc: 'تظهر في صفحة التعريف بالمنصة.', icon: Info },
    { key: 'ogImageUrl', label: 'صورة المشاركة (SEO)', desc: 'تظهر عند مشاركة رابط الموقع.', icon: ImageIcon },
    { key: 'icon192', label: 'أيقونة التطبيق (192x192)', desc: 'أيقونة PWA لشاشة الهاتف الرئيسية.', icon: Smartphone },
    { key: 'icon512', label: 'أيقونة التطبيق (512x512)', desc: 'أيقونة PWA عالية الجودة للمتصفحات.', icon: LayoutTemplate },
    { key: 'verifiedBadgeUrl', label: 'شارة التوثيق الزرقاء', desc: 'تظهر بجانب أسماء الحسابات الموثقة.', icon: BadgeCheck }
  ];

  if (isLoading) return <div className="p-10 text-center font-bold animate-pulse text-2xl">جاري تحميل مركز الأصول...</div>;

  return (
    <div className="p-6 md:p-10 space-y-10 bg-zinc-50/50 min-h-screen" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">إدارة الهوية البصرية</h1>
        <p className="text-muted-foreground text-xl">تحكم في كل صورة تظهر في منصة "فهمت" بشكل مستقل ودقيق.</p>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {assetItems.map((item) => {
          const currentImage = settings?.[item.key] || "https://placehold.co/400x300?text=No+Image";
          return (
            <Card key={item.key} className="shadow-xl rounded-[2.5rem] border-2 border-primary/5 overflow-hidden bg-white hover:border-primary/20 transition-all group">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary p-4 rounded-3xl">
                      <item.icon size={28} />
                    </div>
                    <div className="text-right">
                      <h3 className="text-xl font-black text-zinc-800">{item.label}</h3>
                      <p className="text-xs font-bold text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setActiveKey(item.key); fileInputRef.current?.click(); }}
                    disabled={uploadingKey === item.key}
                    className="rounded-xl font-black border-2"
                  >
                    {uploadingKey === item.key ? <RefreshCw className="animate-spin" /> : <Upload size={16} />}
                  </Button>
                </div>

                <div className="relative aspect-video rounded-[2rem] overflow-hidden border-2 border-dashed border-zinc-100 bg-zinc-50 flex items-center justify-center group-hover:border-primary/30 transition-all">
                  <img 
                    src={currentImage} 
                    alt={item.label} 
                    className={`${item.key.includes('icon') || item.key.includes('logo') || item.key.includes('Badge') || item.key.includes('miniIcon') ? 'h-32 w-32 object-contain' : 'w-full h-full object-cover'}`}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
