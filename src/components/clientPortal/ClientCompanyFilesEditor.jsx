import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  allowsMultipleCompanyFileUpload,
  assertCompanyFileUploadable,
  buildStorageCompanyFileEntry,
  formatCompanyFileSize,
  getClientFileFolders,
  MAX_FILES_PER_CLIENT,
  normalizeClientCompanyFiles,
  slimCompanyFilesForApiSave,
  readClientCompanyFileUpload,
} from '../../utils/clientCompanyFiles';
import {
  canUploadBrandAssetToStorage,
  deleteBrandAssetFile,
  isStorageSignUnavailableError,
  probeBrandAssetStorageReady,
  uploadBrandAssetToStorage,
} from '../../utils/brandAssetStorage';
import { withTimeout } from '../../utils/withTimeout';
import {
  beginEditorFilePick,
  clearEditorUploadWork,
  endEditorFilePick,
  isEditorFilePickActive,
  markEditorUploadWork,
} from '../../utils/editorPickGuard';
import { filterDeletedCompanyFiles, recordDeletedCompanyFiles } from '../../utils/brandFileTombstones';
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
  // businessType can briefly clear during a background sync; keep the last known
  // value so folder tabs (drink/food menu) do not collapse mid-upload.
  const businessTypeRef = useRef(businessType);
  if (businessType) businessTypeRef.current = businessType;
  const stableBusinessType = businessType || businessTypeRef.current;

  const folders = getClientFileFolders(stableBusinessType);
  const [activeFolder, setActiveFolder] = useState(folders[0]?.id || 'general');
  const [localFiles, setLocalFiles] = useState(() =>
    filterDeletedCompanyFiles(
      client,
      normalizeClientCompanyFiles(files, businessType),
    ),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const fileInputRef = useRef(null);
  const savingRef = useRef(false);
  const pickingFileRef = useRef(false);
  const localFilesRef = useRef(localFiles);
  const pendingUploadsRef = useRef(pendingUploads);
  const clientKeyRef = useRef(client);
  const allowsMultiple = allowsMultipleCompanyFileUpload(activeFolder);

  useEffect(() => {
    localFilesRef.current = localFiles;
  }, [localFiles]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    if (readOnly) {
      setStorageReady(false);
      return undefined;
    }
    let active = true;
    probeBrandAssetStorageReady().then((ready) => {
      if (active) setStorageReady(ready);
    });
    return () => {
      active = false;
    };
  }, [readOnly]);

  useEffect(() => {
    if (client !== clientKeyRef.current) {
      clientKeyRef.current = client;
      setLocalFiles(
        filterDeletedCompanyFiles(
          client,
          normalizeClientCompanyFiles(files, stableBusinessType),
        ),
      );
      setPendingUploads([]);
      pendingUploadsRef.current = [];
      clearEditorUploadWork();
      setMessage('');
      setError('');
      return;
    }

    if (savingRef.current || pickingFileRef.current || isEditorFilePickActive()) return;
    if (pendingUploadsRef.current.length > 0) return;

    const normalized = filterDeletedCompanyFiles(
      client,
      normalizeClientCompanyFiles(files, stableBusinessType),
    );
    if (incomingRecordsAreStale(localFilesRef.current, normalized)) return;

    setLocalFiles(normalized);
    setMessage('');
    setError('');
    // Never clear pending uploads here — only user actions (cancel, folder tab, save).
  }, [client, files, businessType, stableBusinessType]);

  useEffect(() => {
    if (savingRef.current || pickingFileRef.current || pendingUploadsRef.current.length > 0) return;
    if (!folders.some((folder) => folder.id === activeFolder)) {
      setActiveFolder(folders[0]?.id || 'general');
    }
  }, [folders, activeFolder]);

  const selectFolder = (folderId) => {
    if (folderId === activeFolder) return;
    pendingUploadsRef.current = [];
    setPendingUploads([]);
    clearEditorUploadWork();
    setActiveFolder(folderId);
  };

  const persist = async (nextFiles, { manageSaving = true } = {}) => {
    const normalized = normalizeClientCompanyFiles(nextFiles, stableBusinessType);
    setLocalFiles(normalized);
    if (!onSaveFiles) return;

    if (manageSaving) {
      setSaving(true);
      savingRef.current = true;
    }
    setError('');
    try {
      await onSaveFiles(slimCompanyFilesForApiSave(normalized, stableBusinessType));
      setMessage('Files saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not save files.');
      throw err;
    } finally {
      if (manageSaving) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const defaultUploadName = (file) => file.name.replace(/\.[^.]+$/, '').trim() || file.name;

  const releaseFilePick = () => {
    if (!pickingFileRef.current) return;
    pickingFileRef.current = false;
    endEditorFilePick();
  };

  const openFilePicker = () => {
    if (readOnly || saving) return;
    pickingFileRef.current = true;
    beginEditorFilePick();
    // Cancel closes the picker without firing onChange — release on window focus.
    const onWindowFocus = () => {
      window.setTimeout(releaseFilePick, 750);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });
    fileInputRef.current?.click();
  };

  const handlePickFile = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length || readOnly) {
      releaseFilePick();
      return;
    }

    const selected = allowsMultiple ? picked : picked.slice(0, 1);
    setError('');

    if (localFiles.length + selected.length > MAX_FILES_PER_CLIENT) {
      releaseFilePick();
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
            businessType: stableBusinessType,
            existingCount,
          });
        }
        nextPending.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, name: defaultUploadName(file) });
        existingCount += 1;
      }
      // Update the ref synchronously — a focus refetch can land before React
      // commits state, and the props-sync effect must see pending work.
      pendingUploadsRef.current = nextPending;
      markEditorUploadWork();
      setPendingUploads(nextPending);
    } catch (err) {
      setError(err.message || 'Could not upload file.');
    } finally {
      releaseFilePick();
    }
  };

  const buildUploadEntry = async (pending, { existingCount, preferStorage }) => {
    if (preferStorage) {
      assertCompanyFileUploadable(pending.file, { existingCount });
      try {
        const { url, path } = await uploadBrandAssetToStorage(pending.file, {
          brand: client,
          folder: activeFolder,
        });
        return buildStorageCompanyFileEntry({
          file: pending.file,
          name: pending.name,
          folder: activeFolder,
          url,
          storagePath: path,
          businessType: stableBusinessType,
        });
      } catch (storageErr) {
        if (!isStorageSignUnavailableError(storageErr?.message)) {
          throw storageErr;
        }
      }
    }

    return readClientCompanyFileUpload(pending.file, {
      name: pending.name,
      folder: activeFolder,
      businessType: stableBusinessType,
      existingCount,
    });
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploads.length || readOnly) return;
    if (pendingUploads.some((entry) => !entry.name.trim())) return;

    setError('');
    setMessage('');
    setSaving(true);
    savingRef.current = true;
    try {
      await withTimeout(
        (async () => {
          const entries = [];
          let existingCount = localFiles.length;
          const preferStorage = storageReady || canUploadBrandAssetToStorage();
          for (const pending of pendingUploads) {
            entries.push(
              await buildUploadEntry(pending, { existingCount, preferStorage }),
            );
            existingCount += 1;
          }
          await persist([...entries, ...localFiles], { manageSaving: false });
          setPendingUploads([]);
          pendingUploadsRef.current = [];
        })(),
        120000,
        'Save timed out. Please try again.',
      );
    } catch (err) {
      setError(err.message || 'Could not upload file.');
    } finally {
      savingRef.current = false;
      setSaving(false);
      clearEditorUploadWork();
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
    clearEditorUploadWork();
  };

  const handleRename = async (fileId, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const next = localFiles.map((file) =>
      file.id === fileId ? { ...file, name: trimmed, updatedAt: Date.now() } : file,
    );
    await persist(next);
  };

  const requestRemove = (file) => {
    if (!file || readOnly || saving) return;
    setDeleteTarget(file);
  };

  const cancelRemove = () => setDeleteTarget(null);

  const confirmRemove = async () => {
    if (!deleteTarget || saving) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setError('');
    const nextFiles = localFiles.filter((file) => file.id !== target.id);
    recordDeletedCompanyFiles(client, localFiles, nextFiles);
    try {
      await persist(nextFiles);
      if (target.storagePath) {
        void deleteBrandAssetFile(target.storagePath);
      }
    } catch {
      /* persist surfaces save errors */
    }
  };

  const folderFiles = localFiles.filter((file) => file.folder === activeFolder);
  const activeFolderLabel =
    folders.find((folder) => folder.id === activeFolder)?.label || 'folder';
  const folderClass = (folderId) =>
    `px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] transition ${
      activeFolder === folderId
        ? `${btnPrimaryClass} py-1.5`
        : 'text-white/45 hover:text-white/80'
    }`;

  const renderFileRow = (file) => (
    <li key={file.id} className={`${glassInsetClass} px-3 py-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <FilePreviewActions
          title={file.name}
          dataUrl={file.dataUrl}
          fileName={file.fileName}
          removeLabel="Delete"
          onDownloadError={setError}
          onRemove={readOnly || saving ? undefined : () => requestRemove(file)}
        />
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
              onClick={() => selectFolder(folder.id)}
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
      ) : (
        <ul className="space-y-2">{folderFiles.map(renderFileRow)}</ul>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && !error && <p className="text-sm text-emerald-300">{message}</p>}

      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"
            onClick={cancelRemove}
          >
            <div
              className={`${glassInsetClass} w-full max-w-sm space-y-4 p-4`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-file-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="space-y-1.5">
                <p id="delete-file-title" className="text-sm font-medium text-white">
                  Delete this file?
                </p>
                <p className="text-sm text-white/70">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-white">
                    {deleteTarget.name || deleteTarget.fileName || 'this file'}
                  </span>
                  ? This cannot be undone.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={cancelRemove} className={btnSecondaryClass}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmRemove()}
                  disabled={saving}
                  className={`${btnPrimaryClass} !bg-rose-600 !text-white hover:!opacity-90 disabled:opacity-40`}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
