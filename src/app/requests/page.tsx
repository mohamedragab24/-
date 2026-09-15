
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Clock, 
  User, 
  MessageSquare,
  Eye,
  Timer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, limit } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function RequestsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const requestsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, "istifhams");
  }, [firestore, user]);

  const studentQuery = useMemoFirebase(() => {
    if (!requestsRef || !user?.uid) return null;
    return query(requestsRef, where("mustafhemId", "==", user.uid), limit(50));
  }, [requestsRef, user?.uid]);

  const teacherQuery = useMemoFirebase(() => {
    if (!requestsRef || !user?.uid) return null;
    return query(requestsRef, where("mufhemId", "==", user.uid), limit(50));
  }, [requestsRef, user?.uid]);

  const { data: studentRequests, isLoading: isLoadingStudent } = useCollection(studentQuery);
  const { data: teacherRequests, isLoading: isLoadingTeacher } = useCollection(teacherQuery);

  const allRequests = [...(studentRequests || []), ...(teacherRequests || [])];
  
  const uniqueRequests = Array.from(new Map(allRequests.map(item => [item.id, item])).values())
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isUserLoading || isLoadingStudent || isLoadingTeacher) {
    return <div className="p-10 text-center font-bold animate-pulse">جاري تحميل استفهاماتك...</div>;
  }

  return (
    <div className="bg-white min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto border-x min-h-screen shadow-sm">
        <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
          <h1 className="text-xl md:text-2xl font-black text-zinc-800">الاستفهامات المفتوحة</h1>
          <Button variant="outline" size="icon" className="rounded-md border-zinc-200">
            <SlidersHorizontal size={18} className="text-zinc-600" />
          </Button>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <div className="border-b bg-zinc-50/50">
            <TabsList className="flex h-12 bg-transparent p-0 gap-0 overflow-x-auto no-scrollbar">
              <TabLink value="pending" icon={Eye} label="المراجعة" />
              <TabLink value="active" icon={Timer} label="الانتظار" />
              <TabLink value="accepted" icon={AlertCircle} label="المقبولة" />
              <TabLink value="completed" icon={CheckCircle2} label="المكتملة" />
              <TabLink value="canceled" icon={XCircle} label="الملغية" />
            </TabsList>
          </div>

          {['pending_approval', 'active', 'accepted', 'completed', 'canceled'].map((status) => (
            <TabsContent key={status} value={status === 'pending_approval' ? 'pending' : status} className="m-0">
              <RequestList 
                requests={uniqueRequests.filter((r: any) => r.status === status)} 
                status={status} 
                userId={user?.uid} 
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function TabLink({ value, icon: Icon, label }: any) {
  return (
    <TabsTrigger 
      value={value} 
      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-white data-[state=active]:text-primary text-zinc-500 font-bold px-4 transition-all"
    >
      <Icon size={16} className="ml-2 hidden sm:inline" />
      {label}
    </TabsTrigger>
  );
}

function RequestList({ requests, status, userId }: { requests: any[], status: string, userId?: string }) {
  const router = useRouter();

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-zinc-50 p-6 rounded-full mb-4">
          <ClipboardList size={40} className="text-zinc-300" />
        </div>
        <p className="text-zinc-400 font-bold">لا توجد استفهامات في هذا القسم حالياً</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {requests.map((req) => (
        <div 
          key={req.id} 
          onClick={() => router.push(`/requests/${req.id}`)}
          className="p-6 hover:bg-zinc-50 transition-colors cursor-pointer group"
        >
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-primary group-hover:underline leading-tight">
              {req.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-zinc-400" />
                <span className="font-medium">
                  {req.mustafhemId === userId ? (req.mufhemName || "بانتظار مفهم") : req.mustafhemName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-zinc-400" />
                <span className="font-medium">منذ {getTimeAgo(req.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-zinc-400" />
                <span className="font-medium">
                  {status === 'active' ? 'أضف أول عرض' : status === 'accepted' ? 'تم القبول' : 'محاضرة مكتملة'}
                </span>
              </div>
            </div>

            <p className="text-zinc-600 text-sm leading-relaxed line-clamp-2">
              {req.description}
            </p>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-primary font-black text-lg">
                {req.amount} <span className="text-xs">ج.م</span>
              </div>
              <Button size="sm" variant="outline" className="rounded-lg font-bold h-9">
                عرض التفاصيل
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  if (!dateStr) return "لحظات";
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes} دقيقة`;
  if (hours < 24) return `${hours} ساعة`;
  return `${days} يوم`;
}
