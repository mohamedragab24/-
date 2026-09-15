
"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  History, 
  Plus, 
  Hash, 
  MessageSquare,
  User,
  GraduationCap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS_DATA = {
  general: [
    { q: "ما هي منصة فهمت وما الذي يميزها؟", a: "منصة فهمت هي وسيط تقني يربط بين المُستفهِم (من يبحث عن معلومة أو شرح سريع) و المُفَهِّم (صاحب الخبرة والقدرة على الشرح). ما يميزنا هو التخصص في \"الفهم اللحظي\" عبر جلسات مسجلة تضمن حق الطرفين، مع مراعاة الخصوصية التامة." },
    { q: "هل يمكنني استخدام حسابي كمُستفهِم ومُفَهِّم في نفس الوقت؟", a: "نعم، بضغطة زر واحدة يمكنك التحول من واجهة المُستفهِم لطلب المساعدة، إلى واجهة المُفَهِّم لتقديم عروضك ومساعدة الآخرين، دون الحاجة لإنشاء حسابين." },
    { q: "ما هي الموضوعات الممنوع الاستفهام عنها؟", a: "يُمنع منعاً باتاً التطرق للسياسة، الفتاوى الدينية، الاستشارات الطبية أو القانونية التي يترتب عليها علاج أو إجراء، وكل ما يخالف الشريعة الإسلامية أو القوانين العامة." },
    { q: "ما هو الإجراء المتبع في حال حدوث خلاف أثناء الجلسة؟", a: "تعتمد المنصة على تسجيل الجلسة كمرجع أساسي (وهو تسجيل مؤقت يحذف نهائياً قي حالة عدم وجود شكوى أو خِلاف). في حال وجود شكوى، يقوم فريق الدعم الفني بمراجعة التسجيل والتحكيم بين الطرفين بناءً على محتوى الشرح." },
    { q: "كيف تختلف قوانين الفترة المجانية عن قوانين المنصة؟", a: "جميع السياسات والشروط تنطبق على الفترة المجانية كما تنطبق على ما بعدها، لكن مع استثناء أن الاستفهام يكون مجاناً بالكامل دون دفع أي شيء، وتكون هذه الفترة فرصة للمفهمين ببناء سابقة أعمال قوية وتقييمات." }
  ],
  student: [
    { q: "كيف أطلب \"استفهاماً\" جديداً؟", a: "من حسابك كمستفهم، اضغط على \"طرح استفهام\"، اكتب تفاصيل الجزئية، حدد السعر (بحد أدنى 50 جنيه مصري أو 2 دولار)، ثم انتظر مراجعة الإدارة ونشره." },
    { q: "هل هناك حد أقصى لعدد الاستفهامات؟", a: "في الفترة التجريبية، يحق لك استفهام واحد يومياً وبحد أقصى 5 أسبوعياً. كما يمكنك طلب استفهام واحد فقط قبل توثيق هويتك." },
    { q: "كيف أختار أفضل مُفَهِّم من بين المتقدمين؟", a: "يمكنك تصفح الملف الشخصي، والاطلاع على التقييمات السابقة (إن وُجد)، ومراجعة معرض أعماله للتأكد من خبرته." },
    { q: "ماذا أفعل إذا لم أفهم الشرح أثناء الجلسة؟", a: "عند إنهاء الجلسة، سيظهر لك سؤال \"هل حققت هدفك من الاستفهام؟\". إذا اخترت \"لا\"، يمكنك تقديم شكوى لمراجعة الجلسة واسترداد أموالك إذا ثبت تقصير المفهم." },
    { q: "هل يمكنني التواصل مع المفهم خارج المنصة؟", a: "يُمنع تماماً تبادل أرقام الهواتف أو الروابط الخارجية. أي تواصل خارج المنصة يلغي حقك في الضمان ويعرض حسابك للإغلاق." },
    { q: "ما هي طرق الدفع المتاحة؟", a: "نوفر وسائل دفع آمنة (بطاقات، محافظ إلكترونية)، والحد الأدنى لشحن الرصيد هو 5 دولار أو 200 جنيه مصري أو الحد الأدنى لوسيلة الدفع." },
    { q: "هل الجلسة تكون مسجلة دائماً؟", a: "نعم، الجلسة تسجل لضمان جودة الخدمة ولحماية حقك في حال أردت تقديم شكوى أو مراجعة المعلومة لاحقاً." },
    { q: "ما هو أقل سعر يمكنني وضعه للاستفهام؟", a: "الآن في الفترة المجانية السعر هو صفر، أما بعدها فالحد الأدنى هو 50 جنيهاً مصرياً أو ما يعادلها." },
    { q: "هل يظهر استفهامي للجميع فور كتابته؟", a: "لا، يخضع الاستفهِام للمراجعة من قِبَل فريقنا للتأكد من عدم مخالفته للشروط، ثم يظهر للمفهمين المناسبين." }
  ],
  teacher: [
    { q: "كيف أبدأ بتقديم عروض تفهيم؟", a: "يجب عليك أولاً إكمال ملفك الشخصي وتوثيق هويتك. بعد موافقة الإدارة، يمكنك البدء في تقديم العروض." },
    { q: "ما هي عمولة منصة فهمني؟", a: "تقتطع المنصة عمولة قدرها 20% من قيمة كل استفهام، ويحصل المفهم على 80% (الفترة الحالية مجانية تماماً)." },
    { q: "ماهو معرض الأعمال وكيف أستفيد منه؟", a: "هو واجهتك الاحترافية؛ احرص على إضافة نماذج شرح فيديوهات قصيرة تعبر عن مهاراتك لزيادة فرص اختيارك." },
    { q: "متى يمكنني سحب أرباحي؟", a: "بعد انتهاء الجلسة وتأكيد المستفهم، والحد الأدنى للسحب هو 5 دولار أو 200 جنيه مصري أو الحد الأدنى لوسيلة السحب." },
    { q: "ماذا يحدث إذا قدم المستفهم شكوى كيدية؟", a: "لا داعي للقلق؛ فريقنا يراجع تسجيل الجلسة بالكامل. إذا ثبت تقديمك للشرح بشكل جيد، سيتم رفض الشكوى وتحويل المبلغ لك." },
    { q: "هل يمكنني الاعتراف بالخطأ إذا لم أستطع إيصال المعلومة؟", a: "نعم، توفر المنصة خيار \"الاعتراف بالخطأ\" في حال نشوب نزاع، وهذا يخفف من العقوبة التي تطبق على حسابك." },
    { q: "كيف أحافظ على تقييم مرتفع؟", a: "بقراءة التفاصيل جيداً، التأكد من قدرتك على التفهيم، الالتزام بالموعد، واستخدام أسلوب شرح مبسط." },
    { q: "هل يحق لي رفض تقديم شرح لموضوع معين؟", a: "بالطبع، أنت تختار الاستفهامات التي تناسب خبرتك فقط." },
    { q: "ماذا لو انقطع الإنترنت لدي أثناء الجلسة؟", a: "حاول العودة فوراً. التكرار قد يؤدي لفتح شكوى وضياع قيمة الجلسة عليك." },
    { q: "هل يمكنني تعديل عرضي بعد تقديمه؟", a: "لا يمكنك تعديل القيمة أو التفاصيل بعد النشر، لذا احرص على الدقة قبل الإرسال." },
    { q: "لماذا تم رفض صورة ملفي أو نبذتي أو أحد أعمالي؟", a: "تخضع البيانات للمراجعة اليدوية، وقد يتم الرفض إذا كانت الصورة غير لائقة أو تحتوي النبذة على وسائل تواصل خارجية." }
  ]
};

export default function SupportPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", message: "" });

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "supportTickets"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
  }, [firestore, user]);

  const { data: tickets } = useCollection(ticketsQuery);

  const handleCreateTicket = async () => {
    if (!firestore || !user || !newTicket.subject || !newTicket.message) {
      toast({ variant: "destructive", title: "بيانات ناقصة" });
      return;
    }
    try {
      await addDoc(collection(firestore, "supportTickets"), {
        userId: user.uid,
        userName: user.displayName || "مستخدم",
        subject: newTicket.subject,
        status: "open",
        createdAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      });
      toast({ title: "تم إرسال التذكرة بنجاح" });
      setNewTicket({ subject: "", message: "" });
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الإرسال" });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-16 mb-24 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black font-headline text-zinc-900">الأسئلة الشائعة</h1>
          <p className="text-muted-foreground text-lg font-bold">كل ما تحتاج معرفته حول تجربة التعلم في فهمت.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={() => setIsDialogOpen(true)} className="h-16 px-10 rounded-2xl font-black text-xl shadow-xl"><Plus className="ml-2"/> تذكرة دعم جديدة</Button>
          <DialogContent className="rounded-[3rem] text-right" dir="rtl">
            <DialogHeader><DialogTitle className="text-right text-3xl font-black">فتح تذكرة دعم</DialogTitle></DialogHeader>
            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <Label className="font-black">الموضوع</Label>
                <Input value={newTicket.subject} onChange={(e)=>setNewTicket({...newTicket, subject: e.target.value})} className="h-14 rounded-xl border-2 font-bold" placeholder="ما هي مشكلتك؟" />
              </div>
              <div className="space-y-2">
                <Label className="font-black">التفاصيل</Label>
                <Textarea value={newTicket.message} onChange={(e)=>setNewTicket({...newTicket, message: e.target.value})} className="h-32 rounded-xl border-2 font-bold" placeholder="اشرح لنا المزيد..." />
              </div>
            </div>
            <DialogFooter><Button onClick={handleCreateTicket} className="w-full h-16 rounded-2xl font-black text-lg">إرسال التذكرة الآن</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-12">
        <div className="space-y-8">
          <h3 className="text-3xl font-black flex items-center gap-3"><HelpCircle className="text-primary"/> أولاً: أسئلة عامة</h3>
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS_DATA.general.map((faq, i) => (
              <AccordionItem key={i} value={`gen-${i}`} className="border-2 rounded-[2rem] bg-white px-6 overflow-hidden">
                <AccordionTrigger className="text-xl font-black text-zinc-800 hover:no-underline py-6 text-right">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-lg font-bold text-zinc-500 leading-relaxed pb-6 border-t pt-4 text-right">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="space-y-8">
          <h3 className="text-3xl font-black flex items-center gap-3"><User className="text-primary"/> ثانياً: أسئلة المُستفهِم</h3>
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS_DATA.student.map((faq, i) => (
              <AccordionItem key={i} value={`stu-${i}`} className="border-2 rounded-[2rem] bg-white px-6 overflow-hidden">
                <AccordionTrigger className="text-xl font-black text-zinc-800 hover:no-underline py-6 text-right">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-lg font-bold text-zinc-500 leading-relaxed pb-6 border-t pt-4 text-right">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="space-y-8">
          <h3 className="text-3xl font-black flex items-center gap-3"><GraduationCap className="text-primary"/> ثالثاً: أسئلة المُفَهِّم</h3>
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS_DATA.teacher.map((faq, i) => (
              <AccordionItem key={i} value={`tea-${i}`} className="border-2 rounded-[2rem] bg-white px-6 overflow-hidden">
                <AccordionTrigger className="text-xl font-black text-zinc-800 hover:no-underline py-6 text-right">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-lg font-bold text-zinc-500 leading-relaxed pb-6 border-t pt-4 text-right">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {tickets && tickets.length > 0 && (
        <section className="space-y-8 pt-10 border-t">
          <h3 className="text-3xl font-black flex items-center gap-3"><History className="text-primary"/> تذاكرك السابقة</h3>
          <div className="grid gap-6">
            {tickets.map(t => (
              <Card key={t.id} className="rounded-3xl border-2 p-6 flex flex-col md:flex-row justify-between items-center gap-6 bg-white hover:border-primary/20 transition-all">
                <div className="text-right space-y-1">
                  <h4 className="text-xl font-black">{t.subject}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Hash size={12}/> {t.id.slice(0,8)}</p>
                </div>
                <Badge className={t.status === 'open' ? 'bg-orange-100 text-orange-600 px-4 py-1 rounded-xl' : 'bg-green-100 text-green-600 px-4 py-1 rounded-xl'}>
                  {t.status === 'open' ? 'بانتظار الرد' : 'تم الرد'}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
