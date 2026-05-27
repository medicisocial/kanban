/** Max edge length while editing (before final crop bake). */
export const IMAGE_IMPORT_MAX_DIMENSION = 2048;
/** Final baked avatar/logo square size (sharp on retina displays). */
export const IMAGE_BAKE_OUTPUT_SIZE = 1024;
/** Minimum baked output — never upscale a tiny crop beyond source detail. */
export const IMAGE_BAKE_MIN_SIZE = 512;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
/** In-memory draft during crop — allow larger payloads before bake. */
const DRAFT_MAX_DATA_URL_LENGTH = 2_400_000;
/** Stored baked image — fits localStorage while staying high quality. */
const BAKED_MAX_DATA_URL_LENGTH = 1_400_000;
const ENCODE_QUALITY = 0.94;
const ENCODE_QUALITY_MIN = 0.78;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image.'));
    img.src = src;
  });
}

function encodeWithQuality(canvas, mime, quality) {
  try {
    return canvas.toDataURL(mime, quality);
  } catch {
    return '';
  }
}

function encodeCanvas(canvas, { preferPng = false, maxLength = BAKED_MAX_DATA_URL_LENGTH } = {}) {
  const attemptEncode = (targetCanvas) => {
    if (preferPng) {
      const png = targetCanvas.toDataURL('image/png');
      if (png.length <= maxLength) {
        return png;
      }
    }

    for (const quality of [ENCODE_QUALITY, 0.9, 0.86, 0.82, ENCODE_QUALITY_MIN]) {
      const webp = encodeWithQuality(targetCanvas, 'image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= maxLength) {
        return webp;
      }
    }

    let quality = ENCODE_QUALITY;
    let dataUrl = encodeWithQuality(targetCanvas, 'image/jpeg', quality);
    while (dataUrl.length > maxLength && quality > ENCODE_QUALITY_MIN) {
      quality = Math.round((quality - 0.04) * 100) / 100;
      dataUrl = encodeWithQuality(targetCanvas, 'image/jpeg', quality);
    }

    return dataUrl.length <= maxLength ? dataUrl : null;
  };

  let result = attemptEncode(canvas);
  if (result) return result;

  let fallback = canvas;
  for (let pass = 0; pass < 3; pass += 1) {
    const scale = 0.88;
    const next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(fallback.width * scale));
    next.height = Math.max(1, Math.round(fallback.height * scale));
    const ctx = next.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fallback, 0, 0, next.width, next.height);
    fallback = next;
    result = attemptEncode(fallback);
    if (result) return result;
  }

  throw new Error('Image is too detailed. Try a simpler photo or smaller crop.');
}

function resizeImageToCanvas(img, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  if (scale === 1) {
    return { width: img.width, height: img.height, draw: (ctx) => ctx.drawImage(img, 0, 0) };
  }

  return {
    width,
    height,
    draw: (ctx) => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
    },
  };
}

export function readClientProfileImage(file, { preservePng = false, maxDimension = IMAGE_IMPORT_MAX_DIMENSION } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Please upload an image file (PNG, JPG, or WebP).'));
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      reject(new Error('Image must be under 12 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      loadImage(dataUrl)
        .then((img) => {
          const withinDimensions = img.width <= maxDimension && img.height <= maxDimension;
          const withinDraftBudget =
            typeof dataUrl === 'string' && dataUrl.length <= DRAFT_MAX_DATA_URL_LENGTH;

          if (withinDimensions && withinDraftBudget) {
            resolve(dataUrl);
            return;
          }

          const { width, height, draw } = resizeImageToCanvas(img, maxDimension);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not process image.'));
            return;
          }
          draw(ctx);
          const usePng = preservePng && /^image\/png$/i.test(file.type);
          resolve(
            encodeCanvas(canvas, {
              preferPng: usePng,
              maxLength: DRAFT_MAX_DATA_URL_LENGTH,
            }),
          );
        })
        .catch((error) => reject(error.message ? error : new Error('Could not process image.')));
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function computeBakeOutputSize(img, zoom = 1, maxSize = IMAGE_BAKE_OUTPUT_SIZE) {
  const minSide = Math.min(img.width, img.height);
  const croppedApprox = minSide / Math.max(1, zoom);
  return Math.min(maxSize, Math.max(IMAGE_BAKE_MIN_SIZE, Math.round(croppedApprox)));
}

export { loadImage, encodeCanvas, BAKED_MAX_DATA_URL_LENGTH };
