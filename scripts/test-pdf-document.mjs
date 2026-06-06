/**
 * PDF preview helpers — source classification and DPR cap.
 */
import {
  capDevicePixelRatio,
  classifyPdfSource,
  PREVIEW_MAX_DEVICE_PIXEL_RATIO,
} from '../src/utils/pdfDocumentHelpers.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(classifyPdfSource('') === 'invalid', 'empty source is invalid');
assert(classifyPdfSource('data:application/pdf;base64,abc') === 'data', 'data URL');
assert(classifyPdfSource('blob:http://localhost/abc') === 'blob', 'blob URL');
assert(
  classifyPdfSource('https://example.supabase.co/storage/v1/object/public/brand-assets/a.pdf') === 'remote',
  'https storage URL',
);

assert(capDevicePixelRatio(3) === PREVIEW_MAX_DEVICE_PIXEL_RATIO, 'caps high DPR');
assert(capDevicePixelRatio(1.5) === 1.5, 'keeps moderate DPR');
assert(capDevicePixelRatio(0) === 1, 'floors invalid DPR');

console.log('PDF document helper tests passed.');
