/**
 * Downscale + re-encode a photo before upload.
 *
 * Android phones routinely produce 6–12 MP JPEG/HEIC files (5–15 MB), which
 * either got rejected by the size guard or timed out on mobile networks before
 * the analysis could run. We decode locally and ship a ~1440px JPEG instead.
 *
 * Always safe: if anything fails (HEIC that the browser can't decode, no canvas,
 * OOM on a low-end device) we return the original file untouched.
 */
export async function compressImage(
  file: File,
  { maxDim = 1440, quality = 0.82, maxBytes = 900 * 1024 }: { maxDim?: number; quality?: number; maxBytes?: number } = {}
): Promise<File> {
  try {
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return file;
    // Small enough already — skip the work.
    if (file.size <= maxBytes && file.type === 'image/jpeg') return file;

    const bitmap = await decode(file);
    if (!bitmap) return file;

    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') (bitmap as ImageBitmap).close();

    let blob = await toBlob(canvas, quality);
    if (blob && blob.size > maxBytes) {
      const retry = await toBlob(canvas, 0.62);
      if (retry) blob = retry;
    }
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation matters on Android: EXIF-rotated photos otherwise land sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
