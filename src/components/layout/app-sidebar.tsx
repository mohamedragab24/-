
"use client";

import { useState } from "react";
import {
  Wallet,
  ClipboardList,
  Settings,
  LogOut,
  Users,
  Briefcase,
  HelpCircle,
  Zap,
  Search,
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  ShieldCheck,
  Info,
  FileText,
  History,
  Layout,
  PlusCircle,
  User as UserIcon,
  RefreshCcw,
  Layers,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, auth } = useFirebase();
  const { setOpen, setOpenMobile } = useSidebar();
  const firestore = useFirestore();
  const [isTogglingRole, setIsTogglingRole] = useState(false);

  const userRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(userRef);

  const handleLinkClick = () => { 
    setOpen(false); 
    setOpenMobile(false); 
  };

  const handleLogout = async () => { 
    handleLinkClick(); 
    await signOut(auth); 
    router.push("/login"); 
  };

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com" || user?.email === "mohamedmini2006@gamil.com";
  const isAdmin = profile?.isAdmin || isMasterAdmin;
  const isMufhem = profile?.role === "mufhem";

  const handleToggleRole = async () => {
    if (!userRef) return;
    const targetRole = isMufhem ? "mustafhem" : "mufhem";
    setIsTogglingRole(true);
    try {
      await updateDoc(userRef, { role: targetRole });
      toast({
        title: targetRole === "mufhem" ? "تم التحويل إلى وضع المُفهم" : "تم التحويل إلى وضع المُستفهم",
        description: targetRole === "mufhem" 
          ? "أنت الآن في وضع المُفهم (شرح وتدريس، تقديم عروض، رفع كورسات)." 
          : "أنت الآن في وضع المُستفهم (طرح أسئلة واستفهامات، شراء كورسات، طلب حصص)."
      });
    } catch (err) {
      console.error("Failed to toggle role:", err);
      toast({
        title: "خطأ في التبديل",
        description: "تعذر تحديث رتبة الحساب حالياً، حاول مجدداً.",
        variant: "destructive"
      });
    } finally {
      setIsTogglingRole(false);
    }
  };

  const NavItem = ({ href, icon: Icon, label }: any) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname === href} onClick={handleLinkClick}>
        <Link href={href} className="text-right flex-row-reverse justify-end font-bold gap-3">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <span className="flex-1 truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l shadow-xl bg-white">
      <SidebarHeader className="p-6 shrink-0 text-right">
        <Link href="/" onClick={handleLinkClick} className="flex items-center justify-end gap-3 group cursor-pointer">
          <span className="font-black text-xl text-primary group-hover:opacity-80 transition-opacity">فهمت</span>
          <div className="w-8 h-8 bg-primary rounded-lg group-hover:scale-105 transition-transform"></div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-2 overflow-y-auto no-scrollbar">
        {user ? (
          <>
            {/* بطاقة وزر التبديل بين مُفهم ومُستفهم */}
            <div className="mb-4 mx-1 p-3.5 rounded-2xl bg-gradient-to-b from-zinc-50 to-zinc-100/90 border border-zinc-200/90 shadow-sm space-y-2.5 text-right">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-500">الرتبة الحالية:</span>
                <Badge className={`font-black text-xs px-2.5 py-0.5 rounded-lg border-none ${
                  isMufhem 
                    ? "bg-primary text-white shadow-sm" 
                    : "bg-zinc-800 text-white shadow-sm"
                }`}>
                  {isMufhem ? "مُفهم" : "مُستفهم"}
                </Badge>
              </div>

              <Button
                type="button"
                onClick={handleToggleRole}
                disabled={isTogglingRole}
                variant="outline"
                className="w-full h-10 rounded-xl font-black text-xs gap-2 border-primary/30 bg-white hover:bg-primary/10 text-primary transition-all shadow-sm flex items-center justify-center cursor-pointer"
              >
                {isTogglingRole ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <ArrowLeftRight className="w-4 h-4 text-primary" />
                )}
                <span>
                  {isMufhem ? "التبديل إلى مُستفهم" : "التبديل إلى مُفهم"}
                </span>
              </Button>
            </div>

            <SidebarMenu className="space-y-1">
            {/* الأقسام الأساسية للمسجل */}
            <NavItem href="/offers" icon={Zap} label="عروضي" />
            <NavItem href="/requests" icon={ClipboardList} label="استفهاماتي" />
            <NavItem href="/sessions" icon={History} label="جلساتي" />
            
            <SidebarSeparator className="my-4" />
            
            <NavItem href="/courses" icon={Layers} label="الكورسات" />
            <NavItem href="/teachers" icon={Users} label="تصفح المفهمين" />
            <NavItem href="/portfolio" icon={Layout} label="تصفح أعمال المفهمين" />
            <NavItem href="/browse" icon={Search} label="تصفح الاستفهامات" />
            
            <SidebarSeparator className="my-4" />

            {/* الإعدادات */}
            <Collapsible className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="text-right flex-row-reverse justify-end font-bold gap-3">
                    <Settings className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">الإعدادات</span>
                    <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-8 pr-4 border-r-2 border-primary/10 space-y-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/profile" className="font-bold text-xs py-2">الملف الشخصي</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/wallet" className="font-bold text-xs py-2">محفظتي</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/portfolio/manage" className="font-bold text-xs py-2">معرض أعمالي</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* مركز المساعدة */}
            <Collapsible className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="text-right flex-row-reverse justify-end font-bold gap-3">
                    <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">مركز المساعدة</span>
                    <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-8 pr-4 border-r-2 border-primary/10 space-y-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/guide" className="font-bold text-xs py-2">الدليل الإرشادي</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/support" className="font-bold text-xs py-2">الأسئلة الشائعة</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/contact-us" className="font-bold text-xs py-2">الدعم الفني</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* المزيد */}
            <Collapsible className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="text-right flex-row-reverse justify-end font-bold gap-3">
                    <PlusCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">المزيد</span>
                    <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-8 pr-4 border-r-2 border-primary/10 space-y-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/about" className="font-bold text-xs py-2">عن فهمت</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/guarantees" className="font-bold text-xs py-2">ضمان الحقوق</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/terms" className="font-bold text-xs py-2">شروط الاستخدام</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/privacy-policy" className="font-bold text-xs py-2">سياسة الخصوصية</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/refund-policy" className="font-bold text-xs py-2">سياسة الاسترجاع</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild onClick={handleLinkClick}>
                        <Link href="/jobs" className="font-bold text-xs py-2">الوظائف</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {isAdmin && (
              <>
                <SidebarSeparator className="my-4" />
                <NavItem href="/admin" icon={LayoutDashboard} label="لوحة المسؤول" />
              </>
            )}
          </SidebarMenu>
        </>
        ) : (
          /* حالة عدم تسجيل الدخول */
          <SidebarMenu className="space-y-1">
            <NavItem href="/courses" icon={Layers} label="كورسات جاهزة" />
            <NavItem href="/teachers" icon={Users} label="تصفح المفهمين" />
            <NavItem href="/portfolio" icon={Layout} label="تصفح أعمال المفهمين" />
            <NavItem href="/browse" icon={Search} label="تصفح الاستفهامات" />
            
            <SidebarSeparator className="my-4" />

            <Collapsible className="group/collapsible" defaultOpen>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="text-right flex-row-reverse justify-end font-bold gap-3">
                    <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">مركز المساعدة</span>
                    <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-8 pr-4 border-r-2 border-primary/10 space-y-1">
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/guide" className="font-bold text-xs py-2">الدليل الإرشادي</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/support" className="font-bold text-xs py-2">الأسئلة الشائعة</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/contact-us" className="font-bold text-xs py-2">الدعم الفني</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="text-right flex-row-reverse justify-end font-bold gap-3">
                    <PlusCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">المزيد</span>
                    <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-8 pr-4 border-r-2 border-primary/10 space-y-1">
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/about" className="font-bold text-xs py-2">عن فهمت</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/guarantees" className="font-bold text-xs py-2">ضمان الحقوق</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/terms" className="font-bold text-xs py-2">شروط الاستخدام</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/privacy-policy" className="font-bold text-xs py-2">سياسة الخصوصية</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/refund-policy" className="font-bold text-xs py-2">سياسة الاسترجاع</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton asChild onClick={handleLinkClick}><Link href="/jobs" className="font-bold text-xs py-2">الوظائف</Link></SidebarMenuSubButton></SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        )}
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t bg-zinc-50">
        {user ? (
          <SidebarMenuButton onClick={handleLogout} className="h-12 rounded-xl text-red-600 font-black flex-row-reverse justify-end gap-3">
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1">خروج</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton asChild onClick={handleLinkClick}>
            <Link href="/login" className="h-12 rounded-xl bg-primary text-white font-black flex items-center justify-center">
              <span>دخول / تسجيل</span>
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
