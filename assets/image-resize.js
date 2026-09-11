// assets/image-resize.js
//
// Client-side image resize/compress, run right before an admin upload hits
// Supabase Storage. The site has no server-side image pipeline — files go
// straight from the browser to storage via a signed URL — so this is where
// oversized photos get cut down to something the storefront can load fast.
//
// Usage:
//   import { resizeImageFile } from "./image-resize.js";
//   const optimized = await resizeImageFile(file, { maxDimension: 1600, quality: 0.82 });
//   // optimized.type / optimized.size may differ from the original file —
//   // use optimized (not file) for both the get_upload_url content_type and
//   // the actual upload.
//
// Safe by design: never upscales, never returns something bigger than the
// original, and falls back to the original file untouched if anything about
// resizing fails (unsupported browser, decode error, etc).

const WEBP_SUPPORT = (() => {
  let cached = null;
  return () => {
    if (cached !== null) return cached;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      cached = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      cached = false;
    }
    return cached;
  };
})();

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } else {
      resolve(null);
    }
  });
}

async function loadBitmap(file) {
  // imageOrientation: "from-image" makes the canvas respect EXIF rotation
  // (phone photos are frequently stored sideways with an orientation tag).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // fall through to <img>-based decode below
      }
    }
  }
  return await loadBitmapViaImageElement(file);
}

function loadBitmapViaImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

function renameExtension(name, ext) {
  const base = (name || "image").replace(/\.[a-zA-Z0-9]+$/, "");
  return base + "." + ext;
}

function extForType(type) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

/**
 * Resize + re-encode an uploaded image file so it's cheap to load on the site.
 *
 * @param {File|Blob} file - the original file from an <input type="file">
 * @param {Object} [options]
 * @param {number} [options.maxDimension=1600] - longest side is capped to this many px; never upscales
 * @param {number} [options.quality=0.82] - encoder quality, 0..1 (ignored for lossless png fallback)
 * @param {boolean} [options.preserveTransparency=true] - keep alpha for png sources without a safe opaque background
 * @returns {Promise<File>} the optimized file, or the original file if resizing wasn't possible/worthwhile
 */
export async function resizeImageFile(file, options = {}) {
  const {
    maxDimension = 1600,
    quality = 0.82,
    preserveTransparency = true,
  } = options;

  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  // Animated formats would lose their animation if re-encoded through canvas — leave them alone.
  if (file.type === "image/gif") return file;

  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch (err) {
    console.warn("[image-resize] decode failed, uploading original:", err);
    return file;
  }

  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  if (!width || !height) {
    if (bitmap.close) bitmap.close();
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  let canvas;
  try {
    canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, outW, outH);
  } catch (err) {
    console.warn("[image-resize] draw failed, uploading original:", err);
    return file;
  } finally {
    if (bitmap.close) bitmap.close();
  }

  // Pick an output format: WebP compresses ~25-35% smaller than JPEG at
  // equivalent visual quality and (unlike JPEG) still supports transparency,
  // so it's the default whenever the browser can encode it. PNG sources that
  // actually need alpha fall back to PNG on browsers without WebP encoding
  // support; anything else falls back to JPEG.
  const wantsAlpha = preserveTransparency && file.type === "image/png";
  const webpOk = WEBP_SUPPORT();
  const outType = webpOk ? "image/webp" : wantsAlpha ? "image/png" : "image/jpeg";
  const outQuality = outType === "image/png" ? undefined : quality;

  const blob = await canvasToBlob(canvas, outType, outQuality);
  if (!blob || !blob.size) return file;

  // If we didn't shrink the dimensions AND the re-encode came out no smaller
  // than the original, the original was already about as good as it gets —
  // don't bother swapping it out.
  if (scale === 1 && blob.size >= file.size) return file;

  const newName = renameExtension(file.name, extForType(outType));
  return new File([blob], newName, { type: outType, lastModified: Date.now() });
}

// Width of the grid rendition offered to cards via srcset. Chosen to cover
// every grid context in one file: a 306px desktop card at 2x needs 612px, a
// 172px mobile card at 3x needs 516px. One candidate at 700px serves all of
// them, where the full-size file (sized for the zoom view) is 3-5x heavier.
export const THUMB_WIDTH = 700;

// Below this the full image is already small enough that a second rendition
// would save little and cost an extra request.
const THUMB_WORTH_IT_ABOVE = Math.round(THUMB_WIDTH * 1.25);

/**
 * Build both renditions of an upload from a single decode: the full-size image
 * (same output resizeImageFile produces) and a grid-sized thumb for srcset.
 *
 * @param {File|Blob} file
 * @param {Object} [options] - same shape as resizeImageFile's options
 * @returns {Promise<{full: File, thumb: File|null, width: number, height: number}>}
 *   `width`/`height` describe the FULL rendition. `thumb` is null when the
 *   full image is already grid-sized, or when encoding it failed — callers
 *   must treat a missing thumb as "just use the full one".
 */
export async function buildImageVariants(file, options = {}) {
  const full = await resizeImageFile(file, options);
  const size = await imageDimensions(full);

  let thumb = null;
  if (size.width > THUMB_WORTH_IT_ABOVE) {
    try {
      thumb = await resizeImageFile(full, {
        ...options,
        // resizeImageFile caps the LONGEST side, so for a portrait photo the
        // cap has to be expressed as the height that yields THUMB_WIDTH.
        maxDimension: size.height >= size.width
          ? Math.round((size.height / size.width) * THUMB_WIDTH)
          : THUMB_WIDTH,
      });
      // resizeImageFile returns the input untouched when it cannot improve on
      // it; that would make the "thumb" a second copy of the full file.
      if (thumb === full || thumb.size >= full.size) thumb = null;
    } catch (err) {
      console.warn("[image-resize] thumb generation failed, using full image only:", err);
      thumb = null;
    }
  }

  return { full, thumb, width: size.width, height: size.height };
}

/** Intrinsic pixel size of an image file, or zeros if it cannot be decoded. */
export async function imageDimensions(file) {
  try {
    const bitmap = await loadBitmap(file);
    const width = bitmap.width || bitmap.naturalWidth || 0;
    const height = bitmap.height || bitmap.naturalHeight || 0;
    if (bitmap.close) bitmap.close();
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * Convenience helper for resizing several files (e.g. a multi-file product
 * gallery input) with the same options. Resizing runs one file at a time so
 * a decode failure on one file can't take down the rest of the batch.
 *
 * @param {File[]|FileList} files
 * @param {Object} [options] - same shape as resizeImageFile's options
 * @returns {Promise<File[]>}
 */
export async function resizeImageFiles(files, options = {}) {
  const out = [];
  for (const file of Array.from(files)) {
    out.push(await resizeImageFile(file, options));
  }
  return out;
}

// Sensible presets for this site's known upload spots — tweak here and every
// call site picks up the change.
export const IMAGE_PRESETS = {
  productPhoto: { maxDimension: 1600, quality: 0.82 },
  collectionCover: { maxDimension: 1600, quality: 0.82 },
  blogCover: { maxDimension: 1600, quality: 0.82 },
  heroDesktop: { maxDimension: 1920, quality: 0.8 },
  heroMobile: { maxDimension: 1000, quality: 0.8 },
  testimonialPhoto: { maxDimension: 480, quality: 0.82 },
};
