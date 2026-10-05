"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, WalletCards, Pencil, Trash2, Save, X } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_METHODS = [
  { name: "فودافون كاش", accountNumber: "", sortOrder: 1 },
  { name: "أورنج كاش", accountNumber: "", sortOrder: 2 },
  { name: "اتصالات كاش", accountNumber: "", sortOrder: 3 },
  { name: "وي باي", accountNumber: "", sortOrder: 4 },
  { name: "إنستا باي", accountNumber: "", sortOrder: 5 },
  { name: "تحويل بنكي", accountNumber: "", sortOrder: 6 },
];

export default function AdminPaymentMethodsPage() {
  const { user } = useUser(); const firestore = useFirestore(); const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null), [name, setName] = useState(""), [accountNumber, setAccountNumber] = useState(""), [sortOrder, setSortOrder] = useState("1"), [active, setActive] = useState(true), [busy, setBusy] = useState(false);
  const methodsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "paymentMethods"), orderBy("sortOrder", "asc")) : null, [firestore]);
  const { data: methods, isLoading } = useCollection(methodsQuery);
  const reset=()=>{setEditingId(null);setName("");setAccountNumber("");setSortOrder("1");setActive(true)};
  const startEdit=(m:any)=>{setEditingId(m.id);setName(m.name||"");setAccountNumber(m.accountNumber||"");setSortOrder(String(m.sortOrder||1));setActive(m.active!==false)};
  const save=async()=>{if(!firestore||!name.trim()||!accountNumber.trim()){toast({variant:"destructive",title:"بيانات ناقصة",description:"اكتب اسم الوسيلة ورقم الحساب."});return}setBusy(true);try{const data={name:name.trim(),accountNumber:accountNumber.trim(),sortOrder:Number(sortOrder)||1,active,updatedAt:new Date()};if(editingId)await updateDoc(doc(firestore,"paymentMethods",editingId),data);else await addDoc(collection(firestore,"paymentMethods"),{...data,createdAt:new Date()});toast({title:editingId?"تم تعديل وسيلة الدفع":"تمت إضافة وسيلة الدفع"});reset()}catch{toast({variant:"destructive",title:"تعذر الحفظ"})}finally{setBusy(false)}};
  const seedDefaults=async()=>{if(!firestore)return;setBusy(true);try{const existing=new Set((methods||[]).map((m:any)=>m.name));for(const item of DEFAULT_METHODS)if(!existing.has(item.name))await addDoc(collection(firestore,"paymentMethods"),{...item,active:true,createdAt:new Date(),updatedAt:new Date()});toast({title:"تمت إضافة طرق الدفع الافتراضية",description:"عدّل كل وسيلة واكتب رقم الاستقبال."})}catch{toast({variant:"destructive",title:"تعذر إضافة الطرق الافتراضية"})}finally{setBusy(false)}};
  const remove=async(id:string)=>{if(!firestore||!confirm("هل تريد حذف وسيلة الدفع؟"))return;try{await deleteDoc(doc(firestore,"paymentMethods",id));toast({title:"تم حذف وسيلة الدفع"})}catch{toast({variant:"destructive",title:"تعذر الحذف"})}};
  if(!user)return <div className="p-20 text-center font-black">يجب تسجيل الدخول.</div>;
  return <div className="p-6 md:p-10 space-y-8" dir="rtl">
    <div className="border-r-8 border-primary pr-5"><h1 className="text-4xl font-black">إدارة المحافظ</h1><p className="text-muted-foreground font-bold mt-2">إدارة أرقام المحافظ ووسائل الدفع التي تظهر للمستفهم عند شراء الكورس.</p></div>
    <Card className="rounded-[2rem] shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="text-primary"/> إضافة وسيلة دفع</CardTitle></CardHeader><CardContent className="grid md:grid-cols-4 gap-4 items-end">
      <div><Label>اسم الوسيلة</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="فودافون كاش"/></div><div><Label>رقم الحساب الذي يستقبل التحويل</Label><Input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr"/></div><div><Label>الترتيب</Label><Input type="number" value={sortOrder} onChange={e=>setSortOrder(e.target.value)}/></div><div className="flex items-center justify-between gap-3 h-10"><div><Label>مفعلة</Label><p className="text-xs text-muted-foreground">تظهر في الشراء</p></div><Switch checked={active} onCheckedChange={setActive}/></div>
      <div className="md:col-span-4 flex gap-2 flex-wrap"><Button onClick={save} disabled={busy} className="rounded-xl font-black"><Save className="ml-2 h-4 w-4"/>{editingId?"حفظ التعديل":"إضافة"}</Button>{editingId&&<Button variant="outline" onClick={reset} className="rounded-xl"><X className="ml-2 h-4 w-4"/>إلغاء</Button>}<Button variant="secondary" onClick={seedDefaults} disabled={busy} className="rounded-xl font-black">إضافة طرق الدفع الافتراضية</Button></div>
    </CardContent></Card>
    <Card className="rounded-[2rem] shadow-lg overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="text-primary"/> طرق الدفع الحالية</CardTitle></CardHeader><CardContent className="space-y-3">
      {isLoading?<p className="text-center p-8">جارٍ التحميل...</p>:(methods||[]).length===0?<p className="text-center p-8 text-muted-foreground font-bold">لا توجد وسائل دفع بعد. استخدم زر إضافة الطرق الافتراضية أو أضف وسيلة جديدة.</p>:(methods||[]).map((m:any)=><div key={m.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border bg-white"><div className="flex-1"><div className="font-black text-lg">{m.name}</div><div className="font-mono text-primary font-black" dir="ltr">{m.accountNumber}</div></div><Badge className={m.active===false?"bg-zinc-200 text-zinc-700":"bg-emerald-100 text-emerald-700"}>{m.active===false?"موقوفة":"مفعلة"}</Badge><Button variant="outline" onClick={()=>startEdit(m)} className="rounded-xl"><Pencil className="ml-2 h-4 w-4"/>تعديل</Button><Button variant="destructive" onClick={()=>remove(m.id)} className="rounded-xl"><Trash2 className="ml-2 h-4 w-4"/>حذف</Button></div>)}
    </CardContent></Card>
  </div>;
}
