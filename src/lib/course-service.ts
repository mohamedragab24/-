import { collection, doc, getDoc, getDocs, query, where, orderBy, writeBatch, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { Course, CourseLesson } from './types';

const mapCourse = (id: string, data: any, lessons: CourseLesson[] = []): Course => ({
  id,
  ...data,
  coverUrl: data.coverUrl || data.thumbnailUrl || '',
  features: Array.isArray(data.features) ? data.features : [],
  lessons,
  status: data.status || (data.isPublished ? 'published' : 'pending'),
  isPublished: data.status === 'published' || data.isPublished === true,
});

export async function getCourseFromFirestore(db: Firestore, courseId: string) {
  const snap = await getDoc(doc(db, 'courses', courseId));
  if (!snap.exists()) return null;
  const lessonsSnap = await getDocs(query(collection(db, 'courses', courseId, 'lessons'), orderBy('lessonNumber', 'asc')));
  const lessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CourseLesson));
  return mapCourse(snap.id, snap.data(), lessons);
}

export async function listPublishedCourses(db: Firestore) {
  const snap = await getDocs(query(collection(db, 'courses'), where('status', '==', 'published')));
  return snap.docs.map(d => mapCourse(d.id, d.data()));
}

export async function listInstructorCourses(db: Firestore, instructorId: string) {
  const snap = await getDocs(query(collection(db, 'courses'), where('instructorId', '==', instructorId)));
  const out: Course[] = [];
  for (const d of snap.docs) out.push(mapCourse(d.id, d.data()));
  return out;
}

export async function uploadCourseFile(storage: FirebaseStorage, file: File, courseId: string, kind: 'cover' | 'lesson', lessonNumber?: number) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = kind === 'cover'
    ? `courses/${courseId}/cover/${Date.now()}_${safe}`
    : `courses/${courseId}/lessons/${String(lessonNumber).padStart(2, '0')}/${Date.now()}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return { storagePath: path, downloadUrl: url, fileName: file.name, fileSize: file.size };
}

export async function saveCourseWithLessons(db: Firestore, course: Course, lessons: CourseLesson[], existingLessonIds: string[] = []) {
  const batch = writeBatch(db);
  const courseRef = doc(db, 'courses', course.id);
  const courseData = { ...course } as any;
  delete courseData.lessons;
  batch.set(courseRef, { ...courseData, updatedAt: serverTimestamp() }, { merge: true });
  const keep = new Set(lessons.map(l => l.id));
  existingLessonIds.filter(id => !keep.has(id)).forEach(id => batch.delete(doc(db, 'courses', course.id, 'lessons', id)));
  lessons.forEach((lesson, index) => {
    const ref = doc(db, 'courses', course.id, 'lessons', lesson.id);
    batch.set(ref, {
      title: lesson.title,
      description: lesson.description || '',
      storagePath: lesson.storagePath || '',
      videoUrl: lesson.videoUrl || '',
      videoFileName: lesson.videoFileName || '',
      videoFileSize: lesson.videoFileSize || '',
      durationMinutes: lesson.durationMinutes,
      durationSeconds: lesson.durationSeconds || Math.round(lesson.durationMinutes * 60),
      order: index + 1,
      lessonNumber: index + 1,
      isPreview: index === 0,
      isFreePreview: index === 0,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

export async function reviewCourse(db: Firestore, courseId: string, reviewerId: string, reviewerName: string, decision: 'approved' | 'rejected', rejectionReason?: string) {
  if (decision === 'rejected' && !rejectionReason?.trim()) throw new Error('سبب الرفض مطلوب');
  const batch = writeBatch(db);
  const courseRef = doc(db, 'courses', courseId);
  batch.update(courseRef, {
    status: decision === 'approved' ? 'published' : 'rejected',
    isPublished: decision === 'approved',
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
    rejectionReason: decision === 'rejected' ? rejectionReason!.trim() : null,
    updatedAt: serverTimestamp(),
  });
  const reviewRef = doc(collection(db, 'courses', courseId, 'reviews'));
  batch.set(reviewRef, {
    reviewerId,
    reviewerName,
    reviewedAt: serverTimestamp(),
    decision,
    ...(decision === 'rejected' ? { rejectionReason: rejectionReason!.trim() } : {}),
  });
  batch.set(doc(collection(db, 'notifications')), {
    userId: (await getDoc(courseRef)).data()?.instructorId,
    title: decision === 'approved' ? 'تم اعتماد الكورس' : 'تم رفض الكورس',
    message: decision === 'approved' ? 'تم اعتماد الكورس وأصبح منشورًا للطلاب.' : `تم رفض الكورس. السبب: ${rejectionReason!.trim()}`,
    type: decision === 'approved' ? 'course_approval' : 'course_rejection',
    read: false,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
}

export async function withdrawCourse(db: Firestore, courseId: string, instructorId: string, instructorName: string) {
  const ref = doc(db, 'courses', courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('الكورس غير موجود');
  const data = snap.data();
  if (data.instructorId !== instructorId) throw new Error('غير مصرح');
  if (data.status !== 'pending') throw new Error('يمكن سحب الكورس قبل الاعتماد فقط');
  const batch = writeBatch(db);
  batch.update(ref, { status: 'withdrawn', isPublished: false, withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const reviewRef = doc(collection(db, 'courses', courseId, 'reviews'));
  batch.set(reviewRef, { reviewerId: instructorId, reviewerName: instructorName, reviewedAt: serverTimestamp(), decision: 'withdrawn' });
  await batch.commit();
}

export async function hasPurchased(db: Firestore, uid: string, courseId: string) {
  const snap = await getDoc(doc(db, 'purchases', `${uid}_${courseId}`));
  return snap.exists() && snap.data()?.status === 'completed';
}

export async function purchaseCourse(db: Firestore, uid: string, course: Course) {
  const functions = getFunctions(getApp(), 'us-central1');
  const callable = httpsCallable(functions, 'purchaseCourse');
  await callable({ courseId: course.id });
}
