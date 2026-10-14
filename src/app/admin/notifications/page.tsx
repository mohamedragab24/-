"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

export default function AdminNotifications(){
 const { toast } = useToast();
 const { firebaseApp, storage, firestore } = useFirebase();
 const [loading,setLoading]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [f,setF]=useState({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:"",deliveryMode:"push"}); // push = خارج التطبيق (شريط الهاتف) | in_app = داخل التطبيق
 const [history,setHistory]=useState<any[]>([]);
 useEffect(()=>{ if(!firestore) return; const q=query(collection(firestore,"scheduledNotifications"),orderBy("createdAt","desc"),limit(100)); return onSnapshot(q,s=>setHistory(s.docs.map(d=>({id:d.id,...d.data()})))); },[firestore]);
 const uploadImage=async(file:File)=>{
   if(!storage) throw new Error('خدمة التخزين غير متاحة');
   setUploading(true);
   try {
     const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
     const imageRef=ref(storage,`notifications/${Date.now()}_${safe}`);
     await uploadBytes(imageRef,file,{contentType:file.type||'image/jpeg'});
     const url=await getDownloadURL(imageRef);
     setF(v=>({...v,imageUrl:url}));
   } finally { setUploading(false); }
 };
 const submit=async()=>{
   if(!f.title||!f.body){toast({variant:"destructive",title:"أكمل البيانات",description:"العنوان والرسالة مطلوبان."});return;}
   setLoading(true);
   try {
     if(!firebaseApp) throw new Error('Firebase غير جاهز');
     const fn=httpsCallable(getFunctions(firebaseApp,'us-central1'),'scheduleNotification');
     const res:any=await fn({...f,audience:'all',sendAt:f.sendAt?new Date(f.sendAt).toISOString():''});
     toast({title:res?.data?.immediate?"تم إرسال الإشعار":"تمت جدولة الإشعار",description:res?.data?.immediate?(f.deliveryMode==='push'?`وصل لـ ${res.data.sent} جهاز في شريط الهاتف.`:`ظهر داخل التطبيق لـ ${res.data.inApp} مستخدم.`):"سيُرسل في الموعد المحدد."});
     setF({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:"",deliveryMode:"push"});
   } catch(e:any) { toast({variant:"destructive",title:"تعذر الجدولة",description:e?.message||"حدث خطأ"}); } finally { setLoading(false); }
 };
 return <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto" dir="rtl">
   <div className="border-r-8 border-primary pr-6"><h1 className="text-4xl font-black">الإشعارات والحملات</h1><p className="text-muted-foreground font-bold">الصورة تُرفع من الجهاز إلى Firebase Storage، وليست رابطًا يُطلب من المستخدم كتابته.</p></div>
   <Card className="rounded-[2.5rem] shadow-xl"><CardHeader><CardTitle className="flex items-center gap-3"><CalendarClock className="text-primary"/> إنشاء حملة</CardTitle></CardHeader><CardContent className="space-y-6">
    <div className="grid md:grid-cols-2 gap-5"><div><Label>العنوان</Label><Input value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></div><div><Label>اسم الحملة</Label><Input value={f.campaign} onChange={e=>setF({...f,campaign:e.target.value})}/></div></div>
    <div><Label>الرسالة</Label><Textarea value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></div>
    <div><Label>الوصف</Label><Textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></div>
    <div className="space-y-3"><Label>صورة الإشعار</Label><div className="flex items-center gap-3"><label className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-bold cursor-pointer hover:bg-zinc-50"><ImagePlus className="w-5 h-5"/> رفع صورة من الجهاز<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0]; if(file) uploadImage(file).catch(err=>toast({variant:'destructive',title:'فشل رفع الصورة',description:err?.message||'تعذر الرفع'}));}}/></label>{uploading&&<Loader2 className="animate-spin"/>}</div>{f.imageUrl&&<img src={f.imageUrl} alt="صورة الإشعار" className="h-28 w-48 object-cover rounded-xl border"/>}</div>
    <div><Label>وقت الإرسال (اتركه فارغًا للإرسال الآن)</Label><Input type="datetime-local" value={f.sendAt} onChange={e=>setF({...f,sendAt:e.target.value})}/></div>
    <div className="space-y-2"><Label>مكان ظهور الرسالة</Label><div className="grid sm:grid-cols-2 gap-3">
      <button type="button" onClick={()=>setF({...f,deliveryMode:"in_app"})} className={"rounded-2xl border-2 p-4 text-right transition "+(f.deliveryMode==="in_app"?"border-primary bg-primary/5":"hover:bg-zinc-50")}><p className="font-black">داخل التطبيق</p><p className="text-xs text-muted-foreground mt-1">تظهر في شاشة الإشعارات داخل التطبيق.</p></button>
      <button type="button" onClick={()=>setF({...f,deliveryMode:"push"})} className={"rounded-2xl border-2 p-4 text-right transition "+(f.deliveryMode==="push"?"border-primary bg-primary/5":"hover:bg-zinc-50")}><p className="font-black">خارج التطبيق</p><p className="text-xs text-muted-foreground mt-1">تصل في شريط إشعارات الهاتف بالعنوان والوصف والصورة.</p></button>
    </div></div>
    <Button disabled={loading||uploading} onClick={submit} className="h-16 w-full rounded-2xl font-black text-xl">{loading?<Loader2 className="animate-spin"/>:<CalendarClock/>} {f.sendAt?"جدولة الإشعار":"إرسال الآن"}</Button>
   </CardContent></Card>
   <Card className="rounded-[2.5rem] shadow-xl">
    <CardHeader><CardTitle>سجل الإشعارات والحملات السابقة</CardTitle></CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right"><thead><tr className="border-b"><th className="p-3">الحملة</th><th className="p-3">العنوان</th><th className="p-3">الموعد</th><th className="p-3">الحالة</th><th className="p-3">القناة</th><th className="p-3">تم الإرسال</th><th className="p-3">فشل</th><th className="p-3">آخر خطأ</th></tr></thead>
        <tbody>{history.length===0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد حملات بعد</td></tr> : history.map(n=><tr key={n.id} className="border-b"><td className="p-3 font-bold">{n.campaign||'—'}</td><td className="p-3">{n.title||'—'}</td><td className="p-3">{n.sendAt?.toDate ? n.sendAt.toDate().toLocaleString('ar-EG') : '—'}</td><td className="p-3">{n.status==='sent'?'تم الإرسال':n.status==='processing'?'جارٍ الإرسال':n.status==='pending'?'مجدولة':n.status==='partial'?'وصل جزئيًا':n.status==='failed'?'فشل الإرسال':n.status||'—'}</td><td className="p-3">{n.deliveryMode==='in_app'?'داخل التطبيق':n.deliveryMode==='push'?'Push فقط':'التطبيق + Push'}</td><td className="p-3">{typeof n.sentCount==='number'?n.sentCount:'—'}</td><td className="p-3">{typeof n.failedCount==='number'?n.failedCount:'—'}</td><td className="p-3 max-w-40 truncate" title={n.lastError||''}>{n.lastError||'—'}</td></tr>)}</tbody></table>
      </div>
    </CardContent>
   </Card>
 </div>;
}
