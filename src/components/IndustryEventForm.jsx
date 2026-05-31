import { useRef, useState } from 'react';
import { btnSecondaryClass, inputClass, selectClass } from './clientPortal/clientPortalUi';
import FilePreviewActions from './clientPortal/FilePreviewActions';
import { isFieldVisible, getDisplayEventType } from '../utils/eventFormSchemas';
import {
  eventPdfHasAttachment,
  normalizeEventPdfAttachment,
  readEventPdfUpload,
} from '../utils/eventPdfUpload';

function FieldLabel({ children, required }) {
  return (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/45">
      {children}
      {required ? ' *' : ''}
    </span>
  );
}

function ToggleField({ field, value, onChange, disabled }) {
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
          onClick={() => onChange(field.id, option.val)}
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

function ChoiceField({ field, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {field.options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(field.id, option)}
          className={`border px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
            value === option
              ? 'border-[#810100]/60 bg-[#810100]/15 text-white'
              : 'border-white/15 bg-[#111111] text-white/55 hover:border-white/25 hover:text-white/80'
          } disabled:opacity-50`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function menuHasContent(textContent, pdf) {
  return Boolean(String(textContent || '').trim() || eventPdfHasAttachment(pdf));
}

function PdfAttachmentField({ pdf, onChange, disabled, label = 'Upload PDF', embedded = false }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const attachment = normalizeEventPdfAttachment(pdf);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    try {
      onChange(await readEventPdfUpload(file));
    } catch (err) {
      setError(err.message || 'Could not upload PDF.');
    }
  };

  return (
    <div className={embedded ? 'border-t border-white/10 pt-3' : ''}>
      {label && (
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      )}
      {attachment ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-0 truncate text-xs text-white/75">{attachment.name}</span>
          <FilePreviewActions
            title={attachment.name}
            dataUrl={attachment.dataUrl}
            fileName={attachment.name}
          />
          {!disabled && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-medium uppercase tracking-wider text-white/50 transition-colors hover:text-white"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-rose-300"
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
            className={`${btnSecondaryClass} w-full justify-center py-2.5 text-xs`}
          >
            Upload PDF
          </button>
        )
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
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

function MenuGroupField({ field, values, onChange, disabled }) {
  const drinkContent = values[field.drinkContentField] ?? '';
  const foodContent = values[field.foodContentField] ?? '';
  const drinkPdf = values[field.drinkPdfField] ?? null;
  const foodPdf = values[field.foodPdfField] ?? null;
  const [showDrinkText, setShowDrinkText] = useState(() => Boolean(String(drinkContent).trim()));
  const [showFoodText, setShowFoodText] = useState(() => Boolean(String(foodContent).trim()));

  const syncDrinkEnabled = (content, pdf) => {
    onChange(field.drinkEnableField, menuHasContent(content, pdf));
  };

  const syncFoodEnabled = (content, pdf) => {
    onChange(field.foodEnableField, menuHasContent(content, pdf));
  };

  const handleDrinkPdf = (pdf) => {
    onChange(field.drinkPdfField, pdf);
    syncDrinkEnabled(drinkContent, pdf);
  };

  const handleFoodPdf = (pdf) => {
    onChange(field.foodPdfField, pdf);
    syncFoodEnabled(foodContent, pdf);
  };

  const handleDrinkContent = (content) => {
    onChange(field.drinkContentField, content);
    syncDrinkEnabled(content, drinkPdf);
  };

  const handleFoodContent = (content) => {
    onChange(field.foodContentField, content);
    syncFoodEnabled(content, foodPdf);
  };

  return (
    <div>
      <FieldLabel>Menus & PDFs</FieldLabel>
      <p className="mb-2 text-xs leading-relaxed text-white/40">
        Upload drink or food menu PDFs below. You can also type menu details if needed.
      </p>
      <div className="space-y-4 border border-white/10 bg-white/[0.02] p-3">
        <PdfAttachmentField
          label="Drink menu PDF"
          pdf={drinkPdf}
          onChange={handleDrinkPdf}
          disabled={disabled}
        />
        {(showDrinkText || String(drinkContent).trim()) ? (
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/40">
              Drink menu details (optional)
            </span>
            <textarea
              value={drinkContent}
              onChange={(e) => handleDrinkContent(e.target.value)}
              placeholder="Cocktails, spirits, prices, descriptions…"
              rows={3}
              disabled={disabled}
              className={`${inputClass} resize-y text-sm`}
            />
          </label>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => setShowDrinkText(true)}
              className="text-[10px] font-medium uppercase tracking-wider text-white/45 transition-colors hover:text-white/70"
            >
              + Type drink menu details
            </button>
          )
        )}

        <PdfAttachmentField
          label="Food menu PDF"
          pdf={foodPdf}
          onChange={handleFoodPdf}
          disabled={disabled}
          embedded
        />
        {(showFoodText || String(foodContent).trim()) ? (
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/40">
              Food menu details (optional)
            </span>
            <textarea
              value={foodContent}
              onChange={(e) => handleFoodContent(e.target.value)}
              placeholder="Dishes, dietary notes, prices…"
              rows={3}
              disabled={disabled}
              className={`${inputClass} resize-y text-sm`}
            />
          </label>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => setShowFoodText(true)}
              className="text-[10px] font-medium uppercase tracking-wider text-white/45 transition-colors hover:text-white/70"
            >
              + Type food menu details
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function IndustryEventForm({ schema, values, onChange, disabled = false }) {
  if (!schema?.length) {
    return (
      <p className="border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-200/90">
        No business type assigned. Ask your account manager to set one before logging events.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {schema.map((field) => {
        if (field.type === 'menuGroup') {
          return (
            <MenuGroupField
              key={field.id}
              field={field}
              values={values}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (field.type === 'addSection') return null;
        if (!isFieldVisible(field, values)) return null;

        if (field.type === 'pdf') {
          return (
            <div key={field.id}>
              <FieldLabel required={field.required}>{field.label}</FieldLabel>
              {field.description && (
                <p className="mb-2 text-xs leading-relaxed text-white/40">{field.description}</p>
              )}
              <div className="border border-white/10 bg-white/[0.02] p-3">
                <PdfAttachmentField
                  pdf={values[field.id]}
                  onChange={(value) => onChange(field.id, value)}
                  disabled={disabled}
                  label="Upload PDF"
                />
              </div>
            </div>
          );
        }

        return (
          <label key={field.id} className="block">
            <FieldLabel required={field.required}>{field.label}</FieldLabel>

            {field.type === 'text' && (
              <input
                type="text"
                value={values[field.id] ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className={inputClass}
                disabled={disabled}
                required={field.required}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={values[field.id] ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                rows={field.rows || 3}
                className={`${inputClass} resize-y`}
                disabled={disabled}
                required={field.required}
              />
            )}

            {field.type === 'select' && (
              <div className="relative">
                <select
                  value={values[field.id] ?? ''}
                  onChange={(e) => {
                    onChange(field.id, e.target.value);
                    if (field.id === 'eventType') {
                      if (e.target.value !== 'Other') onChange('eventTypeOther', '');
                      if (e.target.value !== 'Business Highlight') {
                        onChange('highlightBusinessName', '');
                        onChange('highlightOwnerNames', '');
                        onChange('brandingVideoNotes', '');
                      }
                    }
                  }}
                  className={`${selectClass} w-full`}
                  disabled={disabled}
                  required={field.required}
                >
                  <option value="">Select…</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                  ▾
                </span>
              </div>
            )}

            {field.type === 'toggle' && (
              <ToggleField field={field} value={Boolean(values[field.id])} onChange={onChange} disabled={disabled} />
            )}

            {field.type === 'choice' && (
              <ChoiceField field={field} value={values[field.id]} onChange={onChange} disabled={disabled} />
            )}
          </label>
        );
      })}
    </div>
  );
}

export function IndustryEventDetails({ event, schema, attendanceLabel = 'Estimated covers' }) {
  const drinkMenu = event?.fields?.drinkMenuDetails;
  const foodMenu = event?.fields?.foodMenuDetails;
  const drinkPdf = normalizeEventPdfAttachment(event?.fields?.drinkMenuPdf);
  const foodPdf = normalizeEventPdfAttachment(event?.fields?.foodMenuPdf);

  const displaySchema = schema || [];
  const fields = displaySchema.filter((field) => {
    if (field.type === 'menuGroup' || field.type === 'addSection') return false;
    if (field.type === 'pdf') return eventPdfHasAttachment(event?.fields?.[field.id]);
    return isFieldVisible(field, event?.fields || {}) && event?.fields?.[field.id] !== undefined;
  });

  return (
    <div className="space-y-3 text-sm">
      {event?.estimatedCovers && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{attendanceLabel}</p>
          <p className="mt-1 text-white/80">{event.estimatedCovers}</p>
        </div>
      )}

      {fields.map((field) => {
        const value = event.fields[field.id];
        if (field.id === 'eventType') {
          const displayType = getDisplayEventType(event.fields);
          if (!displayType) return null;
          return (
            <div key={field.id}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{field.label}</p>
              <p className="mt-1 text-white/80">{displayType}</p>
            </div>
          );
        }
        if (field.id === 'eventTypeOther') return null;
        if (field.type === 'pdf') {
          const attachment = normalizeEventPdfAttachment(value);
          if (!attachment) return null;
          return (
            <div key={field.id} className="rounded border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{field.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <span className="text-white/55">PDF:</span>
                <span className="text-white/80">{attachment.name}</span>
                <FilePreviewActions
                  title={attachment.name}
                  dataUrl={attachment.dataUrl}
                  fileName={attachment.name}
                />
              </div>
            </div>
          );
        }
        if (field.type === 'toggle' && !value) return null;
        if ((field.type === 'textarea' || field.type === 'text') && !String(value || '').trim()) return null;

        return (
          <div key={field.id}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{field.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-white/80">
              {field.type === 'toggle' ? (value ? 'Yes' : 'No') : value || '—'}
            </p>
          </div>
        );
      })}

      {(String(drinkMenu || '').trim() || drinkPdf) && (
        <div className="rounded border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Drink menu</p>
          {String(drinkMenu || '').trim() && (
            <p className="mt-1 whitespace-pre-wrap text-white/80">{drinkMenu}</p>
          )}
          {drinkPdf && (
            <div
              className={`${String(drinkMenu || '').trim() ? 'mt-2' : 'mt-1'} flex flex-wrap items-center gap-x-3 gap-y-2 text-xs`}
            >
              <span className="text-white/55">PDF:</span>
              <span className="text-white/80">{drinkPdf.name}</span>
              <FilePreviewActions
                title={drinkPdf.name}
                dataUrl={drinkPdf.dataUrl}
                fileName={drinkPdf.name}
              />
            </div>
          )}
        </div>
      )}

      {(String(foodMenu || '').trim() || foodPdf) && (
        <div className="rounded border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Food menu</p>
          {String(foodMenu || '').trim() && (
            <p className="mt-1 whitespace-pre-wrap text-white/80">{foodMenu}</p>
          )}
          {foodPdf && (
            <div
              className={`${String(foodMenu || '').trim() ? 'mt-2' : 'mt-1'} flex flex-wrap items-center gap-x-3 gap-y-2 text-xs`}
            >
              <span className="text-white/55">PDF:</span>
              <span className="text-white/80">{foodPdf.name}</span>
              <FilePreviewActions
                title={foodPdf.name}
                dataUrl={foodPdf.dataUrl}
                fileName={foodPdf.name}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
