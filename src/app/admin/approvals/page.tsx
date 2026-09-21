
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc, limit, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  Clock, 
  Eye, 
  Mail, 
  Phone, 
  Calendar, 
  UserCircle,
  HelpCircle,
  BadgeCent,
  MapPin,
  FileText,
  MessageSquare,
  ImageIcon,
  ShieldCheck,
  IdCard,
  AlertCircle,
  FileCheck,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseReviewPanel } from "@/app/admin/course-reviews/page";

export default function AdminApprovals() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedIstifham, setSelectedIstifham] = useState<any>(null);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: adminProfile } = useDoc(userRef);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com" || user?.email === "mohamedmini2006@gamil.com";
  const canReadApprovals = adminProfile?.isAdmin || isMasterAdmin;

  const profilesQuery = useMemoFirebase(() => {
    if (!firestore || !canReadApprovals) return null;
    return query(collection(firestore, "users"), where("profilePicturePending", "==", true), limit(500));
  }, [firestore, canReadApprovals]);

  const istifhamsQuery = useMemoFirebase(() => {
    if (!firestore || !canReadApprovals) return null;
    return query(collection(firestore, "istifhams"), where("status", "==", "pending_approval"));
  }, [firestore, canReadApprovals]);

  const identityQuery = useMemoFirebase(() => {
    if (!firestore || !canReadApprovals) return null;
    return query(collection(firestore, "users"), where("verificationStatus", "==", "pending"), limit(500));
  }, [firestore, canReadApprovals]);

  const { data: profiles, isLoading: profilesLoading } = useCollection(profilesQuery);
  const { data: istifhams, isLoading: istifhamsLoading } = useCollection(istifhamsQuery);
  const { data: verifications, isLoading: verificationsLoading } = useCollection(identityQuery);

  const handleApproveProfile = (u: any) => {
    if (!firestore) return;
    const uRef = doc(firestore, "users", u.id);
    
    // نقل الصورة من حقل "قيد الانتظار" إلى الحقل الرسمي
    updateDocumentNonBlocking(uRef, { 
      profilePictureUrl: u.pendingProfilePictureUrl,
      isProfileApproved: true, 
      profilePicturePending: false,
      pendingProfilePictureUrl: null,
      status: 'active' 
    });
    
    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: u.id,
      title: "تم اعتماد صورتك الشخصية!",
      message: "تهانينا، تم مراجعة صورتك الشخصية واعتمادها بنجاح في فهمت.",
      type: "approval",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ title: "تم الاعتماد", description: "تم تفعيل الصورة الشخصية بنجاح." });
    setSelectedUser(null);
  };

  const handleRejectProfile = (u: any) => {
    if (!firestore) return;
    const uRef = doc(firestore, "users", u.id);
    
    // حذف الصورة المنتظرة دون المساس بالرسمية (إذا كانت موجودة)
    updateDocumentNonBlocking(uRef, { 
      profilePicturePending: false,
      pendingProfilePictureUrl: null 
    });
    
    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: u.id,
      title: "تم رفض الصورة الشخصية",
      message: "عذراً، الصورة الشخصية المرفوعة لا تستوفي المعايير. يرجى رفع صورة بديلة واضحة.",
      type: "rejection",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ variant: "destructive", title: "تم الرفض", description: "تم رفض الصورة وإبلاغ المستخدم." });
    setSelectedUser(null);
  };

  const handleApproveIstifham = (ist: any) => {
    if (!firestore) return;
    const istRef = doc(firestore, "istifhams", ist.id);
    updateDocumentNonBlocking(istRef, { 
      status: "active",
      approvedAt: new Date().toISOString()
    });

    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: ist.mustafhemId,
      title: "تم نشر استفهامك!",
      message: `تمت الموافقة على استفهامك: "${ist.title}" وهو متاح الآن للمفهمين.`,
      type: "approval",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ title: "تم النشر", description: "الاستفهام متاح الآن للجميع." });
    setSelectedIstifham(null);
  };

  const handleRejectIstifham = (ist: any) => {
    if (!firestore) return;
    const istRef = doc(firestore, "istifhams", ist.id);
    updateDocumentNonBlocking(istRef, { status: "canceled" });

    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: ist.mustafhemId,
      title: "تم رفض الاستفهام",
      message: "عذراً، لم تتم الموافقة على نشر طلبك لمخالفته شروط المحتوى في فهمت.",
      type: "rejection",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ variant: "destructive", title: "تم الرفض", description: "تم إلغاء طلب الاستفهام." });
    setSelectedIstifham(null);
  };

  const handleApproveIdentity = (u: any) => {
    if (!firestore) return;
    const uRef = doc(firestore, "users", u.id);
    updateDocumentNonBlocking(uRef, { 
      isVerified: true, 
      verificationStatus: 'verified',
      verifiedAt: new Date().toISOString()
    });
    
    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: u.id,
      title: "تم توثيق هويتك بنجاح!",
      message: "مبروك! تم التحقق من هويتك وحصلت على شارة التوثيق في فهمت.",
      type: "verification_success",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ title: "تم التوثيق!", description: "تم منح المستخدم شارة التوثيق." });
    setSelectedVerification(null);
  };

  const handleRejectIdentity = (u: any) => {
    if (!firestore) return;
    const uRef = doc(firestore, "users", u.id);
    updateDocumentNonBlocking(uRef, { 
      verificationStatus: 'rejected',
      idCardFront: null,
      idCardBack: null
    });
    
    addDocumentNonBlocking(collection(firestore, "notifications"), {
      userId: u.id,
      title: "فشل توثيق الهوية",
      message: "عذراً، لم نتمكن من قبول وثائق الهوية المرفوعة. يرجى المحاولة بصور أوضح.",
      type: "verification_failed",
      read: false,
      createdAt: new Date().toISOString()
    });

    toast({ variant: "destructive", title: "تم الرفض", description: "تم رفض وثائق الهوية." });
    setSelectedVerification(null);
  };

  if (!canReadApprovals && adminProfile) {
    return <div className="p-20 text-center font-black opacity-30 text-2xl">عذراً، لا تملك صلاحية الوصول لهذه الصفحة.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6 text-right">
        <h1 className="text-4xl font-black font-headline text-zinc-900">مركز الاعتماد والرقابة الموحد</h1>
        <p className="text-muted-foreground text-lg">إدارة كافة عمليات المراجعة والاعتماد لضمان بيئة تعليمية احترافية وآمنة.</p>
      </div>

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto md:h-16 p-1 bg-muted rounded-2xl mb-8 gap-1">
          <TabsTrigger value="profiles" className="rounded-xl text-lg font-bold">
            <ImageIcon className="ml-2 h-5 w-5" /> الصور ({profiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="istifhams" className="rounded-xl text-lg font-bold">
            <MessageSquare className="ml-2 h-5 w-5" /> الاستفهامات ({istifhams?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="identity" className="rounded-xl text-lg font-bold">
            <IdCard className="ml-2 h-5 w-5" /> توثيق الهوية ({verifications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="courses" className="rounded-xl text-lg font-bold">
            <FileCheck className="ml-2 h-5 w-5" /> مراجعة الكورسات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {profilesLoading ? <p className="col-span-full text-center font-bold animate-pulse">جاري تحميل الحسابات...</p> : 
              profiles?.map((p) => (
                <Card key={p.id} className="rounded-[2.5rem] overflow-hidden shadow-lg border-2 hover:border-primary/20 transition-all bg-white group">
                  <CardHeader className="bg-muted/30 p-8 flex flex-col items-center text-center">
                    <div className="relative mb-4 group-hover:scale-105 transition-transform">
                      <Avatar className="h-32 w-32 border-8 border-white shadow-2xl">
                        {/* نُظهر الصورة الجديدة التي تنتظر المراجعة */}
                        <AvatarImage src={p.pendingProfilePictureUrl} />
                        <AvatarFallback className="text-4xl font-black">{p.fullName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-xl shadow-lg animate-pulse">
                        <Clock size={16} />
                      </div>
                    </div>
                    <CardTitle className="font-black text-xl">{p.fullName}</CardTitle>
                    <Badge variant="outline" className="mt-2 text-primary font-bold">{p.role === 'mufhem' ? 'مُفهم' : 'مُستفهم'}</Badge>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <Button variant="outline" onClick={() => setSelectedUser(p)} className="w-full h-12 rounded-xl font-bold border-2"><Eye className="ml-2 h-5 w-5" /> معاينة</Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => handleApproveProfile(p)} className="bg-green-600 hover:bg-green-700 font-black rounded-xl h-12 text-white shadow-md shadow-green-600/20">اعتماد</Button>
                      <Button onClick={() => handleRejectProfile(p)} variant="destructive" className="font-black rounded-xl h-12 shadow-md shadow-red-600/20">رفض</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            }
            {!profilesLoading && profiles?.length === 0 && <NoData message="لا توجد صور شخصية بانتظار المراجعة." />}
          </div>
        </TabsContent>

        <TabsContent value="istifhams">
          <div className="grid gap-6">
            {istifhamsLoading ? <p className="text-center font-bold animate-pulse">جاري تحميل الاستفهامات...</p> :
              istifhams?.map((ist) => (
                <Card key={ist.id} className="rounded-3xl border-2 p-8 shadow-md flex flex-col md:flex-row justify-between items-center gap-6 bg-white group hover:border-primary/20 transition-all">
                  <div className="space-y-2 text-right w-full">
                    <div className="flex items-center gap-3 justify-end">
                      <span className="text-xs text-muted-foreground font-bold flex items-center gap-1"><Clock size={12}/> {new Date(ist.createdAt).toLocaleString('ar-EG')}</span>
                      <Badge className="bg-primary/10 text-primary border-none font-bold">{ist.category}</Badge>
                    </div>
                    <h4 className="text-2xl font-black text-zinc-800 group-hover:text-primary transition-colors text-right">{ist.title}</h4>
                    <p className="font-bold text-muted-foreground text-right">بواسطة: <span className="text-zinc-900">{ist.mustafhemName}</span> | الميزانية: <span className="text-green-600 font-black">{ist.amount} ج.م</span></p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto shrink-0">
                    <Button variant="outline" onClick={() => setSelectedIstifham(ist)} className="h-14 px-8 font-black rounded-2xl border-2"><Eye className="ml-2 h-5 w-5" /> التفاصيل</Button>
                    <Button onClick={() => handleApproveIstifham(ist)} className="bg-green-600 hover:bg-green-700 h-14 px-8 font-black rounded-2xl shadow-lg text-white">نشر الطلب</Button>
                  </div>
                </Card>
              ))
            }
            {!istifhamsLoading && istifhams?.length === 0 && <NoData message="لا توجد استفهامات جديدة للمراجعة." />}
          </div>
        </TabsContent>

        <TabsContent value="identity">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {verificationsLoading ? <p className="col-span-full text-center font-bold animate-pulse">جاري تحميل طلبات التوثيق...</p> :
              verifications?.map((v) => (
                <Card key={v.id} className="rounded-[2.5rem] overflow-hidden shadow-lg border-2 hover:border-accent/20 transition-all bg-white group">
                  <CardHeader className="bg-accent/5 p-8 flex flex-col items-center gap-4 text-center">
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                        <AvatarImage src={v.profilePictureUrl} />
                        <AvatarFallback className="text-3xl font-black">{v.fullName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md text-accent">
                        <IdCard size={20} />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">{v.fullName}</CardTitle>
                      <Badge variant="outline" className="mt-2 font-bold border-accent/20 text-accent">{v.role === 'mufhem' ? 'مفهم' : 'طالب'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <Button variant="outline" onClick={() => setSelectedVerification(v)} className="w-full h-12 rounded-xl font-black border-2"><Eye className="ml-2 h-5 w-5" /> مراجعة البطاقة</Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => handleApproveIdentity(v)} className="bg-green-600 hover:bg-green-700 font-black rounded-xl h-12 text-white shadow-md">توثيق</Button>
                      <Button onClick={() => handleRejectIdentity(v)} variant="destructive" className="font-black rounded-xl h-12 shadow-md">رفض</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            }
            {!verificationsLoading && verifications?.length === 0 && <NoData message="لا توجد طلبات توثيق هوية معلقة." />}
          </div>
        </TabsContent>
      </Tabs>

      {/* مودال مراجعة الصورة الشخصية */}
      <TabsContent value="courses" className="mt-0">
        <CourseReviewPanel />
      </TabsContent>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3"><UserCircle className="text-primary h-8 w-8" /> مراجعة بيانات الحساب</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="py-6 space-y-8">
              <div className="flex flex-col items-center gap-6 p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                <Avatar className="h-48 w-48 border-8 border-white shadow-2xl">
                  {/* نعرض الصورة التي رفعها المستخدم حديثاً */}
                  <AvatarImage src={selectedUser.pendingProfilePictureUrl} />
                  <AvatarFallback className="text-5xl font-black">{selectedUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-center space-y-2">
                  <h4 className="text-2xl font-black">{selectedUser.fullName}</h4>
                  <div className="flex gap-2 justify-center">
                    <Badge className="bg-muted text-muted-foreground font-bold">{selectedUser.gender === 'male' ? 'ذكر' : 'أنثى'}</Badge>
                    <Badge className="bg-primary/10 text-primary font-bold">{selectedUser.role === 'mufhem' ? 'خبير' : 'طالب'}</Badge>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 rounded-2xl"><p className="text-zinc-700 font-medium italic">"{selectedUser.bio || 'لا توجد نبذة.'}"</p></div>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleApproveProfile(selectedUser)} className="h-16 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-xl text-white shadow-xl">اعتماد</Button>
                <Button onClick={() => handleRejectProfile(selectedUser)} variant="destructive" className="h-16 rounded-2xl font-black text-xl shadow-xl">رفض</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* مودال مراجعة الاستفهام */}
      <Dialog open={!!selectedIstifham} onOpenChange={() => setSelectedIstifham(null)}>
        <DialogContent className="sm:max-w-[650px] rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3"><HelpCircle className="text-orange-500 h-8 w-8" /> تفاصيل الطلب</DialogTitle>
            <DialogDescription className="text-right text-lg">مراجعة كاملة لمحتوى الاستفهام قبل النشر للمفهمين.</DialogDescription>
          </DialogHeader>
          {selectedIstifham && (
            <div className="py-6 space-y-6 max-h-[70vh] overflow-y-auto px-2 text-right">
              <div className="p-8 bg-orange-50/50 rounded-3xl border-2 border-dashed border-orange-200 space-y-4">
                <h4 className="text-2xl font-black text-zinc-900 leading-tight">{selectedIstifham.title}</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-black text-primary flex items-center gap-2 justify-end">
                      التفاصيل <FileText size={16}/>
                    </Label>
                    <p className="text-zinc-700 leading-relaxed font-bold text-lg">{selectedIstifham.description}</p>
                  </div>
                  {selectedIstifham.goal && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="font-black text-accent flex items-center gap-2 justify-end">
                        هدف الاستفهام <Target size={16}/>
                      </Label>
                      <p className="text-zinc-700 leading-relaxed font-bold text-md italic">"{selectedIstifham.goal}"</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailBox icon={BadgeCent} label="الميزانية" value={`${selectedIstifham.amount} ج.م`} />
                <DetailBox icon={Calendar} label="الموعد المقترح" value={new Date(selectedIstifham.meetingTime).toLocaleString('ar-EG')} />
                <DetailBox icon={User} label="المستفهم" value={selectedIstifham.mustafhemName} />
                <DetailBox icon={Clock} label="تاريخ الطلب" value={new Date(selectedIstifham.createdAt).toLocaleDateString('ar-EG')} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6">
                <Button onClick={() => handleApproveIstifham(selectedIstifham)} className="h-16 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-xl shadow-xl text-white">موافقة ونشر الآن</Button>
                <Button onClick={() => handleRejectIstifham(selectedIstifham)} variant="destructive" className="h-16 rounded-2xl font-black text-xl shadow-xl">رفض الطلب</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* مودال مراجعة وثائق الهوية */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="sm:max-w-[800px] rounded-[3.5rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <DialogHeader className="p-8 border-b bg-zinc-900 text-white flex flex-row justify-between items-center">
            <div>
              <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
                <ShieldCheck className="text-primary h-10 w-10" /> مراجعة وثائق الهوية
              </DialogTitle>
              <DialogDescription className="text-right text-zinc-400 font-bold">
                المستخدم: {selectedVerification?.fullName}
              </DialogDescription>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 text-right">
                  <Label className="font-black text-lg border-r-4 border-primary pr-3 block">الوجه الأمامي (Front)</Label>
                  <div className="aspect-[1.6/1] bg-zinc-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                    {selectedVerification?.idCardFront ? <img src={selectedVerification.idCardFront} className="w-full h-full object-cover" alt="ID Front" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400">لم ترفع</div>}
                  </div>
                </div>
                <div className="space-y-4 text-right">
                  <Label className="font-black text-lg border-r-4 border-primary pr-3 block">الوجه الخلفي (Back)</Label>
                  <div className="aspect-[1.6/1] bg-zinc-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                    {selectedVerification?.idCardBack ? <img src={selectedVerification.idCardBack} className="w-full h-full object-cover" alt="ID Back" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400">لم ترفع</div>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4 pb-6">
                <Button onClick={() => handleApproveIdentity(selectedVerification)} className="h-20 rounded-[2rem] bg-green-600 hover:bg-green-700 font-black text-2xl text-white shadow-2xl transition-all">اعتماد التوثيق</Button>
                <Button onClick={() => handleRejectIdentity(selectedVerification)} variant="destructive" className="h-20 rounded-[2rem] font-black text-2xl shadow-2xl transition-all">رفض الطلب</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailBox({ icon: Icon, label, value }: any) {
  return (
    <div className="p-4 bg-muted/20 rounded-2xl border-2 border-transparent hover:border-muted transition-all flex items-center gap-4">
      <div className="bg-white p-3 rounded-xl shadow-sm text-primary"><Icon size={20} /></div>
      <div className="text-right">
        <span className="text-[10px] font-black text-muted-foreground block uppercase tracking-wider">{label}</span>
        <span className="font-black text-zinc-900">{value}</span>
      </div>
    </div>
  );
}

function NoData({ message }: { message: string }) {
  return (
    <div className="col-span-full py-32 text-center text-muted-foreground font-black text-xl opacity-30 flex flex-col items-center gap-4">
      <FileCheck size={64} />
      {message}
    </div>
  );
}
