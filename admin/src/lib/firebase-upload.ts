// Product photo upload to Firebase Storage over its REST API (no Firebase SDK, so no extra dependency).
// It does what the old admin did: files go to images/<product uuid>/<file uuid>; the first one is named like the
// folder. The bucket comes from NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (a public value of the web app, not a secret,
// but never committed). Without it the product form falls back to pasting an image URL.
//
// Security note: Firebase Storage rules decide who may write. The old admin wrote without signing in; once the
// rules require a signed-in user, this uploader needs a Firebase ID token (see README).

export const FIREBASE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
export const uploadEnabled = FIREBASE_BUCKET.length > 0;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  readonly reason: 'type' | 'size' | 'disabled' | 'failed';
  constructor(reason: UploadError['reason']) {
    super(reason);
    this.reason = reason;
  }
}

export function validateFile(file: Pick<File, 'type' | 'size'>): void {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new UploadError('type');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('size');
}

export function storagePath(folder: string, name: string): string {
  return `images/${folder}/${name}`;
}

export function downloadUrl(bucket: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export async function uploadProductImage(file: File, folder: string, name: string): Promise<string> {
  if (!uploadEnabled) throw new UploadError('disabled');
  validateFile(file);
  const path = storagePath(folder, name);
  const res = await fetch(`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o?name=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new UploadError('failed');
  const meta = (await res.json()) as { downloadTokens?: string };
  const token = meta.downloadTokens?.split(',')[0];
  if (!token) throw new UploadError('failed');
  return downloadUrl(FIREBASE_BUCKET, path, token);
}

/** An image address the storefront can use: https anywhere, or http only for localhost (development). */
export function isImageUrl(value: string): boolean {
  if (value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}
