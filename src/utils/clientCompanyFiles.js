import { normalizeBusinessType } from './eventFormSchemas';
import { MAX_PDF_BYTES } from './eventPdfUpload';

const MAX_FILE_BYTES = MAX_PDF_BYTES;
/** Files uploaded to Supabase Storage bypass the JSON body limit, so allow larger. */
export const MAX_STORAGE_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_CLIENT = 40;

const MULTI_UPLOAD_FOLDERS = new Set(['general', 'drink-menu', 'food-menu']);

export function allowsMultipleCompanyFileUpload(folderId) {
  return MULTI_UPLOAD_FOLDERS.has(folderId);
}

export const CLIENT_FILE_FOLDERS_BASE = [
  { id: 'branding-kit', label: 'Branding kit' },
  { id: 'logo', label: 'Logo & assets' },
  { id: 'general', label: 'General' },
];

export const CLIENT_FILE_FOLDERS_HOSPITALITY = [
  { id: 'drink-menu', label: 'Drink menu' },
  { id: 'food-menu', label: 'Food menu' },
];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.zip'];

export function createClientCompanyFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getClientFileFolders(businessType) {
  const folders = [...CLIENT_FILE_FOLDERS_BASE];
  if (normalizeBusinessType(businessType) === 'Hospitality') {
    folders.push(...CLIENT_FILE_FOLDERS_HOSPITALITY);
  }
  return folders;
}

export function getClientFileFolderLabel(folderId, businessType) {
  return getClientFileFolders(businessType).find((folder) => folder.id === folderId)?.label || folderId;
}

function isAllowedFile(file) {
  if (!file) return false;
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;
  const lower = String(file.name || '').toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function defaultDisplayName(fileName) {
  const base = String(fileName || 'Untitled').replace(/\.[^.]+$/, '').trim();
  return base || 'Untitled';
}

export function formatCompanyFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10240 ? 0 : 1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isUsableFileSource(value) {
  const url = String(value || '').trim();
  return url.startsWith('data:') || /^https?:\/\//i.test(url);
}

export function normalizeClientCompanyFile(file, businessType) {
  if (!file || typeof file !== 'object') return null;
  // Either an inline data URL (legacy / portal) or a Supabase Storage URL.
  const dataUrl = String(file.dataUrl || file.url || '').trim();
  if (!isUsableFileSource(dataUrl)) return null;

  const folderIds = new Set(getClientFileFolders(businessType).map((folder) => folder.id));
  const folder = folderIds.has(file.folder) ? file.folder : 'general';
  const name = String(file.name || '').trim() || defaultDisplayName(file.fileName);
  const fileName = String(file.fileName || '').trim() || 'file';
  const mimeType = String(file.mimeType || '').trim() || 'application/octet-stream';
  const storagePath = String(file.storagePath || '').trim();

  return {
    id: String(file.id || createClientCompanyFileId()),
    name,
    folder,
    fileName,
    mimeType,
    dataUrl,
    ...(storagePath ? { storagePath } : {}),
    size: Number(file.size) || 0,
    createdAt: Number(file.createdAt) || Date.now(),
    updatedAt: Number(file.updatedAt) || Date.now(),
  };
}

export function normalizeClientCompanyFiles(files, businessType) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => normalizeClientCompanyFile(file, businessType))
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function groupClientCompanyFilesByFolder(files, businessType) {
  const folders = getClientFileFolders(businessType);
  const grouped = Object.fromEntries(folders.map((folder) => [folder.id, []]));
  for (const file of normalizeClientCompanyFiles(files, businessType)) {
    grouped[file.folder]?.push(file);
  }
  for (const folder of folders) {
    grouped[folder.id].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return grouped;
}

export async function readClientCompanyFileUpload(file, { name, folder, businessType, existingCount = 0 } = {}) {
  if (!file) throw new Error('No file selected.');
  if (!isAllowedFile(file)) {
    throw new Error('Upload a PDF, image (PNG/JPG/WebP/SVG), or ZIP file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Files must be 3 MB or smaller.');
  }
  if (existingCount >= MAX_FILES_PER_CLIENT) {
    throw new Error(`You can store up to ${MAX_FILES_PER_CLIENT} files. Remove one to add another.`);
  }

  const folderIds = new Set(getClientFileFolders(businessType).map((entry) => entry.id));
  const resolvedFolder = folderIds.has(folder) ? folder : 'general';
  const dataUrl = await readAsDataUrl(file);
  if (!String(dataUrl).startsWith('data:')) {
    throw new Error('Could not read file.');
  }

  const now = Date.now();
  return {
    id: createClientCompanyFileId(),
    name: String(name || '').trim() || defaultDisplayName(file.name),
    folder: resolvedFolder,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataUrl,
    size: file.size,
    createdAt: now,
    updatedAt: now,
  };
}

/** Validate a file for storage upload (larger cap, no base64 read). */
export function assertCompanyFileUploadable(file, { existingCount = 0 } = {}) {
  if (!file) throw new Error('No file selected.');
  if (!isAllowedFile(file)) {
    throw new Error('Upload a PDF, image (PNG/JPG/WebP/SVG), or ZIP file.');
  }
  if (file.size > MAX_STORAGE_FILE_BYTES) {
    throw new Error('Files must be 25 MB or smaller.');
  }
  if (existingCount >= MAX_FILES_PER_CLIENT) {
    throw new Error(`You can store up to ${MAX_FILES_PER_CLIENT} files. Remove one to add another.`);
  }
}

/** Build a company-file entry that points at an already-uploaded storage object. */
export function buildStorageCompanyFileEntry({ file, name, folder, url, storagePath, businessType }) {
  const folderIds = new Set(getClientFileFolders(businessType).map((entry) => entry.id));
  const resolvedFolder = folderIds.has(folder) ? folder : 'general';
  const now = Date.now();
  return {
    id: createClientCompanyFileId(),
    name: String(name || '').trim() || defaultDisplayName(file?.name),
    folder: resolvedFolder,
    fileName: file?.name || 'file',
    mimeType: file?.type || 'application/octet-stream',
    dataUrl: url,
    storagePath: storagePath || '',
    size: file?.size || 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function companyFilesMatch(a, b, businessType) {
  return (
    JSON.stringify(normalizeClientCompanyFiles(a, businessType)) ===
    JSON.stringify(normalizeClientCompanyFiles(b, businessType))
  );
}
