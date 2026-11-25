
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert, Clock, Search, Bell, BellRing, CheckCheck,
  UserPlus, UserMinus, ShieldCheck, ShieldX, Wallet, BadgeCheck,
  BadgeMinus, Settings2, Pencil, Trash2, Ban, Activity
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * إشعارات الأدمن — مركز لحظي يعرض كل إجراء أو تعديل يقوم به أي مسؤول في المنصة:
 * من نفّذ الإجراء، ماذا فعل، على من، ومتى. يقرأ من مجموعة adminLogs مباشرة.
 */

const LAST_SEEN_KEY = "admin_activity_last_seen";

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === "string") { const d = new Date(ts); return isNaN(d.getTime()) ? null : d; }
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function actionMeta(action: string) {
  switch (action) {
    case 'create_admin':     return { label: "إنشاء حساب أدمن",  icon: UserPlus,   cls: "bg-emerald-600", group: "admins" };
    case 'grant_admin':      return { label: "منح صلاحية أدمن",  icon: ShieldCheck, cls: "bg-red-500",    group: "admins" };
    case 'revoke_admin':     return { label: "سحب صلاحية أدمن",  icon: ShieldX,     cls: "bg-red-700",    group: "admins" };
    case 'manual_recharge':  return { label: "شحن رصيد يدوي",    icon: Wallet,      cls: "bg-green-600",  group: "finance" };
    case 'manual_deduction': return { label: "خصم رصيد يدوي",    icon: Wallet,      cls: "bg-orange-500", group: "finance" };
    case 'verify_user':      return { label: "توثيق حساب",       icon: BadgeCheck,  cls: "bg-blue-500",   group: "users" };
    case 'unverify_user':    return { label: "إلغاء توثيق",      icon: BadgeMinus,  cls: "bg-zinc-500",   group: "users" };
    case 'ban_user':         return { label: "حظر مستخدم",       icon: Ban,         cls: "bg-red-600",    group: "users" };
    case 'unban_user':       return { label: "فك حظر",           icon: CheckCheck,  cls: "bg-green-600",  group: "users" };
    case 'update_settings':  return { label: "تعديل إعدادات",    icon: Settings2,   cls: "bg-purple-600", group: "edits" };
    case 'edit_content':     return { label: "تعديل محتوى",      icon: Pencil,      cls: "bg-indigo-500", group: "edits" };
    case 'delete_item':      return { label: "حذف عنصر",         icon: Trash2,      cls: "bg-red-500",    group: "edits" };
    default:                 return { label: action || "إجراء إداري", icon: Activity, cls: "bg-zinc-700", group: "other" };
  }
}

const FILTERS = [
  { id: "all",     label: "الكل" },
  { id: "admins",  label: "الصلاحيات" },
  { id: "users",   label: "الحسابات" },
  { id: "finance", label: "المالية" },
  { id: "edits",   label: "التعديلات" },
  { id: "other",   label: "أخرى" },
];

function timeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return d.toLocaleDateString('ar-EG');
}

export default function AdminActivityNotifications() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(LAST_SEEN_KEY) || 0));
  }, []);

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "adminLogs"), orderBy("timestamp", "desc"), limit(300));
  }, [firestore]);

  const { data: logs, isLoading } = useCollection(logsQuery);

  const items = useMemo(() => {
    return (logs || []).map((log: any) => {
      const meta = actionMeta(log.action);
      const date = toDate(log.timestamp);
      return { ...log, _meta: meta, _date: date };
    });
  }, [logs]);

  const unreadCount = useMemo(
    () => items.filter(i => i._date && i._date.getTime() > lastSeen).length,
    [items, lastSeen]
  );

  const filtered = items.filter(i => {
    if (filter !== "all" && i._meta.group !== filter) return false;
    const t = searchTerm.trim().toLowerCase();
    if (!t) return true;
    return (
      i.action?.toLowerCase().includes(t) ||
      i._meta.label.toLowerCase().includes(t) ||
      i.adminName?.toLowerCase().includes(t) ||
      i.targetUserName?.toLowerCase().includes(t) ||
      i.targetUserId?.toLowerCase().includes(t) ||
      i.details?.toLowerCase().includes(t)
    );
  });

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(now));
    setLastSeen(now);
  };

  return (
    <div className="p-6 md:p-10 space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-r-8 border-zinc-800 pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            إشعارات الأدمن
            {unreadCount > 0 && (
              <span className="relative flex h-8 w-8">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-8 w-8 bg-red-600 text-white text-sm items-center justify-center font-black">{unreadCount}</span>
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-lg">أي إجراء أو تعديل يقوم به أي مسؤول يظهر هنا لحظياً مع اسمه ووقته.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="ابحث باسم المسؤول أو الإجراء..."
              className="h-14 pr-12 rounded-2xl shadow-sm border-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={markAllRead} className="h-14 rounded-2xl font-black gap-2">
            <CheckCheck className="h-5 w-5" /> قرأت الكل
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <Button
            key={f.id}
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
            className="rounded-xl font-black"
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card className="rounded-3xl border-2"><CardContent className="p-16 text-center animate-pulse font-black text-lg">جاري تحميل الإشعارات...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-3xl border-2"><CardContent className="p-16 text-center text-muted-foreground font-bold space-y-3">
            <Bell className="h-12 w-12 mx-auto opacity-30" />
            <p>لا توجد إشعارات مطابقة حالياً.</p>
          </CardContent></Card>
        ) : filtered.map((log: any) => {
          const Icon = log._meta.icon;
          const isNew = log._date && log._date.getTime() > lastSeen;
          return (
            <Card key={log.id} className={`rounded-3xl border-2 transition-all hover:shadow-lg ${isNew ? 'bg-primary/5 border-primary/30' : 'bg-white'}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl ${log._meta.cls} text-white flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-zinc-900">{log._meta.label}</span>
                    {isNew && <Badge className="bg-red-600 text-[10px]">جديد</Badge>}
                  </div>
                  <p className="text-sm font-bold text-zinc-600">
                    بواسطة: <span className="text-zinc-900">{log.adminName || log.grantedBy || "مسؤول"}</span>
                    {log.targetUserName && <> على <span className="text-zinc-900">{log.targetUserName}</span></>}
                  </p>
                  {(log.details || log.amount != null) && (
                    <p className="text-xs text-muted-foreground font-bold truncate">
                      {log.details || (log.amount != null ? `المبلغ: ${log.amount} ج.م` : "")}
                    </p>
                  )}
                  {log.targetUserId && (
                    <p className="text-[10px] font-mono text-zinc-400 truncate" dir="ltr">{log.targetUserId}</p>
                  )}
                </div>
                <div className="text-left shrink-0 space-y-1">
                  <p className="text-xs font-black text-primary flex items-center gap-1 justify-end">
                    <BellRing className="h-3.5 w-3.5" /> {log._date ? timeAgo(log._date) : "—"}
                  </p>
                  {log._date && (
                    <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {log._date.toLocaleDateString('ar-EG')} {log._date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
