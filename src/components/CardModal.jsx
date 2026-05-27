import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CONTENT_TYPES,
  PLATFORM,
  PLATFORM_ICON,
  getContentTypeStyle,
  needsShootSchedule,
  isOneOffProjectCard,
} from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { hasStoryRecurrence, hasStoryDailyRange, getStoryScheduleMode, parseRecurrenceDays, parseStoryOccurrenceNotes } from '../utils/calendar';
import { getDefaultShootEndTime, parseTimeToMinutes } from '../utils/shootDay';
import StoryRecurrencePicker from './StoryRecurrencePicker';
import ModelTagInput from './ModelTagInput';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';

const CARD_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'production', label: 'Production' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'references', label: 'References' },
];

export default function CardModal({ card, onClose, onUpdate, onDelete }) {
  const overlayRef = useRef(null);
  const [activeTab, setActiveTab] = useState('details');
  const { clients, getClientAccountManager, getMemberNamesForRole } = useClientsContext();
  const editors = getMemberNamesForRole('Editor');
  const contentCreators = getMemberNamesForRole('Content Creator');
  const accountManagers = getMemberNamesForRole('Account Manager');

  useEffect(() => {
    setActiveTab('details');
  }, [card?.id]);

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

  if (!card) return null;

  const typeStyle = getContentTypeStyle(card.contentType);
  const isOneOff = isOneOffProjectCard(card);

  const handleChange = (field, value) => {
    if (field === 'contentType' && value === 'Story') {
      onUpdate(card.id, {
        contentType: value,
        shootDate: '',
        shootTime: '',
        shootEndTime: '',
        shootModels: '',
        shootNeeds: '',
      });
      return;
    }
    if (field === 'contentType' && value !== 'Story') {
      onUpdate(card.id, {
        contentType: value,
        storyRecurrenceDays: [],
        storyEndDate: '',
        storyOccurrenceNotes: {},
      });
      return;
    }
    if (field === 'client') {
      onUpdate(card.id, {
        client: value,
        accountManager: getClientAccountManager(value) || card.accountManager || '',
      });
      return;
    }
    if (field === 'notes' && card.occurrenceDate && (hasStoryRecurrence(card) || hasStoryDailyRange(card))) {
      onUpdate(card.id, {
        storyOccurrenceNotes: {
          ...parseStoryOccurrenceNotes(card.storyOccurrenceNotes),
          [card.occurrenceDate]: value,
        },
      });
      return;
    }
    if (field === 'shootTime') {
      const updates = { shootTime: value };
      const start = parseTimeToMinutes(value);
      const end = parseTimeToMinutes(card.shootEndTime);
      if (start != null && (end == null || end <= start)) {
        updates.shootEndTime = getDefaultShootEndTime(value, card.contentType);
      }
      if (!value) updates.shootEndTime = '';
      onUpdate(card.id, updates);
      return;
    }
    onUpdate(card.id, { [field]: value });
  };

  const recurrenceDays = parseRecurrenceDays(card.storyRecurrenceDays);
  const storyRecurrenceMode = getStoryScheduleMode(card);
  const occurrenceLabel = card.occurrenceDate
    ? new Date(`${card.occurrenceDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const showShootPlanning = needsShootSchedule(card.contentType) && card.shootDate;
  const tabClass = (id) =>
    `px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition ${
      activeTab === id ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="my-4 flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        style={{ borderTopColor: typeStyle.border, borderTopWidth: '3px' }}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {card.status}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {isOneOff ? 'Edit one-off project' : 'Edit Card'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="shrink-0 border-b border-white/5 px-5 py-3">
          <div className="flex flex-wrap gap-1 border border-white/10 bg-white/[0.03] p-0.5 w-fit">
            {CARD_TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={tabClass(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {activeTab === 'details' && (
            <>
          <Field label="Task Title">
            <input
              type="text"
              value={card.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={inputClass}
            />
          </Field>


          <Field label="Dropbox Content Link">
            <input
              type="url"
              value={card.dropboxLink || ''}
              onChange={(e) => handleChange('dropboxLink', e.target.value)}
              placeholder="Paste Dropbox share link to the content file or folder..."
              className={inputClass}
            />
            {card.dropboxLink ? (
              <a
                href={card.dropboxLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block truncate text-xs text-[#dc2626] hover:text-[#fca5a5]"
              >
                Open in Dropbox →
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                When set, clicking the card title on the board opens this link.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <select
                value={card.client}
                onChange={(e) => handleChange('client', e.target.value)}
                className={inputClass}
              >
                {clients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Content Type">
              {isOneOff ? (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-violet-200">
                  One-off Project
                </p>
              ) : (
                <select
                  value={card.contentType}
                  onChange={(e) => handleChange('contentType', e.target.value)}
                  className={inputClass}
                >
                  {CONTENT_TYPES.filter((t) => t !== 'Story' || card.contentType === 'Story').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {!isOneOff && contentCreators.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Content creator">
                <select
                  value={card.contentCreator || ''}
                  onChange={(e) => handleChange('contentCreator', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {contentCreators.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Editor">
                <select
                  value={card.assignedTo}
                  onChange={(e) => handleChange('assignedTo', e.target.value)}
                  className={inputClass}
                >
                  {editors.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {(isOneOff || contentCreators.length === 0) && (
            <Field label="Editor">
              <select
                value={card.assignedTo}
                onChange={(e) => handleChange('assignedTo', e.target.value)}
                className={inputClass}
              >
                {editors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Account manager">
            <select
              value={card.accountManager || getClientAccountManager(card.client) || ''}
              onChange={(e) => handleChange('accountManager', e.target.value)}
              className={inputClass}
            >
              <option value="">Use client default</option>
              {accountManagers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label={card.occurrenceDate && (hasStoryRecurrence(card) || hasStoryDailyRange(card)) ? `Notes (${occurrenceLabel})` : 'Notes'}>
            <textarea
              value={card.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              placeholder="Add notes..."
              className={`${inputClass} resize-y`}
            />
          </Field>

          {card.clientComment && (
            <div
              className={`rounded-lg border px-3 py-2.5 ${
                card.columnId === 'not-approved'
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-[#810100]/20 bg-[#a00000]/5'
              }`}
            >
              <p className={`text-[10px] font-medium uppercase tracking-wider ${card.columnId === 'not-approved' ? 'text-red-300' : 'text-[#fca5a5]'}`}>
                {card.columnId === 'not-approved' ? 'Client revision notes' : 'Client feedback'}
              </p>
              <p className="mt-1 text-sm text-gray-300">&ldquo;{card.clientComment}&rdquo;</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className={`text-xs font-medium ${typeStyle.label}`}>{card.contentType}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{PLATFORM_ICON} {PLATFORM}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{card.client}</span>
          </div>
            </>
          )}

          {activeTab === 'production' && !isOneOff && (
            <>
          {!isOneOff && needsShootSchedule(card.contentType) && (
            <Field label="Shoot Date">
              <input
                type="date"
                value={card.shootDate || ''}
                onChange={(e) => handleChange('shootDate', e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-500">When to film — appears on Scheduled shoots</p>
            </Field>
          )}

          {showShootPlanning && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Shoot schedule planning
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start time">
                  <input
                    type="time"
                    value={card.shootTime || ''}
                    onChange={(e) => handleChange('shootTime', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    value={card.shootEndTime || ''}
                    onChange={(e) => handleChange('shootEndTime', e.target.value)}
                    min={card.shootTime || undefined}
                    className={inputClass}
                  />
                </Field>
                <Field label="Models / Talent">
                  <ModelTagInput
                    value={card.shootModels || ''}
                    onChange={(value) => handleChange('shootModels', value)}
                    placeholder="Add model name, press Enter"
                  />
                </Field>
                <Field label="Props & Needs">
                  <input
                    type="text"
                    value={card.shootNeeds || ''}
                    onChange={(e) => handleChange('shootNeeds', e.target.value)}
                    placeholder="Ring light, samples, wardrobe..."
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          )}

          {!showShootPlanning && needsShootSchedule(card.contentType) && !card.shootDate && (
            <p className="text-sm text-white/45">Set a shoot date on this tab to plan times and talent.</p>
          )}
            </>
          )}

          {activeTab === 'production' && isOneOff && (
            <p className="text-sm text-white/45">Production fields are not used for one-off projects.</p>
          )}

          {activeTab === 'schedule' && (
            <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={isOneOff ? 'Due date (optional)' : 'Plan date'}>
              <input
                type="date"
                value={card.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className={inputClass}
              />
            </Field>
            {!isOneOff && (
              <Field label={card.columnId === 'scheduled' ? 'Scheduled Time' : 'Plan time'}>
                <input
                  type="time"
                  value={card.dueTime || ''}
                  onChange={(e) => handleChange('dueTime', e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          {!isOneOff && card.contentType === 'Story' && ['scheduled', 'editing', 'in-review', 'approved'].includes(card.columnId) && (
            <StoryRecurrencePicker
              mode={storyRecurrenceMode}
              onModeChange={(mode) => {
                if (mode === 'once') {
                  onUpdate(card.id, { storyRecurrenceDays: [], storyEndDate: '' });
                } else if (mode === 'daily') {
                  onUpdate(card.id, { storyRecurrenceDays: [] });
                } else if (mode === 'weekly') {
                  onUpdate(card.id, {
                    storyEndDate: '',
                    storyRecurrenceDays: recurrenceDays.length ? recurrenceDays : [1],
                  });
                }
              }}
              days={recurrenceDays}
              onDaysChange={(days) => onUpdate(card.id, { storyRecurrenceDays: days, storyEndDate: '' })}
              startDate={card.dueDate}
              onStartDateChange={(dueDate) => handleChange('dueDate', dueDate)}
              endDate={card.storyEndDate || ''}
              onEndDateChange={(storyEndDate) => handleChange('storyEndDate', storyEndDate)}
            />
          )}
            </>
          )}

          {activeTab === 'references' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Reference Music">
              <input
                type="url"
                value={card.referenceMusic || ''}
                onChange={(e) => handleChange('referenceMusic', e.target.value)}
                placeholder="Paste Spotify, Apple Music, or other link..."
                className={inputClass}
              />
            </Field>
            <Field label="Reference Video">
              <input
                type="text"
                value={card.referenceVideo || ''}
                onChange={(e) => handleChange('referenceVideo', e.target.value)}
                placeholder="Paste Instagram, TikTok, or YouTube link..."
                className={inputClass}
              />
            </Field>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-white/5 px-5 py-4">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white transition hover:bg-[#a00000]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';
