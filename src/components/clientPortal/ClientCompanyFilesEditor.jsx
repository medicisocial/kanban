import { useEffect, useRef, useState } from 'react';
import {
  allowsCompanyFileGroups,
  allowsMultipleCompanyFileUpload,
  assertCompanyFileUploadable,
  buildStorageCompanyFileEntry,
  formatCompanyFileSize,
  getClientFileFolders,
  getCompanyFileGroups,
  MAX_FILES_PER_CLIENT,
  normalizeClientCompanyFiles,
  readClientCompanyFileUpload,
} from '../../utils/clientCompanyFiles';
import {
  canUploadBrandAssetToStorage,
  deleteBrandAssetFile,
  uploadBrandAssetToStorage,
} from '../../utils/brandAssetStorage';
import { incomingRecordsAreStale } from '../../utils/editorSyncGuard';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';
import FilePreviewActions from './FilePreviewActions';

export default function ClientCompanyFilesEditor({
  client = '',
  businessType = '',
  files = [],
  onSaveFiles,
  readOnly = false,
}) {
  const folders = getClientFileFolders(businessType);
  const [activeFolder, setActiveFolder] = useState(folders[0]?.id || 'general');
  const [localFiles, setLocalFiles] = useState(() => normalizeClientCompanyFiles(files, businessType));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [pendingGroup, setPendingGroup] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const fileInputRef = useRef(null);
  const savingRef = useRef(false);
  const pickingFileRef = useRef(false);
  const localFilesRef = useRef(localFiles);
  const pendingUploadsRef = useRef(pendingUploads);
  const allowsMultiple = allowsMultipleCompanyFileUpload(activeFolder);
  const allowsGroups = allowsCompanyFileGroups(activeFolder);
  const existingGroups = getCompanyFileGroups(localFiles, activeFolder);

  useEffect(() => {
    localFilesRef.current = localFiles;
  }, [localFiles]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    setStorageReady(!readOnly && canUploadBrandAssetToStorage());
  }, [readOnly]);

  useEffect(() => {
    if (savingRef.current || pickingFileRef.current) return;
    // Don't discard an in-progress upload when a background refresh hands us new
    // props (e.g. the portal refetches on window focus after the file picker closes).
    if (pendingUploadsRef.current.length > 0) return;

    const normalized = normalizeClientCompanyFiles(files, businessType);
    // Keep local state when it is newer than a lagging props read after save.
    if (incomingRecordsAreStale(localFilesRef.current, normalized)) return;

    setLocalFiles(normalized);
    setMessage('');
    setError('');
    setPendingUploads([]);
    pendingUploadsRef.current = [];
  }, [files, businessType]);

  useEffect(() => {
    if (!folders.some((folder) => folder.id === activeFolder)) {
      setActiveFolder(folders[0]?.id || 'general');
    }
  }, [folders, activeFolder]);

  useEffect(() => {
    setPendingUploads([]);
    setPendingGroup('');
  }, [activeFolder]);

  const persist = async (nextFiles) => {
    const normalized = normalizeClientCompanyFiles(nextFiles, businessType);
    setLocalFiles(normalized);
    if (!onSaveFiles) return;

    setSaving(true);
    savingRef.current = true;
    setError('');
    try {
      await onSaveFiles(normalized);
      setMessage('Files saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not save files.');
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const defaultUploadName = (file) => file.name.replace(/\.[^.]+$/, '').trim() || file.name;

  const openFilePicker = () => {
    if (readOnly || saving) return;
    pickingFileRef.current = true;
    fileInputRef.current?.click();
  };

  const handlePickFile = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length || readOnly) {
      pickingFileRef.current = false;
      return;
    }

    const selected = allowsMultiple ? picked : picked.slice(0, 1);
    setError('');

    if (localFiles.length + selected.length > MAX_FILES_PER_CLIENT) {
      pickingFileRef.current = false;
      setError(
        `You can store up to ${MAX_FILES_PER_CLIENT} files. Remove ${localFiles.length + selected.length - MAX_FILES_PER_CLIENT} before adding more.`,
      );
      return;
    }

    try {
      let existingCount = localFiles.length;
      const nextPending = [];
      for (const file of selected) {
        if (storageReady) {
          assertCompanyFileUploadable(file, { existingCount });
        } else {
          // Validates type/size and ensures the file is readable before confirm.
          await readClientCompanyFileUpload(file, {
            folder: activeFolder,
            businessType,
            existingCount,
          });
        }
        nextPending.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, name: defaultUploadName(file) });
        existingCount += 1;
      }
      // Update the ref synchronously — a focus refetch can land before React
      // commits state, and the props-sync effect must see pending work.
      pendingUploadsRef.current = nextPending;
      setPendingUploads(nextPending);
    } catch (err) {
      setError(err.message || 'Could not upload file.');
    } finally {
      pickingFileRef.current = false;
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploads.length || readOnly) return;
    if (pendingUploads.some((entry) => !entry.name.trim())) return;

    setError('');
    setSaving(true);
    savingRef.current = true;
    try {
      const entries = [];
      let existingCount = localFiles.length;
      const group = allowsGroups ? pendingGroup.trim() : '';
      const useStorage = canUploadBrandAssetToStorage();
      for (const pending of pendingUploads) {
        if (useStorage) {
          assertCompanyFileUploadable(pending.file, { existingCount });
          const { url, path } = await uploadBrandAssetToStorage(pending.file, {
            brand: client,
            folder: activeFolder,
          });
          entries.push(
            buildStorageCompanyFileEntry({
              file: pending.file,
              name: pending.name,
              folder: activeFolder,
              group,
              url,
              storagePath: path,
              businessType,
            }),
          );
        } else {
          entries.push(
            await readClientCompanyFileUpload(pending.file, {
              name: pending.name,
              folder: activeFolder,
              group,
              businessType,
              existingCount,
            }),
          );
        }
        existingCount += 1;
      }
      await persist([...entries, ...localFiles]);
      setPendingUploads([]);
      pendingUploadsRef.current = [];
      setPendingGroup('');
    } catch (err) {
      setError(err.message || 'Could not upload file.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const updatePendingName = (key, name) => {
    setPendingUploads((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, name } : entry)),
    );
  };

  const clearPendingUploads = () => {
    pendingUploadsRef.current = [];
    setPendingUploads([]);
  };

  const handleRename = async (fileId, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const next = localFiles.map((file) =>
      file.id === fileId ? { ...file, name: trimmed, updatedAt: Date.now() } : file,
    );
    await persist(next);
  };

  const handleMove = async (fileId, folder) => {
    const next = localFiles.map((file) =>
      file.id === fileId
        ? {
            ...file,
            folder,
            // Drop the group when moving to a folder that doesn't support groups.
            group: allowsCompanyFileGroups(folder) ? file.group : '',
            updatedAt: Date.now(),
          }
        : file,
    );
    await persist(next);
  };

  const handleSetGroup = async (fileId, group) => {
    const trimmed = String(group || '').trim();
    const next = localFiles.map((file) =>
      file.id === fileId ? { ...file, group: trimmed, updatedAt: Date.now() } : file,
    );
    await persist(next);
  };

  const handleRemove = async (fileId) => {
    if (!window.confirm('Remove this file?')) return;
    const target = localFiles.find((file) => file.id === fileId);
    await persist(localFiles.filter((file) => file.id !== fileId));
    if (target?.storagePath) {
      void deleteBrandAssetFile(target.storagePath);
    }
  };

  const folderFiles = localFiles.filter((file) => file.folder === activeFolder);
  const activeFolderLabel =
    folders.find((folder) => folder.id === activeFolder)?.label || 'folder';
  const groupedFolderFiles = allowsGroups
    ? (() => {
        const map = new Map();
        for (const file of folderFiles) {
          const key = String(file.group || '').trim();
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(file);
        }
        const named = [...map.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b));
        const ordered = [...named, ...(map.has('') ? [''] : [])];
        return ordered.map((key) => ({ group: key, files: map.get(key) }));
      })()
    : null;
  const folderClass = (folderId) =>
    `px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] transition ${
      activeFolder === folderId
        ? `${btnPrimaryClass} py-1.5`
        : 'text-white/45 hover:text-white/80'
    }`;

  const renderFileRow = (file) => (
    <li key={file.id} className={`${glassInsetClass} px-3 py-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <p className="text-sm font-medium text-white">{file.name}</p>
          ) : (
            <input
              type="text"
              value={file.name}
              onChange={(e) => {
                const value = e.target.value;
                setLocalFiles((prev) =>
                  prev.map((entry) => (entry.id === file.id ? { ...entry, name: value } : entry)),
                );
              }}
              onBlur={(e) => handleRename(file.id, e.target.value)}
              className={`${inputClass} text-sm font-medium`}
            />
          )}
          <p className="mt-1 truncate text-xs text-white/40">
            {file.fileName} · {formatCompanyFileSize(file.size)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <FilePreviewActions title={file.name} dataUrl={file.dataUrl} fileName={file.fileName} />
          {!readOnly && (
            <>
              {allowsGroups && (
                <input
                  type="text"
                  list="company-file-groups"
                  defaultValue={file.group || ''}
                  onBlur={(e) => {
                    if (String(e.target.value).trim() !== String(file.group || '').trim()) {
                      handleSetGroup(file.id, e.target.value);
                    }
                  }}
                  placeholder="Group"
                  aria-label="File group"
                  className={`${inputClass} w-auto min-w-[7rem] py-1.5 text-[10px]`}
                />
              )}
              <select
                value={file.folder}
                onChange={(e) => handleMove(file.id, e.target.value)}
                className={`${inputClass} w-auto min-w-[9rem] py-1.5 text-[10px]`}
                aria-label="Move file to folder"
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                className="text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-rose-300"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {folders.map((folder) => {
          const count = localFiles.filter((file) => file.folder === folder.id).length;
          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => setActiveFolder(folder.id)}
              className={folderClass(folder.id)}
            >
              {folder.label}
              {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {!readOnly && (
        <div className="space-y-3">
          {!pendingUploads.length ? (
            <button
              type="button"
              onClick={openFilePicker}
              disabled={saving}
              className={`${btnSecondaryClass} w-full justify-center py-2 text-[11px] disabled:opacity-50`}
            >
              {allowsMultiple
                ? `Upload files to ${activeFolderLabel}`
                : `Upload to ${activeFolderLabel}`}
            </button>
          ) : (
            <div className={`${glassInsetClass} space-y-3 p-3`}>
              <p className="text-xs text-white/55">
                {pendingUploads.length === 1 ? (
                  <>
                    Selected: <span className="text-white/80">{pendingUploads[0].file.name}</span>
                  </>
                ) : (
                  <>
                    Selected <span className="text-white/80">{pendingUploads.length} files</span>
                  </>
                )}
              </p>
              <ul className="space-y-3">
                {pendingUploads.map((pending, index) => (
                  <li key={pending.key} className="space-y-1.5">
                    <p className="truncate text-[11px] text-white/40">{pending.file.name}</p>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                        {pendingUploads.length === 1 ? 'File name' : `File name ${index + 1}`}
                      </span>
                      <input
                        type="text"
                        value={pending.name}
                        onChange={(e) => updatePendingName(pending.key, e.target.value)}
                        className={inputClass}
                        autoFocus={index === 0}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              {allowsGroups && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                    Group (optional)
                  </span>
                  <input
                    type="text"
                    list="company-file-groups"
                    value={pendingGroup}
                    onChange={(e) => setPendingGroup(e.target.value)}
                    placeholder="e.g. Cocktails, Wine, Brunch"
                    className={inputClass}
                  />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={saving || pendingUploads.some((entry) => !entry.name.trim())}
                  className={`${btnPrimaryClass} disabled:opacity-40`}
                >
                  {saving
                    ? 'Saving…'
                    : pendingUploads.length === 1
                      ? 'Add file'
                      : `Add ${pendingUploads.length} files`}
                </button>
                <button type="button" onClick={clearPendingUploads} className={btnSecondaryClass}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple={allowsMultiple}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.zip,application/pdf,image/*,application/zip"
            className="hidden"
            onChange={handlePickFile}
          />
          <p className="text-[11px] text-white/35">
            PDF, PNG, JPG, WebP, SVG, or ZIP · {storageReady ? '25 MB' : '3 MB'} max per file
            {allowsMultiple && ' · Select multiple files'}
          </p>
        </div>
      )}

      {folderFiles.length === 0 ? (
        <p className={`${glassInsetClass} px-3 py-4 text-sm text-white/45`}>
          {readOnly ? 'No files in this folder yet.' : 'No files yet. Upload branding assets, menus, or other documents here.'}
        </p>
      ) : groupedFolderFiles ? (
        <div className="space-y-4">
          {groupedFolderFiles.map(({ group, files: groupFiles }) => (
            <div key={group || '__ungrouped'} className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {group || 'Ungrouped'}
                <span className="ml-1 opacity-60">({groupFiles.length})</span>
              </p>
              <ul className="space-y-2">{groupFiles.map(renderFileRow)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">{folderFiles.map(renderFileRow)}</ul>
      )}

      {allowsGroups && !readOnly && (
        <datalist id="company-file-groups">
          {existingGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && !error && <p className="text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
