"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, addDoc, updateDoc, where } from "firebase/firestore";
import { 
  Clock, 
  User, 
  BadgeCent, 
  Calendar, 
  CheckCircle2, 
  Target, 
  FileText, 
  Loader2, 
  Zap, 
  CreditCard,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Star,
  Send,
  Edit3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function RequestDetailsPage() {
  const params = useParams();
  const requestId = params?.requestId as string;
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, "istifhams", requestId);
  }, [firestore, requestId]);

  const { data: request, isLoading } = useDoc(requestRef);

  const offersQuery = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return query(collection(firestore, "istifhams", requestId, "offers"), orderBy("createdAt", "desc"));
  }, [firestore, requestId]);

  const { data: offers } = useCollection(offersQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"));
  }, [firestore]);
  const { data: allUsers } = useCollection(usersQuery);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !currentUser?.uid) return null;
    return doc(firestore, "users", currentUser.uid);
  }, [firestore, currentUser?.uid]);

  const { data: profile } = useDoc(userRef);

  const acceptOffer = (offer: any) => {
    router.push(`/checkout/${requestId}?offerId=${offer.id}`);
  };

  if (isLoading) return (
    <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4 bg-white min-h-screen" dir="rtl">
      <Loader2 className="animate-spin h-12 w-12 text-primary" />
      <p className="font-black text-2xl">جاري تحميل تفاصيل الاستفهام...</p>
    </div>
  );

  if (!request) return <div className="p-20 text-center font-bold text-red-500">الاستفهام غير موجود.</div>;

  const isOwner = currentUser?.uid === request.mustafhemId;
  const isMufhem = profile?.role === 'mufhem';
  const myOffer = offers?.find((o: any) => o.mufhemId === currentUser?.uid);

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-20" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => router.back()} className="hover:bg-white gap-2 font-black text-zinc-500">
            <ChevronRight size={20} className="rotate-180" /> العودة للاستفهامات
          </Button>
          <Badge className={`px-6 py-2 rounded-xl text-md font-black shadow-sm ${
            request.status === 'paid' ? 'bg-green-100 text-green-600' : 
            request.status === 'accepted' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
          }`}>
            {request.status === 'paid' ? 'مدفوع وجاهز' : request.status === 'accepted' ? 'بانتظار الدفع' : 'مفتوح للعروض'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            <Card className="rounded-[3rem] border-none shadow-xl bg-white overflow-hidden">
              <CardContent className="p-10 md:p-14 space-y-12">
                <div className="space-y-4 text-right">
                  <div className="flex flex-wrap items-center gap-3 justify-start mb-2">
                    <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-black">{request.category}</span>
                    {request.categorySub && <span className="bg-primary/5 text-primary/70 px-4 py-1.5 rounded-full text-xs font-black">{request.categorySub}</span>}
                    {request.categoryOpt && <span className="bg-primary/5 text-primary/50 px-4 py-1.5 rounded-full text-xs font-black">{request.categoryOpt}</span>}
                    <span className="text-zinc-400 text-xs font-bold flex items-center gap-1 mr-auto"><Clock size={14}/> منذ {new Date(request.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-zinc-900 leading-tight">
                    {request.title}
                  </h1>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 justify-start text-zinc-800 font-black text-lg uppercase tracking-widest">
                    <FileText size={22} className="text-primary" />
                    <span>تفاصيل الاستفهام</span>
                  </div>
                  <div className="text-lg text-zinc-700 leading-relaxed font-medium bg-zinc-50/50 p-10 rounded-[2.5rem] border-2 border-dashed border-zinc-100">
                    {request.description}
                  </div>
                </div>

                {request.goal && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 justify-start text-zinc-800 font-black text-lg uppercase tracking-widest">
                      <Target size={22} className="text-accent" />
                      <span>الهدف المرجو تحقيقه</span>
                    </div>
                    <div className="text-lg text-zinc-800 font-bold italic bg-accent/5 p-10 rounded-[2.5rem] border-2 border-accent/10 border-dashed">
                      "{request.goal}"
                    </div>
                  </div>
                )}

                {!isOwner && isMufhem && request.status === 'active' && !myOffer && (
                  <div className="pt-10">
                    <Button 
                      onClick={() => router.push(`/requests/${requestId}/make-offer`)}
                      className="w-full h-20 rounded-[2rem] text-2xl font-black bg-primary shadow-2xl hover:scale-[1.02] transition-all"
                    >
                      <Zap className="ml-2" /> قدم عرضك الآن
                    </Button>
                  </div>
                )}

                {myOffer && !isOwner && request.status === 'active' && (
                  <div className="p-8 bg-blue-50 rounded-3xl border-2 border-dashed border-blue-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-blue-700 font-black text-xl flex items-center gap-2"><CheckCircle2/> لقد قدمت عرضاً بالفعل</h4>
                      <Badge className="bg-blue-600">قيد الانتظار</Badge>
                    </div>
                    <p className="text-blue-600 font-bold italic">"{myOffer.details}"</p>
                    <div className="pt-4 border-t border-blue-100 flex justify-between items-center text-blue-800 font-black">
                      <span>سعرك: {myOffer.amount} ج.م</span>
                      <Button variant="ghost" onClick={()=>router.push(`/requests/${requestId}/make-offer`)} className="text-blue-600 hover:bg-blue-100"><Edit3 size={16} className="ml-2"/> تعديل العرض</Button>
                    </div>
                  </div>
                )}

                {isOwner && request.status === 'active' && (
                  <div className="space-y-8 pt-10">
                    <h3 className="text-2xl font-black border-r-8 border-primary pr-4 flex items-center gap-3">
                      العروض المقدمة ({offers?.length || 0})
                    </h3>
                    <div className="grid gap-6">
                      {offers?.map((offer: any) => {
                        const offerer = allUsers?.find(u => u.id === offer.mufhemId);
                        return (
                          <Card key={offer.id} className="rounded-3xl border-2 hover:border-primary/20 transition-all shadow-md overflow-hidden bg-white">
                            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                              <div className="flex items-start gap-4 text-right flex-1">
                                <Avatar className="h-16 w-16 border-2 border-white shadow-lg">
                                  <AvatarImage src={offer.mufhemAvatar} />
                                  <AvatarFallback className="bg-primary/10 text-primary font-black">{offer.mufhemName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-black text-xl flex items-center gap-1">
                                      {offer.mufhemName}
                                      {offerer?.isVerified && <ShieldCheck size={16} className="text-blue-500" />}
                                    </h4>
                                    <Badge className="bg-yellow-50 text-yellow-600 border-none font-black text-[10px]">5.0 <Star size={10} className="fill-yellow-500 mr-1"/></Badge>
                                  </div>
                                  <p className="text-sm text-zinc-600 font-medium mt-1 line-clamp-2">"{offer.details}"</p>
                                  <div className="flex gap-4 mt-3 text-[10px] font-bold text-zinc-400">
                                    <span className="flex items-center gap-1"><Clock size={12}/> الموعد: {offer.duration} يوم</span>
                                    <span className="flex items-center gap-1"><BadgeCent size={12}/> السعر: {offer.amount} ج.م</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 w-full md:w-auto">
                                <Button onClick={() => acceptOffer(offer)} className="bg-green-600 hover:bg-green-700 h-12 rounded-xl font-black">قبول وبدء</Button>
                                <Button variant="outline" onClick={() => router.push('/messages')} className="h-12 rounded-xl font-black border-primary text-primary">استفسار</Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {(!offers || offers.length === 0) && (
                        <div className="py-16 text-center text-muted-foreground font-bold italic border-2 border-dashed rounded-3xl bg-zinc-50">
                          لا توجد عروض مقدمة بعد.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isOwner && request.status === 'accepted' && (
                  <div className="relative group animate-in slide-in-from-bottom-6 duration-700">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-primary rounded-[4rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative bg-white border-4 border-blue-500/20 p-10 md:p-14 rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center space-y-8">
                      <div className="bg-blue-100 w-24 h-24 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-inner">
                        <ShieldCheck size={56} />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-3xl md:text-4xl font-black text-zinc-900">جاهز لبدء التعلم؟</h3>
                        <p className="text-xl text-zinc-500 font-bold max-w-lg mx-auto">
                          لقد قبل المفهم <span className="text-blue-600 underline decoration-dotted">{request.mufhemName}</span> طلبك. يرجى تأمين الرصيد لتفعيل غرفة المحاضرة.
                        </p>
                      </div>
                      
                      <div className="w-full max-w-md p-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed flex justify-between items-center px-10">
                        <span className="text-zinc-400 font-black text-sm uppercase">إجمالي المطلوب</span>
                        <span className="text-4xl font-black text-primary">{request.amount} <span className="text-lg">ج.م</span></span>
                      </div>

                      <Button 
                        onClick={() => router.push(`/checkout/${requestId}`)} 
                        className="w-full h-24 rounded-[2.5rem] bg-blue-600 hover:bg-blue-700 text-white font-black text-2xl shadow-2xl shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-4"
                      >
                        <CreditCard size={32} /> إتمام الدفع وفتح المحاضرة
                      </Button>
                    </div>
                  </div>
                )}

                {(isOwner || isMufhem) && request.status === 'paid' && (
                  <div className="bg-green-50 p-12 rounded-[3.5rem] border-4 border-dashed border-green-200 flex flex-col items-center text-center space-y-8 animate-in zoom-in">
                    <div className="bg-white p-6 rounded-full shadow-xl text-green-600">
                      <Zap size={48} className="fill-current" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-3xl font-black text-green-900">المحاضرة مدفوعة وجاهزة!</h4>
                      <p className="text-lg text-green-700 font-bold">تم تأمين الرصيد بنجاح. اضغط أدناه للدخول للغرفة المباشرة.</p>
                    </div>
                    <Button 
                      onClick={() => router.push(`/meeting/${request.id}`)} 
                      className="h-20 px-16 rounded-[2rem] bg-green-600 hover:bg-green-700 font-black text-2xl shadow-2xl shadow-green-600/20 transition-all hover:scale-105"
                    >
                      دخول المحاضرة الآن
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <Card className="rounded-[2.5rem] bg-white p-8 space-y-8 shadow-xl border-none">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-black text-xs uppercase tracking-widest">الميزانية</span>
                  <span className="text-primary font-black text-4xl tabular-nums">{request.amount} <span className="text-sm">ج.م</span></span>
                </div>
                <div className="pt-6 border-t border-dashed space-y-2 text-right">
                  <span className="text-zinc-400 font-black text-xs uppercase tracking-widest block mb-2">الموعد المطلوب</span>
                  <div className="flex items-center gap-3 justify-end text-zinc-800 font-black">
                    <Calendar size={18} className="text-primary" />
                    <span className="text-lg">{new Date(request.meetingTime).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  <div className="flex items-center gap-3 justify-end text-zinc-500 font-bold mr-7">
                    <Clock size={16} />
                    <span>الساعة {new Date(request.meetingTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
