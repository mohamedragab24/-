"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, initializeFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "@/lib/fn-client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/** رابط انضمام لمجموعة: يسجّل الطالب دخوله ثم يُرسل طلب انضمام يقبله منشئ المجموعة. */
export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    setState("sending");
    const { firebaseApp } = initializeFirebase();
    httpsCallable(getFunctions(firebaseApp, "us-central1"), "requestJoinGroup")({ code })
      .then((r: any) => {
        setMessage(r?.data?.already ? `أنت عضو بالفعل في «${r.data.groupName}»` : `تم إرسال طلب انضمامك إلى «${r?.data?.groupName}». سيصلك إشعار عند قبوله.`);
        setState("done");
      })
      .catch((e: any) => {
        setMessage(e?.message && e.message !== "internal" ? e.message : "تعذر إرسال الطلب");
        setState("error");
      });
  }, [user, isUserLoading, code, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8 text-center" dir="rtl">
      {(state === "idle" || state === "sending") && <Loader2 className="h-10 w-10 animate-spin" />}
      {message && <p className="text-xl font-black">{message}</p>}
      {(state === "done" || state === "error") && <Button onClick={() => router.push("/groups")} className="font-black">الذهاب للمجموعات</Button>}
    </div>
  );
}
