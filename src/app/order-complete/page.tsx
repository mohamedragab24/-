"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { useFirebase, useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";

export default function OrderCompletePage() {
  const [paymentId, setPaymentId] = useState("");
  const [paramsRead, setParamsRead] = useState(false);
  useEffect(() => { setPaymentId(new URLSearchParams(window.location.search).get("paymentId") || ""); setParamsRead(true); }, []);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, isUserLoading } = useFirebase();
  const firestore = useFirestore();
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
  return <main dir="rtl" className="min-h-screen bg-slate-50 p-4 flex items-center justify-center"><section className="w-full max-w-xl rounded-3xl bg-white p-6 md:p-9 shadow-lg border space-y-5">
    <div className="text-center border-b pb-5"><img src="/favicon.ico" alt="شعار فهّمني" className="mx-auto h-12 w-12 object-contain" /><div className="text-2xl font-black text-primary">فهّمني</div><p className="text-sm text-slate-500 mt-2">إيصال الطلب</p></div>
    {loading ? <p className="text-center py-10">جارٍ تحميل بيانات الطلب…</p> : error ? <p className="text-center text-red-600 py-8">{error}</p> : payment ? <>
      <div className="rounded-2xl bg-slate-50 p-4 space-y-3"><h1 className="text-xl font-black">{payment.status === "completed" ? "تم إتمام الطلب" : "تم تسجيل الطلب"}</h1><p className="text-sm text-slate-600">{payment.status === "completed" ? "تم تسجيل الشراء وتفعيل الكورس ويمكنك مشاهدته الآن." : "تم تسجيل بيانات الطلب."}</p><p className="font-bold">رقم الطلب: <span className="font-mono">{payment.orderNumber || payment.id}</span></p></div>
      <dl className="space-y-3 text-sm">{[["رقم العملية",payment.orderNumber || payment.id],["رقم الحساب",payment.publicId],["البريد الإلكتروني",payment.email],["اسم صاحب الحساب",payment.accountHolderName || payment.userName],["الكورس",payment.courseName],["المبلغ",`${Number(payment.amount||0).toFixed(2)} جنيه مصري`],["طريقة الدفع",payment.paymentMethod === "wallet" ? "محفظة فهمت" : ({vodafone_cash:"فودافون كاش",orange_cash:"أورنج كاش",etisalat_cash:"اتصالات كاش",we_pay:"وي باي",instapay:"إنستا باي",bank_transfer:"تحويل بنكي"}[payment.paymentMethod] || payment.paymentMethod)], ["الدفع من رقم",payment.paymentPhone || payment.phone],["حالة العملية",payment.status === "completed" ? "مكتملة" : "مسجلة"]].map(([k,v])=><div key={k} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-bold text-left break-all">{v || "—"}</dd></div>)}</dl>
      {payment.status === "completed" && <div className="grid gap-2"><Button asChild className="w-full"><a href={`fahmny://course/${encodeURIComponent(String(payment.courseId || ""))}`}>فتح الكورس في تطبيق فهمني</a></Button><Button asChild variant="outline" className="w-full"><Link href={`/courses/${payment.courseId}`}>المشاهدة عبر الموقع</Link></Button></div>}
    </> : null}
    <Button asChild variant="outline" className="w-full"><Link href="/courses">العودة للكورسات</Link></Button>
  </section></main>;
}
