
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * توليد ملف manifest.json بشكل ديناميكي من الفايربيز.
 * يستخدم أيقونات التطبيق المخصصة المرفوعة من لوحة التحكم.
 */

export async function GET() {
  let settings = {
    siteTitle: "فهمت",
    primaryColor: "#29B6F6",
    logoUrl: "",
    icon192: "",
    icon512: ""
  };

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    const settingsDoc = await getDoc(doc(db, "settings", "general"));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      settings = { ...settings, ...data };
    }
  } catch (e) {
    console.error("Error fetching dynamic manifest:", e);
  }

  // استخدام أيقونات التطبيق المستقلة المرفوعة من الإدارة، أو اللوجو كبديل
  const appIcon192 = settings.icon192 || settings.logoUrl || "https://placehold.co/192x192?text=F";
  const appIcon512 = settings.icon512 || settings.logoUrl || "https://placehold.co/512x512?text=F";

  const manifest = {
    name: settings.siteTitle,
    short_name: settings.siteTitle,
    description: "أول منصة عربية لخدمات الشرح الفوري والمباشر",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: settings.primaryColor,
    icons: [
      {
        src: appIcon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: appIcon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };

  return NextResponse.json(manifest);
}
