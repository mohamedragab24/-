"use client";

/**
 * مركز الأخطاء: أي خطأ في المنصة يُعرض فورًا للمستخدم بصيغة:
 *   ماذا حدث  ←  السبب  ←  المطلوب لحلّه  (+ تفاصيل تقنية قابلة للنسخ)
 * الاستخدام:  reportError(e, "شحن المحفظة")
 */
export type AppError = {
  id: string;
  title: string;      // ماذا حدث
  cause?: string;     // السبب
  fix?: string;       // المطلوب
  technical?: string; // تفاصيل تقنية للنسخ
  link?: string;
  where?: string;     // مكان الحدوث (اسم العملية أو الصفحة)
  at: number;
};

type Listener = (e: AppError) => void;
const listeners = new Set<Listener>();
const recent = new Map<string, number>();

export function onAppError(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** يحوّل أي خطأ (من fn-client أو Firebase أو JS) إلى AppError مفهوم */
export function explain(raw: any, where?: string): AppError {
  const code = String(raw?.code || "");
  const msg = String(raw?.message || raw || "");
  const low = (code + " " + msg).toLowerCase();
  let title = msg && msg !== "internal" ? msg : "حدث خطأ غير متوقع";
  let cause = raw?.cause && typeof raw.cause === "string" ? raw.cause : raw?.fnCause as string | undefined;
  let fix = raw?.fix as string | undefined;
  const technical = String(raw?.technical || [code, msg, raw?.stack?.split?.("\n")?.[1]?.trim()].filter(Boolean).join(" | ")).slice(0, 900);

  if (!cause && !fix) {
    if (low.includes("permission-denied") || low.includes("missing or insufficient permissions")) {
      title = "ليس لديك صلاحية لتنفيذ هذه العملية";
      cause = "قواعد Firestore المنشورة لا تسمح بهذه العملية، أو حسابك لا يملك الدور المطلوب.";
      fix = "لو أنت المدير: انشر ملف firestore.rules (Firebase Console ← Firestore ← Rules ← Publish). وإلا تأكد أنك مسجّل بالحساب الصحيح.";
    } else if (low.includes("unauthenticated") || low.includes("auth/id-token") || low.includes("requires-recent-login")) {
      title = "انتهت جلسة الدخول";
      cause = "التوكن انتهت صلاحيته.";
      fix = "سجّل الخروج ثم سجّل الدخول من جديد.";
    } else if (low.includes("network-request-failed") || low.includes("failed to fetch") || low.includes("networkerror") || low.includes("load failed")) {
      title = "تعذّر الاتصال بالسيرفر";
      cause = "لا يوجد إنترنت، أو الموقع على Vercel متوقف/لم يُنشر، أو CORS يمنع الطلب.";
      fix = "تأكد من الإنترنت، وافتح رابط الموقع للتأكد أنه يعمل، وإن كان الطلب لدومين مختلف فأضفه في إعدادات CORS.";
    } else if (low.includes("functions/not-found") || low.includes("not-found")) {
      title = "العنصر المطلوب غير موجود";
      cause = "تم حذفه، أو أن المعرّف غير صحيح، أو أن الدالة لم تُنشر بعد على Vercel.";
      fix = "حدّث الصفحة، ولو تكرر ارفع آخر نسخة من المنصة على Vercel.";
    } else if (low.includes("chunkloaderror") || low.includes("loading chunk")) {
      title = "نسخة الموقع تغيّرت";
      cause = "تم نشر تحديث جديد أثناء فتح الصفحة.";
      fix = "حدّث الصفحة (Reload).";
    } else if (low.includes("quota") || low.includes("resource-exhausted")) {
      title = "تم تجاوز الحد المسموح لهذه الخدمة";
      cause = "حصة Firebase المجانية أو حد الطلبات انتهى.";
      fix = "انتظر التجديد أو رقّ الخطة.";
    } else if (low.includes("internal") || low.includes("500")) {
      title = "حدث خطأ في السيرفر";
      cause = "خطأ داخلي لم يُحدَّد سببه.";
      fix = "افتح Vercel ← Logs وابحث عن الخطأ، أو انسخ التفاصيل التقنية وأرسلها للمطوّر.";
    } else {
      cause = "لم يتم التعرّف على سبب محدد.";
      fix = "انسخ التفاصيل التقنية وأرسلها للمطوّر.";
    }
  }
  return { id: Math.random().toString(36).slice(2), title, cause, fix, technical, link: raw?.link, where, at: Date.now() };
}

/** يعرض الخطأ فورًا. التكرار خلال 4 ثوانٍ يُدمج حتى لا تمتلئ الشاشة. */
export function reportError(raw: any, where?: string): AppError {
  const err = explain(raw, where);
  const key = err.title + "|" + (where || "");
  const last = recent.get(key) || 0;
  if (Date.now() - last > 4000) {
    recent.set(key, Date.now());
    try { console.error(`[خطأ${where ? " — " + where : ""}]`, err.title, "\nالسبب:", err.cause, "\nالحل:", err.fix, "\n", err.technical); } catch {}
    listeners.forEach((l) => { try { l(err); } catch {} });
  }
  return err;
}
