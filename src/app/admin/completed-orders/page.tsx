
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  CreditCard, 
  Hash, 
  User, 
  Calendar, 
  Search, 
  Eye, 
  FileText,
  BadgeCent,
  Zap,
  Ticket,
  Clock
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/**
 * صفحة الطلبات المكتملة في لوحة التحكم.
 * تعرض تفاصيل الدفع، رقم الطلب، والمفهم والمستفهم.
 */
export default function AdminCompletedOrders() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const completedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "istifhams"), 
      where("status", "==", "completed"),
      orderBy("completedAt", "desc"),
      limit(200)
    );
  }, [firestore]);

  const { data: orders, isLoading } = useCollection(completedQuery);

  const filteredOrders = orders?.filter(o => 
    o.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id?.includes(searchTerm) ||
    o.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.mustafhemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.mufhemName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-green-600 pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">الطلبات المكتملة</h1>
          <p className="text-muted-foreground text-lg">سجل العمليات المالية والتعليمية الناجحة في المنصة.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input 
            placeholder="ابحث برقم الفاتورة، الطلب، أو الاسم..." 
            className="h-14 pr-12 rounded-2xl shadow-sm border-2 focus:border-green-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-2xl rounded-[2.5rem] overflow-hidden border-2 bg-white">
        <Table>
          <TableHeader className="bg-green-50 h-16">
            <TableRow>
              <TableHead className="text-right px-8 font-black text-green-900">رقم الفاتورة</TableHead>
              <TableHead className="text-right font-black text-green-900">المحاضرة</TableHead>
              <TableHead className="text-right font-black text-green-900">المبلغ</TableHead>
              <TableHead className="text-right font-black text-green-900">تاريخ الإكمال</TableHead>
              <TableHead className="text-left px-8 font-black text-green-900">التفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 animate-pulse font-bold">جاري تحميل السجلات...</TableCell></TableRow>
            ) : filteredOrders?.map((order) => (
              <TableRow key={order.id} className="h-24 hover:bg-green-50/30 transition-colors">
                <TableCell className="px-8 font-mono text-sm font-black text-zinc-700">
                  {order.invoiceNumber || "#" + order.id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-right">
                    <span className="font-bold text-zinc-800 line-clamp-1">{order.title}</span>
                    <span className="text-[10px] text-muted-foreground">{order.mustafhemName} (طالب) & {order.mufhemName} (خبير)</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-black text-green-600 text-lg">{order.amount} ج.م</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-xs font-bold text-zinc-500 flex items-center gap-1 justify-end">
                    <Clock size={12} /> {order.completedAt ? new Date(order.completedAt).toLocaleDateString('ar-EG') : "-"}
                  </span>
                </TableCell>
                <TableCell className="px-8 text-left">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)} className="rounded-xl h-10 w-10 text-green-600 hover:bg-green-100">
                    <Eye size={20} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!filteredOrders || filteredOrders.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-black opacity-30 text-xl">لا توجد طلبات مكتملة حالياً.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <DialogHeader className="p-8 bg-zinc-900 text-white">
            <DialogTitle className="text-right text-3xl font-black flex items-center gap-3">
              <CheckCircle2 className="text-green-500" /> تفاصيل الطلب المكتمل
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-right">مراجعة البيانات المالية والتقنية الدقيقة.</DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-[#F8FAFC]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailBox icon={Hash} label="رقم الطلب (Order ID)" value={selectedOrder?.id} full />
              <DetailBox icon={FileText} label="رقم الفاتورة" value={selectedOrder?.invoiceNumber || "N/A"} />
              <DetailBox icon={CreditCard} label="طريقة الدفع" value="محفظة فهمت (خصم مباشر)" />
              <DetailBox icon={User} label="المستفهم" value={selectedOrder?.mustafhemName} />
              <DetailBox icon={Zap} label="المفهم" value={selectedOrder?.mufhemName} />
              <DetailBox icon={BadgeCent} label="إجمالي المبلغ" value={`${selectedOrder?.amount} ج.م`} color="text-green-600" />
              <DetailBox icon={Calendar} label="تاريخ الإكمال" value={selectedOrder?.completedAt ? new Date(selectedOrder.completedAt).toLocaleString('ar-EG') : "مسجل"} />
              <DetailBox icon={CheckCircle2} label="حالة العملية" value="مكتملة ومؤكدة" color="text-green-600" />
            </div>

            {selectedOrder?.couponApplied && (
              <div className="p-6 bg-orange-50 rounded-3xl border-2 border-orange-100 flex justify-between items-center px-8">
                <div className="flex items-center gap-3">
                  <Ticket className="text-orange-600" />
                  <span className="font-black text-orange-800">الكوبون المستخدم:</span>
                </div>
                <span className="font-mono font-black text-xl text-orange-900">{selectedOrder.couponApplied}</span>
              </div>
            )}

            <div className="p-6 bg-white rounded-3xl border-2 border-dashed space-y-2 shadow-sm">
              <Label className="font-black text-zinc-400 text-[10px] uppercase">موضوع المحاضرة</Label>
              <h4 className="text-xl font-black text-zinc-800">{selectedOrder?.title}</h4>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed">{selectedOrder?.description}</p>
            </div>
          </div>

          <div className="p-6 bg-zinc-50 border-t flex justify-end">
            <Button onClick={() => setSelectedOrder(null)} className="rounded-xl px-10 h-12 font-black">إغلاق النافذة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailBox({ icon: Icon, label, value, color, full }: any) {
  return (
    <div className={`p-4 bg-white rounded-2xl border shadow-sm flex items-center gap-4 ${full ? 'md:col-span-2' : ''}`}>
      <div className="p-2 bg-zinc-50 rounded-xl text-primary"><Icon size={20} /></div>
      <div className="text-right flex-1 min-w-0">
        <p className="text-[10px] font-black text-muted-foreground uppercase">{label}</p>
        <p className={`font-black text-sm truncate ${color || 'text-zinc-800'}`}>{value}</p>
      </div>
    </div>
  );
}
