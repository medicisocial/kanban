import { useEffect, useRef, useState } from 'react';
import {
  createSpecialMenuId,
  formatSpecialMenuDateRange,
  getSpecialMenuRunDaysLabel,
  getSpecialMenuRunLabel,
  getSpecialMenuRunStatus,
  MAX_SPECIAL_MENUS,
  normalizeClientSpecialMenus,
  readSpecialMenuPdfUpload,
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

function PdfUploadRow({ label, pdf, onChange, disabled }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await readSpecialMenuPdfUpload(file));
    } catch (err) {
      setError(err.message || 'Could not upload PDF.');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      {pdf ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-0 truncate text-xs text-white/75">{pdf.name}</span>
          <FilePreviewActions
            title={pdf.name}
            dataUrl={pdf.dataUrl}
            fileName={pdf.name}
          />
          {!disabled && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-medium uppercase tracking-wider text-white/50 hover:text-white"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-[10px] font-medium uppercase tracking-wider text-white/40 hover:text-rose-300"
              >
                Remove
              </button>
            </>
          )}
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${btnSecondaryClass} w-full justify-center py-1.5 text-[10px]`}
          >
            Upload PDF
          </button>
        )
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
        disabled={disabled}
      />
    </div>
  );
}

const EMPTY_DRAFT = {
  name: '',
  startDate: '',
  endDate: '',
  hasDrinkMenu: false,
  drinkMenuPdf: null,
  hasFoodMenu: false,
  foodMenuPdf: null,
};

export default function ClientSpecialMenusEditor({
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

  useEffect(() => {
    setMenus(normalizeClientSpecialMenus(specialMenus));
    setDraft(null);
    setEditingId(null);
    setError('');
  }, [specialMenus]);

  const persist = async (nextMenus) => {
    const normalized = normalizeClientSpecialMenus(nextMenus);
    setMenus(normalized);
    if (!onSaveSpecialMenus) return;

    setSaving(true);
    setError('');
    try {
      await onSaveSpecialMenus(normalized);
      setMessage('Special menus saved.');
      setTimeout(() => setMessage(''), 3000);
      setDraft(null);
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not save special menus.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const validateDraft = (entry) => {
    if (!entry.name.trim()) return 'Enter a name for this special menu.';
    if (!entry.startDate || !entry.endDate) return 'Start and end dates are required.';
    if (entry.endDate < entry.startDate) return 'End date must be on or after the start date.';
    if (entry.hasDrinkMenu && !entry.drinkMenuPdf) return 'Upload a drink menu PDF or choose No.';
    if (entry.hasFoodMenu && !entry.foodMenuPdf) return 'Upload a food menu PDF or choose No.';
    if (!entry.hasDrinkMenu && !entry.hasFoodMenu) {
      return 'Add at least a drink menu or food menu PDF for this special.';
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
    setDraft({ ...EMPTY_DRAFT });
    setError('');
  };

  const startEdit = (menu) => {
    setEditingId(menu.id);
    setDraft({
      name: menu.name,
      startDate: menu.startDate,
      endDate: menu.endDate,
      hasDrinkMenu: menu.hasDrinkMenu,
      drinkMenuPdf: menu.drinkMenuPdf,
      hasFoodMenu: menu.hasFoodMenu,
      foodMenuPdf: menu.foodMenuPdf,
    });
    setError('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Special event menus</h3>
        <p className="mt-1 text-sm text-white/45">
          Limited-time menus with run dates — upload separate drink and food PDFs when applicable.
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
          <div className="space-y-2 text-xs">
            {menu.hasDrinkMenu && menu.drinkMenuPdf && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-white/55">Drink:</span>
                <span className="text-white/80">{menu.drinkMenuPdf.name}</span>
                <FilePreviewActions
                  title={menu.drinkMenuPdf.name}
                  dataUrl={menu.drinkMenuPdf.dataUrl}
                  fileName={menu.drinkMenuPdf.name}
                />
              </div>
            )}
            {menu.hasFoodMenu && menu.foodMenuPdf && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-white/55">Food:</span>
                <span className="text-white/80">{menu.foodMenuPdf.name}</span>
                <FilePreviewActions
                  title={menu.foodMenuPdf.name}
                  dataUrl={menu.foodMenuPdf.dataUrl}
                  fileName={menu.foodMenuPdf.name}
                />
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
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
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
                onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
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
                onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
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
                setDraft((prev) => ({
                  ...prev,
                  hasDrinkMenu,
                  drinkMenuPdf: hasDrinkMenu ? prev.drinkMenuPdf : null,
                }))
              }
              disabled={saving}
            />
          </div>
          {draft.hasDrinkMenu && (
            <PdfUploadRow
              label="Drink menu PDF"
              pdf={draft.drinkMenuPdf}
              onChange={(drinkMenuPdf) => setDraft((prev) => ({ ...prev, drinkMenuPdf }))}
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
                setDraft((prev) => ({
                  ...prev,
                  hasFoodMenu,
                  foodMenuPdf: hasFoodMenu ? prev.foodMenuPdf : null,
                }))
              }
              disabled={saving}
            />
          </div>
          {draft.hasFoodMenu && (
            <PdfUploadRow
              label="Food menu PDF"
              pdf={draft.foodMenuPdf}
              onChange={(foodMenuPdf) => setDraft((prev) => ({ ...prev, foodMenuPdf }))}
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
                setDraft(null);
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
