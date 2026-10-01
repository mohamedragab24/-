import type { Metadata } from "next";
import CourseDetailPage from "./course-client";

// صفحة الكورس: تُولَّد عند أول طلب ثم تُخزَّن (ISR) وتُحدَّث كل 5 دقائق.
// الرابط /courses/<id> ثابت ولا يتغير مع كل تحديث، والبيانات تأتي من R2 (ومن Firebase داخل المتصفح).
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

const R2_MANIFEST_BASE = process.env.NEXT_PUBLIC_R2_MANIFEST_BASE || "https://fahmny-r2.mohamedragabewiess.workers.dev";

function courseIdFromRoute(raw: string): string {
  const m = raw.match(/^course(\d+)-(.+)$/i);
  return m ? `course-${m[2]}` : raw;
}

async function loadManifest(rawId: string): Promise<any | null> {
  try {
    const id = courseIdFromRoute(decodeURIComponent(rawId));
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${R2_MANIFEST_BASE}/courses/${encodeURIComponent(id)}/manifest.json`, { next: { revalidate: 300 }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return { id, ...(await res.json()) };
  } catch {
    return null;
  }
}

function toInitialCourse(d: any) {
  if (!d) return null;
  const lessons = Array.isArray(d.lessons) ? d.lessons : [];
  return {
    ...d,
    id: String(d.id),
    title: String(d.title || d.name || ""),
    description: String(d.description || ""),
    coverUrl: String(d.coverUrl || d.thumbnailUrl || ""),
    price: Number(d.price || 0),
    features: Array.isArray(d.features) ? d.features : [],
    lessons: lessons.map((l: any, i: number) => ({
      ...l,
      id: String(l?.id || l?.lessonId || i),
      title: String(l?.title || ""),
      videoUrl: String(l?.videoUrl || ""),
      durationMinutes: Number(l?.durationMinutes || 0),
      order: Number(l?.order ?? i + 1),
      isFreePreview: l?.isFreePreview ?? l?.isPreview ?? false,
    })),
    instructorId: String(d.instructorId || d.ownerUid || ""),
    instructorName: String(d.instructorName || ""),
    isPublished: d.isPublished ?? d.status === "published",
    category: String(d.category || ""),
    createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date().toISOString(),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = await loadManifest(id);
  if (!m) return { title: "كورس - فهمت" };
  return {
    title: `${m.title || m.name || "كورس"} - فهمت`,
    description: String(m.description || "").slice(0, 160),
    openGraph: { title: String(m.title || m.name || "كورس"), images: m.coverUrl || m.thumbnailUrl ? [String(m.coverUrl || m.thumbnailUrl)] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manifest = await loadManifest(id);
  // JSON round-trip يضمن تمرير بيانات قابلة للتسلسل فقط إلى مكوّن العميل
  const initialCourse = manifest ? JSON.parse(JSON.stringify(toInitialCourse(manifest))) : null;
  return <CourseDetailPage initialCourse={initialCourse} />;
}
