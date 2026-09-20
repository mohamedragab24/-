
"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Layout, Search, Menu, User, Zap, MessageSquare, Bell, ShieldCheck, Layers } from "lucide-react";
import { useFirestore, useDoc, useMemoFirebase, useFirebase, useUser, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    setMounted(true);
  }, []);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings } = useDoc(settingsRef);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: profile } = useDoc(userRef);

  const unreadChatsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "direct_chats"),
      where("participants", "array-contains", user.uid),
      where("hasUnread", "==", true)
    );
  }, [firestore, user]);
  const { data: unreadChats } = useCollection(unreadChatsQuery);
  const unreadMessagesCount = unreadChats?.filter(c => c.lastSenderId !== user?.uid).length || 0;

  const unreadNotifsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
  }, [firestore, user]);
  const { data: unreadNotifs } = useCollection(unreadNotifsQuery);

  const isExcludedPath = pathname === "/" || pathname === "/login" || pathname === "/forgot-password" || pathname === "/signup";
  const shouldHideGlobalHeader = isExcludedPath && !user;

  const miniLogo = settings?.miniIconUrl || settings?.logoUrl || PlaceHolderImages.find(img => img.id === 'logo-official')?.imageUrl;

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur shadow-sm overflow-hidden shrink-0 transition-all duration-300 h-16 md:h-20",
      shouldHideGlobalHeader && "hidden"
    )}>
      {mounted && !shouldHideGlobalHeader && (
        <div className="flex h-full items-center justify-between px-4 md:px-8 max-w-[1920px] mx-auto gap-4">
          
          <div className="flex items-center gap-4 shrink-0">
            {/* زر فتح القائمة الجانبية */}
            <SidebarTrigger className="text-zinc-600 hover:text-primary transition-colors" />
            
            <Link href="/" className="flex items-center group shrink-0">
              <div className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 bg-transparent">
                <img src={miniLogo} className="w-full h-full object-contain" alt="Logo" />
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1 md:gap-4 shrink-0">
            <nav className="hidden md:flex items-center gap-2 pl-4 border-l border-zinc-100">
              <HeaderNavLink href="/courses" icon={Layers} label="الكورسات" />
              <HeaderNavLink href="/teachers" icon={GraduationCap} label="المُفهمين" />
              <HeaderNavLink href="/portfolio" icon={Layout} label="أعمال المفهمين" />
              <HeaderNavLink href="/browse" icon={Search} label="الاستفهامات" />
            </nav>

            <div className="flex items-center gap-1 md:gap-2">
              {user && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative h-10 w-10 rounded-xl hover:bg-primary/5"
                    onClick={() => router.push('/messages')}
                  >
                    <MessageSquare className="h-5 w-5 text-zinc-600" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white shadow-lg animate-bounce">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative h-10 w-10 rounded-xl hover:bg-primary/5"
                    onClick={() => router.push('/notifications')}
                  >
                    <Bell className="h-5 w-5 text-zinc-600" />
                    {unreadNotifs && unreadNotifs.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white shadow-lg">
                        {unreadNotifs.length}
                      </span>
                    )}
                  </Button>
                </>
              )}

              <div className="flex items-center gap-2 mr-2">
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-10 w-10 md:h-14 md:w-14 rounded-2xl p-0 border-2 border-primary/20 transition-all shadow-md group">
                        <Avatar className="h-full w-full">
                          <AvatarImage src={profile?.profilePictureUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-lg">{profile?.fullName?.charAt(0) || "ف"}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-4 rounded-[2rem] shadow-2xl border-2" dir="rtl">
                      <div className="flex flex-col items-center gap-3 py-4 text-right">
                        <p className="font-black text-lg flex items-center gap-1">
                          {profile?.fullName}
                          {profile?.isVerified && <ShieldCheck size={16} className="text-blue-500" />}
                        </p>
                        <Badge className="mt-2">{profile?.role === 'mufhem' ? 'مُفهم' : 'مُستفهم'}</Badge>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/profile')} className="p-3 rounded-xl font-bold cursor-pointer">الملف الشخصي</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/wallet')} className="p-3 rounded-xl font-bold cursor-pointer">المحفظة</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/notifications')} className="p-3 rounded-xl font-bold cursor-pointer">الإشعارات</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {profile?.isAdmin && <DropdownMenuItem onClick={() => router.push('/admin')} className="p-3 rounded-xl font-bold cursor-pointer text-red-600">لوحة المسؤول</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button onClick={() => router.push('/login')} className="h-10 md:h-12 px-6 md:px-8 bg-primary text-white font-black rounded-xl md:rounded-2xl text-md md:text-lg shadow-lg">دخول</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function HeaderNavLink({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-black text-sm whitespace-nowrap group shrink-0",
        isActive ? "text-primary bg-primary/5" : "text-zinc-600 hover:text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="md:inline">{label}</span>
    </Link>
  );
}
