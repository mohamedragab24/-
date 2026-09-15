
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, UserCheck, ShieldAlert, BadgeCent, 
  Settings2, HelpCircle, Briefcase, Activity, Zap, 
  FileCheck, ShieldCheck, MessageSquare, Image as ImageIcon, 
  Layers, Filter, Palette, Share2, ClipboardList, Video, 
  History, Download, Ticket, CloudUpload, Bot, Bug, Lock, 
  Fingerprint, Scale, Archive, GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * تخطيط لوحة التحكم الإدارية - يوفر قائمة جانبية مخصصة للوصول السريع لـ 30+ صفحة.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navGroups = [
    {
      title: "عام والنظام",
      items: [
        { label: "الإحصائيات", href: "/admin", icon: LayoutDashboard },
        { label: "سجل الرقابة", href: "/admin/logs", icon: History },
        { label: "المزامنة vNext", href: "/admin/deployment", icon: CloudUpload },
        { label: "الذكاء الاصطناعي", href: "/admin/ai", icon: Bot },
      ]
    },
    {
      title: "إدارة المستخدمين",
      items: [
        { label: "المفهمين", href: "/admin/mufahems", icon: ShieldCheck },
        { label: "المستفهمين", href: "/admin/mustafhems", icon: Users },
        { label: "الحسابات وكلمات المرور", href: "/admin/accounts", icon: Lock },
        { label: "الرتب والصلاحيات", href: "/admin/roles", icon: ShieldAlert },
        { label: "توثيق الهوية", href: "/admin/verification", icon: Fingerprint },
        { label: "الحظر التلقائي", href: "/admin/auto-bans", icon: ShieldAlert },
        { label: "مركز الطعون", href: "/admin/appeals", icon: Scale },
      ]
    },
    {
      title: "الرقابة والاعتمادات",
      items: [
        { label: "مركز الاعتماد الموحد", href: "/admin/approvals", icon: FileCheck },
        { label: "الاستفهامات المعلقة", href: "/admin/pending-requests", icon: HelpCircle },
        { label: "كافة الاستفهامات", href: "/admin/all-requests", icon: ClipboardList },
        { label: "الطلبات المكتملة", href: "/admin/completed-orders", icon: CheckCircle2 },
        { label: "مراجعة المحاضرات", href: "/admin/sessions", icon: Video },
        { label: "مراجعة الكورسات", href: "/admin/course-reviews", icon: GraduationCap },
        { label: "المحادثات المباشرة", href: "/admin/direct-chats", icon: MessageSquare },
        { label: "مراجعة معرض الأعمال", href: "/admin/portfolio-approvals", icon: ImageIcon },
        { label: "إدارة المعرض", href: "/admin/portfolio-management", icon: Layers },
      ]
    },
    {
      title: "المالية والترويج",
      items: [
        { label: "إدارة المالية", href: "/admin/finance", icon: BadgeCent },
        { label: "الكوبونات", href: "/admin/coupons", icon: Ticket },
      ]
    },
    {
      title: "محرر الموقع",
      items: [
        { label: "المحرر الفائق و SEO", href: "/admin/manual-editor", icon: Zap },
        { label: "الأصول البصرية", href: "/admin/assets", icon: Palette },
        { label: "الأقسام والتخصصات", href: "/admin/categories", icon: Filter },
        { label: "أقسام المفهمين", href: "/admin/teacher-categories", icon: GraduationCap },
        { label: "التخصيص الأساسي", href: "/admin/customize", icon: Settings2 },
        { label: "روابط التواصل", href: "/admin/social-management", icon: Share2 },
      ]
    },
    {
      title: "الدعم والتوظيف",
      items: [
        { label: "تذاكر الدعم", href: "/admin/support", icon: HelpCircle },
        { label: "الشات العائم", href: "/admin/floating-chats", icon: MessageSquare },
        { label: "اختبار المراسلات", href: "/admin/comm-test", icon: Bug },
        { label: "إدارة التوظيف", href: "/admin/jobs", icon: Briefcase },
      ]
    }
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-zinc-50 overflow-hidden" dir="rtl">
      {/* Admin Side Navigation */}
      <aside className="w-72 bg-white border-l shadow-xl shrink-0 z-20 flex flex-col">
        <div className="p-6 border-b bg-zinc-900 text-white">
          <h2 className="text-xl font-black flex items-center gap-2">
            <Settings2 className="text-primary" /> لوحة المسؤول
          </h2>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-widest">Full Access Control</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-8">
            {navGroups.map((group, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4">{group.title}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-bold text-sm",
                        pathname === item.href 
                          ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                          : "text-zinc-600 hover:bg-zinc-100"
                      )}
                    >
                      <item.icon size={18} className={pathname === item.href ? "text-white" : "text-primary"} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-zinc-100/50">
        <div className="max-w-7xl mx-auto pb-24">
          {children}
        </div>
      </main>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
