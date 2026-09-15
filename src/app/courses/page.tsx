"use client";
import React,{useEffect,useState} from 'react';
import Link from 'next/link';
import { Plus, Search, Eye, Edit3, RotateCcw, Clock, CheckCircle2, XCircle, Lock, BookOpen } from 'lucide-react';
import { useFirebase,useFirestore,useDoc,useMemoFirebase } from '@/firebase';
import { collection,query,where } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CourseEditorDialog } from '@/components/courses/course-editor-dialog';
import { withdrawCourse } from '@/lib/course-service';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/lib/types';

export default function CoursesPage(){
 const {user}=useFirebase(); const db=useFirestore(); const {toast}=useToast();
 const profileRef=useMemoFirebase(()=>user?doc(db,'users',user.uid):null,[db,user]); const {data:profile}=useDoc(profileRef); const isMufhem=profile?.role==='mufhem';
 const [search,setSearch]=useState(''); const [open,setOpen]=useState(false); const [edit,setEdit]=useState<Course|null>(null);
 const q=useMemoFirebase(()=>isMufhem&&user?query(collection(db,'courses'),where('instructorId','==',user.uid)):query(collection(db,'courses'),where('status','==','published')),[db,isMufhem,user]);
 const {data:rows,isLoading}=useCollection(q); const courses=(rows||[]).filter((x:any)=>!search||String(x.title||'').toLowerCase().includes(search.toLowerCase())) as any[];
 const makeCourse=(x:any):Course=>({...x,id:x.id,lessons:[],features:Array.isArray(x.features)?x.features:[],coverUrl:x.coverUrl||x.thumbnailUrl||'',status:x.status||'pending',isPublished:x.status==='published'} as Course);
 const cancel=async(c:any)=>{try{await withdrawCourse(db,c.id,user!.uid,profile?.name||user?.displayName||'المُفهم');toast({title:'تم سحب التسجيل',description:'تم سحب الكورس قبل اعتماده ولن يظهر في قائمة المراجعة.'});}catch(e:any){toast({variant:'destructive',title:'تعذر السحب',description:e.message})}};
 return <div className="min-h-screen bg-zinc-50 py-10 px-4 md:px-8" dir="rtl"><div className="max-w-7xl mx-auto space-y-8">
  <div className="bg-zinc-950 text-white rounded-[2rem] p-8 flex flex-col md:flex-row justify-between gap-6"><div><Badge className="mb-3">{isMufhem?'لوحة المُفهم':'مكتبة الكورسات'}</Badge><h1 className="text-4xl font-black">الكورسات</h1><p className="text-zinc-300 mt-2">{isMufhem?'أنشئ الكورس وارفع ملفاته إلى Firebase، ثم أرسله للمراجعة.':'تصفح الكورسات المعتمدة والمتاحة للشراء.'}</p></div>{isMufhem&&<Button onClick={()=>{setEdit(null);setOpen(true)}} className="h-14 rounded-2xl font-black"><Plus className="ml-2"/> إنشاء كورس جديد</Button>}</div>
  <div className="relative"><Search className="absolute right-3 top-3.5 w-4 h-4 text-zinc-400"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن كورس..." className="pr-10 h-12 rounded-2xl bg-white"/></div>
  {isLoading?<div className="py-20 text-center font-bold">جاري تحميل الكورسات...</div>:courses.length===0?<div className="py-24 text-center text-zinc-400 font-black">لا توجد كورسات.</div>:<div className="grid md:grid-cols-2 gap-5">{courses.map((c:any)=><Card key={c.id} className="overflow-hidden rounded-3xl"><div className="aspect-video bg-zinc-100">{c.coverUrl&&<img src={c.coverUrl} className="w-full h-full object-cover"/>}</div><div className="p-5 space-y-3"><div className="flex gap-2"><Badge>{c.category||'عام'}</Badge>{isMufhem&&<Badge variant="outline">{c.status==='pending'?<><Clock className="w-3 h-3 ml-1"/>قيد المراجعة</>:c.status==='published'?<><CheckCircle2 className="w-3 h-3 ml-1"/>منشور</>:c.status==='rejected'?<><XCircle className="w-3 h-3 ml-1"/>مرفوض</>:<><RotateCcw className="w-3 h-3 ml-1"/>مسحوب</>}</Badge>}</div><h2 className="text-xl font-black">{c.title}</h2><p className="text-sm text-zinc-500 line-clamp-2">{c.description}</p><div className="flex items-center justify-between"><b>{c.promotionalPrice||c.price} ج.م</b><span className="text-xs text-zinc-500">بواسطة: {c.instructorName}</span></div>{isMufhem&&c.status==='rejected'&&<div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-bold">سبب الرفض: {c.rejectionReason||'غير محدد'}</div>}<div className="flex gap-2"><Button asChild variant="outline" className="flex-1 rounded-xl"><Link href={`/courses/${c.id}`}><Eye className="w-4 h-4 ml-1"/>معاينة</Link></Button>{isMufhem&&c.status!=='published'&&<><Button variant="outline" className="rounded-xl" onClick={()=>{setEdit(makeCourse(c));setOpen(true)}}><Edit3/></Button>{c.status==='pending'&&<Button variant="destructive" className="rounded-xl" onClick={()=>cancel(c)}><RotateCcw/></Button>}</>}</div></div></Card>)}</div>}
  <CourseEditorDialog open={open} onOpenChange={setOpen} courseToEdit={edit} instructorId={user?.uid||''} instructorName={profile?.name||user?.displayName||'المُفهم'} instructorAvatar={profile?.avatarUrl||user?.photoURL||''} onSaved={()=>{}}/>
 </div></div>
}
