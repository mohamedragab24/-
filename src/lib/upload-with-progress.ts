"use client";

import { ref as storageRef, uploadBytesResumable, getDownloadURL, type FirebaseStorage } from "firebase/storage";

/** رفع صورة إلى Firebase Storage مع عدّاد نسبة التقدم (0–100) ويرجع رابط التحميل. */
export function uploadImageWithProgress(
  storage: FirebaseStorage,
  folder: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r = storageRef(storage, `${folder}/${Date.now()}_${safe}`);
    const task = uploadBytesResumable(r, file, { contentType: file.type || "image/jpeg" });
    onProgress(0);
    task.on(
      "state_changed",
      (s) => onProgress(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
      (err) => reject(err),
      async () => {
        try { onProgress(100); resolve(await getDownloadURL(task.snapshot.ref)); }
        catch (e) { reject(e); }
      },
    );
  });
}
