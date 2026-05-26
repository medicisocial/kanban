const MAX_DIMENSION = 256;
const MAX_DATA_URL_LENGTH = 120000;
const INITIAL_QUALITY = 0.88;

export function readClientProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Please upload an image file (PNG, JPG, or WebP).'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be under 5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
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
          ctx.drawImage(img, 0, 0, width, height);

          let quality = INITIAL_QUALITY;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          if (dataUrl.length > MAX_DATA_URL_LENGTH) {
            reject(new Error('Image is too detailed. Try a simpler logo or smaller file.'));
            return;
          }

          resolve(dataUrl);
        } catch {
          reject(new Error('Could not process image.'));
        }
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}
