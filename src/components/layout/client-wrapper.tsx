
"use client";

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from "firebase/firestore";
import { FloatingChat } from './floating-chat';
import { PWAInstallBanner } from './pwa-install-banner';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

interface ClientWrapperProps {
  children: React.ReactNode;
}

export function ClientWrapper({ children }: ClientWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // المنصة تعمل بالعربية فقط. تم إلغاء تبديل اللغة وترجمة Google من الواجهة.
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";

    // Auto-recover from stale Webpack chunks or ChunkLoadError after updates
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = 'reason' in event ? event.reason : event.error;
      const isChunkLoadError = 
        error?.name === 'ChunkLoadError' || 
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('ChunkLoadError');

      if (isChunkLoadError) {
        const lastReload = sessionStorage.getItem('chunk_reload_retry');
        const now = Date.now();
        // Prevent infinite loops: reload if not reloaded within 10 seconds
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('chunk_reload_retry', now.toString());
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => console.log('SW registration failed:', err));
      });
    }

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return (
    <FirebaseClientProvider>
      <ThemeManager>
        <SidebarProvider defaultOpen={false}>
          <div className="flex min-h-svh w-full bg-background flex-col relative overflow-x-hidden" dir="rtl">
            <Header />
            <div className="flex flex-1 w-full">
              {/* القائمة الجانبية تم استرجاعها هنا */}
              <AppSidebar />
              <main className="flex-1 w-full flex flex-col relative overflow-hidden">
                <div className="flex-1 max-w-[1920px] mx-auto w-full">
                  {children}
                </div>
                <Footer />
              </main>
            </div>
            {mounted && <PWAInstallBanner />}
            <FloatingChat />
            <Toaster />
          </div>
        </SidebarProvider>
      </ThemeManager>
    </FirebaseClientProvider>
  );
}

function ThemeManager({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings } = useDoc(settingsRef);

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      
      if (settings.primaryColor) {
        const hsl = hexToHsl(settings.primaryColor);
        if (hsl) root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }
      
      if (settings.accentColor) {
        const hsl = hexToHsl(settings.accentColor);
        if (hsl) root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }

      if (settings.backgroundColor) {
        const hsl = hexToHsl(settings.backgroundColor);
        if (hsl) root.style.setProperty('--background', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }

      if (settings.borderRadius) {
        root.style.setProperty('--radius', settings.borderRadius);
      }

      if (settings.logoUrl && typeof document !== 'undefined') {
        const updateFavicon = (url: string) => {
          if (!document.head) return;
          const cacheBuster = settings.updatedAt ? encodeURIComponent(settings.updatedAt) : Date.now();
          const finalUrl = url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}v=${cacheBuster}`;
          const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
          rels.forEach(rel => {
            const existingLinks = document.querySelectorAll(`link[rel*='${rel}']`);
            existingLinks.forEach(link => { (link as HTMLLinkElement).href = finalUrl; });
          });
        };
        updateFavicon(settings.logoUrl);
      }

      if (settings.siteTitle) {
        document.title = settings.siteTitle;
      }
    }
  }, [settings]);

  return <>{children}</>;
}

function hexToHsl(hex: string) {
  if (!hex) return null;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else return null;

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) h = s = 0;
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
