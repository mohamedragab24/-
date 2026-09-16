
"use client";

import { useState, useRef } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, User, CheckCircle2, Search, Hash, Send, ChevronRight, Trash2, Ban, Paperclip, Archive, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminSupport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: adminProfile } = useDoc(userRef);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com" || user?.email === "mohamedmini2006@gamil.com";
  const canReadSupport = adminProfile?.isAdmin || isMasterAdmin;

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore || !canReadSupport) return null;
    return query(collection(firestore, "supportTickets"), orderBy("lastUpdate", "desc"));
  }, [firestore, canReadSupport]);

  const { data: tickets, isLoading } = useCollection(ticketsQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedTicket || !canReadSupport) return null;
    return query(collection(firestore, "supportTickets", selectedTicket.id, "messages"), orderBy("createdAt", "asc"));
  }, [firestore, selectedTicket, canReadSupport]);

  const { data: messages } = useCollection(messagesQuery);

  const handleReply = async (attachmentBase64?: string) => {
    if (!replyMessage.trim() && !attachmentBase64) return;
    if (!firestore || !selectedTicket) return;

    try {
      await addDoc(collection(firestore, "supportTickets", selectedTicket.id, "messages"), {
        senderId: "admin",
        senderName: "فريق دعم فهمني",
        text: replyMessage,
        attachmentUrl: attachmentBase64 || null,
        isAdmin: true,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(firestore, "supportTickets", selectedTicket.id), {
        status: "replied",
        lastUpdate: new Date().toISOString()
      });

      setReplyMessage("");
      if (!attachmentBase64) toast({ title: "تم إرسال الرد" });
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

  const setStatus = async (id: string, status: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "supportTickets", id), { status });
    toast({ title: "تم تحديث حالة التذكرة" });
  };

  const deleteTicket = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "supportTickets", id));
    setSelectedTicket(null);
    toast({ title: "تم حذف التذكرة" });
  };

  const filteredTickets = tickets?.filter(t => 
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id?.includes(searchTerm)
  );

  const activeTickets = filteredTickets?.filter(t => t.status !== 'closed' && t.status !== 'suspended') || [];
  const archivedTickets = filteredTickets?.filter(t => t.status === 'closed' || t.status === 'suspended') || [];

  if (!canReadSupport && adminProfile) {
    return <div className="p-20 text-center font-black opacity-30 text-2xl">عذراً، لا تملك صلاحية الوصول لمركز الدعم.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-blue-500 pr-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black font-headline">إدارة تذاكر الدعم</h1>
          <p className="text-muted-foreground text-lg">أرشفة تلقائية للتذاكر المنتهية لتنظيم العمل.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالعنوان، الرقم أو المستخدم..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-14 bg-muted p-1">
              <TabsTrigger value="active" className="rounded-xl font-bold">
                <Inbox size={16} className="ml-2" /> نشطة ({activeTickets.length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="rounded-xl font-bold">
                <Archive size={16} className="ml-2" /> مؤرشفة ({archivedTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <Card className="shadow-xl rounded-[2rem] overflow-hidden border-2 bg-white">
                <ScrollArea className="h-[600px]">
                  <TicketList items={activeTickets} selectedId={selectedTicket?.id} onSelect={setSelectedTicket} />
                </ScrollArea>
              </Card>
            </TabsContent>

            <TabsContent value="archived" className="mt-4">
              <Card className="shadow-xl rounded-[2rem] overflow-hidden border-2 bg-white opacity-80">
                <ScrollArea className="h-[600px]">
                  <TicketList items={archivedTickets} selectedId={selectedTicket?.id} onSelect={setSelectedTicket} />
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="lg:col-span-2 shadow-xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
          {selectedTicket ? (
            <div className="flex flex-col h-[700px]">
              <div className="p-6 border-b bg-muted/10 flex justify-between items-center">
                <div className="text-right">
                  <h3 className="font-black text-xl">{selectedTicket.subject}</h3>
                  <p className="text-xs text-muted-foreground">{selectedTicket.userName} | {selectedTicket.category}</p>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status !== 'closed' && (
                    <Button variant="outline" size="sm" onClick={() => setStatus(selectedTicket.id, 'closed')} className="rounded-xl font-bold border-green-500 text-green-600 hover:bg-green-50">
                      <CheckCircle2 className="ml-1 h-4 w-4" /> إغلاق وأرشفة
                    </Button>
                  )}
                  {selectedTicket.status !== 'suspended' && (
                    <Button variant="outline" size="sm" onClick={() => setStatus(selectedTicket.id, 'suspended')} className="rounded-xl font-bold">
                      <Ban className="ml-1 h-4 w-4" /> تعليق
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
                        <AlertDialogTitle className="text-right">هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">سيتم حذف كافة سجلات الدردشة الخاصة بهذه التذكرة نهائياً.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTicket(selectedTicket.id)} className="bg-red-600">حذف نهائي</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <ScrollArea className="flex-1 p-6 bg-zinc-50/30">
                <div className="space-y-4">
                  {messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] p-4 rounded-3xl shadow-sm ${msg.isAdmin ? 'bg-white border text-zinc-800' : 'bg-primary text-white'}`}>
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
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-14 w-14 rounded-xl" disabled={selectedTicket.status === 'closed'}>
                    <Paperclip size={24} />
                  </Button>
                  <Input placeholder={selectedTicket.status === 'closed' ? "هذه التذكرة مغلقة" : "اكتب ردك هنا..."} className="h-14 rounded-xl border-2" value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleReply()} disabled={selectedTicket.status === 'closed'} />
                  <Button onClick={() => handleReply()} className="h-14 px-8 rounded-xl bg-blue-600 hover:bg-blue-700" disabled={selectedTicket.status === 'closed'}><Send size={20}/></Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30">
              <MessageCircle size={80} />
              <p className="text-2xl font-black mt-4">اختر تذكرة للرد عليها</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TicketList({ items, selectedId, onSelect }: any) {
  if (items.length === 0) {
    return <div className="p-10 text-center text-muted-foreground font-bold italic">لا توجد تذاكر حالياً.</div>;
  }

  return (
    <div className="divide-y">
      {items.map((ticket: any) => (
        <div 
          key={ticket.id} 
          onClick={() => onSelect(ticket)}
          className={`p-6 cursor-pointer hover:bg-muted transition-colors ${selectedId === ticket.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
        >
          <div className="flex justify-between items-start mb-2">
            <Badge className={
              ticket.status === 'open' ? 'bg-orange-100 text-orange-600' : 
              ticket.status === 'suspended' ? 'bg-zinc-100 text-zinc-600' : 
              ticket.status === 'closed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
            }>
              {ticket.status === 'open' ? 'جديدة' : ticket.status === 'suspended' ? 'معلقة' : ticket.status === 'closed' ? 'مغلقة' : 'تم الرد'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">#{ticket.id.slice(0, 8)}</span>
          </div>
          <h4 className="font-bold text-sm truncate text-right">{ticket.subject}</h4>
          <p className="text-xs text-muted-foreground mt-1 text-right">{ticket.userName}</p>
        </div>
      ))}
    </div>
  );
}
