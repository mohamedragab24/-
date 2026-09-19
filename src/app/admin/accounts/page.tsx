
"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, updateDoc, addDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Mail, Phone, Fingerprint, ShieldCheck, Loader2, Key, UserCheck, UserX, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Badge } from "@/components/ui/badge";

/**
 * مركز التوثيق اليدوي والبحث عن الحسابات.
 * يسمح للمسؤول بالبحث عن أي مستخدم عبر (Email, Phone, ID) ومنحه شارة التوثيق.
 */
export default function AdminAccountManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const handleSearch = async () => {
    if (!firestore || !searchQuery.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال البيانات للبحث." });
      return;
    }

    setIsSearching(true);
    setTargetUser(null);
    const text = searchQuery.trim();

    try {
      const usersRef = collection(firestore, "users");
      let foundUser = null;

      // 1. البحث بالـ ID
      const idDoc = await getDoc(doc(firestore, "users", text));
      if (idDoc.exists()) {
        foundUser = { ...idDoc.data(), id: idDoc.id };
      }

      // 2. البحث بالبريد
      if (!foundUser) {
        const qEmail = query(usersRef, where("email", "==", text.toLowerCase()), limit(1));
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          foundUser = { ...emailSnap.docs[0].data(), id: emailSnap.docs[0].id };
        }
      }

      // 3. البحث بالهاتف
      if (!foundUser) {
        const qPhone = query(usersRef, where("phoneNumber", "==", text), limit(1));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          foundUser = { ...phoneSnap.docs[0].data(), id: phoneSnap.docs[0].id };
        }
      }

      if (foundUser) {
        setTargetUser(foundUser);
        toast({ title: "تم العثور على الحساب" });
      } else {
        toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على أي مستخدم بهذه البيانات." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "خطأ", description: "فشل عملية البحث." });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleVerification = async () => {
    if (!firestore || !targetUser) return;
    setIsUpdating(true);
    const newStatus = !targetUser.isVerified;

    try {
      const userRef = doc(firestore, "users", targetUser.id);
      await updateDoc(userRef, { 
        isVerified: newStatus,
        verificationStatus: newStatus ? 'verified' : 'none'
      });

      await addDoc(collection(firestore, "adminLogs"), {
        action: newStatus ? 'verify_user' : 'unverify_user',
        targetUserId: targetUser.id,
        details: `تم ${newStatus ? 'منح' : 'سحب'} شارة التوثيق يدوياً من مركز البحث`,
        timestamp: new Date().toISOString()
      });

      setTargetUser({ ...targetUser, isVerified: newStatus });
      toast({ title: newStatus ? "تم التوثيق بنجاح" : "تم إلغاء التوثيق" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث حالة التوثيق." });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6 text-right">
        <h1 className="text-4xl font-black font-headline text-zinc-900">البحث والتوثيق اليدوي</h1>
        <p className="text-muted-foreground text-lg font-bold">ابحث عن أي مستخدم بواسطة البريد، الهاتف، أو الـ ID ومنحه شارة التوثيق.</p>
      </div>

      <Card className="max-w-3xl mx-auto shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
        <CardHeader className="bg-zinc-900 text-white p-10 text-right">
          <CardTitle className="text-2xl font-black flex items-center gap-4 justify-end">
            <Search className="text-primary h-8 w-8" /> محرك بحث الحسابات
          </CardTitle>
          <CardDescription className="text-zinc-400 font-bold">أدخل البريد الإلكتروني، رقم الهاتف، أو User ID للوصول الفوري.</CardDescription>
        </CardHeader>
        <CardContent className="p-10 space-y-8 text-right">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label className="font-black text-lg">بيانات البحث</Label>
              <Input 
                placeholder="مثال: name@example.com أو 010... أو ID" 
                className="h-16 text-xl rounded-2xl border-2 font-bold text-right"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 mt-8 shadow-lg shadow-primary/20"
            >
              {isSearching ? <Loader2 className="animate-spin h-6 w-6" /> : <Search className="h-6 w-6" />}
            </Button>
          </div>

          <div className="p-8 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed space-y-5">
            <h3 className="text-2xl font-black flex items-center gap-2 justify-end"><ShieldCheck className="text-primary"/> إنشاء حساب أدمن</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Input placeholder="الاسم" value={adminName} onChange={e=>setAdminName(e.target.value)} />
              <Input placeholder="البريد الإلكتروني" type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} />
              <Input placeholder="كلمة المرور (8+ أحرف)" type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} />
            </div>
            <Button disabled={creatingAdmin} className="w-full h-14 rounded-2xl font-black" onClick={async()=>{if(!adminEmail||adminPassword.length<8)return;setCreatingAdmin(true);try{await httpsCallable(getFunctions(getApp(),'us-central1'),'createAdminAccount')({email:adminEmail,password:adminPassword,name:adminName});toast({title:'تم إنشاء حساب الأدمن'});setAdminName('');setAdminEmail('');setAdminPassword('');}catch(e:any){toast({variant:'destructive',title:'تعذر إنشاء الأدمن',description:e?.message||'خطأ'});}finally{setCreatingAdmin(false);}}}>{creatingAdmin?<Loader2 className="animate-spin"/>:<Key/>} إنشاء حساب أدمن</Button>
          </div>

          {targetUser && (
            <div className="p-10 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-6 p-6 bg-white rounded-3xl shadow-sm border justify-end">
                <div className="space-y-1 text-right">
                  <h4 className="text-3xl font-black flex items-center gap-2 justify-end">
                    {targetUser.isVerified && <ShieldCheck className="text-blue-500" />}
                    {targetUser.fullName}
                  </h4>
                  <Badge variant="secondary" className="px-4 py-1 text-sm font-black mr-auto block w-fit">
                    {targetUser.role === 'mufhem' ? 'مفهم معتمد' : 'مستفهم طموح'}
                  </Badge>
                </div>
                <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                  <AvatarImage src={targetUser.profilePictureUrl} />
                  <AvatarFallback className="text-3xl font-black">{targetUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoBox icon={Mail} label="البريد الإلكتروني" value={targetUser.email} />
                <InfoBox icon={Phone} label="رقم الهاتف" value={targetUser.phoneNumber} />
                <InfoBox icon={Fingerprint} label="User ID" value={targetUser.id} full />
                
                {/* زر التوثيق اليدوي */}
                <div className="md:col-span-2">
                  <Button 
                    onClick={toggleVerification} 
                    disabled={isUpdating}
                    className={`w-full h-20 rounded-3xl font-black text-2xl shadow-xl transition-all ${
                      targetUser.isVerified 
                        ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100" 
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isUpdating ? <Loader2 className="animate-spin ml-2" /> : (targetUser.isVerified ? <UserX className="ml-2" /> : <UserCheck className="ml-2" />)}
                    {targetUser.isVerified ? "إلغاء توثيق الحساب" : "منح شارة التوثيق الزرقاء"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, full }: any) {
  return (
    <div className={`p-6 bg-white rounded-2xl border shadow-sm space-y-1 text-right ${full ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground font-black text-xs justify-end">
        {label} <Icon size={14} className="text-primary" />
      </div>
      <p className="text-lg font-black text-zinc-900 truncate">{value}</p>
    </div>
  );
}
