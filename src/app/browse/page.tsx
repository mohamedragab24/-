
"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Clock, 
  User, 
  BadgeCent, 
  ArrowRight, 
  ClipboardList, 
  Zap, 
  Filter, 
  Check, 
  Calendar, 
  Layers,
  ChevronRight,
  Timer,
  Activity,
  ShieldCheck,
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function BrowseRequestsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedMain, setSelectedMain] = useState("all");
  const [selectedSub, setSelectedSub] = useState("all");
  const [selectedOpt, setSelectedOpt] = useState("all");

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "categories"), orderBy("name", "asc"));
  }, [firestore]);
  const { data: allCategories } = useCollection(categoriesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"));
  }, [firestore]);
  const { data: allUsers } = useCollection(usersQuery);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "istifhams"), where("status", "==", "active"), limit(100));
  }, [firestore]);

  const { data: rawRequests, isLoading } = useCollection(requestsQuery);

  const mainCategories = useMemo(() => allCategories?.filter(c => c.type === 'main' || !c.type) || [], [allCategories]);
  const subCategories = useMemo(() => {
    if (selectedMain === "all") return [];
    const parent = mainCategories.find(c => c.name === selectedMain);
    return allCategories?.filter(c => c.type === 'sub' && c.parentId === parent?.id) || [];
  }, [allCategories, selectedMain, mainCategories]);
  const optCategories = useMemo(() => {
    if (selectedSub === "all") return [];
    const parent = subCategories.find(c => c.name === selectedSub);
    return allCategories?.filter(c => c.type === 'option' && c.parentId === parent?.id) || [];
  }, [allCategories, selectedSub, subCategories]);

  const filteredRequests = useMemo(() => {
    if (!rawRequests) return [];
    return rawRequests.filter(r => {
      const matchesSearch = !searchTerm.trim() || (
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mustafhemName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesMain = selectedMain === "all" || r.category === selectedMain;
      const matchesSub = selectedSub === "all" || r.categorySub === selectedSub;
      const matchesOpt = selectedOpt === "all" || r.categoryOpt === selectedOpt;
      return matchesSearch && matchesMain && matchesSub && matchesOpt;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawRequests, searchTerm, selectedMain, selectedSub, selectedOpt]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline tracking-tight text-zinc-900">الاستفهامات المطروحة</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <Button 
            onClick={() => router.push('/create-request')} 
            className="h-14 px-8 rounded-2xl font-black text-lg bg-accent hover:bg-accent/90 shadow-lg order-2 md:order-none"
          >
            <Plus className="ml-2" /> طرح استفهام جديد
          </Button>
          <div className="relative w-full md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input 
              placeholder="(ابحث بعنوان الاستفهام)" 
              className="h-14 pr-12 rounded-2xl border-none shadow-md bg-white text-right font-bold text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-white p-8 rounded-[3rem] shadow-sm border-2 border-primary/5">
        <div className="space-y-2">
          <Label className="font-black text-[10px] text-zinc-400 uppercase tracking-widest px-2">الأقسام الرئيسية</Label>
          <div className="flex flex-wrap gap-2">
            <FilterPill label="الكل" active={selectedMain === "all"} onClick={() => { setSelectedMain("all"); setSelectedSub("all"); setSelectedOpt("all"); }} />
            {mainCategories.map((cat) => (
              <FilterPill key={cat.id} label={cat.name} active={selectedMain === cat.name} onClick={() => { setSelectedMain(cat.name); setSelectedSub("all"); setSelectedOpt("all"); }} />
            ))}
            <FilterPill label="أخرى" active={selectedMain === "أخرى"} onClick={() => { setSelectedMain("أخرى"); setSelectedSub("all"); setSelectedOpt("all"); }} />
          </div>
        </div>

        {selectedMain !== "all" && (
          <div className="space-y-2 pt-4 border-t border-dashed animate-in fade-in">
            <Label className="font-black text-[10px] text-zinc-400 uppercase tracking-widest px-2">التخصصات</Label>
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
          <div className="space-y-2 pt-4 border-t border-dashed animate-in fade-in">
            <Label className="font-black text-[10px] text-zinc-400 uppercase tracking-widest px-2">المهارات</Label>
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

      <div className="grid gap-6">
        {isLoading ? <div className="py-20 text-center font-black animate-pulse text-2xl text-zinc-300">جاري تحميل الاستفهامات...</div> : 
          filteredRequests.map((req) => (
            <IstifhamCard key={req.id} req={req} allUsers={allUsers} router={router} />
          ))
        }
        {!isLoading && filteredRequests.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-zinc-100 flex flex-col items-center gap-6">
            <Layers size={64} className="text-zinc-200" />
            <p className="text-2xl font-black text-zinc-300">لا توجد استفهامات تطابق هذه الفلاتر حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("px-5 py-2.5 rounded-xl text-xs font-black transition-all border-2", active ? "bg-primary border-primary text-white shadow-md" : "bg-white border-zinc-100 text-zinc-500 hover:border-primary/20")}>
      {active && <Check size={12} className="inline-block ml-1.5" />}
      {label}
    </button>
  );
}

function IstifhamCard({ req, allUsers, router }: any) {
  const requester = allUsers?.find((u: any) => u.id === req.mustafhemId);
  const defaultMaleAvatar = "https://picsum.photos/seed/male/200/200";
  const defaultFemaleAvatar = "https://picsum.photos/seed/female/200/200";
  const avatar = requester?.profilePictureUrl || (requester?.gender === 'female' ? defaultFemaleAvatar : defaultMaleAvatar);

  return (
    <Card 
      onClick={() => router.push(`/requests/${req.id}`)} 
      className="rounded-[3rem] border-2 hover:border-primary/20 transition-all cursor-pointer group bg-white shadow-lg overflow-hidden flex flex-col md:flex-row"
    >
      <div className="md:w-64 bg-zinc-50/50 p-8 flex flex-col items-center justify-center text-center border-l shrink-0">
        <Avatar className="h-24 w-24 border-4 border-white shadow-xl mb-4 group-hover:scale-105 transition-transform">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl">{req.mustafhemName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 text-center">
          <p className="font-black text-xl text-zinc-900 leading-tight flex items-center justify-center gap-1">
            {req.mustafhemName}
            {requester?.isVerified && <ShieldCheck size={16} className="text-blue-500" />}
          </p>
          <p className="text-[10px] text-zinc-400 font-bold">{requester?.specialization || "مستفهم طموح"}</p>
        </div>
      </div>

      <div className="flex-1 p-8 md:p-10 flex flex-col space-y-6">
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-black text-zinc-400 border-b border-dashed pb-6">
          <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-xl flex items-center gap-1.5"><BadgeCent size={14} /> {req.amount} ج.م</span>
          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl flex items-center gap-1.5"><Calendar size={14} /> {new Date(req.meetingTime).toLocaleString('ar-EG')}</span>
          <span className="bg-zinc-100 text-zinc-600 px-4 py-1.5 rounded-xl flex items-center gap-1.5"><Layers size={14} /> {req.category}</span>
          <span className="bg-zinc-100 text-zinc-600 px-4 py-1.5 rounded-xl flex items-center gap-1.5"><ClipboardList size={14} /> {req.offersCount || 0} عرض</span>
          <span className="flex items-center gap-1.5"><Clock size={14} /> منذ {getTimeAgo(req.createdAt)}</span>
          <Badge className="mr-auto bg-primary/10 text-primary border-none px-4 py-1.5 rounded-lg font-black">{req.status === 'active' ? 'مفتوح' : req.status === 'completed' ? 'منتهي' : 'ملغي'}</Badge>
        </div>

        <div className="space-y-3 text-right">
          <h3 className="text-2xl md:text-3xl font-black text-zinc-800 group-hover:text-primary transition-colors leading-tight">{req.title}</h3>
          <p className="text-zinc-500 font-medium line-clamp-2 text-lg leading-relaxed">{req.description}</p>
        </div>
      </div>
    </Card>
  );
}

function getTimeAgo(dateStr: string) {
  if (!dateStr) return "لحظات";
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) return `${minutes}د`;
  if (hours < 24) return `${hours}س`;
  return `${days}ي`;
}
