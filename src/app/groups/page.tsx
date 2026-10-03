"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, query, where } from "firebase/firestore";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Copy, Loader2, Snowflake, MailPlus, Check, X, IdCard, Wallet } from "lucide-react";
import { callGroupFn, fnErrorMessage, formatBytes, estimateWeeklyFee } from "@/lib/groups";

function daysLeft(ts: any): number | null {
  const ms = ts?.toMillis?.();
  if (!ms) return null;
  return Math.max(0, Math.ceil((ms - Date.now()) / 86400000));
}

function GroupCard({ id, g, owner }: { id: string; g: any; owner: boolean }) {
  const frozen = g?.status === "frozen";
  const purge = daysLeft(g?.purgeAt);
  return (
    <Link href={frozen && !owner ? "#" : `/groups/${id}`} className="block">
      <Card className="rounded-[2rem] border-2 hover:border-primary/40 transition-all">
        <CardContent className="p-6 space-y-3 text-right">
          <div className="flex items-center justify-between gap-3">
            {frozen ? <Badge variant="destructive" className="gap-1"><Snowflake size={12} /> مجمّدة</Badge> : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">نشطة</Badge>}
            <h3 className="text-xl font-black">{g?.name}</h3>
          </div>
          {g?.description && <p className="text-sm text-zinc-500 font-bold line-clamp-2">{g.description}</p>}
          <div className="flex flex-wrap gap-2 justify-end text-xs font-black text-zinc-600">
            <span className="bg-zinc-100 rounded-full px-3 py-1">{g?.memberCount || 0} طالب</span>
            <span className="bg-zinc-100 rounded-full px-3 py-1">{formatBytes(g?.storageBytes || 0)}</span>
            {!owner && g?.ownerName && <span className="bg-zinc-100 rounded-full px-3 py-1">المُفهم: {g.ownerName}</span>}
          </div>
          {frozen && owner && <p className="text-xs font-black text-red-600">المجموعة مجمّدة لعدم سداد الرسوم. ادفع خلال {purge ?? 7} يوم وإلا ستُحذف نهائيًا.</p>}
          {frozen && !owner && <p className="text-xs font-black text-zinc-500">المجموعة متوقفة مؤقتًا.</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function GroupsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => (firestore && user ? doc(firestore, "users", user.uid) : null), [firestore, user]);
  const { data: profile } = useDoc<any>(userRef);
  const isMufhem = profile?.role === "mufhem";

  const [publicId, setPublicId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (!isUserLoading && !user) router.push("/login"); }, [user, isUserLoading, router]);
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.publicId) { setPublicId(profile.publicId); return; }
    callGroupFn<{ publicId: string }>("ensurePublicId").then((r) => setPublicId(r.publicId)).catch(() => {});
  }, [user, profile]);

  // للمُفهم: مجموعاتي
  const ownedQuery = useMemoFirebase(() => (firestore && user && isMufhem ? query(collection(firestore, "groups"), where("ownerUid", "==", user.uid)) : null), [firestore, user, isMufhem]);
  const { data: owned, isLoading: ownedLoading } = useCollection<any>(ownedQuery);
  const billsQuery = useMemoFirebase(() => (firestore && user && isMufhem ? query(collection(firestore, "groupBills"), where("ownerUid", "==", user.uid)) : null), [firestore, user, isMufhem]);
  const { data: bills } = useCollection<any>(billsQuery);

  // للمُستفهم: الدعوات + المجموعات المنضم إليها
  const invitesQuery = useMemoFirebase(() => (firestore && user ? query(collection(firestore, "groupInvites"), where("toUid", "==", user.uid)) : null), [firestore, user]);
  const { data: invites } = useCollection<any>(invitesQuery);
  const membershipsRef = useMemoFirebase(() => (firestore && user ? collection(firestore, "users", user.uid, "groupMemberships") : null), [firestore, user]);
  const { data: memberships } = useCollection<any>(membershipsRef);
  const pending = (invites || []).filter((i: any) => i.status === "pending");

  const unpaid = (bills || []).filter((b: any) => b.status === "unpaid");
  const unpaidTotal = unpaid.reduce((a: number, b: any) => a + Number(b.fee || 0), 0);
  const estimate = (owned || []).filter((g: any) => g.status === "active").reduce((a: number, g: any) => a + estimateWeeklyFee(g.storageBytes, g.memberCount), 0);

  const create = async () => {
    setBusy("create");
    try {
      const r = await callGroupFn<{ groupId: string }>("createGroup", { name, description: desc });
      setCreateOpen(false); setName(""); setDesc("");
      router.push(`/groups/${r.groupId}`);
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر إنشاء المجموعة", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  const respond = async (inviteId: string, accept: boolean) => {
    setBusy(inviteId);
    try {
      await callGroupFn("respondGroupInvite", { inviteId, accept });
      toast({ title: accept ? "تم الانضمام للمجموعة" : "تم رفض الدعوة" });
    } catch (e: any) { toast({ variant: "destructive", title: "تعذر تنفيذ الطلب", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  const payBills = async () => {
    setBusy("pay");
    try { await callGroupFn("payGroupBills"); toast({ title: "تم سداد الرسوم وتفعيل مجموعاتك" }); }
    catch (e: any) { toast({ variant: "destructive", title: "تعذر السداد", description: fnErrorMessage(e) }); }
    finally { setBusy(null); }
  };

  if (isUserLoading || !profile) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8 space-y-8 font-body" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="border-r-8 border-primary pr-5">
          <h1 className="text-3xl md:text-4xl font-black">المجموعات</h1>
          <p className="text-zinc-500 font-bold mt-1">{isMufhem ? "المجموعات التي تديرها" : "المجموعات التي انضممت إليها ودعوات الانضمام"}</p>
        </div>
        {isMufhem && <Button onClick={() => setCreateOpen(true)} className="h-12 rounded-2xl font-black gap-2"><Plus size={18} /> مجموعة جديدة</Button>}
      </div>

      {/* الرقم التعريفي */}
      <Card className="rounded-[2rem] bg-primary/5 border-primary/20">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <Button variant="outline" className="rounded-xl font-black gap-2" disabled={!publicId} onClick={() => { navigator.clipboard.writeText(publicId); toast({ title: "تم نسخ الرقم التعريفي" }); }}>
            <Copy size={16} /> نسخ
          </Button>
          <div className="text-right">
            <p className="text-xs font-black text-zinc-500 flex items-center gap-1 justify-end"><IdCard size={14} /> رقمك التعريفي على المنصة</p>
            <p className="text-2xl font-black tracking-[0.3em] font-mono" dir="ltr">{publicId || "..."}</p>
          </div>
        </CardContent>
      </Card>

      {/* فواتير المُفهم (تظهر له فقط) */}
      {isMufhem && (owned?.length || 0) > 0 && (
        <Card className="rounded-[2rem] border-2">
          <CardContent className="p-5 space-y-3 text-right">
            <p className="font-black flex items-center gap-2 justify-end"><Wallet size={18} /> رسوم المجموعات الأسبوعية</p>
            <p className="text-xs text-zinc-500 font-bold">5 جنيه أسبوعيًا لكل جيجا و10 جنيه أسبوعيًا لكل طالب، بمتوسط الأسبوع. التقدير الحالي: <b>{estimate} ج.م</b> أسبوعيًا.</p>
            {unpaid.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <Button onClick={payBills} disabled={busy === "pay"} className="rounded-xl font-black bg-red-600 hover:bg-red-700">{busy === "pay" ? <Loader2 className="animate-spin" /> : `سداد ${Math.round(unpaidTotal * 100) / 100} ج.م`}</Button>
                <p className="text-sm font-black text-red-700">لديك رسوم غير مدفوعة. اشحن محفظتك ثم اضغط سداد، وإلا ستُجمَّد المجموعة بعد يومين.</p>
              </div>
            )}
            <Link href="/wallet" className="text-primary font-black text-sm underline">فتح محفظتي لشحن الرصيد</Link>
          </CardContent>
        </Card>
      )}

      {/* دعوات الانضمام */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-black flex items-center gap-2"><MailPlus size={20} /> دعوات الانضمام ({pending.length})</h2>
          {pending.map((inv: any) => (
            <Card key={inv.id} className="rounded-2xl border-2 border-primary/30">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-xl font-black gap-1" disabled={busy === inv.id} onClick={() => respond(inv.id, true)}><Check size={16} /> قبول</Button>
                  <Button size="sm" variant="outline" className="rounded-xl font-black gap-1" disabled={busy === inv.id} onClick={() => respond(inv.id, false)}><X size={16} /> رفض</Button>
                </div>
                <div className="text-right">
                  <p className="font-black">{inv.groupName}</p>
                  <p className="text-xs text-zinc-500 font-bold">من المُفهم: {inv.ownerName || "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* مجموعاتي */}
      <section className="space-y-3">
        <h2 className="text-xl font-black flex items-center gap-2"><Users size={20} /> {isMufhem ? "مجموعاتي" : "مجموعاتي المنضم إليها"}</h2>
        {isMufhem ? (
          ownedLoading ? <Loader2 className="animate-spin" /> :
          (owned?.length ? <div className="grid md:grid-cols-2 gap-4">{owned.map((g: any) => <GroupCard key={g.id} id={g.id} g={g} owner />)}</div>
            : <p className="text-zinc-500 font-bold">لم تنشئ أي مجموعة بعد. اضغط «مجموعة جديدة» للبدء.</p>)
        ) : (
          memberships?.length ? <div className="grid md:grid-cols-2 gap-4">{memberships.map((m: any) => <MembershipCard key={m.id} groupId={m.groupId} />)}</div>
            : <p className="text-zinc-500 font-bold">لم تنضم لأي مجموعة بعد. عندما يدعوك مُفهم برقمك التعريفي ستظهر الدعوة هنا.</p>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-[2rem]" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-2xl font-black">إنشاء مجموعة جديدة</DialogTitle><DialogDescription className="text-right">يمكنك بعدها رفع المحتوى ودعوة الطلاب برقمهم التعريفي.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="font-black">اسم المجموعة</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border-2" maxLength={80} /></div>
            <div className="space-y-2"><Label className="font-black">وصف (اختياري)</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl border-2" maxLength={500} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl font-black">إلغاء</Button>
            <Button onClick={create} disabled={busy === "create" || name.trim().length < 3} className="rounded-xl font-black">{busy === "create" ? <Loader2 className="animate-spin" /> : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembershipCard({ groupId }: { groupId: string }) {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => (firestore ? doc(firestore, "groups", groupId) : null), [firestore, groupId]);
  const { data: g } = useDoc<any>(ref);
  if (!g) return null;
  return <GroupCard id={groupId} g={g} owner={false} />;
}
