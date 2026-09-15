
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Search, 
  Clock, 
  User, 
  ChevronRight, 
  Eye, 
  Inbox, 
  History,
  ShieldCheck,
  ArrowRight,
  Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * صفحة سجل المحادثات المباشرة - للاطلاع والرقابة اللاحقة فقط.
 * تؤكد الواجهة أن التواصل مباشر وتلقائي بين العملاء.
 */
export default function AdminDirectChats() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChat, setSelectedChat] = useState<any>(null);

  // جلب كافة المحادثات المباشرة الجارية
  const chatsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "direct_chats"), orderBy("updatedAt", "desc"), limit(100));
  }, [firestore]);

  const { data: chats, isLoading } = useCollection(chatsQuery);

  // جلب رسائل المحادثة المختارة
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedChat) return null;
    return query(collection(firestore, "direct_chats", selectedChat.id, "messages"), orderBy("createdAt", "asc"));
  }, [firestore, selectedChat]);

  const { data: messages } = useCollection(messagesQuery);

  const filteredChats = chats?.filter(chat => 
    chat.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.requestTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">سجل المحادثات المباشرة</h1>
          <p className="text-muted-foreground text-lg font-bold">متابعة التواصل التلقائي والمباشر الجاري بين الطلاب والمفهمين لضمان الجودة.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالطالب، المفهم أو الطلب..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[750px]">
        {/* قائمة المحادثات النشطة */}
        <Card className="lg:col-span-1 shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white flex flex-col">
          <CardHeader className="bg-muted/30 border-b p-6">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Zap size={20} className="text-primary fill-current" /> تواصل مباشر نشط
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-10 text-center animate-pulse font-bold">جاري جلب المحادثات الجارية...</div>
            ) : filteredChats && filteredChats.length > 0 ? (
              <div className="divide-y">
                {filteredChats.map((chat) => (
                  <div 
                    key={chat.id} 
                    onClick={() => setSelectedChat(chat)}
                    className={`p-6 cursor-pointer hover:bg-primary/5 transition-all flex flex-col gap-3 ${selectedChat?.id === chat.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="text-right">
                        <h4 className="font-black text-md text-zinc-900">{chat.studentName} & {chat.teacherName}</h4>
                        <p className="text-[10px] text-primary font-bold mt-1 line-clamp-1">{chat.requestTitle}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{getTimeAgo(chat.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium line-clamp-1 italic">"{chat.lastMessage}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground font-bold opacity-30">لا توجد محادثات مباشرة حالياً.</div>
            )}
          </ScrollArea>
        </Card>

        {/* معاينة المحادثة - اطلاع فقط */}
        <Card className="lg:col-span-2 shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white flex flex-col">
          {selectedChat ? (
            <>
              <CardHeader className="bg-zinc-900 text-white p-6 flex flex-row justify-between items-center space-y-0">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4 space-x-reverse">
                    <Avatar className="h-12 w-12 border-4 border-zinc-800 shadow-xl">
                      <AvatarImage src={selectedChat.teacherAvatar} />
                      <AvatarFallback>م</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-12 w-12 border-4 border-zinc-800 shadow-xl">
                      <AvatarFallback className="bg-primary text-white">س</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="text-right">
                    <h3 className="font-black text-lg leading-tight">{selectedChat.studentName} و {selectedChat.teacherName}</h3>
                    <p className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                      <ShieldCheck size={10} /> اطلاع إداري لضمان الحقوق (تواصل تلقائي)
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-mono text-[10px]">
                  ID: {selectedChat.id.slice(0, 12)}
                </Badge>
              </CardHeader>

              <ScrollArea className="flex-1 p-8 bg-[#F8FAFC]">
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages?.map((msg: any) => {
                    const isTeacher = msg.senderId === selectedChat.teacherId;
                    return (
                      <div key={msg.id} className={`flex ${isTeacher ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[80%] p-5 rounded-[2rem] shadow-sm space-y-2 ${isTeacher ? 'bg-primary text-white rounded-br-none' : 'bg-white text-zinc-800 border-2 rounded-bl-none'}`}>
                          <div className="flex justify-between items-center gap-4 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">{msg.senderName}</span>
                            <span className="text-[9px] font-bold opacity-40">{new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {msg.text && <p className="font-medium text-md leading-relaxed">{msg.text}</p>}
                          {msg.attachmentUrl && (
                            <img src={msg.attachmentUrl} className="rounded-2xl max-w-full h-auto border-2 border-white/20 mt-2" alt="Attachment" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-6 bg-zinc-50 border-t flex justify-between items-center">
                <div className="flex items-center gap-3 text-zinc-400 font-bold text-xs">
                  <History size={16} /> سجل كامل لمحادثة مباشرة وتلقائية
                </div>
                <Button variant="ghost" className="font-black text-primary gap-2" onClick={() => router.push(`/requests/${selectedChat.requestId}`)}>
                  عرض طلب الاستفهام <ArrowRight size={16} className="rotate-180" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-20 p-20 text-center">
              <MessageSquare size={120} strokeWidth={1} />
              <h2 className="text-3xl font-black mt-6">اختر محادثة للاطلاع</h2>
              <p className="text-xl font-bold mt-2">يمكنك متابعة التواصل المباشر بين الأطراف لضمان الجودة.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
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
