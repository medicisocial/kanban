import { filterCards } from '../utils';
import { getToCreateCards } from './videoIdeas';

export function cardIsAssignedToContentCreator(card, staffName) {
  if (!staffName) return true;
  const creator = card.contentCreator?.trim().toLowerCase() || '';
  if (!creator) return true;
  return creator === staffName.trim().toLowerCase();
}

/** Content Creator queue — same shoot cards as Vault → To Create, optionally scoped to a creator. */
export function getToCreateQueueCards(cards, { staffName = '', personalScope = false } = {}) {
  return getToCreateCards(cards).filter((card) => {
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
