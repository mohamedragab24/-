
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ShieldAlert, Eye, Mail, Phone, Calendar, Clock, Fingerprint, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function AdminAutoBans() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // جلب المستخدمين المحظورين بواسطة النظام
  const bannedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("status", "==", "blocked"), where("bannedBy", "==", "system"));
  }, [firestore]);

  const { data: bannedUsers, isLoading } = useCollection(bannedQuery);

  const filtered = bannedUsers?.filter(u => 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phoneNumber?.includes(searchTerm) ||
    u.id?.includes(searchTerm)
  );

  const handleUnban = (userId: string) => {
    if (!firestore) return;
    const uRef = doc(firestore, "users", userId);
    updateDocumentNonBlocking(uRef, { 
      status: 'active',
      bannedBy: null,
      banReason: null 
    });
    toast({ title: "تم فك الحظر", description: "تم استعادة الحساب بنجاح." });
    setSelectedUser(null);
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-red-600 pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">سجل الحظر التلقائي</h1>
          <p className="text-muted-foreground text-lg">مراجعة الحسابات التي حظرها السيستم بسبب الألفاظ غير اللائقة.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث بالبريد، الايدي أو الهاتف..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 focus:border-red-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2">
        <Table>
          <TableHeader className="bg-red-50 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black text-red-900">المستخدم</TableHead>
              <TableHead className="text-right font-black text-red-900">توقيت الحظر</TableHead>
              <TableHead className="text-right font-black text-red-900">سبب الحظر</TableHead>
              <TableHead className="text-left px-8 font-black text-red-900">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-20 animate-pulse">جاري جلب البيانات...</TableCell></TableRow>
            ) : filtered?.map((u) => (
              <TableRow key={u.id} className="h-24 hover:bg-red-50/30 transition-colors">
                <TableCell className="px-8">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-red-200">
                      <AvatarImage src={u.profilePictureUrl} />
                      <AvatarFallback>{u.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold">{u.fullName}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-sm">
                  {u.bannedAt ? new Date(u.bannedAt).toLocaleString('ar-EG') : "-"}
                </TableCell>
                <TableCell className="max-w-xs truncate font-medium text-red-600">
                  {u.banReason || "حظر سيستم"}
                </TableCell>
                <TableCell className="px-8 text-left">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedUser(u)}
                    className="rounded-xl h-10 border-2 font-bold"
                  >
                    <Eye className="ml-2 h-4 w-4" /> التفاصيل
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!filtered || filtered.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-black opacity-30 text-xl">لا توجد سجلات حظر تلقائي حالياً.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-[2.5rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black mb-2 flex items-center gap-3">
              <ShieldAlert className="text-red-600" /> تفاصيل الحساب المحظور
            </DialogTitle>
            <DialogDescription className="text-right text-lg">بيانات الحظر المسجلة بواسطة النظام.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-6 space-y-6">
              <div className="flex items-center gap-6 p-6 bg-red-50 rounded-3xl">
                <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                  <AvatarImage src={selectedUser.profilePictureUrl} />
                  <AvatarFallback>{selectedUser.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="text-xl font-black">{selectedUser.fullName}</h4>
                  <Badge variant="destructive" className="mt-2">محظور تلقائياً</Badge>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 rounded-3xl border-2 border-dashed space-y-2">
                <Label className="font-black text-red-600">سبب الحظر المسجل:</Label>
                <p className="text-lg font-bold leading-relaxed">{selectedUser.banReason}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem icon={Mail} label="البريد الإلكتروني" value={selectedUser.email} />
                <DetailItem icon={Phone} label="رقم الهاتف" value={selectedUser.phoneNumber} />
                <DetailItem icon={Fingerprint} label="User ID" value={selectedUser.id} full />
              </div>

              <Button 
                onClick={() => handleUnban(selectedUser.id)}
                className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-xl shadow-lg"
              >
                <UserCheck className="ml-2" /> فك الحظر وتفعيل الحساب
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, full }: any) {
  return (
    <div className={`p-4 bg-zinc-50 rounded-2xl border ${full ? 'md:col-span-2' : ''}`}>
      <Label className="flex items-center gap-2 text-muted-foreground font-bold text-xs mb-1">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      <p className="font-black break-all text-sm">{value}</p>
    </div>
  );
}
