 "use client";

import React, { useEffect, useState } from "react";

const cache = new Map<string, string>();
const R2_WORKER_URL = "https://fahmny-r2.mohamedragabewiess.workers.dev";

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
    const parts = src.split(":");
    const key = src.startsWith("r2:") ? parts.slice(3).join(":") : parts.slice(2).join(":");
    if (key) {
      const url = `${R2_WORKER_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
      cache.set(src, url);
      if (alive) setResolved(url);
    }
    return () => { alive = false; };
  }, [src]);

  if (!resolved) return <div className={className} aria-label={alt} />;
  return <img src={resolved} alt={alt} className={className} />;
}
