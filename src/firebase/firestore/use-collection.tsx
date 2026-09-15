
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Improved to handle SDK internal state stability.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 1. Cleanup previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let isMounted = true;

    // Small delay before attaching to allow SDK to settle if just unsubscribed
    const timer = setTimeout(() => {
      if (!isMounted) return;

      try {
        const unsubscribe = onSnapshot(
          memoizedTargetRefOrQuery,
          (snapshot: QuerySnapshot<DocumentData>) => {
            if (!isMounted) return;
            const results: WithId<T>[] = [];
            snapshot.forEach((doc) => {
              results.push({ ...(doc.data() as T), id: doc.id });
            });
            setData(results);
            setError(null);
            setIsLoading(false);
          },
          (err: FirestoreError) => {
            if (!isMounted) return;
            
            if (err.code === 'permission-denied') {
              const path = 'path' in memoizedTargetRefOrQuery 
                ? memoizedTargetRefOrQuery.path 
                : 'query-result';

              const contextualError = new FirestorePermissionError({
                operation: 'list',
                path: path,
              });
              setError(contextualError);
              setData(null);
              setIsLoading(false);
              
              setTimeout(() => {
                if (isMounted) {
                  errorEmitter.emit('permission-error', contextualError);
                }
              }, 500);
            } else {
              setError(err);
              setIsLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err: any) {
        if (isMounted) {
          setIsLoading(false);
          setError(err);
        }
      }
    }, 10);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
