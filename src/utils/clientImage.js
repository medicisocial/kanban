const MAX_DIMENSION = 512;
const MAX_DATA_URL_LENGTH = 450000;
const INITIAL_QUALITY = 0.92;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image.'));
    img.src = src;
  });
}

function encodeCanvas(canvas) {
  const tryWebp = canvas.toDataURL('image/webp', INITIAL_QUALITY);
  if (tryWebp.startsWith('data:image/webp') && tryWebp.length <= MAX_DATA_URL_LENGTH) {
    return tryWebp;
  }

  let quality = INITIAL_QUALITY;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.5) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('Image is too detailed. Try a simpler photo or smaller crop.');
  }

  return dataUrl;
}

export function readClientProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Please upload an image file (PNG, JPG, or WebP).'));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image must be under 8 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      loadImage(reader.result)
        .then((img) => {
          const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not process image.'));
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          resolve(encodeCanvas(canvas));
        })
        .catch((error) => reject(error.message ? error : new Error('Could not process image.')));
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export { loadImage, encodeCanvas };
