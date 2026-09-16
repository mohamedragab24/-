"use client";

import React, { useEffect, useState } from "react";
import { Globe, Check, RotateCcw, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: "ar", name: "Arabic", nativeName: "العربية (الأصل)", flag: "🇪🇬" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "zh-CN", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
];

export function GoogleTranslate() {
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>("ar");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Read current cookie
    const getGoogTransLang = () => {
      const match = document.cookie.match(/googtrans=\/([^/]+)\/([^;]+)/);
      if (match && match[2]) {
        return match[2];
      }
      return "ar";
    };

    setCurrentLang(getGoogTransLang());

    // Initialize Google Translate
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "ar",
            includedLanguages: "ar,en,fr,de,es,tr,ru,zh-CN,ur,it,ja,ko,hi,fa,id,pt",
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          "google_translate_element"
        );
      }
    };

    // Check if script already injected
    const existingScript = document.getElementById("google-translate-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate) {
      window.googleTranslateElementInit();
    }
  }, []);

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode);

    // If Arabic, reset translation cookies
    if (langCode === "ar") {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
      setIsOpen(false);
      window.location.reload();
      return;
    }

    // Set Google translate cookie
    const cookieValue = `/ar/${langCode}`;
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname};`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=.${window.location.hostname};`;

    // Also trigger the combo box if available in DOM
    const select = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event("change"));
    } else {
      // Reload if combo box is not yet in DOM
      window.location.reload();
    }

    setIsOpen(false);
  };

  if (!mounted) return null;

  const activeLangObj = POPULAR_LANGUAGES.find((l) => l.code === currentLang);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 md:h-12 px-3 md:px-3.5 rounded-2xl border-2 transition-all shadow-sm flex items-center gap-2 font-black text-xs cursor-pointer",
            currentLang !== "ar"
              ? "border-blue-500 bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 shadow-blue-500/10"
              : "border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-zinc-700 dark:text-zinc-200"
          )}
          title="ترجمة جوجل الفورية"
        >
          {/* Google Translate Styled Icon */}
          <div className="flex items-center justify-center w-5 h-5 rounded-md overflow-hidden bg-white shadow-xs border border-zinc-200/80 shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
              <path
                d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
                fill="#4285F4"
              />
            </svg>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <span className="hidden sm:inline">ترجمة جوجل</span>
            {currentLang !== "ar" && activeLangObj ? (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-mono uppercase tracking-wider font-black">
                {activeLangObj.flag} {activeLangObj.code}
              </span>
            ) : null}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-4 rounded-3xl shadow-2xl border-2 bg-white dark:bg-zinc-900 z-50 text-right"
        dir="rtl"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3 border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>ترجمة جوجل</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                    Google Translate
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 font-medium">ترجمة فورية للمنصة بالكامل</p>
              </div>
            </div>

            {currentLang !== "ar" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => changeLanguage("ar")}
                className="h-8 px-2 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-50 gap-1 cursor-pointer"
                title="الرجوع للغة العربية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>الأصل</span>
              </Button>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-zinc-500 px-1 block">لغات سريعة:</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {POPULAR_LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => changeLanguage(lang.code)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all border text-right cursor-pointer",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                    )}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-sm shrink-0">{lang.flag}</span>
                      <span className="truncate">{lang.nativeName}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Languages via official Google Translate dropdown */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <label className="text-[11px] font-black text-zinc-500 px-1 block">
              كل اللغات (أكثر من 100 لغة):
            </label>
            <div
              id="google_translate_element"
              className="w-full flex justify-center py-1 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
