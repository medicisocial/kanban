import { filterCards, getBoardCards } from '../utils';

export function cardIsAssignedToContentCreator(card, staffName) {
  if (!staffName) return true;
  const creator = card.contentCreator?.trim().toLowerCase() || '';
  if (!creator) return true;
  return creator === staffName.trim().toLowerCase();
}

export function getToCreateQueueCards(cards, { staffName = '', personalScope = false } = {}) {
  return getBoardCards(cards).filter((card) => {
    if (card.columnId !== 'shoot') return false;
    if (personalScope && staffName) {
      return cardIsAssignedToContentCreator(card, staffName);
    }
    return true;
  });
}

export function buildContentCreatorTasks(cards, { client, staffName = '' } = {}) {
  const filtered = filterCards(getToCreateQueueCards(cards, { staffName, personalScope: Boolean(staffName) }), {
    client,
  });

  return filtered
    .map((card) => ({
      id: card.id,
      title: card.title,
      client: card.client,
      contentType: card.contentType,
      shootDate: card.shootDate || '',
      shootTime: card.shootTime || '',
      contentCreator: card.contentCreator || '',
      assignedTo: card.assignedTo || '',
      card,
    }))
    .sort((a, b) => {
      const dateA = a.shootDate || '9999';
      const dateB = b.shootDate || '9999';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.shootTime || '').localeCompare(b.shootTime || '');
    });
}
