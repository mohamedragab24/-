
"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, doc, updateDoc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  ShieldCheck, 
  BadgeCent, 
  Zap, 
  MessageSquare,
  AlertCircle,
  Inbox
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NotificationsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [firestore, user]);

  const { data: notifications, isLoading } = useCollection(notificationsQuery);

  const markAllAsRead = async () => {
    if (!firestore || !notifications || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(firestore);
      unread.forEach(n => {
        batch.update(doc(firestore, "notifications", n.id), { read: true });
      });
      await batch.commit();
      toast({ title: "تم تحديد الكل كمقروء" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    }
  };

  const deleteNotification = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "notifications", id));
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  const markAsRead = async (id: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "notifications", id), { read: true });
  };

  if (isUserLoading || isLoading) return <div className="p-20 text-center animate-pulse font-black text-2xl">جاري جلب تنبيهاتك...</div>;

  const getIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckCircle2 className="text-green-500" />;
      case 'rejection': return <AlertCircle className="text-red-500" />;
      case 'verification_success': return <ShieldCheck className="text-blue-500" />;
      case 'new_offer': return <Zap className="text-orange-500" />;
      case 'payment': return <BadgeCent className="text-primary" />;
      default: return <Bell className="text-zinc-400" />;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">مركز التنبيهات</h1>
          <p className="text-muted-foreground text-lg font-bold">تابع كافة التحديثات والنشاطات الخاصة بحسابك في فهمت.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={markAllAsRead} className="flex-1 md:flex-none h-12 rounded-xl font-bold border-2">
            تحديد الكل كمقروء
          </Button>
        </div>
      </div>

      <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 p-8 border-b">
          <CardTitle className="text-2xl font-black flex items-center gap-3">
            <Inbox className="text-primary" /> بريدك الوارد ({notifications?.length || 0})
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[600px]">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => markAsRead(notif.id)}
                  className={`p-8 hover:bg-zinc-50 transition-all flex items-start gap-6 group relative ${!notif.read ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                >
                  <div className="bg-white p-4 rounded-2xl shadow-sm border shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-2 text-right">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-xl text-zinc-900">{notif.title}</h4>
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> {new Date(notif.createdAt).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <p className="text-zinc-600 font-medium leading-relaxed">{notif.message}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center flex flex-col items-center gap-6 opacity-30">
              <div className="bg-zinc-50 p-8 rounded-full shadow-inner"><Bell size={80} className="text-zinc-300" /></div>
              <p className="text-2xl font-black">لا توجد إشعارات جديدة حالياً.</p>
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
