import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY, getSampleData, COLUMNS, PLATFORM, TEAM_MEMBERS, createCard } from '../constants';
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
};

function getStatusForColumn(columnId) {
  const col = COLUMNS.find((c) => c.id === columnId);
  return col ? col.title : columnId;
}

function migrateColumnId(columnId) {
  return LEGACY_COLUMN_MAP[columnId] || columnId;
}

function normalizeCard(card) {
  const columnId = migrateColumnId(card.columnId);
  return {
    ...card,
    platform: PLATFORM,
    columnId,
    status: getStatusForColumn(columnId),
    referenceMusic: card.referenceMusic || '',
    referenceVideo: card.referenceVideo || '',
    dropboxLink: card.dropboxLink || '',
    dueTime: card.dueTime || '',
    shootDate: card.shootDate || '',
    shootTime: card.shootTime || '',
    shootDuration: card.shootDuration || 45,
    shootModels: card.shootModels || '',
    shootNeeds: card.shootNeeds || '',
    shootScript: card.shootScript || '',
    storyRecurrenceDays: parseRecurrenceDays(card.storyRecurrenceDays),
    storyEndDate: card.storyEndDate || '',
    storyOccurrenceNotes: parseStoryOccurrenceNotes(card.storyOccurrenceNotes),
    storyPostedDates: parseStoryPostedDates(card.storyPostedDates),
    accountManager: card.accountManager || '',
    postedAt: card.postedAt || null,
    clientComment: card.clientComment || '',
    sourceIdeaId: card.sourceIdeaId || null,
  };
}

function loadCards() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeCard);
      }
    }
  } catch {
    /* fall through to sample data */
  }
  return getSampleData();
}

function withColumnDate(columnId, dueDate) {
  if ((columnId === 'scheduled' || columnId === 'editing') && !dueDate) {
    return toDateKey(new Date());
  }
  return dueDate;
}

export function useKanban() {
  const [cards, setCards] = useState(loadCards);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const addCard = useCallback((columnId) => {
    const status = getStatusForColumn(columnId);
    setCards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        client: 'Plume',
        contentType: 'Reel',
        platform: PLATFORM,
        title: 'New task',
        dueDate: withColumnDate(columnId, ''),
        dueTime: '',
        shootDate: '',
        shootTime: '',
        shootDuration: 45,
        shootModels: '',
        shootNeeds: '',
        shootScript: '',
        assignedTo: TEAM_MEMBERS[0],
        notes: '',
        referenceMusic: '',
        referenceVideo: '',
        dropboxLink: '',
        clientComment: '',
        sourceIdeaId: null,
        status,
        columnId,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const createCardFromIdea = useCallback((idea) => {
    const cardId = crypto.randomUUID();
    const notes = [
      idea.description,
      idea.clientComment ? `Client feedback: ${idea.clientComment}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const card = {
      id: cardId,
      client: idea.client,
      contentType: idea.contentType || 'Reel',
      platform: PLATFORM,
      title: idea.title,
      dueDate: '',
      dueTime: '',
      shootDate: '',
      shootTime: '',
      shootDuration: 45,
      shootModels: '',
      shootNeeds: '',
      shootScript: '',
      assignedTo: TEAM_MEMBERS[0],
      notes,
      referenceMusic: '',
      referenceVideo: idea.referenceVideo || '',
      dropboxLink: '',
      clientComment: '',
      sourceIdeaId: idea.id,
      status: 'To Shoot',
      columnId: 'shoot',
      createdAt: Date.now(),
    };

    setCards((prev) => [...prev, card]);
    return cardId;
  }, []);

  const updateCard = useCallback((id, updates) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const nextColumnId = updates.columnId ?? card.columnId;
        const nextDueDate = withColumnDate(
          nextColumnId,
          updates.dueDate !== undefined ? updates.dueDate : card.dueDate,
        );
        return {
          ...card,
          ...updates,
          dueDate: nextDueDate,
          platform: PLATFORM,
        };
      }),
    );
  }, []);

  const deleteCard = useCallback((id) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  const moveCard = useCallback((cardId, targetColumnId) => {
    const status = getStatusForColumn(targetColumnId);
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        return {
          ...card,
          columnId: targetColumnId,
          status,
          dueDate: withColumnDate(targetColumnId, card.dueDate),
        };
      }),
    );
  }, []);

  const markAsPosted = useCallback((cardId, occurrenceDate) => {
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
            updates.columnId = 'posted';
            updates.status = 'Posted';
            updates.postedAt = Date.now();
          }

          return { ...card, ...updates };
        }

        return {
          ...card,
          columnId: 'posted',
          status: 'Posted',
          postedAt: Date.now(),
        };
      }),
    );
  }, []);

  const addCardWithDetails = useCallback((overrides = {}) => {
    const columnId = overrides.columnId || 'shoot';
    const card = createCard({
      ...overrides,
      columnId,
      status: overrides.status || getStatusForColumn(columnId),
      dueDate: withColumnDate(columnId, overrides.dueDate ?? ''),
    });
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

  const addShootItem = useCallback(({ client, title, contentType, shootDate, shootTime = '' }) => {
    const isStory = contentType === 'Story';
    return addCardWithDetails({
      client,
      title,
      contentType,
      shootDate: isStory ? '' : shootDate,
      shootTime: isStory ? '' : shootTime,
      columnId: 'shoot',
      status: 'To Shoot',
    });
  }, [addCardWithDetails]);

  return {
    cards,
    addCard,
    addCardWithDetails,
    addCalendarPost,
    addShootItem,
    createCardFromIdea,
    updateCard,
    deleteCard,
    moveCard,
    markAsPosted,
  };
}
