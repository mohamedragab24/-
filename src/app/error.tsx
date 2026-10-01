'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Page error:', error); }, [error]);
  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-black">حدث خطأ غير متوقع</h2>
      <p className="text-sm text-zinc-500 max-w-md break-words">{error?.message || 'حاول مرة أخرى.'}</p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className="rounded-xl bg-primary text-white font-black px-6 py-3">إعادة المحاولة</button>
        <a href="/courses" className="rounded-xl border font-black px-6 py-3">العودة للكورسات</a>
      </div>
    </div>
  );
}
