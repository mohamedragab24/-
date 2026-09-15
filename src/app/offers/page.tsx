
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  BadgeCent, 
  Loader2,
  ArrowRight,
  Zap,
  History,
  Timer,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * صفحة عروضي المرسلة للمفهم.
 * تعرض كافة الطلبات التي شارك فيها الخبير مع تفاصيل سعره المقترح وحالة العرض.
 */
export default function MySentOffersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [myFullOffers, setMyFullOffers] = useState<any[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);

  useEffect(() => {
    const fetchMyOffers = async () => {
      if (!firestore || !user) return;
      setIsLoadingOffers(true);
      try {
        // نأتي بكافة الاستفهامات
        const requestsSnap = await getDocs(collection(firestore, "istifhams"));
        const offersPromises = requestsSnap.docs.map(async (requestDoc) => {
          const offersSnap = await getDocs(
            query(collection(firestore, "istifhams", requestDoc.id, "offers"), where("mufhemId", "==", user.uid))
          );
          
          if (!offersSnap.empty) {
            return {
              request: { ...requestDoc.data(), id: requestDoc.id },
              offer: { ...offersSnap.docs[0].data(), id: offersSnap.docs[0].id }
            };
          }
          return null;
        });

        const results = await Promise.all(offersPromises);
        setMyFullOffers(results.filter(r => r !== null).sort((a: any, b: any) => 
          new Date(b.offer.createdAt).getTime() - new Date(a.offer.createdAt).getTime()
        ));
      } catch (e) {
        console.error("Error fetching offers:", e);
      } finally {
        setIsLoadingOffers(false);
      }
    };

    fetchMyOffers();
  }, [firestore, user]);

  if (isUserLoading || isLoadingOffers) return (
    <div className="p-20 text-center animate-pulse flex flex-col items-center gap-4 bg-white min-h-screen" dir="rtl">
      <Loader2 className="animate-spin h-12 w-12 text-primary" />
      <p className="font-black text-2xl text-zinc-400">جاري جلب عروضك المتقدمة...</p>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 mb-20" dir="rtl">
      <div className="border-r-8 border-primary pr-6 space-y-2">
        <h1 className="text-4xl font-black font-headline text-zinc-900">عروضي المرسلة</h1>
        <p className="text-muted-foreground text-lg font-bold">تابع حالة عروضك والأسعار التي اقترحتها للمستفهمين.</p>
      </div>

      <div className="grid gap-8">
        {myFullOffers.length > 0 ? (
          myFullOffers.map((item) => (
            <Card key={item.offer.id} className="rounded-[3rem] border-2 bg-white shadow-xl overflow-hidden hover:border-primary/20 transition-all group">
              <div className="p-8 md:p-10 flex flex-col md:flex-row justify-between gap-10">
                <div className="flex-1 space-y-6 text-right">
                  <div className="flex items-center gap-3 justify-end md:justify-start">
                    <Badge className={item.offer.status === 'accepted' ? 'bg-green-100 text-green-600 border-none font-black px-4 py-1' : 'bg-orange-100 text-orange-600 border-none font-black px-4 py-1'}>
                      {item.offer.status === 'accepted' ? <><CheckCircle2 size={12} className="ml-1"/> مقبول</> : <><Clock size={12} className="ml-1"/> قيد المراجعة</>}
                    </Badge>
                    <span className="text-[10px] text-zinc-400 font-bold">قدمت العرض في: {new Date(item.offer.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl md:text-3xl font-black text-zinc-800 group-hover:text-primary transition-colors">{item.request.title}</h3>
                    <div className="p-6 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-100">
                      <p className="text-zinc-600 font-bold leading-relaxed italic">
                        <MessageSquare size={16} className="inline-block ml-2 text-primary opacity-50" />
                        " {item.offer.details} "
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-8 pt-4 border-t border-zinc-100 items-center justify-end md:justify-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-400 font-black uppercase">سعرك المقترح</span>
                      <div className="flex items-center gap-2 text-green-600 font-black text-2xl">
                        <BadgeCent size={20}/>
                        <span>{item.offer.amount} ج.م</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-400 font-black uppercase">مدة التنفيذ</span>
                      <div className="flex items-center gap-2 text-primary font-black text-2xl">
                        <Timer size={20}/>
                        <span>{item.offer.duration} يوم</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 justify-center">
                  <Button onClick={() => router.push(`/requests/${item.request.id}`)} className="h-16 px-10 rounded-2xl font-black text-lg bg-zinc-900 shadow-xl group-hover:scale-105 transition-all">
                    عرض الطلب بالكامل <ArrowRight className="mr-2 rotate-180" />
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/messages')} className="h-14 rounded-2xl font-black text-primary border-primary hover:bg-primary/5">
                    متابعة الدردشة
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="py-32 text-center bg-zinc-50 rounded-[4rem] border-4 border-dashed border-zinc-100 flex flex-col items-center gap-6">
            <div className="bg-white p-8 rounded-full shadow-inner text-zinc-200">
              <Zap size={80} strokeWidth={1} />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-black text-zinc-300">لم تقدم أي عروض بعد</p>
              <p className="text-zinc-400 font-bold">تصفح الاستفهامات المفتوحة وابدأ في مشاركة خبرتك.</p>
            </div>
            <Button onClick={() => router.push('/browse')} className="h-16 px-12 rounded-2xl font-black text-xl shadow-lg mt-4">تصفح الاستفهامات الآن</Button>
          </div>
        )}
      </div>
    </div>
  );
}
