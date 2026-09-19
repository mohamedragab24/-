 "use client";

import React, { useEffect, useState } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const cache = new Map<string, string>();

export function R2MediaImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState<string>(src);

  useEffect(() => {
    let alive = true;
    if (!src?.startsWith("r2cover:") && !src?.startsWith("r2:")) {
      setResolved(src || "");
      return () => { alive = false; };
    }
    const cached = cache.get(src);
    if (cached) {
      setResolved(cached);
      return () => { alive = false; };
    }
    (async () => {
      try {
        const fn = httpsCallable(getFunctions(getApp(), "us-central1"), "getR2MediaUrl");
        const result = await fn({ token: src });
        const url = String((result.data as any)?.url || "");
        if (url) {
          cache.set(src, url);
          if (alive) setResolved(url);
        }
      } catch (e) {
        console.warn("R2 image resolve failed", e);
      }
    })();
    return () => { alive = false; };
  }, [src]);

  if (!resolved) return <div className={className} aria-label={alt} />;
  return <img src={resolved} alt={alt} className={className} />;
}
