import { apiUrl } from './apiBase';
import { auth } from './firebase';

export type MediaBucket =
  | 'avatars'
  | 'covers'
  | 'posts'
  | 'stories'
  | 'reels'
  | 'chat'
  | 'groups'
  | 'streams';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
];

export function validateMediaFile(file: File): { valid: boolean; error?: string; kind: 'image' | 'video' | 'file' } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported format. Please select JPG, PNG, WebP, GIF, MP4, WebM, or PDF.',
      kind: 'file',
    };
  }
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File exceeds ${isVideo ? '50MB' : '10MB'} limit.`,
      kind: isVideo ? 'video' : isImage ? 'image' : 'file',
    };
  }
  return {
    valid: true,
    kind: isVideo ? 'video' : isImage ? 'image' : 'file',
  };
}

export async function uploadMediaFile(
  file: File,
  bucket: MediaBucket
): Promise<{ url: string; mimeType: string; kind: 'image' | 'video' | 'file' }> {
  const check = validateMediaFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid file');
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in required to upload media.');
  }
  const token = await user.getIdToken();
  const res = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type,
      'x-mime-type': file.type,
      'x-file-name': encodeURIComponent(file.name),
      'x-bucket': bucket,
    },
    body: file,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Upload failed.');
  }
  const data = (await res.json()) as { url: string; mimeType: string };
  return { url: data.url, mimeType: data.mimeType, kind: check.kind };
}
