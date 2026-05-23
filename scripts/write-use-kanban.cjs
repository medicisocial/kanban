const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'src', 'hooks', 'useKanban.js');

const content = String.raw`import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY, getSampleData, COLUMNS, PLATFORM, TEAM_MEMBERS } from '../constants';
import { toDateKey } from '../utils/calendar';

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
  const columnId = migrateColumnId(card.columnId);
  return {
    ...card,
    platform: PLATFORM,
    columnId,
    status: getStatusForColumn(columnId),
    referenceMusic: card.referenceMusic || '',
    referenceVideo: card.referenceVideo || '',
    dropboxLink: card.dropboxLink || '',
    shootDate: card.shootDate || '',
    shootTime: card.shootTime || '',
    shootDuration: card.shootDuration || 45,
    shootModels: card.shootModels || '',
    shootNeeds: card.shootNeeds || '',
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

function withScheduledDate(columnId, dueDate) {
  if (columnId === 'scheduled' && !dueDate) {
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
        dueDate: withScheduledDate(columnId, ''),
        shootDate: '',
        shootTime: '',
        shootDuration: 45,
        shootModels: '',
        shootNeeds: '',
        assignedTo: TEAM_MEMBERS[0],
        priority: 'Medium',
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
      idea.clientComment ? \`Client feedback: \${idea.clientComment}\` : '',
    ]
      .filter(Boolean)
      .join('\\n\\n');

    const card = {
      id: cardId,
      client: idea.client,
      contentType: idea.contentType || 'Reel',
      platform: PLATFORM,
      title: idea.title,
      dueDate: '',
      shootDate: '',
      shootTime: '',
      shootDuration: 45,
      shootModels: '',
      shootNeeds: '',
      assignedTo: TEAM_MEMBERS[0],
      priority: 'Medium',
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
        const nextDueDate = withScheduledDate(
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
          dueDate: withScheduledDate(targetColumnId, card.dueDate),
        };
      }),
    );
  }, []);

  return { cards, addCard, createCardFromIdea, updateCard, deleteCard, moveCard };
}
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Wrote', target);
