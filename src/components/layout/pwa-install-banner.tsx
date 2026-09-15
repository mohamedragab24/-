
"use client";

import { useState, useEffect } from "react";
import { Download, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { usePathname } from "next/navigation";

/**
 * بانر تثبيت التطبيق الذكي - يظهر عند الدخول من المتصفح ولا يختفي إلا بقرار المستخدم (تثبيت أو ليس الآن).
 */
export function PWAInstallBanner() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings } = useDoc(settingsRef);

  const isExcludedPath = pathname === "/login" || pathname === "/forgot-password" || pathname === "/signup";

  useEffect(() => {
    setIsMounted(true);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;

    if (isStandalone) return;

    // إظهار البانر بعد ثانيتين من التحميل
    const showTimer = setTimeout(() => {
      if (!isExcludedPath) {
        setShowBanner(true);
      }
    }, 2000);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(showTimer);
    };
  }, [isExcludedPath]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else {
      alert("يرجى الضغط على زر الخيارات في متصفحك واختيار 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'.");
      setShowBanner(false);
    }
  };

  if (!isMounted || !showBanner || isExcludedPath) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[300] animate-in slide-in-from-top-full duration-700" dir="rtl">
      <div className="max-w-lg mx-auto bg-white/95 backdrop-blur-xl border-2 border-primary/20 shadow-2xl rounded-[2.5rem] p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 flex items-center justify-center shrink-0 overflow-hidden bg-transparent">
            {settings?.miniIconUrl || settings?.logoUrl ? (
              <img src={settings.miniIconUrl || settings.logoUrl} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <span className="text-primary font-black text-2xl">ف</span>
            )}
          </div>
          <div className="text-right truncate">
            <h4 className="font-black text-zinc-900 text-md leading-tight truncate">تثبيت تطبيق {settings?.siteTitle || "فهمني"}</h4>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex">
                {[1,2,3,4,5].map(s => <Star key={s} size={10} className="fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="text-[10px] text-zinc-400 font-bold truncate">أسرع وأخف على هاتفك</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={handleInstallClick}
            className="h-12 px-6 rounded-2xl font-black text-sm bg-primary hover:bg-primary/90 text-white shadow-lg"
          >
            <Download size={18} className="ml-2" /> تثبيت
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setShowBanner(false)}
            className="h-12 px-4 rounded-2xl font-black text-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            ليس الآن
          </Button>
        </div>
      </div>
    </div>
  );
}
