import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

// R2-backed course media storage. IndexedDB is retained only for local previews.

// Allows uploading actual high-definition video files and images without external links.

const DB_NAME = "FahimtCourseMediaDB";
const STORE_VIDEOS = "course_videos";
const STORE_IMAGES = "course_images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is undefined"));
  }
  if (!window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS);
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function storeMediaBlob(
  storeName: typeof STORE_VIDEOS | typeof STORE_IMAGES,
  key: string,
  data: Blob | File
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(data, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMediaBlob(
  storeName: typeof STORE_VIDEOS | typeof STORE_IMAGES,
  key: string
): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not retrieve media from IndexedDB:", err);
    return null;
  }
}

// In-memory cache for active blob URLs
const activeBlobUrls = new Map<string, string>();

/**
 * Resolves a media URL (supports indexeddb:video:..., indexeddb:image:..., data:, blob:, or http/https)
 */
export async function resolveMediaUrl(url: string): Promise<string> {
  if (!url) return "";

  if (url.startsWith("r2:") || url.startsWith("r2cover:")) {
    try {
      const functions = getFunctions(getApp(), "us-central1");
      const callable = httpsCallable(functions, "getR2MediaUrl");
      const result = await callable({ token: url });
      const data = result.data as { url?: string };
      return data.url || "";
    } catch (err) {
      console.warn("Could not resolve R2 media URL:", err);
      return "";
    }
  }

  if (url.startsWith("indexeddb:video:")) {
    const key = url.replace("indexeddb:video:", "");
    if (activeBlobUrls.has(key)) return activeBlobUrls.get(key)!;
    const blob = await getMediaBlob(STORE_VIDEOS, key);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrls.set(key, blobUrl);
      return blobUrl;
    }
  }

  if (url.startsWith("indexeddb:image:")) {
    const key = url.replace("indexeddb:image:", "");
    if (activeBlobUrls.has(key)) return activeBlobUrls.get(key)!;
    const blob = await getMediaBlob(STORE_IMAGES, key);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrls.set(key, blobUrl);
      return blobUrl;
    }
  }

  return url;
}


export async function uploadToR2(
  file: File,
  courseId: string,
  kind: "cover" | "lesson",
  lessonNumber?: number
): Promise<{ token: string; key: string; previewUrl: string }> {
  const functions = getFunctions(getApp(), "us-central1");
  const callable = httpsCallable(functions, "createR2UploadUrl");
  const result = await callable({
    courseId,
    kind,
    lessonNumber: lessonNumber || 0,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  });
  const data = result.data as { uploadUrl?: string; url?: string; token: string; key: string };
  const uploadUrl = data.uploadUrl || data.url;
  if (!uploadUrl) throw new Error("R2 upload URL was not returned");
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`R2 upload failed: ${response.status}`);
  return { token: data.token, key: data.key, previewUrl: URL.createObjectURL(file) };
}

/**
 * Format bytes into human readable string (e.g. 15.4 MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Extracts duration in minutes from a video file
 */
export function extractVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        const durationSec = video.duration || 0;
        const minutes = Math.max(1, Math.round(durationSec / 60));
        resolve(minutes);
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(10); // fallback default
      };
    } catch {
      resolve(10);
    }
  });
}

/**
 * Converts an image file to a compressed Base64 Data URL or stores in IndexedDB
 */
export async function processImageFile(file: File): Promise<{ url: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  try {
    await storeMediaBlob(STORE_IMAGES, imageId, file);
    return {
      url: `indexeddb:image:${imageId}`,
      previewUrl
    };
  } catch {
    // fallback to DataURL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string,
          previewUrl
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

/**
 * Compresses an image file to a lightweight JPEG Data URL (under 100KB)
 * for instant, crisp rendering across all browsers without external dependencies.
 */
export function compressImageToDataUrl(
  file: File, 
  maxWidth = 1280, 
  maxHeight = 720, 
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/**
 * Saves a video file into IndexedDB and returns a resolution token
 */
export async function processVideoFile(
  file: File,
  courseId?: string,
  lessonNumber?: number
): Promise<{ token: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  if (!courseId) {
    return { token: previewUrl, previewUrl };
  }
  const uploaded = await uploadToR2(file, courseId, "lesson", lessonNumber);
  return { token: uploaded.token, previewUrl: uploaded.previewUrl };
}
