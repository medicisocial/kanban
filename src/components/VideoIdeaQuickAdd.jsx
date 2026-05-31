import { useEffect, useRef, useState } from 'react';
import { CONTENT_TYPES } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { normalizeLink } from '../utils/links';
import { btnPrimaryClass, inputClass, selectClass, surfacePanelClass } from './clientPortal/clientPortalUi';

function clientFromFilter(clientFilter, fallbackClient) {
  if (clientFilter && clientFilter !== 'all') return clientFilter;
  return fallbackClient;
}

export default function VideoIdeaQuickAdd({ clientFilter = 'all', onAdd, onAdded }) {
  const { clients, defaultClient: firstClient } = useClientsContext();
  const titleRef = useRef(null);
  const referenceRef = useRef(null);
  const lockedClient = Boolean(clientFilter && clientFilter !== 'all');

  const [form, setForm] = useState(() => ({
    client: clientFromFilter(clientFilter, firstClient),
    title: '',
    referenceVideo: '',
    contentType: 'Reel',
  }));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      client: clientFromFilter(clientFilter, firstClient),
    }));
  }, [clientFilter, firstClient]);

  const resetForm = () => {
    setForm({
      client: clientFromFilter(clientFilter, firstClient),
      title: '',
      referenceVideo: '',
      contentType: 'Reel',
    });
    setError('');
  };

  const submit = () => {
    setError('');
    const title = form.title.trim();
    const referenceVideo = normalizeLink(form.referenceVideo.trim());

    if (!title) {
      setError('Enter an idea title.');
      titleRef.current?.focus();
      return;
    }

    onAdd({
      client: form.client,
      title,
      referenceVideo: referenceVideo || '',
      description: '',
      contentType: form.contentType,
      clientComment: '',
    });

    resetForm();
    onAdded?.();
    titleRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
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

  return (
    <form
      onSubmit={handleSubmit}
      className={`${surfacePanelClass} mb-4 border-white/10 px-4 py-4`}
    >
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
        New idea
      </p>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto_auto] md:items-end">
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
            ref={referenceRef}
            type="text"
            value={form.referenceVideo}
            onChange={(e) => setForm({ ...form, referenceVideo: e.target.value })}
            onPaste={handleReferencePaste}
            placeholder="Paste Instagram, TikTok, or YouTube link…"
            className={inputClass}
          />
        </label>

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

        <button type="submit" className={`${btnPrimaryClass} w-full md:w-auto md:self-end`}>
          Add idea
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-[10px] text-white/30">
        Press Enter to add — the idea appears in the list below. No popup.
      </p>
    </form>
  );
}
