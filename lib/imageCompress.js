// Client-side image downscale + recompress before upload.
// Cuts mobile upload time, page-load egress, and storage cost.
// Images only; documents pass through untouched. Any failure (e.g. HEIC that the
// browser can't decode) falls back to the original file — never blocks an upload.

const MAX_EDGE = 2000;       // longest side, px
const QUALITY = 0.82;        // JPEG quality
const MIN_BYTES = 300_000;   // skip already-small images (~300KB)

export async function maybeCompressImage(file) {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return file;
    if (typeof createImageBitmap !== "function") return file;
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file; // keep animation/vector
    if (file.size <= MIN_BYTES) return file;

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return file; // undecodable (e.g. HEIC on this browser) → upload original
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file; // no real gain → keep original

    const baseName = String(file.name ?? "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
