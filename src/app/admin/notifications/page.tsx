"use client";
import { useState } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
export default function AdminNotifications(){
 const {toast}=useToast(); const [loading,setLoading]=useState(false);
 const [f,setF]=useState({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:""});
 const submit=async()=>{ if(!f.title||!f.body||!f.sendAt){toast({variant:"destructive",title:"أكمل البيانات",description:"العنوان والرسالة ووقت الإرسال مطلوبة."});return;} setLoading(true); try{const fn=httpsCallable(getFunctions(getApp(),'us-central1'),'scheduleNotification'); await fn({...f,audience:'all',sendAt:new Date(f.sendAt).toISOString()}); toast({title:"تمت جدولة الإشعار"}); setF({title:"",body:"",imageUrl:"",campaign:"",description:"",sendAt:""});}catch(e:any){toast({variant:"destructive",title:"تعذر الجدولة",description:e?.message||"حدث خطأ"});}finally{setLoading(false)}};
 return <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto" dir="rtl"><div className="border-r-8 border-primary pr-6"><h1 className="text-4xl font-black">الإشعارات والحملات</h1><p className="text-muted-foreground font-bold">إرسال إشعار فوري أو جدولة حملة لجميع مستخدمي التطبيق.</p></div><Card className="rounded-[2.5rem] shadow-xl"><CardHeader><CardTitle className="flex items-center gap-3"><Bell className="text-primary"/> إنشاء إشعار</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid md:grid-cols-2 gap-5"><div><Label>العنوان</Label><Input value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></div><div><Label>اسم الحملة</Label><Input value={f.campaign} onChange={e=>setF({...f,campaign:e.target.value})}/></div></div><div><Label>الرسالة</Label><Textarea value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></div><div><Label>الوصف</Label><Textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></div><div><Label>رابط الصورة</Label><Input value={f.imageUrl} onChange={e=>setF({...f,imageUrl:e.target.value})} placeholder="https://..."/></div><div><Label>وقت الإرسال</Label><Input type="datetime-local" value={f.sendAt} onChange={e=>setF({...f,sendAt:e.target.value})}/></div><Button disabled={loading} onClick={submit} className="h-16 w-full rounded-2xl font-black text-xl">{loading?<Loader2 className="animate-spin"/>:<CalendarClock/>} جدولة الإشعار</Button></CardContent></Card></div>;
}
