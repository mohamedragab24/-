"use client";

import { Firestore, addDoc, collection, doc } from "firebase/firestore";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";

/** هوية المسؤول الحالي لاستخدامها عند تسجيل الإجراءات الإدارية. */
export function useAdminActor(): { uid: string | null; fullName: string | null; email: string | null } {
  const { user } = useUser();
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => (firestore && user?.uid) ? doc(firestore, "users", user.uid) : null, [firestore, user?.uid]);
  const { data: profile } = useDoc(ref);
  return {
    uid: user?.uid || null,
    fullName: (profile as any)?.fullName || null,
    email: user?.email || null,
  };
}

/**
 * تسجيل إجراء إداري في سجل adminLogs مع بيانات المسؤول المنفّذ.
 * تظهر هذه السجلات في صفحة «إشعارات الأدمن» (/admin/logs) بشكل لحظي.
 */
export type AdminActor = {
  uid?: string | null;
  fullName?: string | null;
  email?: string | null;
} | null | undefined;

export async function logAdminActivity(
  firestore: Firestore | null | undefined,
  actor: AdminActor,
  entry: {
    action: string;
    targetUserId?: string;
    targetUserName?: string;
    details?: string;
    amount?: number;
  }
) {
  if (!firestore) return;
  try {
    await addDoc(collection(firestore, "adminLogs"), {
      action: entry.action,
      targetUserId: entry.targetUserId || null,
      targetUserName: entry.targetUserName || null,
      details: entry.details || null,
      amount: entry.amount ?? null,
      adminId: actor?.uid || null,
      adminName: actor?.fullName || actor?.email || "مسؤول",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // التسجيل لا يوقف العملية الأساسية
    console.warn("admin activity log failed", e);
  }
}
