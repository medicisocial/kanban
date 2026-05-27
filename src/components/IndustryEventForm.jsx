import { useState } from 'react';
import { btnPrimaryClass, btnSecondaryClass, inputClass, selectClass } from './clientPortal/clientPortalUi';
import { isFieldVisible, getDisplayEventType } from '../utils/eventFormSchemas';

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

function MenuPanel({ title, content, placeholder, onChange, onSave, onCancel, disabled }) {
  return (
    <div className="border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/65">{title}</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={disabled}
        className={`${inputClass} resize-y border-0 bg-transparent px-2.5 py-2 text-sm focus:border-0`}
      />
      {!disabled && (
        <div className="flex justify-end gap-2 border-t border-white/10 px-2.5 py-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] font-medium uppercase tracking-wider text-white/45 transition-colors hover:text-white/70"
          >
            Cancel
          </button>
          <button type="button" onClick={onSave} className={`${btnPrimaryClass} py-1.5 text-[10px]`}>
            Save menu
          </button>
        </div>
      )}
    </div>
  );
}

function SavedMenuSummary({ title, content, onEdit, onRemove, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.trim().split('\n').filter(Boolean);
  const preview = lines[0] || 'No items added yet';

  return (
    <div className="border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left transition hover:opacity-90"
        >
          <span className="mt-0.5 shrink-0 text-[10px] text-white/35">{expanded ? '▾' : '▸'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/65">{title}</p>
            {!expanded && (
              <p className="truncate text-xs text-white/45">
                {lines.length > 0
                  ? `${lines.length} item${lines.length !== 1 ? 's' : ''} · ${preview}`
                  : preview}
              </p>
            )}
          </div>
        </button>
        {!disabled && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="text-[10px] font-medium uppercase tracking-wider text-white/50 transition-colors hover:text-white"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-[10px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-rose-300"
            >
              Remove
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-white/10 px-2.5 py-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
            {content.trim() || 'No items added yet.'}
          </p>
        </div>
      )}
    </div>
  );
}

function MenuGroupField({ field, values, onChange, disabled }) {
  const drinkEnabled = Boolean(values[field.drinkEnableField]);
  const foodEnabled = Boolean(values[field.foodEnableField]);
  const drinkContent = values[field.drinkContentField] ?? '';
  const foodContent = values[field.foodContentField] ?? '';

  const [editingDrink, setEditingDrink] = useState(false);
  const [editingFood, setEditingFood] = useState(false);

  const drinkSaved = drinkEnabled && !editingDrink;
  const foodSaved = foodEnabled && !editingFood;

  const startDrink = () => {
    onChange(field.drinkEnableField, true);
    setEditingDrink(true);
  };

  const startFood = () => {
    onChange(field.foodEnableField, true);
    setEditingFood(true);
  };

  const saveDrink = () => setEditingDrink(false);
  const saveFood = () => setEditingFood(false);

  const cancelDrink = () => {
    if (!drinkContent.trim()) {
      onChange(field.drinkEnableField, false);
      onChange(field.drinkContentField, '');
    }
    setEditingDrink(false);
  };

  const cancelFood = () => {
    if (!foodContent.trim()) {
      onChange(field.foodEnableField, false);
      onChange(field.foodContentField, '');
    }
    setEditingFood(false);
  };

  const removeDrink = () => {
    onChange(field.drinkEnableField, false);
    onChange(field.drinkContentField, '');
    setEditingDrink(false);
  };

  const removeFood = () => {
    onChange(field.foodEnableField, false);
    onChange(field.foodContentField, '');
    setEditingFood(false);
  };

  const showDrinkAdd = !drinkEnabled && !editingDrink;
  const showFoodAdd = !foodEnabled && !editingFood;

  return (
    <div>
      <FieldLabel>Menus</FieldLabel>
      <div className="space-y-2">
        {drinkSaved && (
          <SavedMenuSummary
            title="Drink menu"
            content={drinkContent}
            onEdit={() => setEditingDrink(true)}
            onRemove={removeDrink}
            disabled={disabled}
          />
        )}

        {foodSaved && (
          <SavedMenuSummary
            title="Food menu"
            content={foodContent}
            onEdit={() => setEditingFood(true)}
            onRemove={removeFood}
            disabled={disabled}
          />
        )}

        {editingDrink && (
          <MenuPanel
            title="Drink menu"
            content={drinkContent}
            placeholder="Cocktails, spirits, prices, descriptions…"
            disabled={disabled}
            onChange={(value) => onChange(field.drinkContentField, value)}
            onSave={saveDrink}
            onCancel={cancelDrink}
          />
        )}

        {editingFood && (
          <MenuPanel
            title="Food menu"
            content={foodContent}
            placeholder="Dishes, dietary notes, prices…"
            disabled={disabled}
            onChange={(value) => onChange(field.foodContentField, value)}
            onSave={saveFood}
            onCancel={cancelFood}
          />
        )}

        {(showDrinkAdd || showFoodAdd) && (
          <div className={`grid gap-2 ${showDrinkAdd && showFoodAdd ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showDrinkAdd && (
              <button
                type="button"
                disabled={disabled}
                onClick={startDrink}
                className={`${btnSecondaryClass} justify-center py-2 text-[10px]`}
              >
                + Drink menu
              </button>
            )}
            {showFoodAdd && (
              <button
                type="button"
                disabled={disabled}
                onClick={startFood}
                className={`${btnSecondaryClass} justify-center py-2 text-[10px]`}
              >
                + Food menu
              </button>
            )}
          </div>
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

  const displaySchema = schema || [];
  const fields = displaySchema.filter((field) => {
    if (field.type === 'menuGroup' || field.type === 'addSection') return false;
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

      {String(drinkMenu || '').trim() && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Drink menu</p>
          <p className="mt-1 whitespace-pre-wrap text-white/80">{drinkMenu}</p>
        </div>
      )}

      {String(foodMenu || '').trim() && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Food menu</p>
          <p className="mt-1 whitespace-pre-wrap text-white/80">{foodMenu}</p>
        </div>
      )}
    </div>
  );
}
