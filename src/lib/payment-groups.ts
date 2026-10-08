/** مجموعات الدفع الظاهرة للمستخدم (نفس الترتيب في كل مكان: شراء الكورس + شحن المحفظة + لوحة التحكم). */
export type PaymentGroupKey = "wallet" | "instapay" | "telda" | "card" | "bank" | "other";

export const PAYMENT_GROUPS: { key: PaymentGroupKey; title: string; hint: string }[] = [
  { key: "wallet", title: "محفظة إلكترونية", hint: "فودافون كاش، أورنج كاش، اتصالات كاش، وي باي" },
  { key: "instapay", title: "إنستا باي", hint: "تحويل برقم الموبايل أو برقم الحساب" },
  { key: "telda", title: "تيلدا", hint: "الدفع عبر التطبيق أو تحويل بنكي إلى تيلدا" },
  { key: "card", title: "بطاقة بنكية", hint: "فيزا، ماستركارد، ميزة" },
  { key: "bank", title: "تحويل بنكي", hint: "من أي بنك مصري" },
];

/** قوالب سريعة تملأ نموذج إضافة بوابة الدفع (اسم الخدمة + اسم المزود). */
export const GATEWAY_TEMPLATES: { group: PaymentGroupKey; name: string; providerName: string }[] = [
  { group: "wallet", name: "فودافون كاش", providerName: "فودافون كاش" },
  { group: "wallet", name: "أورنج كاش", providerName: "أورنج كاش" },
  { group: "wallet", name: "اتصالات كاش", providerName: "اتصالات كاش" },
  { group: "wallet", name: "وي باي", providerName: "وي باي" },
  { group: "instapay", name: "تحويل برقم الموبايل", providerName: "إنستا باي" },
  { group: "instapay", name: "تحويل برقم الحساب", providerName: "إنستا باي" },
  { group: "telda", name: "دفع عبر التطبيق", providerName: "تيلدا" },
  { group: "telda", name: "تحويل بنكي إلى تيلدا", providerName: "تيلدا" },
  { group: "card", name: "فيزا", providerName: "فيزا" },
  { group: "card", name: "ماستركارد", providerName: "ماستركارد" },
  { group: "card", name: "ميزة", providerName: "ميزة" },
  { group: "bank", name: "من أي بنك مصري", providerName: "تحويل بنكي" },
];

const DEFAULT_KEYS: Record<string, string> = {
  فودافونكاش: "vodafone_cash", اورنجكاش: "orange_cash", اتصالاتكاش: "etisalat_cash", ويباي: "we_pay",
};

/** نفس تطبيع السيرفر (normProv) لضمان تطابق اسم المزود بين المنصة والتطبيق والبوت. */
export const normProvider = (s: string) =>
  String(s || "").toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0621-\u064A]/g, "");

/** معرّف إنجليزي ثابت للمزود: المزودون الأربعة الافتراضيون بمعرّفاتهم القديمة، والباقي hash ثابت للاسم. */
export function providerKeyFor(providerName: string): string {
  const n = normProvider(providerName);
  if (DEFAULT_KEYS[n]) return DEFAULT_KEYS[n];
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) >>> 0;
  return `p_${h.toString(36)}`;
}

/** يقرأ الأرقام من الشكل الجديد (accountNumber) أو القديم (accounts[]). */
export const gatewayNumber = (m: any): string => String(m?.accountNumber || m?.accounts?.[0]?.number || "");
export const gatewayGroup = (m: any): PaymentGroupKey => (PAYMENT_GROUPS.some((g) => g.key === m?.group) ? m.group : "other");

/** يصغّر صورة الشعار إلى 160px ويحوّلها لـ data URL صغيرة (بدون رفع خارجي). */
export async function logoFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("تعذر قراءة الصورة")); i.src = url; });
    const size = 160;
    const scale = Math.min(size / img.width, size / img.height, 1);
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const webp = c.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
