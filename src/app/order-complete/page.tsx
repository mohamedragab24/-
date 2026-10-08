"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { useFirebase, useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { syncPurchasedCourses } from "@/lib/courses-data";

const METHOD_NAMES: Record<string, string> = { vodafone_cash: "فودافون كاش", orange_cash: "أورنج كاش", etisalat_cash: "اتصالات كاش", we_pay: "وي باي", instapay: "إنستا باي", bank_transfer: "تحويل بنكي" };
const fmtTime = (ts: any) => { try { const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d ? d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short", hour12: false, timeZone: "Africa/Cairo" }) : ""; } catch { return ""; } };

export default function OrderCompletePage() {
  const [paymentId, setPaymentId] = useState("");
  const [paramsRead, setParamsRead] = useState(false);
  useEffect(() => { setPaymentId(new URLSearchParams(window.location.search).get("paymentId") || ""); setParamsRead(true); }, []);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, isUserLoading } = useFirebase();
  const firestore = useFirestore();
  const synced = useRef(false);

  useEffect(() => {
    // ننتظر قراءة الرابط وتحميل حالة تسجيل الدخول قبل أي رسالة خطأ
    if (!paramsRead || isUserLoading || !firestore) return;
    if (!paymentId) { setLoading(false); setError("تعذر العثور على بيانات الطلب."); return; }
    if (!user) { setLoading(false); setError("سجّل الدخول لعرض الإيصال."); return; }
    let active = true;
    setLoading(true); setError("");
    const unsubscribe = onSnapshot(doc(firestore, "payments", paymentId), (snap) => {
      if (!active) return;
      if (!snap.exists() || snap.data().uid !== user.uid) {
        setPayment(null); setError("الطلب غير موجود أو لا يخص حسابك."); setLoading(false); return;
      }
      setError(""); setPayment({ id: snap.id, ...snap.data() }); setLoading(false);
    }, (e) => { if (active) { setError(e?.message || "تعذر تحميل الإيصال."); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [user, isUserLoading, firestore, paymentId, paramsRead]);

  const status = String(payment?.status || "");
  const pending = status === "pending_verification";

  // أثناء الانتظار: نطلب من الخادم إعادة مطابقة الطلب مع عمليات البوت كل 8 ثوانٍ
  useEffect(() => {
    if (!pending || !paymentId) return;
    let stop = false;
    const tick = async () => {
      try { await httpsCallable(getFunctions(undefined, "us-central1"), "checkPaymentStatus")({ paymentId }); } catch (_) {}
    };
    void tick();
    const t = setInterval(() => { if (!stop) void tick(); }, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [pending, paymentId]);

  // عند التأكيد: حدّث قائمة "كورساتي" فورًا
  useEffect(() => {
    if (status === "completed" && payment?.type !== "wallet_topup" && user?.uid && firestore && !synced.current) {
      synced.current = true;
      void syncPurchasedCourses(firestore, user.uid);
    }
  }, [status, user?.uid, firestore]);

  const methodLabel = payment?.paymentMethod === "wallet" ? "محفظة فهمت" : (payment?.paymentMethodName || METHOD_NAMES[payment?.paymentMethod] || payment?.paymentMethod);
  const accounts: { label: string; number: string }[] = Array.isArray(payment?.paymentAccounts) ? payment.paymentAccounts : [];

  const isTopup = payment?.type === "wallet_topup";
  const rejected = status === "rejected";
  const rows: [string, any][] = [
    ["رقم الطلب", payment?.orderNumber || payment?.id],
    ["رقم العملية (من البوت)", payment?.providerTxId],
    [isTopup ? "نوع العملية" : "الكورس", isTopup ? "شحن المحفظة" : payment?.courseName],
    ["المبلغ", `${Number(payment?.amount || 0).toFixed(2)} جنيه مصري`],
    ["طريقة الدفع", methodLabel],
    ["الدفع من رقم", payment?.paymentPhone || payment?.phone],
    ["وقت العملية", fmtTime(payment?.providerTxTime)],
    ["البريد الإلكتروني", payment?.email],
    ["حالة العملية", status === "completed" ? "مكتملة" : pending ? "بانتظار التأكيد" : status === "expired" ? "منتهية" : rejected ? "مرفوضة" : "مسجلة"],
  ];

  return <main dir="rtl" className="min-h-screen bg-slate-50 p-4 flex items-center justify-center"><section className="w-full max-w-xl rounded-3xl bg-white p-6 md:p-9 shadow-lg border space-y-5">
    <div className="text-center border-b pb-5"><img src="/favicon.ico" alt="شعار فهّمني" className="mx-auto h-12 w-12 object-contain" /><div className="text-2xl font-black text-primary">فهّمني</div><p className="text-sm text-slate-500 mt-2">إيصال الطلب</p></div>
    {loading ? <p className="text-center py-10">جارٍ تحميل بيانات الطلب…</p> : error ? <p className="text-center text-red-600 py-8">{error}</p> : payment ? <>
      {pending ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3 text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-amber-300 border-t-amber-600 animate-spin" />
          <h1 className="text-xl font-black text-amber-900">يرجى الانتظار حتى تتأكد العملية</h1>
          <p className="text-sm text-amber-800 font-bold">حوّل <span className="font-mono">{Number(payment.amount || 0).toFixed(2)}</span> جنيه من الرقم <span className="font-mono" dir="ltr">{payment.paymentPhone}</span> إلى:</p>
          {accounts.map((a, i) => (<div key={i} className="rounded-xl bg-white border p-2 text-sm font-black">{a.label ? `${a.label}: ` : ""}<span className="font-mono text-primary" dir="ltr">{a.number}</span></div>))}
          <p className="text-xs text-amber-700">يجب أن يتم التحويل بعد وقت إنشاء الطلب ({fmtTime(payment.createdAt)}). سيتم التأكيد تلقائيًا بمجرد وصول العملية، لا تُغلق هذه الصفحة.</p>
        </div>
      ) : rejected ? (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2"><h1 className="text-xl font-black text-red-800">تم رفض العملية</h1><p className="text-sm text-red-700">{payment.rejectReason === "duplicate_transaction" ? "رقم هذه العملية مستخدم من قبل لنفس طريقة الدفع، ولا يمكن استخدامه مرة أخرى." : "تم رفض هذه العملية."} إن كنت قد حوّلت المبلغ فعلًا تواصل مع الدعم برقم الطلب.</p></div>
      ) : status === "expired" ? (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2"><h1 className="text-xl font-black text-red-800">انتهت مهلة الطلب</h1><p className="text-sm text-red-700">لم تصلنا عملية مطابقة خلال المدة المحددة. إن كنت قد حوّلت المبلغ فعلًا تواصل مع الدعم برقم الطلب.</p></div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-4 space-y-3"><h1 className="text-xl font-black">{status === "completed" ? "تم إتمام الطلب" : "تم تسجيل الطلب"}</h1><p className="text-sm text-slate-600">{status === "completed" ? (isTopup ? "تمت إضافة المبلغ إلى محفظتك." : "تم تسجيل الشراء وتفعيل الكورس ويمكنك مشاهدته الآن.") : "تم تسجيل بيانات الطلب."}</p></div>
      )}
      <dl className="space-y-3 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-bold text-left break-all">{v || "—"}</dd></div>)}</dl>
      {status === "completed" && isTopup && <div className="grid gap-2"><Button asChild className="w-full"><Link href="/wallet">العودة للمحفظة</Link></Button></div>}
      {status === "completed" && !isTopup && <div className="grid gap-2"><Button asChild className="w-full"><a href={`fahmny://course/${encodeURIComponent(String(payment.courseId || ""))}`}>فتح الكورس في تطبيق فهمني</a></Button><Button asChild variant="outline" className="w-full"><Link href={`/courses/${payment.courseId}`}>المشاهدة عبر الموقع</Link></Button><Button asChild variant="outline" className="w-full"><Link href="/courses?tab=enrolled">كورساتي</Link></Button></div>}
    </> : null}
    <Button asChild variant="outline" className="w-full"><Link href="/courses">العودة للكورسات</Link></Button>
  </section></main>;
}
