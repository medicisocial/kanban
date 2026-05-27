import { useEffect, useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import { formatTime } from '../utils';
import {
  getSchemaForBusinessType,
  getDefaultFieldValues,
  buildEventPayload,
  normalizeBusinessType,
  getEstimatedAttendanceLabel,
  getEstimatedAttendancePlaceholder,
} from '../utils/eventFormSchemas';
import IndustryEventForm, { IndustryEventDetails } from './IndustryEventForm';
import { btnPrimaryClass, btnSecondaryClass, inputClass, selectClass, statusBadgeClass } from './clientPortal/clientPortalUi';

export default function IndustryEventModal({
  event,
  defaultClient,
  defaultDate,
  lockedClient,
  businessType: businessTypeProp,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
}) {
  const { clients, getClientColor, getClientBusinessType } = useClientsContext();
  const isEdit = Boolean(event?.id);

  const [client, setClient] = useState(event?.client || lockedClient || defaultClient || clients[0] || '');
  const [date, setDate] = useState(event?.date || defaultDate || toDateKey(new Date()));
  const [time, setTime] = useState(event?.time || '');
  const [estimatedCovers, setEstimatedCovers] = useState(event?.estimatedCovers || '');
  const [fieldValues, setFieldValues] = useState(() => {
    if (event?.fields && Object.keys(event.fields).length > 0) {
      const fields = { ...event.fields };
      if (fields.newItemsToShootDetails && !fields.drinkMenuDetails) {
        fields.hasDrinkMenu = true;
        fields.drinkMenuDetails = fields.newItemsToShootDetails;
      }
      if (fields.newMenuItemsDetails && !fields.foodMenuDetails) {
        fields.hasFoodMenu = true;
        fields.foodMenuDetails = fields.newMenuItemsDetails;
      }
      if (fields.equipmentHighlight && !fields.eventDescription) {
        fields.eventDescription = fields.equipmentHighlight;
      }
      if (String(fields.drinkMenuDetails || '').trim()) fields.hasDrinkMenu = true;
      if (String(fields.foodMenuDetails || '').trim()) fields.hasFoodMenu = true;
      return fields;
    }
    const initialClient = event?.client || lockedClient || defaultClient || '';
    const bt = event?.businessType || businessTypeProp || '';
    const initialSchema = getSchemaForBusinessType(bt);
    const defaults = getDefaultFieldValues(initialSchema);
    if (event?.title) {
      const titleField = initialSchema?.find((field) => field.mapsToTitle);
      if (titleField) defaults[titleField.id] = event.title;
    }
    return defaults;
  });
  const [error, setError] = useState('');

  const businessType = normalizeBusinessType(
    businessTypeProp || event?.businessType || getClientBusinessType(client),
  );
  const schema = useMemo(() => getSchemaForBusinessType(businessType), [businessType]);
  const attendanceLabel = getEstimatedAttendanceLabel(businessType);
  const clientColor = getClientColor(client);
  const clientLocked = Boolean(lockedClient);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (isEdit || lockedClient) return;
    const nextType = getClientBusinessType(client);
    const nextSchema = getSchemaForBusinessType(nextType);
    setFieldValues(getDefaultFieldValues(nextSchema));
  }, [client, getClientBusinessType, isEdit, lockedClient]);

  const handleFieldChange = (fieldId, value) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setError('');
  };

  const persist = (status) => {
    if (status === 'submitted' && !date) {
      setError('Event date is required.');
      return;
    }
    if (!client) {
      setError('Client is required.');
      return;
    }
    if (!businessType) {
      setError('Assign a business type to this client before creating events.');
      return;
    }

    const result = buildEventPayload({
      schema,
      values: fieldValues,
      client,
      businessType,
      date,
      time,
      status,
      estimatedCovers,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSave({
      ...result.data,
      ...(isEdit ? { id: event.id, createdAt: event.createdAt } : {}),
      updatedAt: Date.now(),
    });
    onClose();
  };

  const statusLabel = event?.status === 'draft' ? 'Draft' : 'Submitted';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                {readOnly ? 'Event details' : isEdit ? 'Edit event' : 'Log event'}
              </h2>
              {isEdit && (
                <span className={statusBadgeClass(event?.status === 'draft' ? 'pending' : 'approved')}>
                  {statusLabel}
                </span>
              )}
            </div>
            {businessType && (
              <p className="mt-1 text-xs text-white/45">{businessType} event form</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-white/45 hover:text-white">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {readOnly ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Client</p>
                <p className="mt-1" style={{ color: clientColor }}>{client}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Date</p>
                  <p className="mt-1 text-white/80">{date}</p>
                </div>
                {time && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Time</p>
                    <p className="mt-1 text-white/80">{formatTime(time)}</p>
                  </div>
                )}
                {estimatedCovers && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{attendanceLabel}</p>
                    <p className="mt-1 text-white/80">{estimatedCovers}</p>
                  </div>
                )}
              </div>
              <IndustryEventDetails
                event={{ ...event, estimatedCovers }}
                schema={schema}
                attendanceLabel={attendanceLabel}
              />
            </div>
          ) : (
            <form
              id="industry-event-form"
              onSubmit={(e) => {
                e.preventDefault();
                persist('submitted');
              }}
              className="space-y-4"
            >
              {!clientLocked && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                    Client
                  </span>
                  <div className="relative">
                    <select
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      className={`${selectClass} w-full`}
                      required
                    >
                      {clients.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                      ▾
                    </span>
                  </div>
                </label>
              )}

              {clientLocked && (
                <div className="border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Client</p>
                  <p className="mt-0.5 text-sm font-medium" style={{ color: clientColor }}>{client}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                    Event date *
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                    Time
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/45">
                    {attendanceLabel}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={estimatedCovers}
                    onChange={(e) => setEstimatedCovers(e.target.value)}
                    placeholder={getEstimatedAttendancePlaceholder(businessType)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="border-t border-white/10 pt-4">
                <IndustryEventForm
                  schema={schema}
                  values={fieldValues}
                  onChange={handleFieldChange}
                />
              </div>

              {error && <p className="text-sm text-rose-300">{error}</p>}
            </form>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/10 px-5 py-4">
          {isEdit && onDelete && !readOnly && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this event?')) {
                  onDelete(event.id);
                  onClose();
                }
              }}
              className="border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-rose-200/90 hover:bg-rose-500/15"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className={btnSecondaryClass}>
              Cancel
            </button>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => persist('draft')}
                  className={btnSecondaryClass}
                >
                  Save as Draft
                </button>
                <button type="submit" form="industry-event-form" className={btnPrimaryClass}>
                  Submit Event
                </button>
              </>
            )}
            {readOnly && (
              <button type="button" onClick={onClose} className={btnSecondaryClass}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
