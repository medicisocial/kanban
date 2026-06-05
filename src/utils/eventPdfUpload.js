/** Keep under hosted API body limits (~4.5 MB on Vercel once base64 + JSON overhead). */
export const MAX_PDF_BYTES = 3 * 1024 * 1024;

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
  // Either an inline PDF data URL (legacy / small uploads) or a Supabase Storage URL.
  const dataUrl = String(value.dataUrl || value.url || '').trim();
  const isData = dataUrl.startsWith('data:application/pdf');
  const isHttp = /^https?:\/\//i.test(dataUrl);
  if (!name || (!isData && !isHttp)) return null;
  const storagePath = String(value.storagePath || '').trim();
  return {
    name,
    dataUrl,
    size: Number(value.size) || 0,
    ...(storagePath ? { storagePath } : {}),
  };
}

export function eventPdfHasAttachment(value) {
  return Boolean(normalizeEventPdfAttachment(value));
}

export function getEventMenuAttachments(event) {
  const fields = event?.fields || {};
  const drinkPdf = normalizeEventPdfAttachment(fields.drinkMenuPdf);
  const foodPdf = normalizeEventPdfAttachment(fields.foodMenuPdf);
  const hasDrinkText = Boolean(String(fields.drinkMenuDetails || '').trim());
  const hasFoodText = Boolean(String(fields.foodMenuDetails || '').trim());

  return {
    drinkPdf,
    foodPdf,
    hasDrinkMenu: Boolean(fields.hasDrinkMenu || drinkPdf || hasDrinkText),
    hasFoodMenu: Boolean(fields.hasFoodMenu || foodPdf || hasFoodText),
    hasDrinkText,
    hasFoodText,
  };
}

export function eventHasMenuContent(event) {
  const menus = getEventMenuAttachments(event);
  return (
    menus.hasDrinkMenu ||
    menus.hasFoodMenu ||
    menus.hasDrinkText ||
    menus.hasFoodText ||
    Boolean(menus.drinkPdf) ||
    Boolean(menus.foodPdf)
  );
}

export function getEventDocumentAttachment(event) {
  return normalizeEventPdfAttachment(event?.fields?.eventDocument);
}

export function eventHasPdfAttachments(event) {
  if (getEventDocumentAttachment(event)) return true;
  const menus = getEventMenuAttachments(event);
  if (menus.drinkPdf || menus.foodPdf) return true;
  const fields = event?.fields || {};
  return Object.entries(fields).some(
    ([key, value]) =>
      !['drinkMenuPdf', 'foodMenuPdf', 'eventDocument'].includes(key) &&
      eventPdfHasAttachment(value),
  );
}

/** Short labels for calendar chips and upcoming lists. */
export function getEventAttachmentChipLabel(event) {
  const parts = [];
  const menus = getEventMenuAttachments(event);
  if (menus.drinkPdf || menus.hasDrinkText) parts.push('Drink');
  if (menus.foodPdf || menus.hasFoodText) parts.push('Food');
  if (getEventDocumentAttachment(event)) parts.push('PDF');
  return parts.join(' · ');
}

export async function readEventPdfUpload(file) {
  if (!file) throw new Error('No file selected.');
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Please upload a PDF file.');
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 3 MB or smaller.');
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
