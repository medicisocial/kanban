import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  COLUMNS,
  CONTENT_TYPES,
  PLATFORM,
  PLATFORM_ICON,
  getContentTypeStyle,
  needsShootSchedule,
  isOneOffProjectCard,
  isScheduledPostType,
  EDITOR_POINT_OPTIONS,
  normalizeEditorPoints,
} from '../constants';
import { contentTypeLabelProps } from '../utils/contentTypeColors';
import { useClientsContext } from '../context/ClientsContext';
import { hasStoryRecurrence, hasStoryDailyRange, getStoryScheduleMode, parseRecurrenceDays, parseStoryOccurrenceNotes } from '../utils/calendar';
import { formatScheduledDateTime, formatDate, formatTime } from '../utils';
import { getDefaultShootEndTime, parseTimeToMinutes, getClientUpcomingShoots, sortCardsByShootTime } from '../utils/shootDay';
import StoryRecurrencePicker from './StoryRecurrencePicker';
import DateInput from './DateInput';
import ClientNameInput from './ClientNameInput';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';
import ReferenceVideoLink, { ReferenceMusicLink } from './clientPortal/ReferenceVideoLink';
import { CalendarSheetNoteEditor } from './CalendarSheetNote';
import { getCalendarClientNote, hasCalendarClientNote, isContentCalendarCard } from '../utils/calendarClientNote';
import { buildCalendarNoteDeletePatch } from '../utils/calendarNote';
import { canReturnCardToVault } from '../utils/videoIdeas';
import { beginBatch, endBatch } from '../utils/undoHistory';
import DebouncedField, { DebouncedModelTagInput, DebouncedTimeInput } from './DebouncedField';

const CARD_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'production', label: 'Production' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'references', label: 'References' },
];

/** Text fields in the modal sync to cloud only when Done / close — not while typing. */
const SAVE_ON_CLOSE = { deferCommit: true, commitOnBlur: true };

function CardModal({
  card,
  cards = [],
  ideas = [],
  plans = {},
  onClose,
  onUpdate,
  onDelete,
  onPlanPostDate,
  onPlanShootDate,
  onAddCardsToShoot,
  onOpenCard,
  onReturnToVault,
  onMoveCard,
}) {
  const overlayRef = useRef(null);
  const mouseDownOnOverlayRef = useRef(false);
  const pendingTabRef = useRef(null);
  const [activeTab, setActiveTab] = useState('details');
  const {
    clients,
    getClientAccountManager,
    getClientVideographer,
    getMemberNamesForRole,
  } = useClientsContext();
  const editors = getMemberNamesForRole('Editor');
  const contentCreators = getMemberNamesForRole('Content Creator');
  const calendarClientNote = getCalendarClientNote(card);
  const showCalendarClientNote =
    isContentCalendarCard(card) && hasCalendarClientNote(card);
  const accountManagers = getMemberNamesForRole('Account Manager');

  const pendingCardIdRef = useRef(null);
  const pendingUpdatesRef = useRef({});
  const [draftDisplay, setDraftDisplay] = useState({});

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const queueUpdate = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...patch };
    setDraftDisplay((prev) => ({ ...prev, ...patch }));
  }, []);

  const flushPendingUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current;
    const id = pendingCardIdRef.current;
    pendingUpdatesRef.current = {};
    setDraftDisplay({});
    if (!id || !Object.keys(updates).length) return;
    onUpdateRef.current(id, updates, { recordUndo: false });
  }, []);

  useEffect(() => {
    pendingCardIdRef.current = card?.id ?? null;
    pendingUpdatesRef.current = {};
    setDraftDisplay({});
  }, [card?.id]);

  const handleDone = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    beginBatch();
    return () => {
      flushPendingUpdates();
      endBatch();
    };
  }, [card?.id, flushPendingUpdates]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleDone();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleDone]);

  useEffect(() => {
    if (pendingTabRef.current) {
      setActiveTab(pendingTabRef.current);
      pendingTabRef.current = null;
    } else {
      setActiveTab('details');
    }
  }, [card?.id]);

  const shootDayCards = useMemo(() => {
    const merged = { ...card, ...draftDisplay };
    if (!merged?.shootDate || !needsShootSchedule(merged?.contentType)) return [];
    const filtered = cards.filter(
      (entry) =>
        entry.client === merged.client &&
        entry.shootDate === merged.shootDate &&
        needsShootSchedule(entry.contentType),
    );
    return sortCardsByShootTime(filtered);
  }, [cards, card, draftDisplay]);

  const upcomingShoots = useMemo(() => {
    const merged = { ...card, ...draftDisplay };
    if (!merged?.client || !needsShootSchedule(merged?.contentType)) return [];
    return getClientUpcomingShoots(cards, plans, merged.client).filter(
      (session) => session.dateKey !== merged.shootDate,
    );
  }, [cards, plans, card, draftDisplay]);

  const commitTextField = useCallback(
    (field, value) => {
      queueUpdate({ [field]: value });
    },
    [queueUpdate],
  );

  const commitNotes = useCallback(
    (value) => {
      if (!card) return;
      const merged = { ...card, ...draftDisplay };
      if (merged.occurrenceDate && (hasStoryRecurrence(merged) || hasStoryDailyRange(merged))) {
        queueUpdate({
          storyOccurrenceNotes: {
            ...parseStoryOccurrenceNotes(merged.storyOccurrenceNotes),
            [merged.occurrenceDate]: value,
          },
        });
        return;
      }
      commitTextField('notes', value);
    },
    [card, draftDisplay, commitTextField, queueUpdate],
  );

  const notesValue = useMemo(() => {
    if (!card) return '';
    const merged = { ...card, ...draftDisplay };
    if (merged.occurrenceDate && (hasStoryRecurrence(merged) || hasStoryDailyRange(merged))) {
      return parseStoryOccurrenceNotes(merged.storyOccurrenceNotes)[merged.occurrenceDate] ?? merged.notes ?? '';
    }
    return merged.notes ?? '';
  }, [card, draftDisplay]);

  const commitShootTime = useCallback(
    (value) => {
      if (!card) return;
      const merged = { ...card, ...draftDisplay };
      const updates = { shootTime: value };
      const start = parseTimeToMinutes(value);
      const end = parseTimeToMinutes(merged.shootEndTime);
      if (start != null && (end == null || end <= start)) {
        updates.shootEndTime = getDefaultShootEndTime(value, merged.contentType);
      }
      if (!value) updates.shootEndTime = '';
      queueUpdate(updates);
    },
    [card, draftDisplay, queueUpdate],
  );

  if (!card) return null;

  const displayCard = { ...card, ...draftDisplay };
  const typeStyle = getContentTypeStyle(displayCard.contentType);
  const isOneOff = isOneOffProjectCard(displayCard);

  const joinShootSession = (session) => {
    queueUpdate({
      shootDate: session.dateKey,
      shootTime: session.shootTime || '',
      shootEndTime: session.shootEndTime || '',
    });
  };

  const openShootCard = (entry) => {
    if (!onOpenCard || entry.id === card.id) return;
    pendingTabRef.current = 'production';
    onOpenCard(entry);
  };

  const renderShootRosterItem = (entry, { isCurrent = entry.id === card.id } = {}) => {
    const entryStyle = getContentTypeStyle(entry.contentType);
    const canOpen = !isCurrent && onOpenCard;

    return (
      <li key={entry.id}>
        <button
          type="button"
          onClick={() => openShootCard(entry)}
          disabled={!canOpen}
          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
            isCurrent
              ? 'cursor-default border-[#810100]/40 bg-[#810100]/10'
              : canOpen
                ? 'cursor-pointer border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.06]'
                : 'cursor-default border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{entry.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                <span className={entryStyle.label}>{entry.contentType}</span>
                {entry.shootTime ? ` · ${formatTime(entry.shootTime)}` : ''}
                {isCurrent ? ' · this card' : canOpen ? ' · click to open' : ''}
              </p>
            </div>
            {canOpen && (
              <span className="shrink-0 text-xs font-medium text-[#fca5a5]">Open →</span>
            )}
          </div>
        </button>
      </li>
    );
  };

  const handleChange = (field, value) => {
    if (field === 'contentType' && value === 'One-off Project') {
      queueUpdate({
        contentType: value,
        isOneOffProject: true,
        shootDate: '',
        shootTime: '',
        shootEndTime: '',
        shootModels: '',
        shootNeeds: '',
        dueTime: '',
        storyRecurrenceDays: [],
        storyEndDate: '',
        storyOccurrenceNotes: {},
      });
      return;
    }
    if (field === 'contentType' && value === 'Story') {
      queueUpdate({
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
      queueUpdate({
        contentType: value,
        isOneOffProject: false,
        storyRecurrenceDays: [],
        storyEndDate: '',
        storyOccurrenceNotes: {},
      });
      return;
    }
    if (field === 'client') {
      queueUpdate({
        client: value,
        accountManager: getClientAccountManager(value) || displayCard.accountManager || '',
        contentCreator: getClientVideographer?.(value) || displayCard.contentCreator || '',
      });
      return;
    }
    if (field === 'notes' && displayCard.occurrenceDate && (hasStoryRecurrence(displayCard) || hasStoryDailyRange(displayCard))) {
      commitNotes(value);
      return;
    }
    if (field === 'shootTime') {
      const updates = { shootTime: value };
      const start = parseTimeToMinutes(value);
      const end = parseTimeToMinutes(displayCard.shootEndTime);
      if (start != null && (end == null || end <= start)) {
        updates.shootEndTime = getDefaultShootEndTime(value, displayCard.contentType);
      }
      if (!value) updates.shootEndTime = '';
      queueUpdate(updates);
      return;
    }
    queueUpdate({ [field]: value });
  };

  const recurrenceDays = parseRecurrenceDays(displayCard.storyRecurrenceDays);
  const storyRecurrenceMode = getStoryScheduleMode(displayCard);
  const occurrenceLabel = displayCard.occurrenceDate
    ? new Date(`${displayCard.occurrenceDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const showShootPlanning = needsShootSchedule(displayCard.contentType) && displayCard.shootDate;
  const tabClass = (id) =>
    `px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition ${
      activeTab === id ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        mouseDownOnOverlayRef.current = e.target === overlayRef.current;
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current && mouseDownOnOverlayRef.current) handleDone();
      }}
    >
      <div
        className="my-4 flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        style={{ borderTopColor: typeStyle.border, borderTopWidth: '3px' }}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/5 px-5 py-4">
          <div>
            {onMoveCard ? (
              <select
                value={displayCard.columnId}
                onChange={(e) => onMoveCard(card.id, e.target.value)}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider text-gray-300 outline-none transition hover:border-white/20 focus:border-[#810100]/50"
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {card.status}
              </p>
            )}
            <h2 className="mt-1 text-lg font-semibold text-white">
              {isOneOff ? 'Edit one-off project' : 'Edit Card'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDone}
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
            <DebouncedField
              {...SAVE_ON_CLOSE}
              resetKey={card.id}
              value={displayCard.title}
              onCommit={(value) => commitTextField('title', value)}
              className={inputClass}
            />
          </Field>


          <Field label="Video File Link">
            <DebouncedField
              {...SAVE_ON_CLOSE}
              resetKey={card.id}
              type="text"
              value={displayCard.dropboxLink}
              onCommit={(value) => commitTextField('dropboxLink', value)}
              placeholder="Paste link to video file (Dropbox, Google Drive, Vimeo, WeTransfer…)"
              className={inputClass}
            />
            {displayCard.dropboxLink?.trim() ? (
              <a
                href={displayCard.dropboxLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block truncate text-xs text-[#dc2626] hover:text-[#fca5a5]"
              >
                Open file →
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                When set, clicking the card title on the board opens this link.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              {isOneOff ? (
                <ClientNameInput
                  value={displayCard.client}
                  onChange={(e) => handleChange('client', e.target.value)}
                  clients={clients}
                  inputClass={inputClass}
                />
              ) : (
                <select
                  value={displayCard.client}
                  onChange={(e) => handleChange('client', e.target.value)}
                  className={inputClass}
                >
                  {clients.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Content Type">
              {isOneOff ? (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-violet-200">
                  One-off Project
                </p>
              ) : (
                <select
                  value={displayCard.contentType}
                  onChange={(e) => handleChange('contentType', e.target.value)}
                  className={inputClass}
                >
                  {CONTENT_TYPES.filter((t) => t !== 'Story' || displayCard.contentType === 'Story').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {!isOneOff && displayCard.contentType === 'Reel' && (
            <Field label="Editor points">
              <select
                value={String(normalizeEditorPoints(displayCard.editorPoints))}
                onChange={(e) => handleChange('editorPoints', Number(e.target.value))}
                className={inputClass}
              >
                {EDITOR_POINT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-white/35">
                1 point = regular reel · ½ point = short / quick edit. Used for payroll and client reel quotas.
              </p>
            </Field>
          )}

          {!isOneOff && contentCreators.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Content creator">
                <select
                  value={displayCard.contentCreator || ''}
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
                  value={displayCard.assignedTo}
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
                value={displayCard.assignedTo}
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
              value={displayCard.accountManager || getClientAccountManager(displayCard.client) || ''}
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

          <Field label={displayCard.occurrenceDate && (hasStoryRecurrence(displayCard) || hasStoryDailyRange(displayCard)) ? `Notes (${occurrenceLabel})` : 'Notes'}>
            <DebouncedField
              {...SAVE_ON_CLOSE}
              resetKey={`${card.id}:${card.occurrenceDate || ''}`}
              as="textarea"
              value={notesValue}
              onCommit={commitNotes}
              rows={4}
              placeholder="Add notes..."
              className={`${inputClass} resize-y`}
            />
          </Field>

          {showCalendarClientNote && (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                Client calendar note
              </p>
              <CalendarSheetNoteEditor
                key={`${card.id}-${card.occurrenceDate || ''}-${calendarClientNote}`}
                initialNote={calendarClientNote}
                readOnly
                onDelete={() => {
                  onUpdate(
                    card.id,
                    buildCalendarNoteDeletePatch(card, { occurrenceDate: card.occurrenceDate }),
                  );
                }}
              />
            </div>
          )}

          {card.clientComment && !showCalendarClientNote && (
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
            <span {...contentTypeLabelProps(typeStyle, 'text-xs font-medium')}>{card.contentType}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{PLATFORM_ICON} {PLATFORM}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{card.client}</span>
          </div>
            </>
          )}

          {activeTab === 'production' && !isOneOff && (
            <>
          {card.columnId === 'shoot' && onReturnToVault && canReturnCardToVault(card) && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/90">
                Bank
              </p>
              <p className="mt-1 text-sm text-violet-100/80">
                Not filming this yet? Send it back to the bank and schedule again later.
              </p>
              <button
                type="button"
                onClick={() => onReturnToVault(card)}
                className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
              >
                Return to bank
              </button>
            </div>
          )}

          {!isOneOff && needsShootSchedule(card.contentType) && (
            <Field label="Shoot date">
              <div className="space-y-3">
                {card.shootDate ? (
                  <p className="text-sm text-white">
                    {formatDate(card.shootDate)}
                    {card.shootTime ? ` · ${formatTime(card.shootTime)}` : ''}
                    {card.shootEndTime ? ` – ${formatTime(card.shootEndTime)}` : ''}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">No shoot date set yet.</p>
                )}
                {onPlanShootDate && (
                  <button
                    type="button"
                    onClick={() => onPlanShootDate(card)}
                    className={`${btnPrimaryClass} w-full py-2.5 text-sm normal-case tracking-normal`}
                  >
                    {card.shootDate ? 'Change on calendar' : 'Pick on calendar'}
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  Pick a day on the calendar, or join an existing shoot below.
                </p>
              </div>
            </Field>
          )}

          {!card.shootDate && upcomingShoots.length > 0 && needsShootSchedule(card.contentType) && (
            <div className="rounded-lg border border-[#810100]/20 bg-[#810100]/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#fca5a5]">
                Join an existing {card.client} shoot
              </p>
              <ul className="space-y-2">
                {upcomingShoots.map((session) => (
                  <li
                    key={session.dateKey}
                    className="rounded-lg border border-white/10 bg-[#1a1a1a]/80 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{formatDate(session.dateKey)}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {session.shootTime ? formatTime(session.shootTime) : 'Time TBD'}
                          {session.shootEndTime ? ` – ${formatTime(session.shootEndTime)}` : ''}
                          {session.cardCount > 0
                            ? ` · ${session.cardCount} item${session.cardCount === 1 ? '' : 's'} scheduled`
                            : ' · Shoot planned'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => joinShootSession(session)}
                          className="rounded-lg bg-[#810100] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#a00000]"
                        >
                          Add this card
                        </button>
                        {onAddCardsToShoot && (
                          <button
                            type="button"
                            onClick={() =>
                              onAddCardsToShoot(card.client, session.dateKey, {
                                excludeCardIds: [card.id],
                                shootTime: session.shootTime,
                                shootEndTime: session.shootEndTime,
                              })
                            }
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5"
                          >
                            Add more cards
                          </button>
                        )}
                      </div>
                    </div>
                    {session.cards.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                        {session.cards.map((entry) => renderShootRosterItem(entry))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.shootDate && needsShootSchedule(card.contentType) && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  On this shoot · {formatDate(card.shootDate)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {onReturnToVault && canReturnCardToVault(card) && (
                    <button
                      type="button"
                      onClick={() => onReturnToVault(card)}
                      className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 hover:bg-violet-500/15"
                    >
                      Return to bank
                    </button>
                  )}
                  {onAddCardsToShoot && (
                    <button
                      type="button"
                      onClick={() => {
                        const sessionTime = shootDayCards.find((entry) => entry.shootTime)?.shootTime || card.shootTime || '';
                        const sessionEnd =
                          shootDayCards.find((entry) => entry.shootEndTime)?.shootEndTime || card.shootEndTime || '';
                        onAddCardsToShoot(card.client, card.shootDate, {
                          excludeCardIds: [card.id],
                          shootTime: sessionTime,
                          shootEndTime: sessionEnd,
                        });
                      }}
                      className="rounded-lg border border-[#810100]/30 bg-[#810100]/10 px-2.5 py-1 text-xs font-medium text-[#fca5a5] hover:bg-[#810100]/20"
                    >
                      + Add cards
                    </button>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {shootDayCards.map((entry) => renderShootRosterItem(entry))}
              </ul>
              {shootDayCards.length === 1 && (
                <p className="mt-3 text-xs text-gray-500">
                  Add more reels or posts to this shoot with the button above.
                </p>
              )}
            </div>
          )}

          {showShootPlanning && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Shoot schedule planning
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start time">
                  <DebouncedTimeInput
                    {...SAVE_ON_CLOSE}
                    resetKey={card.id}
                    value={displayCard.shootTime || ''}
                    onCommit={commitShootTime}
                    placeholder="Start time"
                    inputClassName={inputClass}
                  />
                </Field>
                <Field label="End time">
                  <DebouncedTimeInput
                    {...SAVE_ON_CLOSE}
                    resetKey={card.id}
                    value={displayCard.shootEndTime || ''}
                    onCommit={(value) => commitTextField('shootEndTime', value)}
                    placeholder="End time"
                    min={displayCard.shootTime || undefined}
                    inputClassName={inputClass}
                  />
                </Field>
                <Field label="Models / Talent">
                  <DebouncedModelTagInput
                    {...SAVE_ON_CLOSE}
                    resetKey={card.id}
                    value={displayCard.shootModels || ''}
                    onCommit={(value) => commitTextField('shootModels', value)}
                    placeholder="Add model name, press Enter"
                  />
                </Field>
                <Field label="Props & Needs">
                  <DebouncedField
                    {...SAVE_ON_CLOSE}
                    resetKey={card.id}
                    value={displayCard.shootNeeds}
                    onCommit={(value) => commitTextField('shootNeeds', value)}
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
            <>
              <Field label="Shoot date">
                <div className="space-y-3">
                  <DateInput
                    value={displayCard.shootDate || displayCard.dueDate || ''}
                    onChange={(e) => handleChange('shootDate', e.target.value)}
                    placeholder="Select shoot date"
                    inputClassName={inputClass}
                  />
                  {onPlanShootDate && (
                    <button
                      type="button"
                      onClick={() => onPlanShootDate(card)}
                      className={`${btnPrimaryClass} w-full py-2.5 text-sm normal-case tracking-normal`}
                    >
                      {card.shootDate || card.dueDate ? 'Change on calendar' : 'Pick on calendar'}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">
                    Production shoot date — stays in sync with the due date on the Schedule tab.
                  </p>
                </div>
              </Field>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Shoot time
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Start time">
                    <DebouncedTimeInput
                      {...SAVE_ON_CLOSE}
                      resetKey={card.id}
                      value={displayCard.shootTime || displayCard.dueTime || ''}
                      onCommit={commitShootTime}
                      placeholder="Start time"
                      inputClassName={inputClass}
                    />
                  </Field>
                  <Field label="End time">
                    <DebouncedTimeInput
                      {...SAVE_ON_CLOSE}
                      resetKey={card.id}
                      value={displayCard.shootEndTime || ''}
                      onCommit={(value) => commitTextField('shootEndTime', value)}
                      placeholder="End time"
                      min={displayCard.shootTime || displayCard.dueTime || undefined}
                      inputClassName={inputClass}
                    />
                  </Field>
                </div>
              </div>

              {contentCreators.length > 0 && (
                <Field label="Content creator">
                  <select
                    value={displayCard.contentCreator || ''}
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
              )}
            </>
          )}

          {activeTab === 'schedule' && (
            <>
          {isOneOff ? (
            <div className="space-y-4">
              <Field label="Due date">
                <DateInput
                  value={displayCard.dueDate || displayCard.shootDate || ''}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  placeholder="Select due date"
                  inputClassName={inputClass}
                />
              </Field>
              <Field label="Due time">
                <DebouncedTimeInput
                  {...SAVE_ON_CLOSE}
                  resetKey={card.id}
                  value={displayCard.dueTime || displayCard.shootTime || ''}
                  onCommit={(value) => commitTextField('dueTime', value)}
                  placeholder="Select time"
                  inputClassName={inputClass}
                />
              </Field>
              <p className="text-xs text-gray-500">
                When this one-off project should be completed. Syncs with the shoot date on the Production tab.
              </p>
            </div>
          ) : isScheduledPostType(card.contentType) ? (
            <div className="space-y-4">
              <Field label="Plan date">
                <div className="space-y-3">
                  {card.dueDate ? (
                    <p className="text-sm text-white">
                      {formatScheduledDateTime(card.dueDate, card.dueTime)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">No plan date set yet.</p>
                  )}
                  {onPlanPostDate && (
                    <button
                      type="button"
                      onClick={() => onPlanPostDate(card)}
                      className={`${btnPrimaryClass} w-full py-2.5 text-sm normal-case tracking-normal`}
                    >
                      {card.dueDate ? 'Change on calendar' : 'Pick on calendar'}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">
                    Opens {card.client}&apos;s content calendar with all scheduled posts so you can pick a date and time.
                  </p>
                </div>
              </Field>
              <Field label={displayCard.columnId === 'scheduled' ? 'Scheduled time' : 'Plan time'}>
                <DebouncedTimeInput
                  {...SAVE_ON_CLOSE}
                  resetKey={card.id}
                  value={displayCard.dueTime || ''}
                  onCommit={(value) => commitTextField('dueTime', value)}
                  placeholder="Select time"
                  inputClassName={inputClass}
                />
              </Field>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plan date">
              <DateInput
                value={displayCard.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                placeholder="Select date"
                inputClassName={inputClass}
              />
            </Field>
            <Field label={displayCard.columnId === 'scheduled' ? 'Scheduled Time' : 'Plan time'}>
              <DebouncedTimeInput
                {...SAVE_ON_CLOSE}
                resetKey={card.id}
                value={displayCard.dueTime || ''}
                onCommit={(value) => commitTextField('dueTime', value)}
                placeholder="Select time"
                inputClassName={inputClass}
              />
            </Field>
          </div>
          )}

          {!isOneOff && displayCard.contentType === 'Story' && ['scheduled', 'editing', 'in-review', 'approved'].includes(displayCard.columnId) && (
            <StoryRecurrencePicker
              mode={storyRecurrenceMode}
              onModeChange={(mode) => {
                if (mode === 'once') {
                  queueUpdate({ storyRecurrenceDays: [], storyEndDate: '' });
                } else if (mode === 'daily') {
                  queueUpdate({ storyRecurrenceDays: [] });
                } else if (mode === 'weekly') {
                  queueUpdate({
                    storyEndDate: '',
                    storyRecurrenceDays: recurrenceDays.length ? recurrenceDays : [1],
                  });
                }
              }}
              days={recurrenceDays}
              onDaysChange={(days) => queueUpdate({ storyRecurrenceDays: days, storyEndDate: '' })}
              startDate={displayCard.dueDate}
              onStartDateChange={(dueDate) => handleChange('dueDate', dueDate)}
              endDate={displayCard.storyEndDate || ''}
              onEndDateChange={(storyEndDate) => handleChange('storyEndDate', storyEndDate)}
            />
          )}
            </>
          )}

          {activeTab === 'references' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Reference Music">
              <DebouncedField
                {...SAVE_ON_CLOSE}
                resetKey={card.id}
                type="url"
                value={displayCard.referenceMusic}
                onCommit={(value) => commitTextField('referenceMusic', value)}
                placeholder="Paste Spotify, Apple Music, or other link..."
                className={inputClass}
              />
              {displayCard.referenceMusic?.trim() && (
                <div className="mt-2">
                  <ReferenceMusicLink url={displayCard.referenceMusic} />
                </div>
              )}
            </Field>
            <Field label="Reference Video">
              <DebouncedField
                {...SAVE_ON_CLOSE}
                resetKey={card.id}
                value={displayCard.referenceVideo}
                onCommit={(value) => commitTextField('referenceVideo', value)}
                placeholder="Paste Instagram, TikTok, or YouTube link..."
                className={inputClass}
              />
              {displayCard.referenceVideo?.trim() && (
                <div className="mt-2">
                  <ReferenceVideoLink url={displayCard.referenceVideo} />
                </div>
              )}
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
            onClick={handleDone}
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

export default memo(CardModal);
