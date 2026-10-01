
export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  role: UserRole;
  avatarUrl: string;
  specialization?: string;
  balance: number;
}

export type RequestStatus = 'pending' | 'accepted' | 'completed' | 'canceled';

export interface LearningRequest {
  id: string;
  title: string;
  description: string;
  amount: number;
  meetingTime: string;
  category: string;
  status: RequestStatus;
  studentId: string;
  studentName: string;
  teacherId?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payment' | 'earning';
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  videoUrl: string; // Internal protected streaming URL or embedded video
  durationMinutes: number;
  order: number;
  isFreePreview?: boolean;
  videoFileName?: string;
  videoFileSize?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  price: number;
  features: string[];
  lessons: CourseLesson[];
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  isPublished: boolean;
  category: string;
  createdAt: string;
  updatedAt?: string;
  totalEnrollments?: number;
  rating?: number;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: string;
  amountPaid: number;
  progressPercent: number;
  completedLessonIds: string[];
}

