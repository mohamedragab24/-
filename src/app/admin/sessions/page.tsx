
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, ShieldCheck, User, Calendar, Clock, Star, ShieldAlert, BadgeCent, PlayCircle, FileText, AlertCircle, MessageSquare, CloudOff, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function AdminSessionsReview() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: adminProfile } = useDoc(userRef);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com";
  const canReadSessions = adminProfile?.isAdmin || isMasterAdmin;

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !canReadSessions) return null;
    return query(
      collection(firestore, "istifhams"), 
      where("status", "in", ["accepted", "completed", "pending_review"])
    );
  }, [firestore, canReadSessions]);

  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  const sessions = rawSessions?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!canReadSessions && adminProfile) {
    return <div className="p-20 text-center font-black opacity-30 text-2xl">عذراً، لا تملك صلاحية الوصول لمركز الرقابة.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-blue-600 pr-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-right">
          <h1 className="text-4xl font-black font-headline text-zinc-900">سجلات الرقابة والتوثيق</h1>
          <p className="text-muted-foreground text-lg">مراجعة المحاضرات المسجلة على Firebase Storage والتحقق من التقييمات وفض النزاعات.</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border-2 border-dashed border-blue-200 flex items-center gap-3 text-blue-700">
          <ShieldCheck />
          <span className="font-black">نظام التوثيق السحابي (Firebase Storage) مفعّل</span>
        </div>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
        <Table>
          <TableHeader className="bg-muted/30 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black text-zinc-900">المحاضرة</TableHead>
              <TableHead className="text-right font-black text-zinc-900">الأطراف</TableHead>
              <TableHead className="text-right font-black text-zinc-900">التوثيق</TableHead>
              <TableHead className="text-right font-black text-zinc-900">التقييم</TableHead>
              <TableHead className="text-left px-8 font-black text-zinc-900">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold animate-pulse">جاري جلب السجلات السحابية...</TableCell></TableRow>
            ) : sessions?.map((session) => (
              <TableRow key={session.id} className="h-24 hover:bg-muted/5 transition-colors">
                <TableCell className="px-8 text-right">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg text-zinc-800">{session.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">ID: {session.id.slice(-6)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col text-sm space-y-1">
                    <span className="font-bold text-primary flex items-center gap-1 justify-end"><User size={14}/> {session.mustafhemName}</span>
                    <span className="font-bold text-accent flex items-center gap-1 justify-end"><ShieldCheck size={14}/> {session.mufhemName || 'بانتظار المفهم'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {session.isRecorded ? (
                    <Badge className="bg-green-100 text-green-600 border-none font-black flex items-center gap-1 w-fit mr-auto shadow-sm">
                      <PlayCircle size={12} /> مسجلة سحابياً
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-400 font-bold flex items-center gap-1 w-fit mr-auto opacity-50">
                      <CloudOff size={12} /> بدون تسجيل
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {session.hasComplaint && <Badge variant="destructive" className="ml-2 animate-pulse">شكوى معلقة</Badge>}
                  {session.understandingRating ? (
                    <div className="flex items-center gap-1 text-yellow-500 font-black justify-end">
                      <Star size={16} className="fill-current" /> {session.understandingRating}.0
                    </div>
                  ) : <span className="text-muted-foreground italic text-xs font-bold">لم تقيم بعد</span>}
                </TableCell>
                <TableCell className="px-8 text-left">
                  <Button 
                    variant={session.isRecorded ? "default" : "outline"}
                    size="sm" 
                    disabled={!session.recordingUrl}
                    className={`rounded-xl gap-2 font-black shadow-lg ${session.isRecorded ? 'bg-blue-600 hover:bg-blue-700' : ''}`} 
                    onClick={() => setSelectedSession(session)}
                  >
                    <PlayCircle size={16} /> مراجعة المحتوى
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="sm:max-w-[900px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-10 pt-10 text-right">
            <div className="flex justify-between items-center mb-4">
              <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
                <ShieldCheck className="text-primary h-10 w-10" /> تقرير المحاضرة الموثق
              </DialogTitle>
              {selectedSession?.recordingUrl && (
                <Button variant="outline" className="rounded-xl font-bold gap-2" asChild>
                  <a href={selectedSession.recordingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} /> فتح في نافذة مستقلة
                  </a>
                </Button>
              )}
            </div>
            <DialogDescription className="text-right text-lg">مراجعة المحتوى المرئي المحفوظ في Firebase Storage لضمان الجودة وفض النزاعات.</DialogDescription>
          </DialogHeader>
          
          <div className="p-10 space-y-10 max-h-[75vh] overflow-y-auto bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-zinc-50 rounded-3xl border flex items-center gap-4">
                <User className="text-primary h-8 w-8" />
                <div className="text-right flex-1"><span className="text-[10px] block font-black text-muted-foreground uppercase">المستفهم</span><span className="font-black text-xl">{selectedSession?.mustafhemName}</span></div>
              </div>
              <div className="p-6 bg-zinc-50 rounded-3xl border flex items-center gap-4">
                <ShieldCheck className="text-accent h-8 w-8" />
                <div className="text-right flex-1"><span className="text-[10px] block font-black text-muted-foreground uppercase">المفهم</span><span className="font-black text-xl">{selectedSession?.mufhemName}</span></div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-2xl font-black flex items-center gap-3 text-blue-600 justify-end"><Video className="h-8 w-8" /> الفيديو المسجل للمحاضرة</h4>
              <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden relative group shadow-2xl border-[10px] border-zinc-100">
                {selectedSession?.recordingUrl ? (
                  <video 
                    src={selectedSession.recordingUrl} 
                    className="w-full h-full" 
                    controls 
                    playsInline 
                    autoPlay={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                    <CloudOff size={64} />
                    <p className="text-xl font-black">تعذر تحميل الفيديو من Storage</p>
                  </div>
                )}
              </div>
              <div className="p-6 bg-blue-50 rounded-3xl flex items-start gap-4 text-blue-700 text-sm font-bold border-2 border-dashed border-blue-200">
                <AlertCircle size={20} className="shrink-0 mt-1" />
                <p>هذا الفيديو هو نسخة أصلية موثقة زمنياً. في حال وجود نزاع مالي، يعتمد فريق الرقابة على محتوى هذا الفيديو للفصل بين الطرفين.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-8 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed space-y-6">
                <h4 className="text-xl font-black flex items-center gap-3 justify-end text-zinc-800"><Star className="text-yellow-500 fill-yellow-500" /> تقييمات الطالب</h4>
                <div className="space-y-4">
                  <RatingStat label="مدى الفهم" value={selectedSession?.understandingRating} />
                  <RatingStat label="أسلوب المعلم" value={selectedSession?.teacherStyleRating} />
                  <RatingStat label="جودة التقنية" value={selectedSession?.platformTechRating} />
                </div>
              </div>

              <div className="p-8 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed space-y-4">
                <h4 className="text-xl font-black flex items-center gap-3 justify-end text-zinc-800"><MessageSquare className="text-primary" /> ملاحظات ختامية</h4>
                <div className="bg-white p-6 rounded-2xl shadow-sm border text-right min-h-[120px]">
                  <p className="text-lg italic font-medium text-zinc-700 leading-relaxed">
                    "{selectedSession?.review || "لا توجد ملاحظات مكتوبة من قبل الطالب."}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 bg-zinc-50 border-t flex justify-between items-center">
            {selectedSession?.hasComplaint && (
              <Badge variant="destructive" className="h-12 px-8 rounded-2xl text-lg font-black animate-pulse shadow-lg">
                تنبيه: يوجد شكوى رسمية مفتوحة لهذه الجلسة
              </Badge>
            )}
            <Button onClick={() => setSelectedSession(null)} className="rounded-2xl px-14 h-16 font-black text-xl shadow-xl">إغلاق التقرير</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RatingStat({ label, value }: { label: string, value?: number }) {
  return (
    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => <Star key={s} className={`h-4 w-4 ${Number(value) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-200'}`} />)}
      </div>
      <span className="font-bold text-zinc-600">{label}</span>
    </div>
  );
}
