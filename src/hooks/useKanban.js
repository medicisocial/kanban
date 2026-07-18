import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { STORAGE_KEY, COLUMNS, PLATFORM, createCard, EDITOR_TODO_STORAGE_KEY, isScheduledPostType, isOneOffProjectCard, syncOneOffScheduleFields, normalizeEditorPoints } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { useCollectionSync } from '../lib/useCollectionSync';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';
import { pushStaffSyncRecords } from '../lib/staffSyncApi';
import { markRecentlyPushed } from '../lib/syncEchoGuard';
import { reportSyncIssue } from '../lib/workspaceSyncHealth';
import { applyVaultIdeaShootSchedule, withPipelineRegressionAuthorization } from '../utils/cardPipelineMerge';
import { resolveShootScriptsFromIdea } from '../utils/videoIdeas';
import { normalizeCaptionMode, normalizePostSlides } from '../utils/postSlides';

const getCardId = (card) => card.id;
import { getDefaultAssigneeForRole } from '../utils/teamMembers';
import { buildEditorCompletionStampUpdates } from '../utils/editorTodo';
import { findCardsDueForAutoPost } from '../utils/scheduleTime';
import {
  toDateKey,
  parseRecurrenceDays,
  parseStoryOccurrenceNotes,
  parseStoryPostedDates,
  shouldArchiveStoryAfterPost,
} from '../utils/calendar';

const AUTO_POST_INTERVAL_MS = 60_000;

const LEGACY_COLUMN_MAP = {
  briefing: 'shoot',
  'in-production': 'editing',
  scheduled: 'scheduled',
  posted: 'scheduled',
};

function getStatusForColumn(columnId) {
  const col = COLUMNS.find((c) => c.id === columnId);
  return col ? col.title : columnId;
}

function migrateColumnId(columnId) {
  return LEGACY_COLUMN_MAP[columnId] || columnId;
}

function normalizeCard(card) {
  const rawColumnId = card.columnId;
  const columnId = migrateColumnId(rawColumnId);
  const isOneOffProject =
    Boolean(card.isOneOffProject) || card.contentType === 'One-off Project';
  const resolvedColumnId =
    isOneOffProject && columnId === 'not-approved' ? 'editing' : columnId;
  const postedAt =
    card.postedAt || (rawColumnId === 'posted' ? Date.now() : null);
  const shootDate = card.shootDate || '';
  const shootTime = card.shootTime || '';
  let dueDate = card.dueDate || '';
  let dueTime = card.dueTime || '';
  if (isOneOffProject) {
    if (shootDate && !dueDate) dueDate = shootDate;
    if (shootTime && !dueTime) dueTime = shootTime;
  }
  return {
    ...card,
    platform: PLATFORM,
    columnId: resolvedColumnId,
    status: getStatusForColumn(resolvedColumnId),
    referenceMusic: card.referenceMusic || '',
    referenceVideo: card.referenceVideo || '',
    dropboxLink: card.dropboxLink || '',
    dueTime,
    shootDate,
    shootTime,
    shootEndTime: card.shootEndTime || '',
    shootDuration: card.shootDuration || 45,
    shootModels: card.shootModels || '',
    shootNeeds: card.shootNeeds || '',
    shootScript: card.shootScript || '',
    shootScriptHook: card.shootScriptHook || '',
    shootScriptBody: card.shootScriptBody || '',
    shootTextOverlays: card.shootTextOverlays || '',
    caption: card.caption || '',
    captionMode: normalizeCaptionMode(card.captionMode, card.contentType),
    postSlides: normalizePostSlides(card.postSlides, card.contentType, {
      fallbackDescription: card.shootScriptBody || card.shootScript || '',
      fallbackTextOverlay: card.shootTextOverlays || '',
    }),
    contentCreator: card.contentCreator || '',
    storyRecurrenceDays: parseRecurrenceDays(card.storyRecurrenceDays),
    storyEndDate: card.storyEndDate || '',
    storyOccurrenceNotes: parseStoryOccurrenceNotes(card.storyOccurrenceNotes),
    storyPostedDates: parseStoryPostedDates(card.storyPostedDates),
    accountManager: card.accountManager || '',
    postedAt,
    editorCompletedAt: card.editorCompletedAt || null,
    editorPoints: normalizeEditorPoints(card.editorPoints),
    clientComment: card.clientComment || '',
    sourceIdeaId: card.sourceIdeaId || null,
    dueDate,
    isOneOffProject,
    updatedAt: card.updatedAt || card.createdAt || 0,
  };
}

function migrateLegacyOneOffTasks(cards) {
  try {
    const stored = localStorage.getItem(EDITOR_TODO_STORAGE_KEY);
    if (stored === null) return cards;

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(EDITOR_TODO_STORAGE_KEY);
      return cards;
    }

    const migrated = parsed.map((task) =>
      normalizeCard(
        createCard({
          id: task.id,
          client: task.projectName || 'Plume',
          title: task.title || 'One-off project',
          notes: task.description || '',
          dueDate: task.dueDate || '',
          assignedTo: task.assignedTo || getDefaultAssigneeForRole('Editor'),
          contentType: 'One-off Project',
          isOneOffProject: true,
          columnId: task.completed ? 'finished' : 'editing',
          createdAt: task.createdAt || Date.now(),
        }),
      ),
    );

    localStorage.removeItem(EDITOR_TODO_STORAGE_KEY);
    return [...cards, ...migrated];
  } catch {
    return cards;
  }
}

function loadCards() {
  try {
    const parsed = readOrgScopedJson(STORAGE_KEY, null);
    if (Array.isArray(parsed)) {
      return migrateLegacyOneOffTasks(parsed.map(normalizeCard));
    }
  } catch {
    /* fall through */
  }
  return migrateLegacyOneOffTasks([]);
}

function withColumnDate(columnId, dueDate, { isOneOffProject = false, contentType = 'Reel' } = {}) {
  if (isOneOffProject) return dueDate || '';
  if (columnId === 'editing' && !dueDate && !isScheduledPostType(contentType)) {
    return toDateKey(new Date());
  }
  return dueDate || '';
}

const ONE_OFF_ALLOWED_COLUMNS = ['shoot', 'editing', 'in-review', 'approved', 'finished'];

function canMoveCardToColumn(card, targetColumnId) {
  if (card.isOneOffProject) {
    return ONE_OFF_ALLOWED_COLUMNS.includes(targetColumnId);
  }
  if (targetColumnId === 'finished') return false;
  return true;
}

export function useKanban() {
  const [cards, setCards] = useState(() =>
    initialSyncCollectionState(loadCards, { table: 'cards', getId: getCardId }),
  );
  const cardsRef = useRef(cards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const pushCardNow = useCallback((card) => {
    if (!SUPABASE_ENABLED || !card) return;
    pushStaffSyncRecords('cards', [card])
      .then((ok) => {
        if (ok) {
          markRecentlyPushed('cards', [card.id]);
        } else {
          reportSyncIssue({
            level: 'warn',
            table: 'cards',
            message: 'Card status changed on this device but could not immediately reach the cloud.',
          });
        }
      })
      .catch((error) => {
        reportSyncIssue({
          level: 'error',
          table: 'cards',
          message: error?.message || 'Could not immediately save card status to the cloud.',
        });
      });
  }, []);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setCards(loadCards());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'cards',
    items: cards,
    setItems: setCards,
    getId: getCardId,
    normalize: normalizeCard,
    loadLocal: loadCards,
  });

  // Debounce localStorage writes to avoid thrashing during rapid edits (e.g. typing).
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(STORAGE_KEY, cards);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [cards, syncLoaded]);

  const applyAutoPostedCards = useCallback(() => {
    const due = findCardsDueForAutoPost(cardsRef.current);
    if (!due.length) return;
    const stampedAt = Date.now();
    const updated = due
      .filter((card) => !card.postedAt)
      .map((card) => normalizeCard({ ...card, postedAt: stampedAt, updatedAt: stampedAt }));
    if (!updated.length) return;
    const byId = new Map(updated.map((card) => [card.id, card]));
    setCards((prev) => prev.map((card) => byId.get(card.id) || card));
    for (const card of updated) {
      pushCardNow(card);
    }
  }, [pushCardNow]);

  useEffect(() => {
    if (!syncLoaded) return;
    applyAutoPostedCards();
  }, [syncLoaded, applyAutoPostedCards, cards]);

  useEffect(() => {
    if (!syncLoaded) return;
    const timer = setInterval(applyAutoPostedCards, AUTO_POST_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [syncLoaded, applyAutoPostedCards]);

  const replaceCards = useCallback((next) => {
    setCards(next.map(normalizeCard));
  }, []);

  const addCard = useCallback((columnId, { client } = {}) => {
    notifyMutation();
    const status = getStatusForColumn(columnId);
    const card = normalizeCard({
      id: crypto.randomUUID(),
      client: client || 'Plume',
      contentType: 'Reel',
      platform: PLATFORM,
      title: 'New task',
      dueDate: withColumnDate(columnId, '', { contentType: 'Reel' }),
      dueTime: '',
      shootDate: '',
      shootTime: '',
      shootEndTime: '',
      shootDuration: 45,
      shootModels: '',
      shootNeeds: '',
      shootScript: '',
      shootScriptHook: '',
      shootScriptBody: '',
      shootTextOverlays: '',
      contentCreator:
        columnId === 'shoot' ? getDefaultAssigneeForRole('Content Creator') : '',
      assignedTo: getDefaultAssigneeForRole('Editor'),
      notes: '',
      referenceMusic: '',
      referenceVideo: '',
      dropboxLink: '',
      clientComment: '',
      sourceIdeaId: null,
      status,
      columnId,
      createdAt: Date.now(),
    });
    setCards((prev) => [...prev, card]);
    return card;
  }, []);

  const createCardFromIdea = useCallback((idea, schedule = null) => {
    notifyMutation();
    let resolvedId = idea.boardCardId || `from-idea-${idea.id}`;

    const withSchedule = (card, { isNew = false } = {}) =>
      applyVaultIdeaShootSchedule(card, schedule, { isNew });

    setCards((prev) => {
      const existing =
        prev.find((card) => card.sourceIdeaId === idea.id) ||
        prev.find((card) => card.id === resolvedId);
      if (existing) {
        resolvedId = existing.id;
        return prev.map((card) => {
          if (card.id !== resolvedId) return card;
          return normalizeCard(
            withSchedule(
              {
                ...card,
                sourceIdeaId: idea.id,
                // preserve existing structured fields; fill from idea when empty
                ...resolveShootScriptsFromIdea(idea, card),
              },
              { isNew: false },
            ),
          );
        });
      }

      const notes = [
        idea.description,
        idea.clientComment ? `Client feedback: ${idea.clientComment}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const scriptFields = resolveShootScriptsFromIdea(idea);
      const persisted = normalizeCard(
        withSchedule(
          {
          id: resolvedId,
          client: idea.client,
          contentType: idea.contentType || 'Reel',
          platform: PLATFORM,
          title: idea.title,
          dueDate: '',
          dueTime: '',
          shootDate: '',
          shootTime: '',
          shootEndTime: '',
          shootDuration: 45,
          shootModels: '',
          shootNeeds: '',
          // legacy freeform
          shootScript: String(idea.script || '').trim(),
          // structured
          ...scriptFields,
          contentCreator: getDefaultAssigneeForRole('Content Creator'),
          assignedTo: getDefaultAssigneeForRole('Editor'),
          notes,
          referenceMusic: idea.referenceMusic || '',
          referenceVideo: idea.referenceVideo || '',
          dropboxLink: '',
          clientComment: '',
          sourceIdeaId: idea.id,
          columnId: 'shoot',
          createdAt: Date.now(),
        },
          { isNew: true },
        ),
      );

      return [...prev, persisted];
    });

    return resolvedId;
  }, []);

  const updateCard = useCallback((id, updates, { recordUndo = true, immediateSync = false } = {}) => {
    notifyMutation({ recordUndo });
    let persisted = null;
    const applyUpdate = () => {
      setCards((prev) =>
        prev.map((card) => {
          if (card.id !== id) return card;
          const synced = syncOneOffScheduleFields(updates, card);
          const authorized = withPipelineRegressionAuthorization(card, synced);
          const nextColumnId = authorized.columnId ?? card.columnId;
          const isOneOff = authorized.isOneOffProject ?? isOneOffProjectCard({ ...card, ...authorized });
          const nextDueDate = withColumnDate(
            nextColumnId,
            authorized.dueDate !== undefined ? authorized.dueDate : card.dueDate,
            { isOneOffProject: isOneOff, contentType: authorized.contentType ?? card.contentType },
          );
          persisted = normalizeCard({
            ...card,
            ...authorized,
            dueDate: nextDueDate,
            isOneOffProject: isOneOff,
            platform: PLATFORM,
            updatedAt: Date.now(),
          });
          return persisted;
        }),
      );
    };
    if (recordUndo) applyUpdate();
    else startTransition(applyUpdate);
    if (immediateSync) {
      const fallback = cardsRef.current.find((card) => card.id === id);
      pushCardNow(
        persisted ||
          (fallback
            ? normalizeCard({
                ...fallback,
                ...withPipelineRegressionAuthorization(fallback, updates),
                updatedAt: Date.now(),
              })
            : null),
      );
    }
  }, [pushCardNow]);

  const deleteCard = useCallback((id) => {
    notifyMutation();
    tombstoneSyncedDeletes('cards', [id]);
    setCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  const moveCard = useCallback((cardId, targetColumnId) => {
    notifyMutation();
    const status = getStatusForColumn(targetColumnId);
    const current = cardsRef.current.find((card) => card.id === cardId);
    let persisted = null;
    if (current && canMoveCardToColumn(current, targetColumnId)) {
      const completionUpdates = buildEditorCompletionStampUpdates(current, targetColumnId);
      const regressionAuth = withPipelineRegressionAuthorization(current, {
        columnId: targetColumnId,
      });
      persisted = normalizeCard({
        ...current,
        ...completionUpdates,
        ...regressionAuth,
        columnId: targetColumnId,
        status,
        dueDate: withColumnDate(targetColumnId, current.dueDate, {
          isOneOffProject: current.isOneOffProject,
          contentType: current.contentType,
        }),
        updatedAt: Date.now(),
      });
    }
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        if (!canMoveCardToColumn(card, targetColumnId)) return card;
        const completionUpdates = buildEditorCompletionStampUpdates(card, targetColumnId);
        const regressionAuth = withPipelineRegressionAuthorization(card, {
          columnId: targetColumnId,
        });
        return normalizeCard({
          ...card,
          ...completionUpdates,
          ...regressionAuth,
          columnId: targetColumnId,
          status,
          dueDate: withColumnDate(targetColumnId, card.dueDate, {
            isOneOffProject: card.isOneOffProject,
            contentType: card.contentType,
          }),
          updatedAt: Date.now(),
        });
      }),
    );
    pushCardNow(persisted);
  }, [pushCardNow]);

  const markAsPosted = useCallback((cardId, occurrenceDate) => {
    notifyMutation();
    let persisted = null;
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;

        if (card.contentType === 'Story') {
          const dateKey =
            occurrenceDate || card.occurrenceDate || card.dueDate || toDateKey(new Date());
          const storyPostedDates = [
            ...new Set([...parseStoryPostedDates(card.storyPostedDates), dateKey]),
          ];
          const updates = { storyPostedDates };

          if (shouldArchiveStoryAfterPost({ ...card, storyPostedDates }, storyPostedDates)) {
            updates.postedAt = Date.now();
          }

          persisted = normalizeCard({ ...card, ...updates, updatedAt: Date.now() });
          return persisted;
        }

        persisted = normalizeCard({ ...card, postedAt: Date.now(), updatedAt: Date.now() });
        return persisted;
      }),
    );
    pushCardNow(persisted);
  }, [pushCardNow]);

  const addCardWithDetails = useCallback((overrides = {}) => {
    notifyMutation();
    const columnId = overrides.columnId || 'shoot';
    const isOneOff = Boolean(overrides.isOneOffProject);
    const card = normalizeCard(createCard({
      ...overrides,
      columnId,
      status: overrides.status || getStatusForColumn(columnId),
      dueDate: withColumnDate(columnId, overrides.dueDate ?? '', {
        isOneOffProject: isOneOff,
        contentType: overrides.contentType || 'Reel',
      }),
    }));
    setCards((prev) => [...prev, card]);
    return card.id;
  }, []);

  const addCalendarPost = useCallback(({ client, title, contentType, dueDate, dueTime = '', storyRecurrenceDays = [], storyEndDate = '' }) => {
    const recurrence = parseRecurrenceDays(storyRecurrenceDays);
    return addCardWithDetails({
      client,
      title,
      contentType,
      dueDate: recurrence.length ? (dueDate || toDateKey(new Date())) : dueDate,
      dueTime,
      storyRecurrenceDays: recurrence,
      storyEndDate: storyEndDate || '',
      columnId: 'editing',
      status: 'Editing',
    });
  }, [addCardWithDetails]);

  const addShootItem = useCallback(
    ({ client, title, contentType, shootDate, shootTime = '', contentCreator }) => {
      const isStory = contentType === 'Story';
      const isOneOff = contentType === 'One-off Project';
      return addCardWithDetails({
        client,
        title,
        contentType,
        isOneOffProject: isOneOff,
        shootDate: isStory ? '' : shootDate,
        shootTime: isStory ? '' : shootTime,
        dueDate: isOneOff ? shootDate : '',
        dueTime: isOneOff ? shootTime : '',
        contentCreator: contentCreator || getDefaultAssigneeForRole('Content Creator'),
        assignedTo: getDefaultAssigneeForRole('Editor'),
        columnId: 'shoot',
        status: getStatusForColumn('shoot'),
      });
    },
    [addCardWithDetails],
  );

  const addOneOffProject = useCallback(
    ({ client, title, description = '', dueDate = '', assignedTo }) => {
      return addCardWithDetails({
        client,
        title,
        notes: description,
        dueDate,
        assignedTo: assignedTo || getDefaultAssigneeForRole('Editor'),
        contentType: 'One-off Project',
        isOneOffProject: true,
        columnId: 'editing',
        status: 'Editing',
      });
    },
    [addCardWithDetails],
  );

  return {
    cards,
    cardsSyncLoaded: syncLoaded,
    replaceCards,
    addCard,
    addCardWithDetails,
    addOneOffProject,
    addCalendarPost,
    addShootItem,
    createCardFromIdea,
    updateCard,
    deleteCard,
    moveCard,
    markAsPosted,
  };
}
