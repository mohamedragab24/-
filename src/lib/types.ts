export type UserRole = 'teacher' | 'student' | 'mufhem' | 'mustafhem';

export interface UserProfile {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
  birthDate?: string;
  role: UserRole;
  avatarUrl?: string;
  balance?: number;
  [key: string]: any;
}

export type CourseStatus = 'pending' | 'published' | 'rejected' | 'withdrawn';

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  storagePath?: string;
  videoFileName?: string;
  videoFileSize?: string;
  durationMinutes: number;
  durationSeconds?: number;
  order: number;
  lessonNumber: number;
  isFreePreview: boolean;
}

export interface CourseReview {
  reviewerId: string;
  reviewerName: string;
  reviewedAt: any;
  decision: 'approved' | 'rejected' | 'withdrawn';
  rejectionReason?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  coverStoragePath?: string;
  coverFileName?: string;
  price: number;
  promotionalPrice?: number | null;
  features: string[];
  lessons: CourseLesson[];
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  status: CourseStatus;
  isPublished: boolean;
  category: string;
  createdAt: any;
  updatedAt?: any;
  submittedAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
  totalEnrollments?: number;
  rating?: number;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: any;
  amountPaid: number;
  progressPercent: number;
  completedLessonIds: string[];
}
