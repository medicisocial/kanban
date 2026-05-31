const MAX_PDF_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read PDF.'));
    reader.readAsDataURL(file);
  });
}

export function normalizeEventPdfAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const name = String(value.name || '').trim();
  const dataUrl = String(value.dataUrl || '').trim();
  if (!name || !dataUrl.startsWith('data:application/pdf')) return null;
  return {
    name,
    dataUrl,
    size: Number(value.size) || 0,
  };
}

export function eventPdfHasAttachment(value) {
  return Boolean(normalizeEventPdfAttachment(value));
}

export async function readEventPdfUpload(file) {
  if (!file) throw new Error('No file selected.');
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Please upload a PDF file.');
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 8 MB or smaller.');
  }

  const dataUrl = await readAsDataUrl(file);
  if (!String(dataUrl).startsWith('data:application/pdf')) {
    throw new Error('Please upload a PDF file.');
  }

  return {
    name: file.name,
    dataUrl,
    size: file.size,
  };
}
