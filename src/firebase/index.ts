'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * تهيئة الفايربيز بشكل مستقر لضمان عدم حدوث تضارب في الحالة الداخلية للـ SDK.
 * تم تفعيل Long Polling لضمان الاتصال في كافة بيئات الشبكة.
 */
export function initializeFirebase() {
  let firebaseApp: FirebaseApp;

  if (getApps().length > 0) {
    firebaseApp = getApp();
  } else {
    firebaseApp = initializeApp(firebaseConfig);
  }

  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  // تهيئة Firestore مرة واحدة فقط. إذا كان SDK قد أنشأ المثيل بالفعل، أعد استخدامه.
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch (error: any) {
    if (error?.code === 'failed-precondition' || error?.message?.includes('already been called')) {
      firestore = getFirestore(firebaseApp);
    } else {
      throw error;
    }
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    storage: getStorage(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
