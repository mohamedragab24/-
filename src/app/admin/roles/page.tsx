"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldAlert, ShieldCheck, Search, UserPlus, UserMinus, Shield, Users, Trash2, Phone, Fingerprint, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminRoles() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>(["support"]);
  const [isSearching, setIsSearching] = useState(false);

  // جلب قائمة المسؤولين الحاليين
  const adminsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("isAdmin", "==", true));
  }, [firestore]);

  const { data: currentAdmins, isLoading: isLoadingAdmins } = useCollection(adminsQuery);

  const handleSearch = async () => {
    if (!firestore || !searchQuery.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال البريد، المعرف أو الهاتف للبحث." });
      return;
    }
    
    setTargetUser(null);
    setIsSearching(true);
    const qText = searchQuery.trim().toLowerCase();

    try {
      const usersRef = collection(firestore, "users");
      let foundUser = null;

      // 1. البحث بالـ ID المباشر
      const idDoc = await getDoc(doc(firestore, "users", searchQuery.trim()));
      if (idDoc.exists()) {
        foundUser = { ...idDoc.data(), id: idDoc.id };
      }

      // 2. البحث بالبريد الإلكتروني إذا لم نجد بالـ ID
      if (!foundUser) {
        const qEmail = query(usersRef, where("email", "==", qText), limit(1));
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          foundUser = { ...emailSnap.docs[0].data(), id: emailSnap.docs[0].id };
        }
      }

      // 3. البحث برقم الهاتف إذا لم نجد بعد
      if (!foundUser) {
        const qPhone = query(usersRef, where("phoneNumber", "==", qText), limit(1));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          foundUser = { ...phoneSnap.docs[0].data(), id: phoneSnap.docs[0].id };
        }
      }

      if (foundUser) {
        setTargetUser(foundUser);
        setPermissions(foundUser.adminPermissions || ["support"]);
        toast({ title: "تم العثور على المستخدم", description: `المستخدم: ${foundUser.fullName}` });
      } else {
        toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على أي مستخدم بهذه البيانات." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "خطأ", description: "فشلت عملية البحث." });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleAdminStatus = async (userToUpdate: any = null) => {
    const target = userToUpdate || targetUser;
    if (!firestore || !target) return;
    
    const masterEmails = ["mohamed76y@gmail.com", "mohamjedminijd2006@gmail.com", "mohamedmini2006@gamil.com"];
    if (masterEmails.includes(target.email)) {
      toast({ variant: "destructive", title: "تنبيه", description: "لا يمكن سحب صلاحيات المسؤول الماستر." });
      return;
    }

    const isNowAdmin = !target.isAdmin;
    
    try {
      await updateDoc(doc(firestore, "users", target.id), {
        isAdmin: isNowAdmin,
        adminPermissions: isNowAdmin ? permissions : []
      });

      await addDoc(collection(firestore, "adminLogs"), {
        action: isNowAdmin ? 'grant_admin' : 'revoke_admin',
        targetUserId: target.id,
        targetUserName: target.fullName,
        details: isNowAdmin ? `تم منح صلاحيات: ${permissions.join(', ')}` : 'تم سحب كافة الصلاحيات الإدارية',
        timestamp: new Date().toISOString()
      });

      toast({ 
        title: isNowAdmin ? "تم التعيين كمسؤول!" : "تم سحب الصلاحية", 
        description: `تم تحديث رتبة ${target.fullName} بنجاح.` 
      });
      
      if (targetUser?.id === target.id) {
        setTargetUser({ ...targetUser, isAdmin: isNowAdmin, adminPermissions: isNowAdmin ? permissions : [] });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث الصلاحيات الإدارية." });
    }
  };

  const handlePermissionChange = (perm: string) => {
    setPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <div className="p-6 md:p-10 space-y-12" dir="rtl">
      <div className="border-r-8 border-red-600 pr-6 text-right">
        <h1 className="text-4xl font-black font-headline text-zinc-900">إدارة المنصة (فريق العمل)</h1>
        <p className="text-muted-foreground text-lg">تحكم في صلاحيات المسؤولين المساعدين وإدارة الرتب.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* قسم البحث والتعيين */}
        <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white h-fit">
          <CardHeader className="bg-zinc-900 text-white p-8 text-right">
            <CardTitle className="text-2xl font-black flex items-center gap-4 justify-end">
              <UserPlus className="h-8 w-8 text-primary" /> إضافة / تعديل مسؤول
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <Label className="text-lg font-bold">ابحث عن مستخدم (بريد / ID / هاتف)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="أدخل البيانات هنا..." 
                  className="h-14 text-lg rounded-2xl border-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching} className="h-14 px-8 rounded-2xl bg-zinc-800">
                  {isSearching ? <Loader2 className="animate-spin" /> : <Search className="h-6 w-6" />}
                </Button>
              </div>
            </div>

            {targetUser && (
              <div className="p-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed space-y-6 animate-in fade-in">
                <div className="flex items-center gap-4 justify-end">
                  <div className="text-right">
                    <h4 className="text-xl font-black">{targetUser.fullName}</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Mail size={10}/> {targetUser.email}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Phone size={10}/> {targetUser.phoneNumber}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Fingerprint size={10}/> {targetUser.id}</span>
                    </div>
                  </div>
                  <Avatar className="h-20 w-20 border-4 border-white shadow-md">
                    <AvatarImage src={targetUser.profilePictureUrl} />
                    <AvatarFallback className="text-xl font-black">{targetUser.fullName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>

                <div className="space-y-4 bg-white p-6 rounded-2xl border">
                  <h5 className="font-black text-primary flex items-center gap-2 justify-end">
                    <Shield size={18} /> الصلاحيات المتاحة
                  </h5>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'finance', label: 'إدارة المالية (شحن وسحب)' },
                      { id: 'support', label: 'الدعم الفني (الرد على التذاكر)' },
                      { id: 'moderator', label: 'الرقابة (حظر وتوثيق ومراجعة)' },
                      { id: 'superadmin', label: 'سوبر أدمن (تحكم كامل في المنصة)' }
                    ].map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-zinc-50 cursor-pointer justify-end">
                        <Label htmlFor={p.id} className="cursor-pointer font-bold">{p.label}</Label>
                        <Checkbox 
                          id={p.id} 
                          checked={permissions.includes(p.id)} 
                          onCheckedChange={() => handlePermissionChange(p.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => toggleAdminStatus()}
                  variant={targetUser.isAdmin ? "destructive" : "default"}
                  className="w-full h-14 text-xl font-black rounded-2xl shadow-lg"
                >
                  {targetUser.isAdmin ? <><UserMinus className="ml-2 h-6 w-6" /> سحب الرتبة الإدارية</> : <><UserPlus className="ml-2 h-6 w-6" /> تفعيل كمسؤول مساعد</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* قائمة المسؤولين الحاليين */}
        <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
          <CardHeader className="bg-primary p-8 text-white text-right">
            <CardTitle className="text-2xl font-black flex items-center gap-4 justify-end">
              <Users className="h-8 w-8" /> المسؤولون في المنصة
            </CardTitle>
          </CardHeader>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-14">
                  <TableHead className="text-right px-6 font-black text-zinc-900">المسؤول</TableHead>
                  <TableHead className="text-right font-black text-zinc-900">الصلاحيات</TableHead>
                  <TableHead className="text-left px-6 font-black text-zinc-900">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAdmins ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10 animate-pulse font-bold">جاري تحميل فريق العمل...</TableCell></TableRow>
                ) : currentAdmins?.map((admin) => (
                  <TableRow key={admin.id} className="h-20 hover:bg-muted/30">
                    <TableCell className="px-6 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                          <p className="font-bold text-sm leading-tight">{admin.fullName}</p>
                          <p className="text-[10px] text-muted-foreground">{admin.email}</p>
                        </div>
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={admin.profilePictureUrl} />
                          <AvatarFallback>{admin.fullName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {admin.adminPermissions?.map((p: string) => (
                          <Badge key={p} variant="secondary" className="text-[10px] font-bold px-2">{p}</Badge>
                        )) || <Badge variant="outline" className="text-[10px]">مسؤول ماستر</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-left">
                      {admin.email !== "mohamed76y@gmail.com" && admin.email !== "mohamjedminijd2006@gmail.com" && admin.email !== "mohamedmini2006@gamil.com" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:bg-red-50 rounded-xl"
                          onClick={() => toggleAdminStatus(admin)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoadingAdmins && currentAdmins?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">لا يوجد مسؤولون مساعدون حالياً.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
