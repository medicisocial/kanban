import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY, COLUMNS, PLATFORM, createCard, EDITOR_TODO_STORAGE_KEY, isScheduledPostType, isOneOffProjectCard, syncOneOffScheduleFields } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { initialSyncCollectionState, shouldPersistSyncedState } from '../lib/syncInitialState';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';
import { markPendingRemoved } from '../lib/syncHelpers';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

function persistCardRecord(card) {
  if (!SUPABASE_ENABLED || !card) return;
  void pushStaffSyncRecords('cards', [card]);
}

function persistCardDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  markPendingRemoved(getOrgId(), 'cards', [id]);
  void pushStaffSync({ table: 'cards', changed: [], removed: [id] });
}

const getCardId = (card) => card.id;
import { getDefaultAssigneeForRole } from '../utils/teamMembers';
import {
  toDateKey,
  parseRecurrenceDays,
  parseStoryOccurrenceNotes,
  parseStoryPostedDates,
  shouldArchiveStoryAfterPost,
} from '../utils/calendar';

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
    contentCreator: card.contentCreator || '',
    storyRecurrenceDays: parseRecurrenceDays(card.storyRecurrenceDays),
    storyEndDate: card.storyEndDate || '',
    storyOccurrenceNotes: parseStoryOccurrenceNotes(card.storyOccurrenceNotes),
    storyPostedDates: parseStoryPostedDates(card.storyPostedDates),
    accountManager: card.accountManager || '',
    postedAt,
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
  const [cards, setCards] = useState(() => initialSyncCollectionState(loadCards));

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

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(STORAGE_KEY, cards);
  }, [cards, syncLoaded]);

  const replaceCards = useCallback((next) => {
    const normalized = next.map(normalizeCard);
    setCards(normalized);
    if (SUPABASE_ENABLED && normalized.length) {
      void pushStaffSyncRecords('cards', normalized);
    }
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
    persistCardRecord(card);
    return card;
  }, []);

  const createCardFromIdea = useCallback((idea) => {
    notifyMutation();
    let resolvedId = idea.boardCardId || `from-idea-${idea.id}`;
    let persisted = null;

    setCards((prev) => {
      const existing =
        prev.find((card) => card.sourceIdeaId === idea.id) ||
        prev.find((card) => card.id === resolvedId);
      if (existing) {
        resolvedId = existing.id;
        return prev;
      }

      const notes = [
        idea.description,
        idea.clientComment ? `Client feedback: ${idea.clientComment}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      persisted = normalizeCard({
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
        shootScript: '',
        contentCreator: getDefaultAssigneeForRole('Content Creator'),
        assignedTo: getDefaultAssigneeForRole('Editor'),
        notes,
        referenceMusic: '',
        referenceVideo: idea.referenceVideo || '',
        dropboxLink: '',
        clientComment: '',
        sourceIdeaId: idea.id,
        status: getStatusForColumn('shoot'),
        columnId: 'shoot',
        createdAt: Date.now(),
      });

      return [...prev, persisted];
    });

    if (persisted) persistCardRecord(persisted);
    return resolvedId;
  }, []);

  const updateCard = useCallback((id, updates) => {
    notifyMutation();
    let persisted = null;
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const synced = syncOneOffScheduleFields(updates, card);
        const nextColumnId = synced.columnId ?? card.columnId;
        const isOneOff = synced.isOneOffProject ?? isOneOffProjectCard({ ...card, ...synced });
        const nextDueDate = withColumnDate(
          nextColumnId,
          synced.dueDate !== undefined ? synced.dueDate : card.dueDate,
          { isOneOffProject: isOneOff, contentType: synced.contentType ?? card.contentType },
        );
        persisted = normalizeCard({
          ...card,
          ...synced,
          dueDate: nextDueDate,
          isOneOffProject: isOneOff,
          platform: PLATFORM,
          updatedAt: Date.now(),
        });
        return persisted;
      }),
    );
    if (persisted) persistCardRecord(persisted);
  }, []);

  const deleteCard = useCallback((id) => {
    notifyMutation();
    persistCardDelete(id);
    setCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  const moveCard = useCallback((cardId, targetColumnId) => {
    notifyMutation();
    let persisted = null;
    const status = getStatusForColumn(targetColumnId);
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        if (!canMoveCardToColumn(card, targetColumnId)) return card;
        persisted = normalizeCard({
          ...card,
          columnId: targetColumnId,
          status,
          dueDate: withColumnDate(targetColumnId, card.dueDate, {
            isOneOffProject: card.isOneOffProject,
            contentType: card.contentType,
          }),
          updatedAt: Date.now(),
        });
        return persisted;
      }),
    );
    if (persisted) persistCardRecord(persisted);
  }, []);

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
    if (persisted) persistCardRecord(persisted);
  }, []);

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
    persistCardRecord(card);
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
