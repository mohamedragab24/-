
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  Briefcase, 
  Clock, 
  Loader2, 
  ToggleLeft,
  ToggleRight,
  Users,
  Eye,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Baby,
  UserCircle,
  GraduationCap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AdminJobs() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", description: "", requirements: "", type: "full-time" });
  const [viewingApplicantsJob, setViewingApplicantsJob] = useState<any>(null);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // تم تبسيط الاستعلام لضمان جلب البيانات دون الحاجة لفهارس يدوية في البداية
    return query(collection(firestore, "jobs"));
  }, [firestore]);

  const { data: rawJobs, isLoading } = useCollection(jobsQuery);
  // الترتيب يتم في الذاكرة لضمان العمل الفوري
  const jobs = rawJobs ? [...rawJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore || !viewingApplicantsJob) return null;
    return query(collection(firestore, "jobs", viewingApplicantsJob.id, "applications"));
  }, [firestore, viewingApplicantsJob]);

  const { data: applicants } = useCollection(applicantsQuery);

  const handlePost = async () => {
    if (!firestore || !newJob.title || !newJob.description) return;
    setIsPosting(true);
    try {
      await addDoc(collection(firestore, "jobs"), {
        ...newJob,
        status: "active",
        createdAt: new Date().toISOString()
      });
      toast({ title: "تم نشر الوظيفة" });
      setNewJob({ title: "", description: "", requirements: "", type: "full-time" });
      setIsModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ" });
    } finally {
      setIsPosting(false);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "jobs", id), { status: current === 'active' ? 'closed' : 'active' });
    toast({ title: "تم تحديث الحالة" });
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "jobs", id));
    toast({ title: "تم الحذف" });
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline">إدارة التوظيف</h1>
          <p className="text-muted-foreground text-lg">نشر الوظائف ومراجعة المتقدمين (السن، العنوان، الهاتف، المهارات).</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="h-16 px-10 rounded-2xl font-black text-xl shadow-xl shadow-primary/20">
          <Plus className="ml-2 h-6 w-6" /> نشر وظيفة جديدة
        </Button>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="py-20 text-center animate-pulse font-black text-2xl">جاري تحميل سجل الوظائف...</div>
        ) : jobs?.map((job) => (
          <Card key={job.id} className={`rounded-[2.5rem] border-2 transition-all shadow-md overflow-hidden bg-white ${job.status === 'closed' ? 'opacity-60' : ''}`}>
            <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-3 text-right flex-1">
                <div className="flex items-center gap-3 justify-end md:justify-start">
                  <Badge className={job.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}>
                    {job.status === 'active' ? 'نشطة' : 'مغلقة'}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-bold">{new Date(job.createdAt).toLocaleString('ar-EG')}</span>
                </div>
                <h3 className="text-2xl font-black text-zinc-900">{job.title}</h3>
                <p className="text-zinc-600 font-bold text-sm">{job.type === 'full-time' ? 'دوام كامل' : 'عمل حر'}</p>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setViewingApplicantsJob(job)} className="h-12 rounded-xl font-bold border-2 bg-blue-50 text-blue-600 border-blue-200">
                  <Users className="ml-2 h-5 w-5" /> المتقدمون
                </Button>
                <Button variant="outline" onClick={() => toggleStatus(job.id, job.status)} className="h-12 rounded-xl font-bold border-2">
                  {job.status === 'active' ? <><ToggleRight className="ml-2 text-green-600" /> إغلاق</> : <><ToggleLeft className="ml-2 text-muted-foreground" /> تفعيل</>}
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(job.id)} className="h-12 rounded-xl font-bold"><Trash2 className="h-5 w-5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3"><Briefcase className="text-primary h-8 w-8" /> نشر فرصة وظيفية</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6 max-h-[60vh] overflow-y-auto px-2">
            <div className="space-y-2"><Label className="font-bold">مسمى الوظيفة</Label><Input placeholder="مثال: مطور تطبيقات" value={newJob.title} onChange={(e) => setNewJob({...newJob, title: e.target.value})} className="h-14 rounded-xl border-2" /></div>
            <div className="space-y-2">
              <Label className="font-bold">نوع الدوام</Label>
              <Select value={newJob.type} onValueChange={(v) => setNewJob({...newJob, type: v})}>
                <SelectTrigger className="h-14 rounded-xl border-2"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">دوام كامل</SelectItem>
                  <SelectItem value="part-time">دوام جزئي</SelectItem>
                  <SelectItem value="project">بالمشروع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label className="font-bold">وصف الوظيفة</Label><Textarea placeholder="اشرح المهام..." value={newJob.description} onChange={(e) => setNewJob({...newJob, description: e.target.value})} className="h-32 rounded-xl border-2" /></div>
          </div>
          <DialogFooter><Button onClick={handlePost} disabled={isPosting} className="w-full h-16 rounded-2xl font-black text-xl">{isPosting ? "جاري النشر..." : "نشر الآن"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingApplicantsJob} onOpenChange={() => setViewingApplicantsJob(null)}>
        <DialogContent className="sm:max-w-[850px] rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3"><Users className="text-primary h-8 w-8" /> المتقدمون لوظيفة {viewingApplicantsJob?.title}</DialogTitle>
            <DialogDescription className="text-right">مراجعة كامل بيانات المتقدمين (الاسم، السن، العنوان، الهاتف، المهارات).</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[550px] mt-6">
            <div className="space-y-6 px-2 pb-10">
              {applicants?.map((app: any) => (
                <Card key={app.id} className="rounded-[2rem] border-2 p-8 bg-zinc-50 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="text-right flex-1">
                      <h4 className="font-black text-2xl text-zinc-900 flex items-center gap-2"><UserCircle className="text-primary" /> {app.userName}</h4>
                      <div className="flex flex-wrap gap-4 mt-3">
                        <span className="bg-white px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 text-zinc-600"><Baby size={14}/> السن: {app.age}</span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 text-zinc-600"><Phone size={14}/> {app.userPhone}</span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 text-zinc-600"><Mail size={14}/> {app.userEmail}</span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 text-zinc-600"><MapPin size={14}/> {app.address}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white h-fit font-bold border-2">{new Date(app.createdAt).toLocaleDateString('ar-EG')}</Badge>
                  </div>
                  <div className="p-6 bg-white rounded-2xl border-2 border-dashed border-primary/20 space-y-3 text-right">
                    <Label className="font-black text-primary text-lg flex items-center gap-2"><GraduationCap size={20}/> المهارات والخبرات:</Label>
                    <p className="text-zinc-700 leading-relaxed font-bold whitespace-pre-wrap">{app.experience}</p>
                  </div>
                </Card>
              ))}
              {(!applicants || applicants.length === 0) && (
                <div className="py-20 text-center opacity-30 font-black text-2xl">لا يوجد متقدمون بعد لهذه الوظيفة.</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
