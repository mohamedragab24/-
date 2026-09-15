
"use client";

import { useEffect, useState } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  BadgeCent, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  Star,
  Download,
  FileCheck,
  User,
  Users2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * صفحة الملخص العام للوحة التحكم - تم إصلاح كافة الاستيرادات المفقودة.
 */
export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user?.uid]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const [stats, setStats] = useState({
    mufahems: 0,
    mustafhems: 0,
    pendingApprovals: 0,
    pendingVerifications: 0,
    totalVolume: 0,
    platformRevenue: 0,
    totalUsers: 0,
    pendingPayouts: 0,
    avgRating: 5.0
  });

  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com";
    if (!isProfileLoading && profile && !profile.isAdmin && !isMasterAdmin) {
      router.push("/");
    }
  }, [profile, isProfileLoading, router, user?.email]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!firestore) return;
      try {
        const mufQuery = query(collection(firestore, "users"), where("role", "==", "mufhem"));
        const musQuery = query(collection(firestore, "users"), where("role", "==", "mustafhem"));
        const appQuery = query(collection(firestore, "users"), where("profilePicturePending", "==", true));
        const verQuery = query(collection(firestore, "users"), where("verificationStatus", "==", "pending"));
        const completedRequestsQuery = query(collection(firestore, "istifhams"), where("status", "==", "completed"));
        const lastRequestsQuery = query(collection(firestore, "istifhams"), orderBy("createdAt", "desc"), limit(5));
        const payoutQuery = query(collection(firestore, "payoutRequests"), where("status", "==", "pending"));

        const [mufSnap, musSnap, appSnap, verSnap, completedSnap, lastSnap, payoutSnap] = await Promise.all([
          getDocs(mufQuery),
          getDocs(musQuery),
          getDocs(appQuery),
          getDocs(verQuery),
          getDocs(completedRequestsQuery),
          getDocs(lastRequestsQuery),
          getDocs(payoutQuery)
        ]);

        let totalVolume = 0;
        let totalRatings = 0;
        let ratedCount = 0;

        completedSnap.forEach(doc => {
          const d = doc.data();
          totalVolume += (d.amount || 0);
          if (d.understandingRating) {
            totalRatings += d.understandingRating;
            ratedCount++;
          }
        });

        const platformRevenue = totalVolume * 0.2;

        setStats({
          mufahems: mufSnap.size,
          mustafhems: musSnap.size,
          pendingApprovals: appSnap.size,
          pendingVerifications: verSnap.size,
          totalVolume: totalVolume,
          platformRevenue: platformRevenue,
          totalUsers: mufSnap.size + musSnap.size,
          pendingPayouts: payoutSnap.size,
          avgRating: ratedCount > 0 ? totalRatings / ratedCount : 5.0
        });

        setRecentRequests(lastSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));

      } catch (e) {
        console.error("Error fetching admin stats:", e);
      }
    };
    fetchStats();
  }, [firestore]);

  const isMasterAdmin = user?.email === "mohamed76y@gmail.com" || user?.email === "mohamjedminijd2006@gmail.com";
  
  if (isUserLoading || isProfileLoading) return <div className="p-20 text-center font-black animate-pulse text-2xl">جاري التحقق من صلاحيات المسؤول...</div>;
  if (!profile?.isAdmin && !isMasterAdmin) return null;

  const chartData = [
    { name: "إجمالي التداول", value: stats.totalVolume, color: "hsl(var(--primary))" },
    { name: "إيرادات المنصة", value: stats.platformRevenue, color: "hsl(var(--accent))" },
    { name: "أرباح المفهمين", value: stats.totalVolume - stats.platformRevenue, color: "#10b981" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-r-8 border-primary pr-6">
        <div className="space-y-1 text-right">
          <h1 className="text-4xl md:text-5xl font-black font-headline text-zinc-900">نظرة عامة على النظام</h1>
          <p className="text-muted-foreground text-lg font-bold">تحليل شامل للإحصائيات، المستخدمين، والإيرادات المالية في منصة فهمت.</p>
        </div>
        <div className="flex items-center gap-3 bg-primary/10 px-6 py-3 rounded-2xl shadow-sm border border-primary/10">
          <Activity className="text-primary animate-pulse" />
          <span className="font-bold text-primary">النظام يعمل بكفاءة عالية</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="إجمالي المستخدمين" value={stats.totalUsers} icon={Users2} color="bg-blue-500" />
        <StatCard title="إيرادات المنصة" value={`${stats.platformRevenue.toLocaleString()} ج.م`} icon={BadgeCent} color="bg-green-600" />
        <StatCard title="طلبات سحب معلقة" value={stats.pendingPayouts} icon={Download} color="bg-orange-500" />
        <StatCard title="معدل تقييم المنصة" value={stats.avgRating.toFixed(1)} icon={Star} color="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white hover:border-primary/20 transition-all">
          <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-black flex items-center gap-3 text-primary">
              <FileCheck className="text-primary" /> مراجعات معلقة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border">
              <span className="font-bold text-zinc-600">صور شخصية (Approvals)</span>
              <Badge className="bg-primary text-lg px-4 py-1 rounded-xl">{stats.pendingApprovals}</Badge>
            </div>
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border">
              <span className="font-bold text-zinc-600">توثيق الهوية (Verification)</span>
              <Badge className="bg-accent text-lg px-4 py-1 rounded-xl">{stats.pendingVerifications}</Badge>
            </div>
            <Button 
              onClick={() => router.push('/admin/approvals')}
              className="w-full h-14 rounded-xl font-black text-lg bg-zinc-900 shadow-lg"
            >
              انتقل لمركز الاعتماد <ArrowUpRight className="mr-2" size={20} />
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-2xl rounded-[3rem] border-2 p-8 bg-white">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="font-black text-2xl flex items-center gap-3 justify-end text-zinc-800">
              توزيع السيولة والنمو <TrendingUp className="text-primary" />
            </CardTitle>
          </CardHeader>
          <div className="h-64">
            {hasMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ right: 40, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontWeight: 'black', fontSize: 12 }} orientation="right" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'right' }}
                    formatter={(value: any) => [`${value.toLocaleString()} ج.م`, 'المبلغ']}
                  />
                  <Bar dataKey="value" radius={[10, 0, 0, 10]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-2xl rounded-[3rem] border-2 overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b p-6">
            <CardTitle className="font-black text-xl flex items-center gap-3 justify-end text-zinc-800">
              أحدث النشاطات في النظام <Activity className="text-primary" />
            </CardTitle>
          </CardHeader>
          <Table dir="rtl">
            <TableHeader className="bg-muted/10 h-14">
              <TableRow>
                <TableHead className="text-right font-black text-zinc-900">الحدث</TableHead>
                <TableHead className="text-right font-black text-zinc-900">القيمة</TableHead>
                <TableHead className="text-right font-black text-zinc-900">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRequests.map((req) => (
                <TableRow key={req.id} className="h-20 hover:bg-muted/5">
                  <TableCell className="font-bold text-sm">
                    <div className="flex flex-col text-right">
                      <span className="font-black text-zinc-800">{req.title}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><User size={10}/> {req.mustafhemName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-primary text-right">{req.amount} ج.م</TableCell>
                  <TableCell className="text-right">
                    <Badge className={`text-[10px] font-black px-3 py-1 rounded-lg ${
                      req.status === 'completed' ? 'bg-green-100 text-green-700' : 
                      req.status === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {req.status === 'completed' ? 'مكتمل' : req.status === 'paid' ? 'مدفوع' : 'قيد العروض'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {recentRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-20 text-muted-foreground font-bold italic">لا توجد سجلات نشطة حالياً.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="rounded-[3rem] border-2 shadow-2xl p-10 bg-zinc-900 text-white flex flex-col justify-center gap-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 p-16 opacity-5 rotate-45"><BadgeCent size={200}/></div>
          <div className="space-y-4 relative z-10 text-right">
            <p className="text-zinc-400 font-black text-xl uppercase tracking-widest">إجمالي حجم التداول</p>
            <h2 className="text-7xl font-black tabular-nums tracking-tighter">{stats.totalVolume.toLocaleString()} <span className="text-2xl font-bold opacity-40">ج.م</span></h2>
          </div>
          <div className="grid grid-cols-2 gap-8 relative z-10 border-t border-white/10 pt-10">
            <div className="text-right space-y-1">
              <p className="text-xs text-zinc-500 font-black">دخل المنصة (20%)</p>
              <p className="text-3xl font-black text-primary">{stats.platformRevenue.toLocaleString()}</p>
            </div>
            <div className="text-right space-y-1 border-r border-white/10 pr-8">
              <p className="text-xs text-zinc-500 font-black">أرباح الخبراء (80%)</p>
              <p className="text-3xl font-black text-accent">{(stats.totalVolume - stats.platformRevenue).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="shadow-xl border-2 border-transparent hover:border-primary/20 transition-all rounded-[2.5rem] overflow-hidden bg-white group">
      <CardContent className="p-8 flex items-center gap-6 justify-end">
        <div className="space-y-1 text-right flex-1">
          <p className="text-sm font-black text-muted-foreground uppercase">{title}</p>
          <h3 className="text-3xl font-black tabular-nums group-hover:text-primary transition-colors">{value}</h3>
        </div>
        <div className={`${color} p-5 rounded-2xl shadow-xl shadow-black/10 group-hover:scale-110 transition-transform`}>
          <Icon className="text-white h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
