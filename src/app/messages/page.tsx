
"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, ArrowLeft, ChevronRight, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MessagesListPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "direct_chats"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );
  }, [firestore, user]);

  const { data: chats, isLoading } = useCollection(chatsQuery);

  if (isUserLoading || isLoading) return <div className="p-20 text-center animate-pulse font-black">جاري تحميل محادثاتك...</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">مركز الرسائل</h1>
        <p className="text-muted-foreground text-lg font-bold">المحادثات التوضيحية مع المفهمين حول استفهاماتك.</p>
      </div>

      <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 p-8 border-b">
          <CardTitle className="text-2xl font-black flex items-center gap-3">
            <Inbox className="text-primary" /> بريدك الوارد
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {chats && chats.length > 0 ? (
              <div className="divide-y">
                {chats.map((chat: any) => {
                  const isStudent = user?.uid === chat.studentId;
                  const otherPartyName = isStudent ? chat.teacherName : chat.studentName;
                  const otherPartyAvatar = isStudent ? chat.teacherAvatar : "";
                  const isUnread = chat.hasUnread && chat.lastSenderId !== user?.uid;

                  return (
                    <div 
                      key={chat.id} 
                      onClick={() => router.push(`/messages/${chat.id}`)}
                      className={`p-6 hover:bg-primary/5 cursor-pointer transition-all flex items-center gap-6 group ${isUnread ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                    >
                      <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                        <AvatarImage src={otherPartyAvatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black">{otherPartyName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1 text-right">
                        <div className="flex justify-between items-center">
                          <h4 className="font-black text-xl text-zinc-900">{otherPartyName}</h4>
                          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <Clock size={10} /> {getTimeAgo(chat.updatedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-primary font-bold line-clamp-1">بخصوص: {chat.requestTitle}</p>
                        <p className={`text-sm line-clamp-1 ${isUnread ? 'font-black text-zinc-900' : 'text-zinc-500 font-medium'}`}>
                          {chat.lastMessage}
                        </p>
                      </div>
                      <ChevronRight className="text-zinc-300 group-hover:text-primary transition-colors rotate-180" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-32 text-center flex flex-col items-center gap-6 opacity-30">
                <MessageSquare size={80} />
                <p className="text-2xl font-black">لا توجد محادثات نشطة حالياً.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  if (!dateStr) return "لحظات";
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (minutes < 60) return `${minutes} دقيقة`;
  if (hours < 24) return `${hours} ساعة`;
  return new Date(dateStr).toLocaleDateString('ar-EG');
}
