import { redirect } from "next/navigation";

// الصفحة الرئيسية كانت فارغة (ملف page.tsx بدون محتوى) فكانت تسبب Application error.
// مؤقتًا نحوّل الزائر لصفحة الكورسات.
export default function HomePage() {
  redirect("/courses");
}
