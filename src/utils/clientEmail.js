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
  const text = `${copy.intro(client)}\n\n${url}\n\n— Medici Social`;
  const html = `
    <p>${copy.intro(client).replace(/\n/g, '<br>')}</p>
    <p><a href="${url}">Open your review link</a></p>
    <p>— Medici Social</p>
  `;
  return { subject, text, html };
}

export function openMailtoEmail(to, subject, body) {
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendClientEmail({ to, subject, text, html }) {
  const headers = { 'Content-Type': 'application/json' };
  const secret = import.meta.env.VITE_EMAIL_API_SECRET;
  if (secret) {
    headers['x-email-secret'] = secret;
  }

  const response = await fetch('/api/send-client-email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, subject, text, html }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error || 'Email could not be sent.', status: response.status };
  }
  return { ok: true, ...data };
}

export async function emailClientShareLink({ client, url, type, getClientEmail }) {
  const to = (getClientEmail(client) || '').trim();
  if (!to) {
    return { ok: false, error: `No email saved for ${client}. Add one under Manage Clients.` };
  }

  const { subject, text, html } = buildShareEmailContent(type, client, url);

  try {
    const result = await sendClientEmail({ to, subject, text, html });
    if (result.ok) {
      return { ok: true, method: 'api', to };
    }
    if (result.status !== 503) {
      return result;
    }
  } catch {
    /* fall through to mailto */
  }

  openMailtoEmail(to, subject, text);
  return { ok: true, method: 'mailto', to };
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}
