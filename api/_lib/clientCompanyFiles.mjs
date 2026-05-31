const HOSPITALITY_TYPES = new Set(['Hospitality', 'Cocktail Lounge', 'Sports Bar']);

const CLIENT_FILE_FOLDERS_BASE = ['branding-kit', 'logo', 'general'];
const CLIENT_FILE_FOLDERS_HOSPITALITY = ['drink-menu', 'food-menu'];

function normalizeBusinessType(businessType) {
  if (HOSPITALITY_TYPES.has(businessType)) return 'Hospitality';
  return businessType || '';
}

function getFolderIds(businessType) {
  const folders = [...CLIENT_FILE_FOLDERS_BASE];
  if (normalizeBusinessType(businessType) === 'Hospitality') {
    folders.push(...CLIENT_FILE_FOLDERS_HOSPITALITY);
  }
  return new Set(folders);
}

function defaultDisplayName(fileName) {
  const base = String(fileName || 'Untitled').replace(/\.[^.]+$/, '').trim();
  return base || 'Untitled';
}

export function normalizeClientCompanyFiles(files, businessType = '') {
  if (!Array.isArray(files)) return [];
  const folderIds = getFolderIds(businessType);

  return files
    .map((file) => {
      if (!file || typeof file !== 'object') return null;
      const dataUrl = String(file.dataUrl || '').trim();
      if (!dataUrl.startsWith('data:')) return null;

      const folder = folderIds.has(file.folder) ? file.folder : 'general';
      return {
        id: String(file.id || `file-${Date.now()}`),
        name: String(file.name || '').trim() || defaultDisplayName(file.fileName),
        folder,
        fileName: String(file.fileName || '').trim() || 'file',
        mimeType: String(file.mimeType || '').trim() || 'application/octet-stream',
        dataUrl,
        size: Number(file.size) || 0,
        createdAt: Number(file.createdAt) || Date.now(),
        updatedAt: Number(file.updatedAt) || Date.now(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
