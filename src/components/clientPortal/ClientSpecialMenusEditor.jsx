import { useEffect, useRef, useState } from 'react';
import {
  canUploadSpecialMenuToStorage,
  createSpecialMenuId,
  formatSpecialMenuDateRange,
  getSpecialMenuRunDaysLabel,
  getSpecialMenuRunLabel,
  getSpecialMenuRunStatus,
  MAX_SPECIAL_MENUS,
  normalizeClientSpecialMenus,
  uploadSpecialMenuPdf,
} from '../../utils/clientSpecialMenus';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';
import DateInput from '../DateInput';
import FilePreviewActions from './FilePreviewActions';

function SpecialMenuRunBanner({ startDate, endDate }) {
  const status = getSpecialMenuRunStatus(startDate, endDate);
  const statusLabel = getSpecialMenuRunLabel(status);
  const rangeLabel = formatSpecialMenuDateRange(startDate, endDate);
  const daysLabel = getSpecialMenuRunDaysLabel(startDate, endDate);

  const bannerClass =
    status === 'active'
      ? 'border-emerald-500/25 bg-emerald-500/[0.08]'
      : status === 'upcoming'
        ? 'border-amber-500/25 bg-amber-500/[0.08]'
        : 'border-white/10 bg-white/[0.03]';

  const statusClass =
    status === 'active'
      ? 'text-emerald-300'
      : status === 'upcoming'
        ? 'text-amber-300'
        : 'text-white/40';

  return (
    <div className={`rounded border px-3 py-2.5 ${bannerClass}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${statusClass}`}>
          {statusLabel}
        </span>
        {daysLabel && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
            {daysLabel}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug text-white">{rangeLabel}</p>
    </div>
  );
}

function ToggleYesNo({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      {[
        { label: 'Yes', val: true },
        { label: 'No', val: false },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.val)}
          className={`flex-1 border px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
            value === option.val
              ? 'border-[#810100]/60 bg-[#810100]/15 text-white'
              : 'border-white/15 bg-[#111111] text-white/55 hover:border-white/25 hover:text-white/80'
          } disabled:opacity-50`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MenuPdfListEditor({ label, brand, items = [], onChange, disabled, onUploadBusyChange }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const storageReady = canUploadSpecialMenuToStorage();
  const busy = disabled || uploading;

  const setUploadBusy = (next) => {
    setUploading(next);
    onUploadBusyChange?.(next);
  };

  const openFilePicker = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleAddFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    setUploadBusy(true);
    try {
      const added = [];
      for (const file of files) {
        added.push(await uploadSpecialMenuPdf(file, { brand }));
      }
      onChange([...(items || []), ...added]);
    } catch (err) {
      setError(err.message || 'Could not upload PDF.');
    } finally {
      setUploadBusy(false);
    }
  };

  const updateLabel = (id, value) =>
    onChange(items.map((item) => (item.id === id ? { ...item, label: value } : item)));
  const removeItem = (id) => onChange(items.filter((item) => item.id !== id));

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</p>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-white/10 bg-white/[0.02] p-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateLabel(item.id, e.target.value)}
                  placeholder="Label (e.g. Cocktails)"
                  disabled={disabled}
                  className={`${inputClass} min-w-0 flex-1 py-1.5 text-xs`}
                />
                <FilePreviewActions title={item.label || item.name} dataUrl={item.dataUrl} fileName={item.name} />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                    className="text-[10px] font-medium uppercase tracking-wider text-white/40 hover:text-rose-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1 truncate text-[10px] text-white/35">{item.name}</p>
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className={`${btnSecondaryClass} w-full justify-center py-1.5 text-[10px] disabled:opacity-50`}
          >
            {uploading ? 'Uploading…' : items.length ? 'Add another PDF' : 'Upload PDF'}
          </button>
          <p className="text-[10px] text-white/35">
            PDF · {storageReady ? '25 MB' : '3 MB'} max · Select multiple to add several
          </p>
        </>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleAddFiles}
        disabled={busy}
      />
    </div>
  );
}

const EMPTY_DRAFT = {
  name: '',
  startDate: '',
  endDate: '',
  hasDrinkMenu: false,
  drinkMenuPdfs: [],
  hasFoodMenu: false,
  foodMenuPdfs: [],
};

export default function ClientSpecialMenusEditor({
  client = '',
  specialMenus = [],
  onSaveSpecialMenus,
  readOnly = false,
}) {
  const [menus, setMenus] = useState(() => normalizeClientSpecialMenus(specialMenus));
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const draftRef = useRef(draft);
  const uploadBusyRef = useRef(false);

  const setDraftGuarded = (updater) => {
    setDraft((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      draftRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (savingRef.current || uploadBusyRef.current) return;
    // Don't discard an open draft when a background refresh hands us new props
    // (e.g. the portal refetches on window focus after the file picker closes).
    if (draftRef.current) return;
    setMenus(normalizeClientSpecialMenus(specialMenus));
    setDraftGuarded(null);
    draftRef.current = null;
    setEditingId(null);
    setError('');
  }, [specialMenus]);

  const persist = async (nextMenus) => {
    const normalized = normalizeClientSpecialMenus(nextMenus);
    setMenus(normalized);
    if (!onSaveSpecialMenus) return;

    setSaving(true);
    savingRef.current = true;
    setError('');
    try {
      await onSaveSpecialMenus(normalized);
      setMessage('Special menus saved.');
      setTimeout(() => setMessage(''), 3000);
      setDraftGuarded(null);
      draftRef.current = null;
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not save special menus.');
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const validateDraft = (entry) => {
    if (!entry.name.trim()) return 'Enter a name for this special menu.';
    if (!entry.startDate || !entry.endDate) return 'Start and end dates are required.';
    if (entry.endDate < entry.startDate) return 'End date must be on or after the start date.';
    if (entry.hasDrinkMenu && !entry.drinkMenuPdfs.length) {
      return 'Add at least one drink menu PDF or choose No.';
    }
    if (entry.hasFoodMenu && !entry.foodMenuPdfs.length) {
      return 'Add at least one food menu PDF or choose No.';
    }
    if (!entry.drinkMenuPdfs.length && !entry.foodMenuPdfs.length) {
      return 'Add at least one drink or food menu PDF for this special.';
    }
    return '';
  };

  const handleSaveDraft = async () => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    const now = Date.now();
    const payload = {
      ...draft,
      name: draft.name.trim(),
      id: editingId || createSpecialMenuId(),
      updatedAt: now,
      createdAt: editingId
        ? menus.find((menu) => menu.id === editingId)?.createdAt || now
        : now,
    };

    const next = editingId
      ? menus.map((menu) => (menu.id === editingId ? payload : menu))
      : [payload, ...menus];

    if (!editingId && next.length > MAX_SPECIAL_MENUS) {
      setError(`You can store up to ${MAX_SPECIAL_MENUS} special menus.`);
      return;
    }

    await persist(next);
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this special event menu?')) return;
    await persist(menus.filter((menu) => menu.id !== id));
  };

  const startCreate = () => {
    setEditingId(null);
    setDraftGuarded({ ...EMPTY_DRAFT });
    setError('');
  };

  const startEdit = (menu) => {
    setEditingId(menu.id);
    setDraftGuarded({
      name: menu.name,
      startDate: menu.startDate,
      endDate: menu.endDate,
      hasDrinkMenu: menu.hasDrinkMenu,
      drinkMenuPdfs: menu.drinkMenuPdfs || [],
      hasFoodMenu: menu.hasFoodMenu,
      foodMenuPdfs: menu.foodMenuPdfs || [],
    });
    setError('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Special event menus</h3>
        <p className="mt-1 text-sm text-white/45">
          Limited-time menus with run dates — add multiple labeled drink and food PDFs when applicable.
        </p>
      </div>

      {menus.map((menu) => (
        <div key={menu.id} className={`${glassInsetClass} space-y-3 p-3`}>
          <SpecialMenuRunBanner startDate={menu.startDate} endDate={menu.endDate} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{menu.name}</p>
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(menu)}
                  className="text-[10px] font-medium uppercase tracking-wider text-white/50 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(menu.id)}
                  className="text-[10px] font-medium uppercase tracking-wider text-white/40 hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <div className="space-y-3 text-xs">
            {menu.hasDrinkMenu && menu.drinkMenuPdfs?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                  Drink menus
                </span>
                {menu.drinkMenuPdfs.map((pdf) => (
                  <div key={pdf.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-white/80">{pdf.label || pdf.name}</span>
                    <FilePreviewActions title={pdf.label || pdf.name} dataUrl={pdf.dataUrl} fileName={pdf.name} />
                  </div>
                ))}
              </div>
            )}
            {menu.hasFoodMenu && menu.foodMenuPdfs?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                  Food menus
                </span>
                {menu.foodMenuPdfs.map((pdf) => (
                  <div key={pdf.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-white/80">{pdf.label || pdf.name}</span>
                    <FilePreviewActions title={pdf.label || pdf.name} dataUrl={pdf.dataUrl} fileName={pdf.name} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {draft && !readOnly && (
        <div className={`${glassInsetClass} space-y-4 p-4`}>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            {editingId ? 'Edit special menu' : 'New special event menu'}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Menu name
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraftGuarded((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Valentine's Day specials"
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                Runs from
              </span>
              <DateInput
                value={draft.startDate}
                onChange={(e) => setDraftGuarded((prev) => ({ ...prev, startDate: e.target.value }))}
                placeholder="Select date"
                inputClassName={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                Runs until
              </span>
              <DateInput
                value={draft.endDate}
                onChange={(e) => setDraftGuarded((prev) => ({ ...prev, endDate: e.target.value }))}
                placeholder="Select date"
                inputClassName={inputClass}
              />
            </label>
          </div>
          {draft.startDate && draft.endDate && draft.endDate >= draft.startDate && (
            <SpecialMenuRunBanner startDate={draft.startDate} endDate={draft.endDate} />
          )}
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Special drink menu?
            </span>
            <ToggleYesNo
              value={draft.hasDrinkMenu}
              onChange={(hasDrinkMenu) =>
                setDraftGuarded((prev) => ({
                  ...prev,
                  hasDrinkMenu,
                  drinkMenuPdfs: hasDrinkMenu ? prev.drinkMenuPdfs : [],
                }))
              }
              disabled={saving}
            />
          </div>
          {draft.hasDrinkMenu && (
            <MenuPdfListEditor
              label="Drink menu PDFs"
              brand={client}
              items={draft.drinkMenuPdfs}
              onChange={(drinkMenuPdfs) => setDraftGuarded((prev) => ({ ...prev, drinkMenuPdfs }))}
              onUploadBusyChange={(busy) => {
                uploadBusyRef.current = busy;
              }}
              disabled={saving}
            />
          )}
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/45">
              Special food menu?
            </span>
            <ToggleYesNo
              value={draft.hasFoodMenu}
              onChange={(hasFoodMenu) =>
                setDraftGuarded((prev) => ({
                  ...prev,
                  hasFoodMenu,
                  foodMenuPdfs: hasFoodMenu ? prev.foodMenuPdfs : [],
                }))
              }
              disabled={saving}
            />
          </div>
          {draft.hasFoodMenu && (
            <MenuPdfListEditor
              label="Food menu PDFs"
              brand={client}
              items={draft.foodMenuPdfs}
              onChange={(foodMenuPdfs) => setDraftGuarded((prev) => ({ ...prev, foodMenuPdfs }))}
              onUploadBusyChange={(busy) => {
                uploadBusyRef.current = busy;
              }}
              disabled={saving}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className={`${btnPrimaryClass} disabled:opacity-40`}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add special menu'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftGuarded(null);
                draftRef.current = null;
                uploadBusyRef.current = false;
                setEditingId(null);
                setError('');
              }}
              className={btnSecondaryClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!readOnly && !draft && (
        <button
          type="button"
          onClick={startCreate}
          className={`${btnSecondaryClass} w-full justify-center py-2 text-[11px]`}
        >
          + Special event menu
        </button>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && !error && <p className="text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
