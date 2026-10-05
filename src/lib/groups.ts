"use client";

import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "@/lib/fn-client";

export const GROUP_PRICE_PER_GB = 5;
export const GROUP_PRICE_PER_STUDENT = 10;
export const GROUP_MIN_PREPAID = 100;

export async function callGroupFn<T = any>(name: string, data: Record<string, any> = {}): Promise<T> {
  const fn = httpsCallable(getFunctions(getApp(), "us-central1"), name);
  const res: any = await fn(data);
  return res.data as T;
}

export function fnErrorMessage(e: any): string {
  const code = String(e?.code || "");
  const msg = String(e?.message || "");
  if (code.endsWith("/internal") && (msg === "internal" || msg === "INTERNAL")) {
    return "تعذر الاتصال بالخادم. تأكد من نشر دوال Firebase ثم حاول مرة أخرى.";
  }
  return msg || "حدث خطأ غير متوقع";
}

export function formatBytes(bytes: number): string {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function estimateWeeklyFee(bytes: number, students: number): number {
  const gb = Number(bytes || 0) / 1024 ** 3;
  return Math.round((gb * GROUP_PRICE_PER_GB + Number(students || 0) * GROUP_PRICE_PER_STUDENT) * 100) / 100;
}

/** رفع مباشر إلى R2 عبر رابط موقّع من الخادم (مع نسبة التقدم). */
export async function uploadGroupFile(
  file: File,
  groupId: string,
  kind: "videos" | "files",
  onProgress?: (percent: number) => void
): Promise<{ key: string; size: number; contentType: string }> {
  const contentType = file.type || (kind === "files" ? "application/pdf" : "video/mp4");
  const signed = await callGroupFn<{ url: string; key: string }>("createGroupUploadUrl", {
    groupId, kind, fileName: file.name, contentType, size: file.size,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress?.(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`فشل الرفع (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("تعذر الرفع إلى R2. تأكد من إعداد CORS للـ bucket (r2-cors.json)."));
    xhr.send(file);
  });
  return { key: signed.key, size: file.size, contentType };
}
