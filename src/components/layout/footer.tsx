
"use client";

import Link from "next/link";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { 
  ShieldCheck, 
  Info, 
  FileText, 
  HelpCircle, 
  Briefcase, 
  BookOpen, 
  Facebook, 
  Youtube, 
  Send, 
  MessageSquare,
  Globe,
  RefreshCcw,
  Phone,
  Instagram,
  Twitter,
  Linkedin
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Facebook,
  Youtube,
  Send,
  MessageSquare,
  Instagram,
  Twitter,
  Linkedin,
  Globe
};

export function Footer() {
  const firestore = useFirestore();
  const settingsRef = useMemoFirebase(() => (firestore) ? doc(firestore, "settings", "general") : null, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const socialLinks = settings?.socialLinks || [
    { id: '1', label: 'فيسبوك', url: '#', icon: 'Facebook', color: '#FFFFFF' },
    { id: '2', label: 'يوتيوب', url: '#', icon: 'Youtube', color: '#FFFFFF' },
    { id: '3', label: 'تليجرام', url: '#', icon: 'Send', color: '#FFFFFF' }
  ];

  return (
    <footer className="bg-accent text-white mt-auto py-16" dir="rtl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 text-right">
          <div className="space-y-6">
            <h4 className="font-black text-xl text-white">عن المنصة</h4>
            <ul className="space-y-4">
              <FooterLink href="/about" icon={Info} label="عن فهمت" />
              <FooterLink href="/guide" icon={BookOpen} label="الدليل الإرشادي" />
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-black text-xl text-white">(الشروط والسياسات)</h4>
            <ul className="space-y-4">
              <FooterLink href="/terms" icon={FileText} label="شروط الاستخدام" />
              <FooterLink href="/privacy-policy" icon={ShieldCheck} label="سياسة الخصوصية" />
              <FooterLink href="/refund-policy" icon={RefreshCcw} label="سياسة الاسترجاع" />
              <FooterLink href="/guarantees" icon={ShieldCheck} label="ضمان الحقوق" />
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-black text-xl text-white">المساعدة</h4>
            <ul className="space-y-4">
              <FooterLink href="/contact-us" icon={Phone} label="اتصل بنا" />
              <FooterLink href="/support" icon={HelpCircle} label="الأسئلة الشائعة" />
              <FooterLink href="/jobs" icon={Briefcase} label="الوظائف" />
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-black text-xl text-white">تابعنا</h4>
            <div className="flex flex-wrap gap-4">
              {socialLinks.map((link: any) => {
                const Icon = ICON_MAP[link.icon] || Globe;
                return (
                  <a 
                    key={link.id} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white/10 rounded-xl transition-all hover:scale-110 hover:bg-white/20 hover:shadow-lg text-white"
                    title={link.label}
                  >
                    <Icon size={24} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="pt-12 mt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-white/80 text-sm font-black">جميع الحقوق محفوظة © منصة فهمت 2026</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, icon: Icon, label }: any) {
  return (
    <li>
      <Link 
        href={href} 
        className="text-white/90 hover:text-white font-bold text-md flex items-center gap-3 transition-colors group"
      >
        <Icon size={18} className="text-white/70 group-hover:text-white transition-colors" />
        {label}
      </Link>
    </li>
  );
}
