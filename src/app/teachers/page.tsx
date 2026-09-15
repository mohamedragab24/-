
"use client";

import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, query, where, doc, setDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Search, MapPin, User, Briefcase, PlayCircle, Send, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function TeachersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const teachersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("role", "==", "mufhem"), where("isProfileApproved", "==", true));
  }, [firestore]);

  const { data: teachers, isLoading } = useCollection(teachersQuery);

  const portfolioQuery = useMemoFirebase(() => {
    if (!firestore || !selectedTeacher?.id) return null;
    return query(
      collection(firestore, "portfolio"), 
      where("mufhemId", "==", selectedTeacher.id),
      where("status", "==", "approved")
    );
  }, [firestore, selectedTeacher?.id]);

  const { data: rawPortfolio } = useCollection(portfolioQuery);
  const teacherPortfolio = rawPortfolio 
    ? [...rawPortfolio].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 
    : [];

  const completedProjectsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedTeacher?.id) return null;
    return query(
      collection(firestore, "istifhams"), 
      where("mufhemId", "==", selectedTeacher.id),
      where("status", "==", "completed")
    );
  }, [firestore, selectedTeacher?.id]);

  const { data: completedProjects } = useCollection(completedProjectsQuery);

  const filteredTeachers = teachers?.filter(t => 
    t.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartChat = async () => {
    if (!currentUser || !selectedTeacher) {
      toast({ title: "تنبيه", description: "يرجى تسجيل الدخول أولاً لبدء المحادثة." });
      router.push("/login");
      return;
    }

    if (currentUser.uid === selectedTeacher.id) {
      toast({ variant: "destructive", title: "تنبيه", description: "لا يمكنك بدء محادثة مع نفسك." });
      return;
    }

    setIsStartingChat(true);
    try {
      const chatId = [currentUser.uid, selectedTeacher.id].sort().join('_');
      const chatRef = doc(firestore!, "direct_chats", chatId);

      await setDoc(chatRef, {
        id: chatId,
        participants: [currentUser.uid, selectedTeacher.id],
        studentId: currentUser.uid,
        studentName: currentUser.displayName || "طالب",
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.fullName,
        teacherAvatar: selectedTeacher.profilePictureUrl || "",
        requestTitle: "استفسار مباشر",
        lastMessage: "بدأت محادثة مباشرة جديدة.",
        updatedAt: new Date().toISOString(),
        hasUnread: true,
        lastSenderId: currentUser.uid
      }, { merge: true });

      router.push(`/messages/${chatId}`);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل بدء المحادثة المباشرة." });
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-12 bg-zinc-50/50 min-h-screen" dir="rtl">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-zinc-800">
          {settings?.teachersListTitle || "نخبة 'المفهمين' الموثقين"}
        </h1>
        <div className="relative mt-8 max-w-xl mx-auto">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder={settings?.teachersListSearchPlaceholder || "(ابحث باسم المفهم)"} 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 bg-white focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="col-span-full py-20 text-center animate-pulse font-bold text-xl">جاري البحث عن المدرسين...</div>
        ) : filteredTeachers?.map((teacher) => (
          <Card key={teacher.id} className="rounded-xl overflow-hidden shadow-sm border-none flex flex-col items-center p-6 bg-white text-center hover:shadow-md transition-shadow">
            <div className="relative mb-4">
              <Avatar className="h-24 w-24 border-2 border-zinc-50 shadow-sm">
                <AvatarImage src={teacher.profilePictureUrl} />
                <AvatarFallback className="text-2xl font-black bg-zinc-100 text-zinc-400">{teacher.fullName?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            
            <div className="space-y-1 mb-4 flex flex-col items-center w-full">
              <div className="flex items-center gap-2 justify-center">
                <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-1">
                  {teacher.fullName}
                  {teacher.isVerified && <ShieldCheck className="h-4 w-4 text-blue-500" />}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-zinc-500 text-sm font-medium">
                <User size={14} className="opacity-70" />
                <span className="truncate max-w-[120px]">{teacher.specialization || "خبير تعليمي"}</span>
                <span className="mx-1 text-zinc-300">•</span>
                <MapPin size={14} className="opacity-70" />
                <span>مصر</span>
              </div>
            </div>

            <div className="flex gap-0.5 mb-6 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>

            <Button 
              onClick={() => setSelectedTeacher(teacher)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg h-11 transition-colors"
            >
              الملف الشخصي
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedTeacher} onOpenChange={() => setSelectedTeacher(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="sr-only">
            <DialogTitle>ملف المفهم: {selectedTeacher?.fullName}</DialogTitle>
            <DialogDescription>عرض النبذة التعريفية ومعرض أعمال الخبير التعليمي.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[90vh]">
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-6 p-6 bg-zinc-50 rounded-3xl">
                <Avatar className="h-28 w-28 border-4 border-white shadow-md">
                  <AvatarImage src={selectedTeacher?.profilePictureUrl} />
                  <AvatarFallback className="text-4xl">{selectedTeacher?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-right flex-1">
                  <h4 className="text-2xl font-black flex items-center gap-2">
                    {selectedTeacher?.fullName}
                    {selectedTeacher?.isVerified && <ShieldCheck className="h-6 w-6 text-blue-500" />}
                  </h4>
                  <Badge className="bg-primary/10 text-primary border-none mt-2 px-4 py-1 font-bold">
                    {selectedTeacher?.specialization || "خبير عام"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                  <Star className="text-yellow-500 mb-1" size={20} />
                  <p className="text-xs text-green-600 font-bold">التقييم العام</p>
                  <p className="text-2xl font-black text-green-700">5.0</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                  <Briefcase className="text-blue-500 mb-1" size={20} />
                  <p className="text-xs text-blue-600 font-bold">استفهامات أتمّها</p>
                  <p className="text-2xl font-black text-blue-700">{completedProjects?.length || 0}</p>
                </div>
                <div className="bg-zinc-100 p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                  {selectedTeacher?.isVerified ? <ShieldCheck className="text-blue-500 mb-1" size={20} /> : <User className="text-zinc-400 mb-1" size={20} />}
                  <p className="text-xs text-zinc-600 font-bold">الحالة</p>
                  <p className="text-lg font-black text-zinc-700">{selectedTeacher?.isVerified ? "موثق" : "نشط"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-xl font-black text-zinc-800 border-r-4 border-primary pr-3">النبذة التعريفية</h5>
                <div className="p-6 bg-zinc-50 rounded-2xl text-lg leading-relaxed text-zinc-600 italic">
                  "{selectedTeacher?.bio || "لم يقم هذا المفهم بإضافة نبذة تعريفية بعد."}"
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-zinc-400 px-2">
                  <span>انضم للمنصة: {selectedTeacher?.createdAt ? new Date(selectedTeacher.createdAt).toLocaleDateString('ar-EG', {month: 'long', year: 'numeric'}) : "جديد"}</span>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={handleStartChat} 
                  disabled={isStartingChat}
                  className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl gap-2 shadow-xl"
                >
                  {isStartingChat ? <Loader2 className="animate-spin" /> : <><Send size={24} className="rotate-180" /> استفهم مني الآن</>}
                </Button>
              </div>

              {teacherPortfolio && teacherPortfolio.length > 0 && (
                <div className="space-y-4">
                  <h5 className="text-xl font-black text-zinc-800 border-r-4 border-accent pr-3">معرض الأعمال</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {teacherPortfolio.map(item => (
                      <div key={item.id} className="aspect-square rounded-xl overflow-hidden border-2 shadow-sm group relative bg-black cursor-pointer" onClick={() => router.push(`/portfolio/${item.id}`)}>
                        {item.mediaType === 'video' ? (
                          <div className="w-full h-full relative">
                            <video src={item.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <PlayCircle className="text-white/80 h-10 w-10" />
                            </div>
                          </div>
                        ) : (
                          <img src={item.mediaUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Portfolio" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
