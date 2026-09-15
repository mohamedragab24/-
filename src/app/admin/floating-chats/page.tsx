
"use client";

import { useState, useRef } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, Send, User, Trash2, Ban, Paperclip, Star, XCircle, Archive, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminFloatingChats() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "floatingChats"), orderBy("updatedAt", "desc"));
  }, [firestore]);

  const { data: chats, isLoading } = useCollection(chatsQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedChat) return null;
    return query(collection(firestore, "floatingChats", selectedChat.id, "messages"), orderBy("createdAt", "asc"));
  }, [firestore, selectedChat]);

  const { data: messages } = useCollection(messagesQuery);

  const handleReply = async (attachmentBase64?: string) => {
    if (!replyMessage.trim() && !attachmentBase64) return;
    if (!firestore || !selectedChat) return;

    try {
      await addDoc(collection(firestore, "floatingChats", selectedChat.id, "messages"), {
        senderId: "admin",
        senderName: "فريق دعم فهمني",
        text: replyMessage,
        attachmentUrl: attachmentBase64 || null,
        isAdmin: true,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(firestore, "floatingChats", selectedChat.id), {
        status: "replied",
        updatedAt: new Date().toISOString()
      });

      setReplyMessage("");
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleReply(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const closeChat = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "floatingChats", id), { 
        status: "closed",
        updatedAt: new Date().toISOString()
      });
      toast({ title: "تم إغلاق وأرشفة المحادثة" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الإغلاق" });
    }
  };

  const deleteChat = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "floatingChats", id));
    setSelectedChat(null);
    toast({ title: "تم حذف المحادثة نهائياً" });
  };

  const activeChats = chats?.filter(c => c.status !== 'closed') || [];
  const archivedChats = chats?.filter(c => c.status === 'closed') || [];

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline">إدارة النافذة العائمة</h1>
        <p className="text-muted-foreground text-lg">الرد المباشر، إغلاق المحادثات، والأرشفة التلقائية.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-14 bg-muted p-1">
              <TabsTrigger value="active" className="rounded-xl font-bold">
                <Inbox size={16} className="ml-2" /> نشطة ({activeChats.length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="rounded-xl font-bold">
                <Archive size={16} className="ml-2" /> مؤرشفة ({archivedChats.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <Card className="shadow-xl rounded-[2rem] overflow-hidden border-2 bg-white">
                <ScrollArea className="h-[600px]">
                  <ChatList items={activeChats} selectedId={selectedChat?.id} onSelect={setSelectedChat} />
                </ScrollArea>
              </Card>
            </TabsContent>

            <TabsContent value="archived" className="mt-4">
              <Card className="shadow-xl rounded-[2rem] overflow-hidden border-2 bg-white opacity-80">
                <ScrollArea className="h-[600px]">
                  <ChatList items={archivedChats} selectedId={selectedChat?.id} onSelect={setSelectedChat} isArchived />
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="lg:col-span-2 shadow-xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
          {selectedChat ? (
            <div className="flex flex-col h-[700px]">
              <div className="p-6 border-b bg-muted/10 flex justify-between items-center">
                <div className="text-right">
                  <h3 className="font-black text-xl flex items-center gap-2">
                    <User size={20} className="text-primary" /> {selectedChat.userName}
                    {selectedChat.status === 'closed' && <Badge className="bg-zinc-500 mr-2">مؤرشفة</Badge>}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Chat ID: {selectedChat.id}</p>
                </div>
                <div className="flex gap-2">
                  {selectedChat.status !== 'closed' && (
                    <Button variant="outline" size="sm" onClick={() => closeChat(selectedChat.id)} className="rounded-xl font-bold border-orange-500 text-orange-600 hover:bg-orange-50">
                      <Archive className="ml-1 h-4 w-4" /> أرشفة وإغلاق
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="rounded-xl font-bold">
                        <Trash2 className="ml-1 h-4 w-4" /> حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">حذف المحادثة؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">سيتم حذف كافة الرسائل والبيانات الخاصة بهذا الشات العائم نهائياً.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteChat(selectedChat.id)} className="bg-red-600">حذف نهائي</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              <ScrollArea className="flex-1 p-6 bg-zinc-50/30">
                <div className="space-y-4">
                  {messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-3xl shadow-sm ${msg.isAdmin ? 'bg-primary text-white' : 'bg-white border text-zinc-800'}`}>
                        {msg.text && <p className="font-bold text-sm">{msg.text}</p>}
                        {msg.attachmentUrl && (
                          <img src={msg.attachmentUrl} className="mt-2 rounded-xl max-w-full h-auto border-4 border-white/10" alt="Attachment" />
                        )}
                        <span className="text-[10px] opacity-50 block mt-1">{new Date(msg.createdAt).toLocaleTimeString('ar-EG')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-6 border-t bg-white">
                <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-14 w-14 rounded-xl" disabled={selectedChat.status === 'closed'}>
                    <Paperclip size={24} />
                  </Button>
                  <Input 
                    placeholder={selectedChat.status === 'closed' ? "هذه المحادثة مؤرشفة، لا يمكن الرد" : "اكتب ردك هنا..."} 
                    className="h-14 rounded-xl border-2" 
                    value={replyMessage} 
                    onChange={(e) => setReplyMessage(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleReply()} 
                    disabled={selectedChat.status === 'closed'}
                  />
                  <Button onClick={() => handleReply()} className="h-14 px-8 rounded-xl bg-primary" disabled={selectedChat.status === 'closed'}>
                    <Send size={20}/>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30">
              <MessageCircle size={80} />
              <p className="text-2xl font-black mt-4">اختر محادثة من القائمة للبدء</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChatList({ items, selectedId, onSelect, isArchived }: any) {
  if (items.length === 0) {
    return <div className="p-10 text-center text-muted-foreground font-bold italic">لا توجد محادثات هنا.</div>;
  }

  return (
    <div className="divide-y">
      {items.map((chat: any) => (
        <div 
          key={chat.id} 
          onClick={() => onSelect(chat)}
          className={`p-6 cursor-pointer hover:bg-muted transition-colors ${selectedId === chat.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
        >
          <div className="flex justify-between items-start mb-2">
            <Badge className={chat.status === 'open' ? 'bg-orange-100 text-orange-600' : chat.status === 'closed' ? 'bg-zinc-100 text-zinc-600' : 'bg-green-100 text-green-600'}>
              {chat.status === 'open' ? 'جديدة' : chat.status === 'closed' ? 'مؤرشفة' : 'تم الرد'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{new Date(chat.updatedAt).toLocaleTimeString('ar-EG')}</span>
          </div>
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm truncate text-right">{chat.userName}</h4>
            {chat.rating && (
              <div className="flex items-center gap-1 text-yellow-500 text-xs font-black">
                <Star size={12} className="fill-current" /> {chat.rating}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right line-clamp-1">{chat.lastMessage}</p>
        </div>
      ))}
    </div>
  );
}
