import React from 'react';
import Link from 'next/link';

interface CoursePageProps {
  params: { id: string };
}

export default async function CoursePage({ params }: CoursePageProps) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/${params.id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`خطأ في جلب بيانات الكورس: ${res.statusText}`);
    }

    const course = await res.json();

    return (
      <div className="max-w-4xl mx-auto p-6 dir-rtl text-right" dir="rtl">
        <h1 className="text-3xl font-bold mb-4">{course?.title || 'كورس تعليمي'}</h1>
        <p className="text-gray-600 mb-6">{course?.description || 'لا يوجد وصف متاح'}</p>

        <div className="bg-gray-100 p-4 rounded-xl mb-6">
          <h2 className="text-xl font-semibold mb-3">معاينة الكورس المجانية</h2>
          {course?.previewVideoUrl ? (
            <video
              controls
              className="w-full rounded-lg shadow"
              src={course.previewVideoUrl}
              poster={course?.thumbnailUrl || ''}
            />
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg">
              لا تتوفر معاينة فيديو لهذا الكورس حالياً
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-2xl font-bold text-green-600">
            {course?.price ? `${course.price} ج.م` : 'مجاني'}
          </span>
          <Link
            href={`/checkout?courseId=${params.id}&price=${course?.price || 0}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            شراء الكورس الآن
          </Link>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-lg text-center dir-rtl" dir="rtl">
        <h2 className="text-red-700 font-bold text-xl mb-2">حدث خطأ أثناء تحميل الكورس</h2>
        <p className="text-red-600 text-sm mb-4">{error?.message || 'تعذر الوصول إلى خادم البيانات'}</p>
        <Link href="/" className="text-blue-600 underline text-sm">
          العودة للرئيسية
        </Link>
      </div>
    );
  }
}
