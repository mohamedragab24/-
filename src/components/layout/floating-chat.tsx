
"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Minus, Maximize2, Loader2, User, Paperclip, Star, LogOut, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, addDoc, doc, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export function FloatingChat() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRatingMode, setIsRatingMode] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [chatStatus, setChatStatus] = useState<string>("open");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const chatId = user?.uid || null;

  // استماع لرسائل الدردشة
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return query(collection(firestore, "floatingChats", chatId, "messages"), orderBy("createdAt", "asc"));
  }, [firestore, chatId]);

  const { data: messages } = useCollection(messagesQuery);

  // استماع لحالة المحادثة (هل أغلقها المسؤول؟)
  useEffect(() => {
    if (!firestore || !chatId) return;
    
    const unsub = onSnapshot(doc(firestore, "floatingChats", chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatStatus(data.status);
        
        // إذا تم إغلاق المحادثة ولم يتم التقييم بعد، فرض وضع التقييم
        if (data.status === "closed" && !data.rating) {
          setIsRatingMode(true);
          setIsOpen(true); // تأكد من فتح النافذة ليراها المستخدم
          setIsMinimized(false);
        }
      }
    });
    
    return () => unsub();
  }, [firestore, chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (attachmentBase64?: string) => {
    if (!message.trim() && !attachmentBase64) return;
    if (!firestore || !user || chatStatus === 'closed') return;

    try {
      const chatRef = doc(firestore, "floatingChats", user.uid);
      await setDoc(chatRef, {
        id: user.uid,
        userId: user.uid,
        userName: user.displayName || "مستخدم",
        lastMessage: attachmentBase64 ? "أرسل صورة/ملف" : message,
        status: "open",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await addDoc(collection(firestore, "floatingChats", user.uid, "messages"), {
        senderId: user.uid,
        senderName: user.displayName || "مستخدم",
        text: message,
        attachmentUrl: attachmentBase64 || null,
        isAdmin: false,
        createdAt: new Date().toISOString()
      });

      setMessage("");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الرسالة." });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEndChat = async () => {
    if (!firestore || !user) return;
    setIsRatingMode(true);
  };

  const handleSendRating = async () => {
    if (!firestore || !user || rating === 0) return;
    try {
      const chatRef = doc(firestore, "floatingChats", user.uid);
      await updateDoc(chatRef, {
        status: "closed",
        rating: rating,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "شكراً لتقييمك!", description: "تم إغلاق المحادثة بنجاح." });
      setIsOpen(false);
      setIsRatingMode(false);
      setRating(0);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4" dir="rtl">
      {isOpen && (
        <Card className={`w-80 md:w-96 shadow-2xl rounded-[2rem] border-2 overflow-hidden transition-all ${isMinimized ? 'h-16' : 'h-[500px]'} ${chatStatus === 'closed' && isRatingMode ? 'border-yellow-400' : ''}`}>
          <CardHeader className="bg-primary text-white p-4 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <User size={20} /> دعم فهمني الفوري
            </CardTitle>
            <div className="flex gap-1">
              {!isRatingMode && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setIsMinimized(!isMinimized)}>
                    {isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleEndChat}>
                    <LogOut size={16} />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => !isRatingMode && setIsOpen(false)} disabled={isRatingMode}>
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          
          {!isMinimized && (
            <div className="flex flex-col h-[436px]">
              {isRatingMode ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-white animate-in fade-in zoom-in">
                  <div className="bg-yellow-100 p-6 rounded-full text-yellow-600 animate-bounce">
                    <Star size={48} className="fill-current" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-zinc-800">انتهت المحادثة</h3>
                    <p className="text-sm text-muted-foreground font-bold">يرجى تقييم تجربتك مع الدعم لإغلاق النافذة.</p>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-125 focus:outline-none">
                        <Star size={32} className={`${rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-200'} transition-colors`} />
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleSendRating} disabled={rating === 0} className="w-full h-14 rounded-2xl font-black text-lg shadow-lg">إرسال التقييم وإنهاء</Button>
                  
                  {chatStatus !== 'closed' && (
                    <Button variant="ghost" onClick={() => setIsRatingMode(false)} className="font-bold text-zinc-400">العودة للدردشة</Button>
                  )}
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4 bg-zinc-50/50">
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-2xl text-[10px] font-bold text-blue-700 text-center border border-blue-100">
                        مرحباً بك! فريق الدعم متواجد لخدمتك. يمكنك إرسال المرفقات إذا لزم الأمر.
                      </div>
                      {messages?.map((msg: any) => (
                        <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm font-bold ${msg.isAdmin ? 'bg-white border text-zinc-800' : 'bg-primary text-white'}`}>
                            {msg.text && <p>{msg.text}</p>}
                            {msg.attachmentUrl && (
                              <img src={msg.attachmentUrl} className="mt-2 rounded-lg max-w-full h-auto cursor-pointer border-2 border-white/20" alt="Attachment" />
                            )}
                            <span className="text-[10px] block mt-1 opacity-50">{new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t bg-white">
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 h-12 w-12 rounded-xl text-zinc-400">
                        <Paperclip size={20} />
                      </Button>
                      <Input 
                        placeholder="اكتب رسالتك..." 
                        className="h-12 rounded-xl border-2" 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                      />
                      <Button type="submit" className="h-12 w-12 rounded-xl p-0 shrink-0">
                        <Send size={20} />
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)}
          className="h-16 w-16 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-transform hover:scale-110 group"
        >
          <MessageCircle size={32} className="group-hover:rotate-12 transition-transform" />
        </Button>
      )}
    </div>
  );
}
