
"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useMemoFirebase, useUser } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { 
  Star, 
  Clock, 
  ChevronRight, 
  PlayCircle, 
  User, 
  Send, 
  Layers,
  Zap,
  FileText,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function PortfolioItemDetails() {
  const { id } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [isStartingChat, setIsStartingChat] = useState(false);

  const workRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "portfolio", id as string);
  }, [firestore, id]);

  const { data: work, isLoading: isWorkLoading } = useDoc(workRef);

  const teacherRef = useMemoFirebase(() => {
    if (!firestore || !work?.mufhemId) return null;
    return doc(firestore, "users", work.mufhemId);
  }, [firestore, work?.mufhemId]);

  const { data: teacher } = useDoc(teacherRef);

  const handleStartChat = async () => {
    if (!currentUser) {
      toast({ title: "تنبيه", description: "يرجى تسجيل الدخول أولاً لبدء المحادثة." });
      router.push("/login");
      return;
    }

    if (currentUser.uid === work?.mufhemId) {
      toast({ variant: "destructive", title: "تنبيه", description: "لا يمكنك بدء محادثة مع نفسك." });
      return;
    }

    setIsStartingChat(true);
    try {
      // إنشاء معرف فريد للمحادثة بين الطرفين
      const chatId = [currentUser.uid, work?.mufhemId].sort().join('_');
      const chatRef = doc(firestore!, "direct_chats", chatId);

      await setDoc(chatRef, {
        id: chatId,
        participants: [currentUser.uid, work?.mufhemId],
        studentId: currentUser.uid,
        studentName: currentUser.displayName || "طالب",
        teacherId: work?.mufhemId,
        teacherName: teacher?.fullName || "مفهم",
        teacherAvatar: teacher?.profilePictureUrl || "",
        requestTitle: work?.title,
        requestId: id,
        lastMessage: "بدأت محادثة مباشرة بخصوص: " + work?.title,
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

  if (isWorkLoading) return <div className="p-20 text-center font-black animate-pulse text-2xl">جاري تحميل العمل...</div>;
  if (!work) return <div className="p-20 text-center font-bold text-red-500">العمل غير متاح.</div>;

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-24 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 pt-10">
        <Button variant="ghost" onClick={() => router.push('/portfolio')} className="mb-8 font-black text-zinc-500 gap-2">
          <ChevronRight size={18} className="rotate-180" /> العودة للمعرض
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8 space-y-10">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden p-10 md:p-14 space-y-10">
              <h1 className="text-4xl md:text-5xl font-black text-zinc-900 leading-tight">{work.title}</h1>
              <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl relative border-[8px] border-zinc-50">
                {work.mediaType === 'video' ? (
                  <video src={work.mediaUrl} className="w-full h-full" controls poster={work.thumbnailUrl} />
                ) : (
                  <img src={work.mediaUrl} className="w-full h-full object-contain" alt={work.title} />
                )}
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-3 justify-end text-primary font-black uppercase tracking-widest text-xs">
                  <FileText size={20}/> <span>وصف العمل التعليمي</span>
                </div>
                <div className="text-xl text-zinc-600 leading-relaxed font-medium bg-zinc-50/50 p-10 rounded-[2.5rem] border-2 border-dashed">
                  {work.description}
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-28">
            <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden p-8 space-y-8">
              <div className="text-center space-y-4">
                <Avatar className="h-28 w-28 border-4 border-primary/10 shadow-xl mx-auto">
                  <AvatarImage src={teacher?.profilePictureUrl} />
                  <AvatarFallback className="text-3xl font-black bg-primary/10 text-primary">{teacher?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-zinc-400 font-black text-[10px] uppercase">المفهم</p>
                  <h5 className="font-black text-2xl">{teacher?.fullName}</h5>
                  <Badge className="bg-primary/10 text-primary border-none font-bold mt-2">{work.category || "خبير تعليمي"}</Badge>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-dashed">
                <div className="flex justify-between items-center"><span className="font-bold text-zinc-500">تقييم المفهم</span><div className="flex gap-0.5"><Star size={14} className="fill-yellow-400 text-yellow-400" /> <Star size={14} className="fill-yellow-400 text-yellow-400" /> <Star size={14} className="fill-yellow-400 text-yellow-400" /> <Star size={14} className="fill-yellow-400 text-yellow-400" /> <Star size={14} className="fill-yellow-400 text-yellow-400" /></div></div>
                <div className="flex justify-between items-center"><span className="font-bold text-zinc-500">انضم للمنصة</span><span className="font-black text-zinc-800">{teacher?.createdAt ? new Date(teacher.createdAt).toLocaleDateString('ar-EG', {month: 'long', year: 'numeric'}) : "جديد"}</span></div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <Button 
                  onClick={handleStartChat} 
                  disabled={isStartingChat}
                  className="h-16 rounded-2xl bg-primary text-white font-black text-lg gap-2 shadow-lg hover:scale-105 transition-all"
                >
                  {isStartingChat ? <Loader2 className="animate-spin" /> : <><Send size={20} className="rotate-180" /> استفهم مني</>}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
