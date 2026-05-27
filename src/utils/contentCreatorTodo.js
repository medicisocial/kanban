import { filterCards, getBoardCards } from '../utils';
import { cardIsAssignedToStaff } from './staffMembers';

export function buildContentCreatorTasks(cards, { client, staffName, clientAccountManagers }) {
  const boardCards = getBoardCards(cards).filter((card) => card.columnId === 'shoot');
  const filtered = filterCards(boardCards, { client }).filter((card) =>
    cardIsAssignedToStaff(card, staffName, clientAccountManagers),
  );

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
