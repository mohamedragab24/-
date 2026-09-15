
"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Calendar, 
  User, 
  ShieldCheck, 
  Clock, 
  PlayCircle,
  History,
  CheckCircle2,
  Timer
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SessionsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const sessionsRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, "istifhams") : null, [firestore, user]);

  const studentSessionsQuery = useMemoFirebase(() => {
    if (!sessionsRef || !user?.uid) return null;
    return query(sessionsRef, where("mustafhemId", "==", user.uid), where("status", "in", ["paid", "completed"]));
  }, [sessionsRef, user?.uid]);

  const teacherSessionsQuery = useMemoFirebase(() => {
    if (!sessionsRef || !user?.uid) return null;
    return query(sessionsRef, where("mufhemId", "==", user.uid), where("status", "in", ["paid", "completed"]));
  }, [sessionsRef, user?.uid]);

  const { data: studentSessions } = useCollection(studentSessionsQuery);
  const { data: teacherSessions } = useCollection(teacherSessionsQuery);

  const allSessions = [...(studentSessions || []), ...(teacherSessions || [])].sort((a: any, b: any) => 
    new Date(b.meetingTime).getTime() - new Date(a.meetingTime).getTime()
  );

  if (isUserLoading) return <div className="p-20 text-center font-black animate-pulse">جاري جلب سجل جلساتك...</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 mb-20 text-right" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">سجل جلساتي</h1>
        <p className="text-muted-foreground text-lg font-bold">متابعة الجلسات التعليمية الحالية والسابقة.</p>
      </div>

      <div className="grid gap-6">
        {allSessions.length > 0 ? (
          allSessions.map((session: any) => {
            const isTeacher = session.mufhemId === user?.uid;
            return (
              <Card key={session.id} className="rounded-[2.5rem] border-2 shadow-xl overflow-hidden hover:border-primary/20 transition-all bg-white group">
                <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex-1 space-y-4 text-right w-full">
                    <div className="flex items-center gap-3 justify-end md:justify-start">
                      <Badge className={session.status === 'paid' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}>
                        {session.status === 'paid' ? 'جلسة قادمة' : 'جلسة مكتملة'}
                      </Badge>
                      <Badge variant="outline" className="font-bold">
                        أنت هنا: {isTeacher ? 'مفهم' : 'مستفهم'}
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-black text-zinc-900">{session.title}</h3>
                    <div className="flex flex-wrap gap-6 text-sm font-bold text-zinc-500 justify-end md:justify-start">
                      <span className="flex items-center gap-2"><Calendar size={16}/> {new Date(session.meetingTime).toLocaleDateString('ar-EG')}</span>
                      <span className="flex items-center gap-2"><Clock size={16}/> {new Date(session.meetingTime).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>
                      <span className="flex items-center gap-2"><User size={16}/> {isTeacher ? session.mustafhemName : (session.mufhemName || 'بانتظار المفهم')}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 shrink-0">
                    {session.status === 'paid' ? (
                      <Button onClick={() => router.push(`/meeting/${session.id}`)} className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-lg shadow-xl shadow-primary/20">
                        <PlayCircle className="ml-2" /> دخول المحاضرة الآن
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => router.push(`/requests/${session.id}`)} className="h-14 px-8 rounded-2xl font-black text-zinc-600 border-zinc-200">
                        عرض التفاصيل والتقييم
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-32 text-center bg-zinc-50 rounded-[4rem] border-4 border-dashed border-zinc-100 flex flex-col items-center gap-6">
            <Video size={80} className="text-zinc-200" />
            <p className="text-2xl font-black text-zinc-300">لا توجد جلسات مجدولة أو سابقة حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
}
