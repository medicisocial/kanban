import { MEDICI_SENDER_NAME, MEDICI_SENDER_EMAIL } from '../constants';

const EMAIL_COPY = {
  ideas: {
    subject: (client) => `Video ideas ready for review — ${client}`,
    intro: (client) =>
      `Hi ${client} team,\n\nYour pending video ideas are ready for review. Open the link below to approve ideas or pass on them.`,
  },
  content: {
    subject: (client) => `Content ready for review — ${client}`,
    intro: (client) =>
      `Hi ${client} team,\n\nContent is ready for your review. Open the link below to approve or request changes.`,
  },
  calendar: {
    subject: (client) => `Your content calendar — ${client}`,
    intro: (client) =>
      `Hi ${client} team,\n\nYour scheduled content calendar is ready to view.`,
  },
  shoot: {
    subject: (client) => `Shoot schedule planning — ${client}`,
    intro: (client) =>
      `Hi ${client} team,\n\nPlease review your shoot schedule and add times, models, and needs for each item.`,
  },
};

export function buildShareEmailContent(type, client, url) {
  const copy = EMAIL_COPY[type] || EMAIL_COPY.ideas;
  const subject = copy.subject(client);
  const text = `${copy.intro(client)}\n\n${url}\n\n— ${MEDICI_SENDER_NAME}\n${MEDICI_SENDER_EMAIL}`;
  return { subject, text };
}

export function openClientShareEmail({ to, type, client, url }) {
  const { subject, text } = buildShareEmailContent(type, client, url);
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

export function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}
