import { getFunctions, httpsCallable } from "@/lib/fn-client";

/** تصغير الصورة قبل الرفع (أقصى 1280 بكسل، JPEG) عشان الجسر ميحمّلش صور تقيلة */
export async function shrinkImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("تعذر ضغط الصورة"))), "image/jpeg", 0.8));
  return new File([blob], "wa.jpg", { type: "image/jpeg" });
}

/** رفع صورة واتساب على Cloudflare R2 (نفس استضافة المنصة، من غير Firebase Storage) ويرجّع الرابط العام */
export async function uploadWaImage(original: File): Promise<string> {
  const file = await shrinkImage(original);
  const signed: any = await httpsCallable(getFunctions(), "createMediaUploadUrl")({
    kind: "whatsapp", fileName: "wa.jpg", contentType: "image/jpeg", size: file.size,
  });
  const put = await fetch(signed.data.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: file });
  if (!put.ok) throw new Error("فشل رفع الصورة على التخزين");
  return String(signed.data.publicUrl);
}
