'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * يستمع لأخطاء صلاحيات Firestore ويعرضها كتنبيه فقط.
 * (النسخة السابقة كانت ترمي الخطأ داخل الـ render، وهذا ما كان يُسقط الصفحة كلها
 * ويُظهر "Application error: a client-side exception" عند فتح صفحة الكورس.)
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    let lastShown = 0;
    const handleError = (error: FirestorePermissionError) => {
      console.error('Firestore permission error:', error);
      const now = Date.now();
      if (now - lastShown < 5000) return; // لا نكرر التنبيه
      lastShown = now;
      toast({
        variant: 'destructive',
        title: 'تعذر الوصول إلى بعض البيانات',
        description: 'قد تحتاج لتسجيل الدخول أو لا تملك صلاحية لهذا الجزء.',
      });
    };
    errorEmitter.on('permission-error', handleError);
    return () => { errorEmitter.off('permission-error', handleError); };
  }, [toast]);

  return null;
}
