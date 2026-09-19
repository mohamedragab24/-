"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  Video, 
  Star, 
  Loader2, 
  ShieldCheck, 
  Lock,
  Monitor,
  Play,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateDocumentNonBlocking, createTransactionNonBlocking } from "@/firebase/non-blocking-updates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

type RatingFlow = 'goal' | 'ratings' | 'complaint_ask';

/**
 * صفحة المحاضرة المباشرة - تم تبسيطها لتبدأ فوراً دون طلب مشاركة الشاشة.
 */
export default function MeetingPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const { user } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<any>(null);
  const [meetingStarted, setMeetingStarted] = useState(false);
  
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState<RatingFlow>('goal');
  
  const [understandingRating, setUnderstandingRating] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, "istifhams", requestId as string);
  }, [firestore, requestId]);

  const { data: request, isLoading } = useDoc(requestRef);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: profile } = useDoc(userRef);

  // بدء المحاضرة فوراً عند الضغط على الزر
  const handleStartMeeting = () => {
    if (request?.status !== 'paid' && !profile?.isAdmin) {
      toast({ variant: "destructive", title: "تنبيه الأمان", description: "لا يمكن بدء المحاضرة قبل إتمام عملية الدفع." });
      return;
    }
    setMeetingStarted(true);
  };

  useEffect(() => {
    if (meetingStarted && window.JitsiMeetExternalAPI && jitsiContainerRef.current && profile && request) {
      (async () => {
        try {
          const functions = getFunctions(getApp(), 'us-central1');
          const callable = httpsCallable(functions, 'getJaasMeetingToken');
          const tokenResult: any = await callable({ requestId, room: `Fahimni_${requestId}` });
          const token = tokenResult.data?.token;
          const room = tokenResult.data?.room || `vpaas-magic-cookie-4ddd1f4050174a1b89a6ce9a82ade034/Fahimni_${requestId}`;
          if (!token) throw new Error('تعذر الحصول على تصريح المحاضرة');
          const isTeacher = request.mufhemId === user?.uid || profile.role === 'mufhem' || profile.role === 'teacher';
          const options = {
            roomName: room, token, width: "100%", height: "100%", parentNode: jitsiContainerRef.current,
            userInfo: { displayName: profile.fullName || profile.name, email: profile.email },
            configOverwrite: { prejoinPageEnabled: false, disableInviteFunctions: true },
            interfaceConfigOverwrite: { TOOLBAR_BUTTONS: ['microphone','camera','chat','raisehand','videoquality','filmstrip','tileview','fullscreen', ...(isTeacher ? ['recording'] : [])] }
          };
          const newApi = new window.JitsiMeetExternalAPI("8x8.vc", options);
          setApi(newApi);
          newApi.addEventListener('videoConferenceLeft', () => setShowRatingDialog(true));
        } catch (e: any) {
          toast({ variant: 'destructive', title: 'تعذر فتح المحاضرة', description: e?.message || 'حاول مرة أخرى' });
        }
      })();
    }
  }, [meetingStarted, profile, request, requestId]);

  const handleFinishSession = async (isComplaint: boolean = false) => {
    setIsSubmitting(true);
    if (requestRef && request && firestore) {
      updateDocumentNonBlocking(requestRef, {
        status: isComplaint ? 'pending_review' : 'completed',
        completedAt: new Date().toISOString(),
        hasComplaint: isComplaint,
        understandingRating: understandingRating
      });

      if (!isComplaint) {
        const teacherEarning = request.amount * 0.8;
        createTransactionNonBlocking(firestore, request.mufhemId, {
          amount: teacherEarning,
          type: 'earning',
          details: `أرباح محاضرة: ${request.title}`,
          status: 'completed'
        });
      }
      router.push("/requests");
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin text-white" /></div>;

  if (request?.status !== 'paid' && !profile?.isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-6 text-center space-y-8" dir="rtl">
        <div className="bg-red-500/20 p-10 rounded-[3rem] border-4 border-dashed border-red-500">
          <Lock size={80} className="mx-auto text-red-500" />
        </div>
        <h2 className="text-4xl font-black">بانتظار تفعيل المحاضرة</h2>
        <p className="text-xl text-zinc-400 max-w-lg">يجب على المستفهم إتمام عملية الدفع أولاً لكي تفتح غرفة المحاضرة المباشرة.</p>
        <Button onClick={() => router.push('/')} className="h-16 px-12 rounded-2xl text-xl font-black bg-primary">العودة للرئيسية</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden" dir="rtl">
      <Script src="https://8x8.vc/vpaas-magic-cookie-4ddd1f4050174a1b89a6ce9a82ade034/external_api.js" />
      
      {!meetingStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 bg-[#F8FAFC]">
          <Card className="p-10 rounded-[3.5rem] shadow-2xl max-w-2xl space-y-8 bg-white border-none animate-in fade-in zoom-in duration-500">
            <div className="bg-primary/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto text-primary shadow-inner">
              <Video size={56} />
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-zinc-900">جاهز لبدء المحاضرة؟</h2>
              <p className="text-muted-foreground font-bold text-lg leading-relaxed">
                اضغط على الزر أدناه للدخول لغرفة المحاضرة المباشرة والبدء في {profile?.role === 'mufhem' ? 'الشرح' : 'التعلم'} فوراً.
              </p>
            </div>

            <div className="p-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed text-right space-y-2">
              <h4 className="font-black text-zinc-800">موضوع الجلسة:</h4>
              <p className="text-primary font-black text-xl">{request?.title}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              <Button variant="outline" asChild className="h-16 rounded-2xl font-black border-2">
                <a href={`fahmny://meeting/${requestId}`}>فتح المحاضرة في التطبيق</a>
              </Button>
              <Button 
              onClick={handleStartMeeting} 
              className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary shadow-xl hover:scale-[1.02] transition-all"
            >
              <Play className="ml-3 h-8 w-8 fill-current" /> ابدأ المحاضرة من الويب
            </Button>
            </div>
            
            <p className="text-xs text-zinc-400 font-bold italic">نتمنى لك رحلة تعليمية مثمرة وممتعة.</p>
          </Card>
        </div>
      ) : (
        <div id="jaas-container" ref={jitsiContainerRef} className="flex-1 w-full h-full" />
      )}

      <Dialog open={showRatingDialog} onOpenChange={() => {}}>
        <DialogContent className="rounded-[3rem] p-10" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
              <Star className="text-yellow-500 fill-current" /> تقييم المحاضرة
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-10 py-6 text-center">
            {currentStep === 'goal' && (
              <div className="space-y-8">
                <div className="bg-muted/30 p-8 rounded-[2rem] space-y-4">
                  <h2 className="text-2xl font-black text-zinc-800 leading-tight">هل تم تحقيق الهدف من الاستفهام وفهمت المعلومة؟</h2>
                  <p className="text-muted-foreground font-bold italic">"{request?.goal}"</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => setCurrentStep('ratings')} className="bg-green-600 hover:bg-green-700 h-16 rounded-2xl font-black text-xl shadow-lg">نعم، فهمت</Button>
                  <Button onClick={() => setCurrentStep('complaint_ask')} variant="outline" className="h-16 rounded-2xl font-black text-xl text-red-600 border-red-200 hover:bg-red-50">لا، أريد مراجعة</Button>
                </div>
              </div>
            )}

            {currentStep === 'ratings' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <Label className="text-xl font-black text-zinc-700 block">كيف تقيم أداء المفهم في هذه الجلسة؟</Label>
                  <div className="flex gap-3 justify-center">
                    {[1,2,3,4,5].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setUnderstandingRating(s)}
                        className="transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star size={56} className={`${understandingRating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-200'} transition-colors`} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="font-black text-right block">ملاحظاتك (اختياري)</Label>
                  <Textarea 
                    placeholder="اكتب كلمة شكر أو ملاحظة للمفهم..." 
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="h-32 rounded-2xl border-2"
                  />
                </div>

                <Button onClick={() => handleFinishSession(false)} disabled={understandingRating === 0 || isSubmitting} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "إنهاء الجلسة وتحويل الأرباح"}
                </Button>
              </div>
            )}

            {currentStep === 'complaint_ask' && (
              <div className="space-y-8 animate-in fade-in zoom-in">
                <div className="bg-red-50 p-8 rounded-[2rem] border-2 border-dashed border-red-200 space-y-4">
                  <ShieldAlert size={64} className="mx-auto text-red-600" />
                  <h2 className="text-2xl font-black text-red-900">فتح نزاع رسمي</h2>
                  <p className="text-red-800 font-bold">سيتم تعليق أرباح المفهم فوراً وسيقوم فريق الرقابة بمراجعة الجلسة للفصل بينكما.</p>
                </div>
                <Button onClick={() => handleFinishSession(true)} disabled={isSubmitting} className="w-full h-16 bg-red-600 hover:bg-red-700 rounded-2xl font-black text-xl shadow-xl">
                  تأكيد فتح النزاع والمراجعة
                </Button>
                <Button variant="ghost" onClick={() => setCurrentStep('goal')} className="font-bold text-zinc-400">تراجع، العودة للخلف</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}