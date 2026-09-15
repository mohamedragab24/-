"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc, orderBy } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Layout, PlayCircle, Plus, Filter, Check, ChevronRight, Zap, Layers, Activity, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function GlobalPortfolioPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedMain, setSelectedMain] = useState("all");
  const [selectedSub, setSelectedSub] = useState("all");
  const [selectedOpt, setSelectedOpt] = useState("all");

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: currentUserProfile } = useDoc(userRef);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "categories"), orderBy("name", "asc"));
  }, [firestore]);
  const { data: allCats } = useCollection(categoriesQuery);

  const mainCategories = useMemo(() => allCats?.filter(c => c.type === 'main' || !c.type) || [], [allCats]);
  const subCategories = useMemo(() => {
    if (selectedMain === "all") return [];
    const parent = mainCategories.find(c => c.name === selectedMain);
    return allCats?.filter(c => c.type === 'sub' && c.parentId === parent?.id) || [];
  }, [allCats, selectedMain, mainCategories]);
  const optCategories = useMemo(() => {
    if (selectedSub === "all") return [];
    const parent = subCategories.find(c => c.name === selectedSub);
    return allCats?.filter(c => c.type === 'option' && c.parentId === parent?.id) || [];
  }, [allCats, selectedSub, subCategories]);

  const portfolioQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "portfolio"), 
      where("status", "==", "approved")
    );
  }, [firestore]);

  const { data: rawPortfolioItems, isLoading: isPortfolioLoading } = useCollection(portfolioQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"));
  }, [firestore]);

  const { data: allUsers } = useCollection(usersQuery);

  const filteredItems = useMemo(() => {
    if (!rawPortfolioItems) return [];
    
    return rawPortfolioItems
      .filter(item => {
        const teacher = allUsers?.find(u => u.id === item.mufhemId);
        const matchesSearch = !searchTerm.trim() || (
          item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesMain = selectedMain === "all" || item.category === selectedMain;
        const matchesSub = selectedSub === "all" || item.categorySub === selectedSub;
        const matchesOpt = selectedOpt === "all" || item.categoryOpt === selectedOpt;
        return matchesSearch && matchesMain && matchesSub && matchesOpt;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawPortfolioItems, allUsers, searchTerm, selectedMain, selectedSub, selectedOpt]);

  return (
    <div className="p-6 md:p-10 space-y-10 bg-[#f8f9fa] min-h-screen pb-24" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8 max-w-7xl mx-auto">
        <div className="space-y-2 text-right w-full md:w-auto border-r-8 border-primary pr-6">
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 flex items-center gap-3">
            <Layout className="text-primary" /> {settings?.portfolioListTitle || "أعمال المفهمين"}
          </h1>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {currentUserProfile?.role === 'mufhem' && (
            <Button 
              onClick={() => router.push('/portfolio/add')} 
              className="h-14 px-8 rounded-2xl font-black text-lg bg-accent hover:bg-accent/90 shadow-lg"
            >
              <Plus className="ml-2" /> أضف عملك الآن
            </Button>
          )}
          <div className="relative w-full md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input 
              placeholder="(ابحث بعنوان العمل)" 
              className="h-14 pr-12 rounded-2xl border-none shadow-md bg-white focus:ring-2 focus:ring-primary/20 text-lg text-right"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 bg-white p-6 rounded-[2.5rem] shadow-sm border">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-widest px-2">
            <Filter size={12} /> الأقسام الرئيسية
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill label="الكل" active={selectedMain === "all"} onClick={() => { setSelectedMain("all"); setSelectedSub("all"); setSelectedOpt("all"); }} />
            {mainCategories.map((cat) => (
              <FilterPill key={cat.id} label={cat.name} active={selectedMain === cat.name} onClick={() => { setSelectedMain(cat.name); setSelectedSub("all"); setSelectedOpt("all"); }} />
            ))}
            <FilterPill label="أخرى" active={selectedMain === "أخرى"} onClick={() => { setSelectedMain("أخرى"); setSelectedSub("all"); setSelectedOpt("all"); }} />
          </div>
        </div>

        {selectedMain !== "all" && (
          <div className="flex flex-col space-y-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-widest px-2">
              <ChevronRight size={12} className="rotate-180" /> التخصصات
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill label="الكل" active={selectedSub === "all"} onClick={() => { setSelectedSub("all"); setSelectedOpt("all"); }} />
              {subCategories.map((cat) => (
                <FilterPill key={cat.id} label={cat.name} active={selectedSub === cat.name} onClick={() => { setSelectedSub(cat.name); setSelectedOpt("all"); }} />
              ))}
              <FilterPill label="أخرى" active={selectedSub === "أخرى"} onClick={() => { setSelectedSub("أخرى"); setSelectedOpt("all"); }} />
            </div>
          </div>
        )}

        {selectedSub !== "all" && (
          <div className="flex flex-col space-y-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-widest px-2">
              <Activity size={12} /> المهارات
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill label="الكل" active={selectedOpt === "all"} onClick={() => setSelectedOpt("all")} />
              {optCategories.map((cat) => (
                <FilterPill key={cat.id} label={cat.name} active={selectedOpt === cat.name} onClick={() => setSelectedOpt(cat.name)} />
              ))}
              <FilterPill label="أخرى" active={selectedOpt === "أخرى"} onClick={() => setSelectedOpt("أخرى")} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">
        {isPortfolioLoading ? (
          <div className="col-span-full py-20 text-center animate-pulse font-black text-2xl opacity-20">جاري تحميل المعرض...</div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const teacher = allUsers?.find(u => u.id === item.mufhemId);
            return (
              <div 
                key={item.id} 
                className="group space-y-5 cursor-pointer" 
                onClick={() => router.push(`/portfolio/${item.id}`)}
              >
                <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden shadow-xl bg-zinc-200 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl">
                  {item.mediaType === 'video' ? (
                    <div className="relative w-full h-full">
                      <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                        <PlayCircle className="text-white h-16 w-16 drop-shadow-2xl opacity-80 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                  ) : (
                    <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  )}
                  
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <Badge className="bg-[#FFC107] text-zinc-900 font-black border-none px-4 py-1.5 rounded-lg text-xs shadow-md">مميز</Badge>
                    {item.category && <Badge className="bg-primary text-white font-black border-none px-4 py-1.5 rounded-lg text-xs shadow-md">{item.category}</Badge>}
                  </div>

                  <div className="absolute bottom-4 right-4">
                    <Avatar className="h-16 w-16 border-[6px] border-white shadow-2xl transition-transform group-hover:scale-110">
                      <AvatarImage src={teacher?.profilePictureUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">{teacher?.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                
                <div className="px-4 space-y-2 text-right">
                  <h3 className="font-black text-xl text-zinc-800 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex flex-col">
                    <p className="text-sm text-zinc-400 font-bold flex items-center gap-1">
                      {teacher?.fullName}
                      {teacher?.isVerified && <ShieldCheck size={14} className="text-blue-500" />}
                    </p>
                    <p className="text-xs text-zinc-300 font-bold mt-1">{item.categorySub || item.category || "خبير تعليمي"}</p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-zinc-100 shadow-inner">
            <Layout size={64} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-2xl font-black text-zinc-300">لا توجد أعمال مطابقة.</p>
            <Button variant="ghost" onClick={() => { setSelectedMain("all"); setSelectedSub("all"); setSelectedOpt("all"); }} className="font-bold text-primary">عرض الكل</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2.5 rounded-xl text-xs font-black transition-all border-2",
        active 
          ? "bg-primary border-primary text-white shadow-md scale-105" 
          : "bg-white border-zinc-100 text-zinc-500 hover:border-primary/30"
      )}
    >
      {active && <Check size={12} className="inline-block ml-1.5" />}
      {label}
    </button>
  );
}
