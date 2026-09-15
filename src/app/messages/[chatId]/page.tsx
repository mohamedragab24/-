
"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, addDoc, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ChevronRight, Paperclip, Loader2, Phone, MoreVertical, MessageSquare, Zap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

/**
 * صفحة المحادثة المباشرة - تواصل فوري وتلقائي بين العميلين.
 */
export default function ChatRoomPage() {
  const { chatId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatRef = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return doc(firestore, "direct_chats", chatId as string);
  }, [firestore, chatId]);

  const { data: chat, isLoading: isChatLoading } = useDoc(chatRef);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return query(collection(firestore, "direct_chats", chatId as string, "messages"), orderBy("createdAt", "asc"));
  }, [firestore, chatId]);

  const { data: messages } = useCollection(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // تحديث حالة القراءة فوراً
  useEffect(() => {
    if (chat && user && chat.hasUnread && chat.lastSenderId !== user.uid) {
      updateDoc(chatRef!, { hasUnread: false });
    }
  }, [chat, user, chatRef]);

  const handleSendMessage = async (attachmentBase64?: string) => {
    if (!message.trim() && !attachmentBase64) return;
    if (!firestore || !user || !chatId) return;

    try {
      // إرسال الرسالة يتم مباشرة لمجموعة الرسائل الفرعية
      await addDoc(collection(firestore, "direct_chats", chatId as string, "messages"), {
        senderId: user.uid,
        senderName: user.displayName || "مستخدم",
        text: message,
        attachmentUrl: attachmentBase64 || null,
        createdAt: new Date().toISOString()
      });

      // تحديث بيانات المحادثة الرئيسية للمعاينة
      await updateDoc(chatRef!, {
        lastMessage: attachmentBase64 ? "أرسل ملفاً/صورة" : message,
        updatedAt: new Date().toISOString(),
        hasUnread: true,
        lastSenderId: user.uid
      });

      setMessage("");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الإرسال" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleSendMessage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (isChatLoading) return <div className="p-20 text-center animate-pulse font-black">جاري فتح قناة التواصل...</div>;
  if (!chat) return <div className="p-20 text-center">المحادثة غير موجودة.</div>;

  const isStudent = user?.uid === chat.studentId;
  const otherPartyName = isStudent ? chat.teacherName : chat.studentName;
  const otherPartyAvatar = isStudent ? chat.teacherAvatar : "";

  return (
    <div className="flex flex-col h-[calc(100svh-80px)] bg-zinc-50" dir="rtl">
      {/* رأس المحادثة - مظهر مباشر وحديث */}
      <div className="bg-white border-b p-4 md:px-8 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/messages')} className="rounded-full">
            <ChevronRight className="rotate-180" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/10">
              <AvatarImage src={otherPartyAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-black">{otherPartyName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="text-right">
              <h3 className="font-black text-lg text-zinc-900 leading-none">{otherPartyName}</h3>
              <p className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1">
                <Zap size={10} className="fill-current" /> دردشة مباشرة بخصوص: {chat.requestTitle}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="text-zinc-400 rounded-xl"><MoreVertical size={20}/></Button>
        </div>
      </div>

      {/* منطقة الرسائل الفورية */}
      <ScrollArea className="flex-1 p-4 md:p-8 bg-[#F8FAFC]">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-center mb-8">
            <Badge variant="outline" className="bg-green-50 px-6 py-2 rounded-2xl border-dashed font-bold text-green-600 border-green-200">
              أنت الآن في تواصل مباشر مع الطرف الآخر
            </Badge>
          </div>

          {messages?.map((msg: any) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-[2rem] shadow-sm space-y-2 ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white text-zinc-800 border rounded-bl-none'}`}>
                  {msg.text && <p className="font-medium text-md leading-relaxed">{msg.text}</p>}
                  {msg.attachmentUrl && (
                    <img src={msg.attachmentUrl} className="rounded-2xl max-w-full h-auto border-2 border-white/20" alt="Attachment" />
                  )}
                  <div className={`flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[9px] block ${isMe ? 'text-white/60' : 'text-zinc-400'} font-bold`}>
                      {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* حقل الإرسال المباشر */}
      <div className="p-4 md:p-6 bg-white border-t shrink-0">
        <div className="max-w-4xl mx-auto">
          <form className="flex gap-3 items-end" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-14 w-14 rounded-xl text-zinc-400 hover:bg-zinc-50 shrink-0">
              <Paperclip size={24} />
            </Button>
            <div className="flex-1 relative">
              <Input 
                placeholder="اكتب رسالتك المباشرة هنا..." 
                className="h-14 rounded-2xl border-2 pr-6 pl-14 font-bold text-lg focus:border-primary transition-all bg-zinc-50/50" 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
              />
              <Button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl p-0 bg-primary hover:bg-primary/90 shadow-lg">
                <Send size={20} className="rotate-180" />
              </Button>
            </div>
          </form>
          <p className="text-[10px] text-center text-muted-foreground font-bold mt-3 italic">
            * تنبيه: تواصلك المباشر محمي ببروتوكولات الأمان. تجنب طلب الدفع الخارجي لضمان حقك المالي.
          </p>
        </div>
      </div>
    </div>
  );
}
