import { useEffect, useRef, useState } from 'react';
import { CONTENT_TYPES } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { normalizeLink } from '../utils/links';
import { btnPrimaryClass, inputClass, selectClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import ReferenceVideoLink from './clientPortal/ReferenceVideoLink';

function clientFromFilter(clientFilter, fallbackClient) {
  if (clientFilter && clientFilter !== 'all') return clientFilter;
  return fallbackClient;
}

export default function VideoIdeaQuickAdd({
  clientFilter = 'all',
  clientOnly,
  onAdd,
  onAddToBank,
  onAdded,
  variant = 'review',
  submitLabel = 'Add for review',
  hint,
}) {
  const { clients, defaultClient: firstClient } = useClientsContext();
  const titleRef = useRef(null);
  const lockedClient = Boolean(clientOnly || (clientFilter && clientFilter !== 'all'));
  const hideClientField = Boolean(clientOnly);
  const isBankVariant = variant === 'bank';

  const [form, setForm] = useState(() => ({
    client: clientOnly || clientFromFilter(clientFilter, firstClient),
    title: '',
    referenceVideo: '',
    description: '',
    contentType: 'Reel',
  }));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      client: clientOnly || clientFromFilter(clientFilter, firstClient),
    }));
  }, [clientFilter, firstClient, clientOnly]);

  const resetForm = () => {
    setForm({
      client: clientOnly || clientFromFilter(clientFilter, firstClient),
      title: '',
      referenceVideo: '',
      description: '',
      contentType: 'Reel',
    });
    setError('');
  };

  const buildPayload = () => {
    const title = form.title.trim();
    const referenceVideo = normalizeLink(form.referenceVideo.trim());

    if (!title) {
      setError('Enter an idea title.');
      titleRef.current?.focus();
      return null;
    }

    return {
      client: form.client,
      title,
      referenceVideo: referenceVideo || '',
      description: form.description.trim(),
      contentType: form.contentType,
      clientComment: '',
    };
  };

  const commit = (handler) => {
    setError('');
    const payload = buildPayload();
    if (!payload || !handler) return;
    handler(payload);
    resetForm();
    onAdded?.();
    titleRef.current?.focus();
  };

  const submitForReview = () => commit(onAdd);
  const submitToBank = () => commit(onAddToBank);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBankVariant) submitToBank();
    else submitForReview();
  };

  const handleReferencePaste = (e) => {
    const pasted = e.clipboardData?.getData('text')?.trim();
    if (!pasted) return;
    const normalized = normalizeLink(pasted);
    if (normalized) {
      e.preventDefault();
      setForm((prev) => ({ ...prev, referenceVideo: normalized }));
    }
  };

  const resolvedHint =
    hint ??
    (isBankVariant
      ? 'Adds straight to Approved — no approval step.'
      : onAddToBank
        ? 'Add for review, or skip approval and put it in Approved.'
        : 'Press Enter to add — the idea appears in the list below.');

  const primaryLabel = isBankVariant ? 'Add to Approved' : submitLabel;

  return (
    <form
      onSubmit={handleSubmit}
      className={`${surfacePanelClass} mb-4 border-white/10 px-4 py-4`}
    >
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
        {isBankVariant ? 'Add to Approved' : 'New idea'}
      </p>

      <div
        className={`grid gap-3 md:items-end ${
          hideClientField
            ? 'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto]'
            : 'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto_auto]'
        }`}
      >
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs text-white/45">Title</span>
          <input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Summer launch reel concept"
            className={inputClass}
            autoFocus
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs text-white/45">Reference video</span>
          <input
            type="text"
            value={form.referenceVideo}
            onChange={(e) => setForm({ ...form, referenceVideo: e.target.value })}
            onPaste={handleReferencePaste}
            placeholder="Paste Instagram, TikTok, or YouTube link…"
            className={inputClass}
          />
          {form.referenceVideo?.trim() && (
            <div className="mt-2">
              <ReferenceVideoLink url={form.referenceVideo} />
            </div>
          )}
        </label>

        <label className="block min-w-0 md:col-span-full">
          <span className="mb-1.5 block text-xs text-white/45">Notes</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Optional notes for your production team…"
            className={`${inputClass} resize-y`}
          />
        </label>

        {!hideClientField && (
          <label className="block min-w-[120px]">
            <span className="mb-1.5 block text-xs text-white/45">Client</span>
            {lockedClient ? (
              <p className={`${inputClass} text-white/80`}>{form.client}</p>
            ) : (
              <select
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className={`${selectClass} w-full`}
              >
                {clients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        <label className="block min-w-[100px]">
          <span className="mb-1.5 block text-xs text-white/45">Type</span>
          <select
            value={form.contentType}
            onChange={(e) => setForm({ ...form, contentType: e.target.value })}
            className={`${selectClass} w-full`}
          >
            {CONTENT_TYPES.filter((t) => t !== 'Story').map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 md:self-end">
          <button type="submit" className={`${btnPrimaryClass} w-full md:w-auto`}>
            {primaryLabel}
          </button>
          {!isBankVariant && onAddToBank && (
            <button
              type="button"
              onClick={submitToBank}
              className={`${btnPrimaryClass} w-full md:w-auto`}
            >
              Add to Approved
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {resolvedHint && <p className="mt-2 text-[10px] text-white/30">{resolvedHint}</p>}
    </form>
  );
}
