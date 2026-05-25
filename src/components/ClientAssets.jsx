import { useEffect, useMemo, useRef, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useClientAssetsContext } from '../context/ClientAssetsContext';
import {
  ASSET_CATEGORIES,
  OPUS_FONT_FAMILIES,
  OPUS_STYLE_KEYS,
  getOpusPreviewStyle,
  normalizeClientAssets,
  parseHexColor,
  previewHexColor,
  toColorPickerHex,
} from '../utils/clientAssets';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

const labelClass = 'mb-1.5 block text-xs font-medium text-gray-400';

const PREVIEW_SAMPLES = {
  headline: 'Your headline here',
  subtitle: 'Supporting subtitle line',
  caption: 'On-screen caption text for reels and clips',
  cta: 'Book now · Link in bio',
};

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ label, value, onChange, showTextSample = false }) {
  const inputRef = useRef(null);
  const focusedRef = useRef(false);
  const [text, setText] = useState(() => parseHexColor(value) || value || '');

  useEffect(() => {
    if (focusedRef.current) return;
    setText(parseHexColor(value) || value || '');
  }, [value]);

  const swatchColor = previewHexColor(text, parseHexColor(value) || '#888888');
  const pickerHex = toColorPickerHex(swatchColor);

  const commitToParent = (next) => {
    const parsed = parseHexColor(next);
    if (!parsed) return false;
    setText(parsed);
    onChange(parsed);
    return true;
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg border border-white/20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 50% / 8px 8px',
            }}
          />
          {showTextSample ? (
            <div
              className="absolute inset-0 flex items-center justify-center text-sm font-bold"
              style={{ color: swatchColor }}
            >
              Aa
            </div>
          ) : (
            <div className="absolute inset-0" style={{ backgroundColor: swatchColor }} />
          )}
          <input
            type="color"
            value={pickerHex}
            onChange={(e) => commitToParent(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            commitToParent(next);
          }}
          onPaste={() => {
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (!el) return;
              setText(el.value);
              commitToParent(el.value);
            });
          }}
          onBlur={() => {
            focusedRef.current = false;
            const current = inputRef.current?.value ?? text;
            commitToParent(current);
          }}
          className={inputClass}
          placeholder="#000000"
          spellCheck={false}
        />
      </div>
    </Field>
  );
}

function OpusStyleEditor({ styleKey, style, onPatchField }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Preview</p>
        <div className="flex min-h-[88px] items-center justify-center rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6">
          <span style={getOpusPreviewStyle(style)}>
            {PREVIEW_SAMPLES[styleKey] || 'Preview text'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Font family">
          <select
            value={style.fontFamily}
            onChange={(e) => onPatchField('fontFamily', e.target.value)}
            className={inputClass}
          >
            {OPUS_FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Font size (px)">
          <input
            type="number"
            min={12}
            max={120}
            value={style.fontSize}
            onChange={(e) => onPatchField('fontSize', Number(e.target.value) || 12)}
            className={inputClass}
          />
        </Field>

        <Field label="Font weight">
          <select
            value={style.fontWeight}
            onChange={(e) => onPatchField('fontWeight', Number(e.target.value))}
            className={inputClass}
          >
            {[400, 500, 600, 700, 800, 900].map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </Field>

        <ColorInput
          label="Text color"
          value={style.color}
          onChange={(v) => onPatchField('color', v)}
          showTextSample
        />

        <Field label="Stroke width (px)">
          <input
            type="number"
            min={0}
            max={12}
            value={style.strokeWidth}
            onChange={(e) => onPatchField('strokeWidth', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>

        <ColorInput
          label="Stroke color"
          value={style.strokeColor}
          onChange={(v) => onPatchField('strokeColor', v)}
        />

        <Field label="Letter spacing (px)">
          <input
            type="number"
            min={-5}
            max={20}
            step={0.5}
            value={style.letterSpacing}
            onChange={(e) => onPatchField('letterSpacing', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>

        <Field label="Line height">
          <input
            type="number"
            min={0.8}
            max={2}
            step={0.05}
            value={style.lineHeight}
            onChange={(e) => onPatchField('lineHeight', Number(e.target.value) || 1)}
            className={inputClass}
          />
        </Field>

        <Field label="Text align">
          <select
            value={style.textAlign}
            onChange={(e) => onPatchField('textAlign', e.target.value)}
            className={inputClass}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>

        <Field label="Text transform">
          <select
            value={style.textTransform}
            onChange={(e) => onPatchField('textTransform', e.target.value)}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="uppercase">Uppercase</option>
            <option value="lowercase">Lowercase</option>
            <option value="capitalize">Capitalize</option>
          </select>
        </Field>

        <ColorInput
          label="Background color"
          value={style.backgroundColor}
          onChange={(v) => onPatchField('backgroundColor', v)}
        />

        <Field label="Background opacity (0–1)">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={style.backgroundOpacity}
            onChange={(e) => onPatchField('backgroundOpacity', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>

        <Field label="Background padding (px)">
          <input
            type="number"
            min={0}
            max={40}
            value={style.backgroundPadding}
            onChange={(e) => onPatchField('backgroundPadding', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>

        <Field label="Border radius (px)">
          <input
            type="number"
            min={0}
            max={32}
            value={style.borderRadius}
            onChange={(e) => onPatchField('borderRadius', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

export default function ClientAssets({ clientFilter }) {
  const { clients, getClientColor } = useClientsContext();
  const { store, saveClientAssets } = useClientAssetsContext();
  const [activeClient, setActiveClient] = useState(
    clientFilter !== 'all' ? clientFilter : clients[0] || '',
  );
  const [activeSection, setActiveSection] = useState('branding');
  const [activeOpusStyle, setActiveOpusStyle] = useState('headline');
  const draftRef = useRef(null);

  useEffect(() => {
    if (clientFilter !== 'all') {
      setActiveClient(clientFilter);
    }
  }, [clientFilter]);

  const clientColor = activeClient ? getClientColor(activeClient) : '#810100';
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [saveError, setSaveError] = useState('');
  const loadedClientRef = useRef(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!activeClient) {
      setDraft(null);
      setBaseline(null);
      draftRef.current = null;
      loadedClientRef.current = null;
      return;
    }

    // Reload when switching clients, or first load — not after save on the same client.
    if (loadedClientRef.current === activeClient) return;

    loadedClientRef.current = activeClient;
    const color = getClientColor(activeClient);
    const snapshot = JSON.parse(
      JSON.stringify(normalizeClientAssets(store[activeClient], color)),
    );
    setDraft(snapshot);
    setBaseline(snapshot);
    draftRef.current = snapshot;
  }, [activeClient, store, getClientColor]);

  const flushFocusedField = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  };

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  const patchDraft = (updater) => {
    setSaveError('');
    setDraft((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      draftRef.current = next;
      return next;
    });
  };

  const patchBranding = (field, value) => {
    patchDraft((prev) => ({
      ...prev,
      branding: { ...prev.branding, [field]: value },
    }));
  };

  const patchOpusStyleField = (styleKey, field, value) => {
    patchDraft((prev) => ({
      ...prev,
      opusAi: {
        ...prev.opusAi,
        [styleKey]: { ...prev.opusAi[styleKey], [field]: value },
      },
    }));
  };

  const handleSave = () => {
    if (!activeClient) return;
    flushFocusedField();

    const source = draftRef.current ?? draft;
    if (!source) return;

    const payload = JSON.parse(JSON.stringify(source));
    const saved = saveClientAssets(activeClient, payload);
    if (!saved) {
      setSaveError('Could not save — try again or check browser storage settings.');
      return;
    }

    setSaveError('');
    setDraft(payload);
    setBaseline(JSON.parse(JSON.stringify(payload)));
    draftRef.current = payload;
  };

  const handleDiscard = () => {
    if (baseline) {
      const reset = JSON.parse(JSON.stringify(baseline));
      setDraft(reset);
      draftRef.current = reset;
    }
  };

  const handleClientChange = (nextClient) => {
    if (nextClient === activeClient) return;
    if (isDirty && !window.confirm('Discard unsaved changes for this client?')) return;
    flushFocusedField();
    setSaveError('');
    loadedClientRef.current = null;
    setActiveClient(nextClient);
  };

  const sectionClass = (section) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      activeSection === section ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;

  if (!clients.length) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-gray-400">Add a client first to manage branding and Opus AI settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 pb-32 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-white">Client assets</h2>
          <p className="mt-1 text-sm text-gray-400">
            Branding kit and Opus AI caption settings — edit below, then save.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Client</span>
          <select
            value={activeClient}
            onChange={(e) => handleClientChange(e.target.value)}
            className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#f9f6f2] outline-none"
          >
            {clients.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeClient && draft && (
        <div key={activeClient}>
          <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-0.5 w-fit">
            <button type="button" onClick={() => setActiveSection('branding')} className={sectionClass('branding')}>
              Branding kit
            </button>
            <button type="button" onClick={() => setActiveSection('opus')} className={sectionClass('opus')}>
              Opus AI fonts
            </button>
          </div>

          {activeSection === 'branding' && (
            <div className="space-y-8">
              <section className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Logos</h3>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Field label="Primary logo URL">
                      <input
                        type="url"
                        value={draft.branding.logoUrl}
                        onChange={(e) => patchBranding('logoUrl', e.target.value)}
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </Field>
                    {draft.branding.logoUrl && (
                      <div className="flex h-28 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-4">
                        <img
                          src={draft.branding.logoUrl}
                          alt={`${activeClient} logo`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <Field label="Logo on dark background URL">
                      <input
                        type="url"
                        value={draft.branding.logoDarkUrl}
                        onChange={(e) => patchBranding('logoDarkUrl', e.target.value)}
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </Field>
                    {draft.branding.logoDarkUrl && (
                      <div className="flex h-28 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a0a] p-4">
                        <img
                          src={draft.branding.logoDarkUrl}
                          alt={`${activeClient} dark logo`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Brand colors</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ColorInput
                    label="Primary"
                    value={draft.branding.primaryColor}
                    onChange={(v) => patchBranding('primaryColor', v)}
                  />
                  <ColorInput
                    label="Secondary"
                    value={draft.branding.secondaryColor}
                    onChange={(v) => patchBranding('secondaryColor', v)}
                  />
                  <ColorInput
                    label="Accent"
                    value={draft.branding.accentColor}
                    onChange={(v) => patchBranding('accentColor', v)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    { label: 'Primary', color: draft.branding.primaryColor },
                    { label: 'Secondary', color: draft.branding.secondaryColor },
                    { label: 'Accent', color: draft.branding.accentColor },
                  ].map(({ label, color }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-2"
                    >
                      <span
                        className="h-8 w-8 rounded-md border border-white/10"
                        style={{ backgroundColor: previewHexColor(color, '#000000') }}
                      />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                          {label}
                        </p>
                        <p className="text-xs text-gray-300">{parseHexColor(color) || color || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Brand fonts</h3>
                  <button
                    type="button"
                    onClick={() =>
                      patchBranding('fonts', [
                        ...draft.branding.fonts,
                        {
                          id: crypto.randomUUID(),
                          label: 'Custom font',
                          family: 'Inter',
                          fileUrl: '',
                        },
                      ])
                    }
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5"
                  >
                    + Add font
                  </button>
                </div>
                <div className="space-y-3">
                  {draft.branding.fonts.map((font, index) => (
                    <div
                      key={font.id}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-white/8 bg-[#0d0d0d] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <input
                        type="text"
                        value={font.label}
                        onChange={(e) => {
                          const fonts = [...draft.branding.fonts];
                          fonts[index] = { ...font, label: e.target.value };
                          patchBranding('fonts', fonts);
                        }}
                        placeholder="Label"
                        className={inputClass}
                      />
                      <select
                        value={font.family}
                        onChange={(e) => {
                          const fonts = [...draft.branding.fonts];
                          fonts[index] = { ...font, family: e.target.value };
                          patchBranding('fonts', fonts);
                        }}
                        className={inputClass}
                      >
                        {OPUS_FONT_FAMILIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <input
                        type="url"
                        value={font.fileUrl}
                        onChange={(e) => {
                          const fonts = [...draft.branding.fonts];
                          fonts[index] = { ...font, fileUrl: e.target.value };
                          patchBranding('fonts', fonts);
                        }}
                        placeholder="Font file URL (optional)"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchBranding(
                            'fonts',
                            draft.branding.fonts.filter((f) => f.id !== font.id),
                          )
                        }
                        className="text-xs text-gray-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Asset library</h3>
                  <button
                    type="button"
                    onClick={() =>
                      patchBranding('assets', [
                        ...draft.branding.assets,
                        {
                          id: crypto.randomUUID(),
                          label: '',
                          url: '',
                          category: 'Other',
                        },
                      ])
                    }
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5"
                  >
                    + Add asset
                  </button>
                </div>
                {draft.branding.assets.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Link Dropbox files, templates, icons, or other brand assets.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {draft.branding.assets.map((asset, index) => (
                      <div
                        key={asset.id}
                        className="grid grid-cols-1 gap-3 rounded-lg border border-white/8 bg-[#0d0d0d] p-3 sm:grid-cols-[1fr_1fr_120px_auto]"
                      >
                        <input
                          type="text"
                          value={asset.label}
                          onChange={(e) => {
                            const items = [...draft.branding.assets];
                            items[index] = { ...asset, label: e.target.value };
                            patchBranding('assets', items);
                          }}
                          placeholder="Asset name"
                          className={inputClass}
                        />
                        <input
                          type="url"
                          value={asset.url}
                          onChange={(e) => {
                            const items = [...draft.branding.assets];
                            items[index] = { ...asset, url: e.target.value };
                            patchBranding('assets', items);
                          }}
                          placeholder="URL"
                          className={inputClass}
                        />
                        <select
                          value={asset.category}
                          onChange={(e) => {
                            const items = [...draft.branding.assets];
                            items[index] = { ...asset, category: e.target.value };
                            patchBranding('assets', items);
                          }}
                          className={inputClass}
                        >
                          {ASSET_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            patchBranding(
                              'assets',
                              draft.branding.assets.filter((a) => a.id !== asset.id),
                            )
                          }
                          className="text-xs text-gray-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Brand guidelines URL">
                    <input
                      type="url"
                      value={draft.branding.guidelinesUrl}
                      onChange={(e) => patchBranding('guidelinesUrl', e.target.value)}
                      placeholder="Link to brand book or style guide"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      value={draft.branding.notes}
                      onChange={(e) => patchBranding('notes', e.target.value)}
                      rows={4}
                      placeholder="Voice, tone, do's and don'ts..."
                      className={`${inputClass} resize-y`}
                    />
                  </Field>
                </div>
              </section>
            </div>
          )}

          {activeSection === 'opus' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">
                Configure text styles for Opus AI captions and on-screen copy.
              </p>

              <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-0.5 w-fit">
                {OPUS_STYLE_KEYS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveOpusStyle(key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      activeOpusStyle === key
                        ? 'bg-[#810100] text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/8 bg-[#111111] p-5">
                <OpusStyleEditor
                  key={activeOpusStyle}
                  styleKey={activeOpusStyle}
                  style={draft.opusAi[activeOpusStyle]}
                  onPatchField={(field, value) => patchOpusStyleField(activeOpusStyle, field, value)}
                />
              </div>

              <section className="rounded-xl border border-white/10 bg-[#141414] p-5">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                  All styles preview
                </p>
                <div className="space-y-4 rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6">
                  {OPUS_STYLE_KEYS.map(({ key, label }) => (
                    <div key={key}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        {label}
                      </p>
                      <span style={getOpusPreviewStyle(draft.opusAi[key], 0.45)}>
                        {PREVIEW_SAMPLES[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#0a0a0a]/98 px-4 py-4 backdrop-blur sm:px-6">
            <div className="pointer-events-auto mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">
                {saveError
                  ? saveError
                  : isDirty
                    ? 'You have unsaved changes — click Save to keep them.'
                    : store[activeClient]
                      ? 'All changes saved.'
                      : 'Nothing saved yet — click Save when ready.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={!isDirty}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-[#810100] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#9a0100]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
