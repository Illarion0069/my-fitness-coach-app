import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'food-photos';
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Extracts the storage path from either a legacy public URL or a signed URL.
 * Returns null when the value is not a food-photos storage URL.
 */
export function foodPhotoPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const withoutQuery = url.split('?')[0];
  const parts = withoutQuery.split(`/${BUCKET}/`);
  if (!parts[1]) return null;
  try {
    return decodeURIComponent(parts[1]);
  } catch {
    return parts[1];
  }
}

/** Signs a single storage path for temporary read access. */
export async function signFoodPhotoPath(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error) {
    console.error('Failed to sign food photo', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Replaces photo_url on each row with a freshly signed URL so private-bucket
 * images keep rendering. Rows whose URL cannot be signed keep their original value.
 */
export async function withSignedFoodPhotos<T extends { photo_url: string }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const paths = rows.map(r => foodPhotoPath(r.photo_url));
  const validPaths = paths.filter((p): p is string => !!p);
  if (!validPaths.length) return rows;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(validPaths, SIGNED_TTL_SECONDS);
  if (error || !data) {
    console.error('Failed to sign food photos', error);
    return rows;
  }
  const byPath = new Map<string, string>();
  data.forEach(entry => {
    if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
  });

  return rows.map((row, i) => {
    const path = paths[i];
    const signed = path ? byPath.get(path) : null;
    return signed ? { ...row, photo_url: signed } : row;
  });
}
