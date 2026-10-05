import { Course, CourseEnrollment } from "./types";
import { doc, getDoc, getDocs, collection, orderBy, query, type Firestore } from "firebase/firestore";

const R2_MANIFEST_BASE = "https://fahmny-r2.mohamedragabewiess.workers.dev";


const INITIAL_COURSES: Course[] = [];

const STORAGE_KEY_COURSES = "fahimt_ready_courses_v2";
const STORAGE_KEY_ENROLLMENTS = "fahimt_course_enrollments_v2";

const DEMO_COURSE_IDS = new Set(["course-web-dev-pro", "course-math-calculus", "course-ai-prompting"]);

export function getStoredCourses(): Course[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURSES);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure all demo mock courses are excluded
    return parsed.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.has(c.id)).map((c: any) => toCourse(String(c.id), c));
  } catch (e) {
    console.error("Failed to parse stored courses", e);
    return [];
  }
}

export function saveCourses(courses: Course[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
    window.dispatchEvent(new Event("fahimt_courses_updated"));
  } catch (e) {
    console.error("Failed to save courses", e);
  }
}

export function getCourseById(id: string): Course | undefined {
  const courses = getStoredCourses();
  const found = courses.find(c => c.id === id);
  return found ? toCourse(String(found.id), found) : undefined;
}

export function upsertCourse(course: Course): void {
  const courses = getStoredCourses();
  const index = courses.findIndex(c => c.id === course.id);
  if (index >= 0) {
    courses[index] = { ...courses[index], ...course, updatedAt: new Date().toISOString() };
  } else {
    courses.unshift(course);
  }
  saveCourses(courses);
}

export function deleteCourse(courseId: string): void {
  const courses = getStoredCourses();
  const filtered = courses.filter(c => c.id !== courseId);
  saveCourses(filtered);
}

export function getStoredEnrollments(): CourseEnrollment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENROLLMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse enrollments", e);
    return [];
  }
}

export function saveEnrollments(enrollments: CourseEnrollment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_ENROLLMENTS, JSON.stringify(enrollments));
    window.dispatchEvent(new Event("fahimt_enrollments_updated"));
  } catch (e) {
    console.error("Failed to save enrollments", e);
  }
}

// الاشتراكات الحقيقية تأتي من Firestore (مجموعة purchases) وتُخزَّن هنا بعد المزامنة.
const purchasedByUser: Record<string, Set<string>> = {};

export async function syncPurchasedCourses(db: any, uid?: string | null): Promise<void> {
  if (!db || !uid) return;
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const snap = await getDocs(query(collection(db, "purchases"), where("uid", "==", uid), where("status", "==", "completed")));
    const ids = new Set<string>();
    snap.forEach((d: any) => { const c = String(d.data()?.courseId || ""); if (c) ids.add(c); });
    purchasedByUser[uid] = ids;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("fahimt_enrollments_updated"));
  } catch (e) {
    console.error("Failed to sync purchased courses", e);
  }
}

export function isUserEnrolled(courseId: string, studentId?: string): boolean {
  if (!studentId) return false;
  if (purchasedByUser[studentId]?.has(courseId)) return true;
  const enrollments = getStoredEnrollments();
  return enrollments.some(e => e.courseId === courseId && e.studentId === studentId);
}

export function enrollStudent(
  courseId: string, 
  studentId: string, 
  studentName: string, 
  studentEmail: string, 
  amount: number
): CourseEnrollment {
  const enrollments = getStoredEnrollments();
  const existing = enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (existing) return existing;

  const newEnrollment: CourseEnrollment = {
    id: `enroll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    courseId,
    studentId,
    studentName,
    studentEmail,
    enrolledAt: new Date().toISOString(),
    amountPaid: amount,
    progressPercent: 0,
    completedLessonIds: []
  };

  enrollments.push(newEnrollment);
  saveEnrollments(enrollments);

  // Update total enrollments in the course object
  const courses = getStoredCourses();
  const course = courses.find(c => c.id === courseId);
  if (course) {
    course.totalEnrollments = (course.totalEnrollments || 0) + 1;
    saveCourses(courses);
  }

  return newEnrollment;
}

export function updateLessonProgress(
  courseId: string, 
  studentId: string, 
  lessonId: string, 
  isCompleted: boolean
): void {
  const enrollments = getStoredEnrollments();
  const enrollment = enrollments.find(e => e.courseId === courseId && e.studentId === studentId);
  if (!enrollment) return;

  const course = getCourseById(courseId);
  if (!course) return;

  const currentIds = new Set(enrollment.completedLessonIds || []);
  if (isCompleted) {
    currentIds.add(lessonId);
  } else {
    currentIds.delete(lessonId);
  }

  enrollment.completedLessonIds = Array.from(currentIds);
  const totalLessons = course.lessons.length || 1;
  enrollment.progressPercent = Math.min(100, Math.round((enrollment.completedLessonIds.length / totalLessons) * 100));

  saveEnrollments(enrollments);
}

export function getEnrollmentsForInstructor(instructorId: string): { enrollment: CourseEnrollment; course: Course }[] {
  const courses = getStoredCourses().filter(c => c.instructorId === instructorId);
  const courseIds = new Set(courses.map(c => c.id));
  const enrollments = getStoredEnrollments().filter(e => courseIds.has(e.courseId));

  return enrollments.map(e => ({
    enrollment: e,
    course: courses.find(c => c.id === e.courseId)!
  }));
}


function toCourse(id: string, d: any): Course {
  const lessons = Array.isArray(d?.lessons) ? d.lessons : [];
  return {
    ...d,
    id,
    title: String(d?.title || d?.name || ""),
    description: String(d?.description || ""),
    coverUrl: String(d?.coverUrl || d?.thumbnailUrl || ""),
    price: Number(d?.price || 0),
    features: Array.isArray(d?.features) ? d.features : [],
    lessons: lessons.map((l: any, i: number) => ({
      ...l,
      id: String(l?.id || l?.lessonId || i),
      title: String(l?.title || ""),
      videoUrl: String(l?.videoUrl || ""),
      durationMinutes: Number(l?.durationMinutes || 0),
      order: Number(l?.order ?? i + 1),
      isFreePreview: l?.isFreePreview ?? l?.isPreview ?? false,
    })),
    instructorId: String(d?.instructorId || d?.ownerUid || ""),
    instructorName: String(d?.instructorName || ""),
    isPublished: d?.isPublished ?? d?.status === "published",
    category: String(d?.category || ""),
    createdAt: String(d?.createdAt?.toDate?.()?.toISOString?.() || d?.createdAt || new Date().toISOString()),
  } as Course;
}

/**
 * Courses used to live only in this browser's localStorage, which is tied to the
 * domain. After a redeploy on a new domain it was empty -> "course not found".
 * This loads the course from Firestore first, then from the R2 manifest.
 */
export async function fetchCourseRemote(id: string, firestore?: Firestore | null): Promise<Course | null> {
  let found: Course | null = null;
  if (firestore) {
    try {
      const snap = await getDoc(doc(firestore, "courses", id));
      if (snap.exists()) {
        const lessonsSnap = await getDocs(query(collection(firestore, "courses", id, "lessons"), orderBy("order")));
        found = toCourse(id, { ...snap.data(), lessons: lessonsSnap.docs.map(l => ({ id: l.id, ...l.data() })) });
      }
    } catch (_) {}
  }
  if (!found) {
    try {
      const res = await fetch(`${R2_MANIFEST_BASE}/courses/${encodeURIComponent(id)}/manifest.json`, { cache: "no-store" });
      if (res.ok) found = toCourse(id, await res.json());
    } catch (_) {}
  }
  if (found) { try { upsertCourse(found); } catch (_) {} }
  return found;
}
