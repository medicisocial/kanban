/**
 * Validates the brand-asset / special-menu PDF upload data chain:
 * storage URLs survive normalization and merge (the usual reason uploads vanish).
 */
import {
  normalizeClientCompanyFiles,
  slimCompanyFilesForApiSave,
} from '../api/_lib/clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from '../api/_lib/clientSpecialMenus.mjs';
import {
  mergeBrandCompanyFiles,
  mergeBrandSpecialMenus,
} from '../api/_lib/clientsWorkspaceMerge.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const storageUrl =
  'https://example.supabase.co/storage/v1/object/public/brand-assets/medici/Plume/drink-menu/abc.pdf';

const companyFile = {
  id: 'file-upload-1',
  name: 'Spring cocktails',
  folder: 'drink-menu',
  fileName: 'spring.pdf',
  mimeType: 'application/pdf',
  dataUrl: storageUrl,
  storagePath: 'medici/Plume/drink-menu/abc.pdf',
  size: 1200000,
  updatedAt: Date.now(),
};

const normalizedFiles = normalizeClientCompanyFiles([companyFile], 'Hospitality');
assert(normalizedFiles.length === 1, 'storage URL company file should normalize');
assert(normalizedFiles[0].dataUrl === storageUrl, 'storage URL should be preserved');
assert(normalizedFiles[0].storagePath === companyFile.storagePath, 'storagePath should be preserved');

const staleRead = [];
const mergedFiles = mergeBrandCompanyFiles(staleRead, normalizedFiles);
assert(mergedFiles.length === 1, 'merge should keep newly uploaded file against empty server read');
assert(mergedFiles[0].id === companyFile.id, 'merged file id should match upload');

const specialMenu = {
  id: 'sm-1',
  name: 'Valentine specials',
  startDate: '2026-02-14',
  endDate: '2026-02-14',
  hasDrinkMenu: true,
  drinkMenuPdfs: [
    {
      id: 'smp-1',
      label: 'Cocktails',
      name: 'cocktails.pdf',
      dataUrl: storageUrl,
      storagePath: 'medici/Plume/special-menus/smp-1.pdf',
      size: 900000,
    },
  ],
  hasFoodMenu: false,
  foodMenuPdfs: [],
  updatedAt: Date.now(),
};

const normalizedMenus = normalizeClientSpecialMenus([specialMenu]);
assert(normalizedMenus.length === 1, 'special menu with storage PDF should normalize');
assert(normalizedMenus[0].drinkMenuPdfs.length === 1, 'drink PDF list should survive normalization');
assert(normalizedMenus[0].drinkMenuPdfs[0].dataUrl === storageUrl, 'menu PDF storage URL should be preserved');

const mergedMenus = mergeBrandSpecialMenus([], normalizedMenus);
assert(mergedMenus.length === 1, 'merge should keep new special menu against empty server read');

const legacyInline = {
  ...companyFile,
  id: 'file-inline-1',
  dataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
};
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
const slimmed = slimCompanyFilesForApiSave([legacyInline], 'Hospitality');
assert(slimmed.length === 1, 'slim should keep storage-backed file');
assert(
  slimmed[0].dataUrl ===
    'https://example.supabase.co/storage/v1/object/public/brand-assets/medici/Plume/drink-menu/abc.pdf',
  'slim should replace inline base64 with public storage URL when storagePath is set',
);
assert(!slimmed[0].dataUrl.startsWith('data:'), 'slim should not send base64 for storage-backed files');

console.log('Brand asset upload chain tests passed.');
