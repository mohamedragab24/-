"use client";

import { useState } from "react";
import { CalendarClock, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function AdminNotifications(){
 const { toast } = useToast();
 const { firebaseApp, storage } = useFirebase();
 const [loading,setLoading]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [f,setF]=useState({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:""});
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
   if(!f.title||!f.body||!f.sendAt){toast({variant:"destructive",title:"أكمل البيانات",description:"العنوان والرسالة ووقت الإرسال مطلوبة."});return;}
   setLoading(true);
   try {
     if(!firebaseApp) throw new Error('Firebase غير جاهز');
     const fn=httpsCallable(getFunctions(firebaseApp,'us-central1'),'scheduleNotification');
     await fn({...f,audience:'all',sendAt:new Date(f.sendAt).toISOString()});
     toast({title:"تمت جدولة الإشعار",description:"سيظهر داخل التطبيق وسيصل Push للأجهزة المسجلة."});
     setF({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:""});
   } catch(e:any) { toast({variant:"destructive",title:"تعذر الجدولة",description:e?.message||"حدث خطأ"}); } finally { setLoading(false); }
 };
 return <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto" dir="rtl">
   <div className="border-r-8 border-primary pr-6"><h1 className="text-4xl font-black">الإشعارات والحملات</h1><p className="text-muted-foreground font-bold">الصورة تُرفع من الجهاز إلى Firebase Storage، وليست رابطًا يُطلب من المستخدم كتابته.</p></div>
   <Card className="rounded-[2.5rem] shadow-xl"><CardHeader><CardTitle className="flex items-center gap-3"><CalendarClock className="text-primary"/> إنشاء حملة</CardTitle></CardHeader><CardContent className="space-y-6">
    <div className="grid md:grid-cols-2 gap-5"><div><Label>العنوان</Label><Input value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></div><div><Label>اسم الحملة</Label><Input value={f.campaign} onChange={e=>setF({...f,campaign:e.target.value})}/></div></div>
    <div><Label>الرسالة</Label><Textarea value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></div>
    <div><Label>الوصف</Label><Textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></div>
    <div className="space-y-3"><Label>صورة الإشعار</Label><div className="flex items-center gap-3"><label className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-bold cursor-pointer hover:bg-zinc-50"><ImagePlus className="w-5 h-5"/> رفع صورة من الجهاز<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0]; if(file) uploadImage(file).catch(err=>toast({variant:'destructive',title:'فشل رفع الصورة',description:err?.message||'تعذر الرفع'}));}}/></label>{uploading&&<Loader2 className="animate-spin"/>}</div>{f.imageUrl&&<img src={f.imageUrl} alt="صورة الإشعار" className="h-28 w-48 object-cover rounded-xl border"/>}</div>
    <div><Label>وقت الإرسال</Label><Input type="datetime-local" value={f.sendAt} onChange={e=>setF({...f,sendAt:e.target.value})}/></div>
    <Button disabled={loading||uploading} onClick={submit} className="h-16 w-full rounded-2xl font-black text-xl">{loading?<Loader2 className="animate-spin"/>:<CalendarClock/>} جدولة الإشعار</Button>
   </CardContent></Card></div>;
}
