import { getLogoSrc } from './clientLogo';
import { clientMatchesBrand } from './clients';

function hasSocialLogins(socialLogins) {
  if (!socialLogins || typeof socialLogins !== 'object') return false;
  return Object.values(socialLogins).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Boolean(entry.username?.trim() || entry.password?.trim());
  });
}

export function buildClientPortalTasks({
  brand,
  ideas = [],
  cards = [],
  contacts = [],
  socialLogins = {},
  clientLogo = '',
}) {
  const pendingIdeas = ideas.filter(
    (idea) => clientMatchesBrand(idea.client, brand) && idea.status === 'pending',
  );
  const reviewCards = cards.filter(
    (card) => clientMatchesBrand(card.client, brand) && card.columnId === 'in-review',
  );

  const setupTasks = [];

  if (!contacts.some((entry) => entry.name?.trim())) {
    setupTasks.push({
      id: 'contact',
      label: 'Add a primary contact',
      detail: 'So your team knows who to reach on shoot days.',
      tab: 'profile',
    });
  }

  if (!getLogoSrc(clientLogo)) {
    setupTasks.push({
      id: 'logo',
      label: 'Upload your brand photo',
      detail: 'Shows in your portal sidebar and shared links.',
      tab: 'profile',
    });
  }

  if (!hasSocialLogins(socialLogins)) {
    setupTasks.push({
      id: 'social',
      label: 'Add social platform logins',
      detail: 'Share credentials your production team may need.',
      tab: 'profile',
    });
  }

  const actionItems = [
    ...pendingIdeas.map((idea) => ({
      id: `idea-${idea.id}`,
      kind: 'idea',
      tab: 'ideas',
      title: idea.title || 'Untitled idea',
      detail: 'Review and approve or decline this concept.',
      meta: idea.contentType || 'Idea',
    })),
    ...reviewCards.map((card) => ({
      id: `review-${card.id}`,
      kind: 'review',
      tab: 'review',
      title: card.title || 'Untitled content',
      detail: 'Approve for scheduling or send revision notes.',
      meta: card.contentType || 'Content',
    })),
  ];

  return {
    pendingIdeasCount: pendingIdeas.length,
    reviewCount: reviewCards.length,
    setupCount: setupTasks.length,
    setupTasks,
    actionItems,
    totalOpen: pendingIdeas.length + reviewCards.length + setupTasks.length,
  };
}
