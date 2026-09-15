import { Course, CourseEnrollment } from "./types";

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
    return parsed.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.has(c.id));
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
  return courses.find(c => c.id === id);
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

export function isUserEnrolled(courseId: string, studentId?: string): boolean {
  if (!studentId) return false;
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
