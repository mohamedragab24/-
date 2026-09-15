
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Ticket, Percent, Banknote, Calendar, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminCoupons() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    type: "fixed",
    value: "",
    expiryDate: "",
    status: "active"
  });

  const couponsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "coupons"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: coupons, isLoading } = useCollection(couponsQuery);

  const handleAddCoupon = async () => {
    if (!firestore || !newCoupon.code || !newCoupon.value) return;
    
    setIsAdding(true);
    try {
      const couponId = newCoupon.code.toUpperCase();
      await setDoc(doc(firestore, "coupons", couponId), {
        ...newCoupon,
        code: couponId,
        value: Number(newCoupon.value),
        createdAt: new Date().toISOString()
      });
      setNewCoupon({ code: "", type: "fixed", value: "", expiryDate: "", status: "active" });
      toast({ title: "تم إنشاء الكوبون بنجاح" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الإنشاء" });
    } finally {
      setIsAdding(false);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "coupons", id), {
      status: current === 'active' ? 'disabled' : 'active'
    });
    toast({ title: "تم تحديث حالة الكوبون" });
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "coupons", id));
    toast({ title: "تم حذف الكوبون" });
  };

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6">
        <h1 className="text-4xl font-black font-headline text-zinc-900">إدارة الكوبونات والخصومات</h1>
        <p className="text-muted-foreground text-lg">إنشاء وإدارة رموز الترويج لجذب المزيد من المستفهمين.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card className="shadow-xl rounded-[2.5rem] border-2 bg-white h-fit">
          <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Plus className="text-primary" /> إنشاء كوبون جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="font-bold">كود الخصم (Code)</Label>
              <Input 
                placeholder="مثال: SAVE20" 
                value={newCoupon.code} 
                onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
                className="h-12 rounded-xl border-2 font-black uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">النوع</Label>
                <Select value={newCoupon.type} onValueChange={(v) => setNewCoupon({...newCoupon, type: v})}>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                    <SelectItem value="percent">نسبة مئوية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">القيمة</Label>
                <Input 
                  type="number" 
                  value={newCoupon.value} 
                  onChange={(e) => setNewCoupon({...newCoupon, value: e.target.value})}
                  className="h-12 rounded-xl border-2 font-bold text-center"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">تاريخ الانتهاء</Label>
              <Input 
                type="date" 
                value={newCoupon.expiryDate} 
                onChange={(e) => setNewCoupon({...newCoupon, expiryDate: e.target.value})}
                className="h-12 rounded-xl border-2 font-bold"
              />
            </div>
            <Button 
              onClick={handleAddCoupon} 
              disabled={isAdding}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-lg"
            >
              {isAdding ? <Loader2 className="animate-spin" /> : "تفعيل الكوبون الآن"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-2xl font-black flex items-center gap-2">
            <Ticket className="text-primary" /> الكوبونات الحالية ({coupons?.length || 0})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              <div className="col-span-full py-20 text-center animate-pulse font-bold">جاري تحميل الكوبونات...</div>
            ) : coupons?.map((c) => (
              <Card key={c.id} className={`rounded-3xl border-2 overflow-hidden bg-white shadow-md ${c.status !== 'active' ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      {c.type === 'percent' ? <Percent className="text-primary" /> : <Banknote className="text-primary" />}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => toggleStatus(c.id, c.status)} className="rounded-xl h-10 w-10">
                        {c.status === 'active' ? <XCircle className="text-orange-500" /> : <CheckCircle2 className="text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="rounded-xl h-10 w-10 text-red-500">
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <h4 className="text-2xl font-black tracking-widest">{c.code}</h4>
                    <p className="text-sm font-bold text-muted-foreground">
                      خصم {c.value} {c.type === 'percent' ? '%' : 'ج.م'}
                    </p>
                    <div className="pt-4 border-t border-dashed mt-4 flex justify-between items-center">
                      <Badge className={c.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-500'}>
                        {c.status === 'active' ? 'نشط' : 'معطل'}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Calendar size={12} /> ينتهي في: {c.expiryDate || 'غير محدد'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isLoading && coupons?.length === 0 && (
              <div className="col-span-full py-20 text-center bg-zinc-50 rounded-[2rem] border-2 border-dashed font-bold opacity-30">لا توجد كوبونات مضافة بعد.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
